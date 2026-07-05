import webpush from "web-push";
import fs from "fs";
import path from "path";
import { getSparks } from "./yahoo";
import { smartSummary } from "./summary";
import { getOverview } from "./overview";

/* Server-side push engine.
   Sends real Web Push notifications so alerts arrive even when the app
   (or the whole phone browser) is closed.

   Storage: on Vercel the filesystem is read-only and process memory dies
   between requests, so subscriptions, VAPID keys and dedupe state live in
   a Redis KV store (Upstash / Vercel KV REST API — set KV_REST_API_URL +
   KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
   Without those env vars it falls back to a local JSON file, which is fine
   for `next dev` / a long-running `next start` but NOT for serverless.

   Scheduling: a long-running server polls every minute by itself; on
   serverless hosts a cron must hit GET /api/push/tick every minute instead
   (see vercel.json and PRODUCTION.md). */

const STORE_FILE = path.join(process.cwd(), ".push-store.json");
const SMART_MIN_GAP = 4 * 60 * 1000;   // don't smart-ping the same stock more than ~every 4 min
const SMART_MIN_MOVE = 0.0005;         // 0.05% price change counts as "updated"

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const hasKV = !!(KV_URL && KV_TOKEN);

async function kv(...cmd) {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function fileDb() {
  try { return JSON.parse(fs.readFileSync(STORE_FILE, "utf8")); } catch { return {}; }
}

async function dbGet(key) {
  if (hasKV) {
    const raw = await kv("GET", key);
    return raw == null ? null : JSON.parse(raw);
  }
  return fileDb()[key] ?? null;
}

async function dbSet(key, value, onlyIfMissing = false) {
  if (hasKV) {
    if (onlyIfMissing) await kv("SET", key, JSON.stringify(value), "NX");
    else await kv("SET", key, JSON.stringify(value));
    return;
  }
  const db = fileDb();
  if (onlyIfMissing && db[key] != null) return;
  db[key] = value;
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(db, null, 2)); } catch {}
}

/* VAPID keys must stay identical across every server instance forever —
   if they change, every existing device subscription becomes undeliverable.
   Order: env vars, then the KV/file store, then generate-once (NX so two
   cold-starting instances can't each mint their own pair). */
async function getVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const g = globalThis;
  if (g.__psVapid) return g.__psVapid;
  let vapid = await dbGet("push:vapid");
  if (!vapid) {
    const fresh = webpush.generateVAPIDKeys();
    await dbSet("push:vapid", fresh, true);
    vapid = (await dbGet("push:vapid")) || fresh;
  }
  g.__psVapid = vapid;
  return vapid;
}

export async function getPublicKey() {
  ensureLoop();
  return (await getVapid()).publicKey;
}

export async function saveSubscription(subscription, config) {
  const subs = (await dbGet("push:subs")) || [];
  const entry = { subscription, config: config || {} };

  /* Alerts the server already fired still exist in the phone's local store
     and come back with every sync — strip them and tell the client which
     ids to drop, or each app-open would re-arm and re-fire the same alert. */
  const st = (await dbGet("push:state")) || {};
  const firedAlerts = st.firedAlerts || {};
  const fired = (entry.config.alerts || []).filter((a) => firedAlerts[a.id]).map((a) => a.id);
  if (fired.length) {
    entry.config.alerts = entry.config.alerts.filter((a) => !firedAlerts[a.id]);
  }

  const i = subs.findIndex((x) => x.subscription?.endpoint === subscription.endpoint);
  if (i >= 0) subs[i] = entry;
  else subs.push(entry);
  await dbSet("push:subs", subs);
  ensureLoop();
  return { devices: subs.length, fired };
}

export async function removeSubscription(endpoint) {
  const subs = (await dbGet("push:subs")) || [];
  await dbSet("push:subs", subs.filter((x) => x.subscription?.endpoint !== endpoint));
}

/* Self-polling for long-running servers (`next start`). Harmless on
   serverless — the instance just dies and the cron does the work. */
export function ensureLoop() {
  const g = globalThis;
  if (!g.__psTimer) {
    g.__psTimer = setInterval(() => tick().catch(() => {}), 60_000);
    if (g.__psTimer.unref) g.__psTimer.unref();
  }
}

export async function tick() {
  const g = globalThis;
  if (g.__psTicking) return { skipped: "busy" };
  g.__psTicking = true;
  let locked = false;
  const counters = { sent: 0, failed: 0, expired: 0, checked: 0 };
  try {
    ensureLoop();

    /* Cross-instance lock so overlapping cron hits don't double-notify. */
    if (hasKV) {
      locked = (await kv("SET", "push:lock", "1", "NX", "EX", "50")) != null;
      if (!locked) return { skipped: "locked" };
    }

    const all = (await dbGet("push:subs")) || [];
    const subs = all.filter((x) => x.config?.enabled !== false);
    if (!subs.length) return { ...counters, subs: 0 };

    const symbols = [
      ...new Set(
        subs.flatMap((x) => [
          ...(x.config?.watchlist || []),
          ...(x.config?.smart || []),
          ...((x.config?.alerts || []).map((a) => a.sym))
        ])
      )
    ].slice(0, 40);
    if (!symbols.length) return { ...counters, subs: subs.length };

    const quotes = await getSparks(symbols);
    counters.checked = quotes.length;

    const now = Date.now();
    const today = new Date().toDateString();

    /* Dedupe state must survive cold starts too, or "once per day" alerts
       repeat every tick and Smart Notify never finds its price baseline. */
    const st = (await dbGet("push:state")) || {};
    const fired = st.fired || {};
    const lastSmart = st.lastSmart || {};
    const firedAlerts = st.firedAlerts || {};
    const dead = new Set();
    let subsDirty = false;

    const vapid = await getVapid();
    webpush.setVapidDetails("mailto:papastocks@example.com", vapid.publicKey, vapid.privateKey);

    const send = async (entry, payload) => {
      try {
        await webpush.sendNotification(entry.subscription, JSON.stringify(payload), { TTL: 3600 });
        counters.sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          dead.add(entry.subscription?.endpoint);
          counters.expired++;
        } else {
          counters.failed++;
        }
      }
    };

    for (const q of quotes) {
      if (q.changePct == null || q.price == null) continue;

      for (const entry of subs) {
        const cfg = entry.config || {};
        const id = (entry.subscription?.endpoint || "").slice(-24);
        const threshold = Number(cfg.threshold) || 3;
        const watches = (cfg.watchlist || []).includes(q.symbol);

        /* Smart Notify: rich update + overview every time the price really moves. */
        if ((cfg.smart || []).includes(q.symbol)) {
          const key = `${id}|${q.symbol}`;
          const last = lastSmart[key];
          const moved = !last || Math.abs(q.price - last.price) / last.price > SMART_MIN_MOVE;
          const spaced = !last || now - last.ts > SMART_MIN_GAP;
          if (moved && spaced) {
            lastSmart[key] = { price: q.price, ts: now };
            if (last) {
              let body = smartSummary(q);
              try {
                const { overview } = await getOverview(q.symbol);
                if (overview) body += `\n\n${overview}`;
              } catch {}
              await send(entry, {
                title: `🤖 ${q.symbol} update`,
                body,
                tag: `smart-${q.symbol}`,
                url: `/stock/${encodeURIComponent(q.symbol)}`
              });
            }
          }
        }

        /* Big daily moves on watched stocks — once per direction per day. */
        if (watches && Math.abs(q.changePct) >= threshold) {
          const dir = q.changePct > 0 ? "up" : "down";
          const key = `${id}|${dir}-${q.symbol}|${today}`;
          if (!fired[key]) {
            fired[key] = true;
            await send(entry, {
              title: dir === "up"
                ? `📈 ${q.symbol} is up ${q.changePct.toFixed(1)}% today!`
                : `📉 ${q.symbol} is down ${Math.abs(q.changePct).toFixed(1)}% today`,
              body: dir === "up"
                ? `Now $${q.price.toFixed(2)}. Looking strong — might be worth a look, Papa.`
                : `Now $${q.price.toFixed(2)}. Keep an eye on it — no need to panic.`,
              tag: `${dir}-${q.symbol}`,
              url: `/stock/${encodeURIComponent(q.symbol)}`
            });
          }
        }

        /* Custom price alerts — fire once, then drop from this device's config. */
        const hits = (cfg.alerts || []).filter(
          (a) => a.sym === q.symbol &&
            ((a.dir === "above" && q.price >= a.price) || (a.dir === "below" && q.price <= a.price))
        );
        if (hits.length) {
          for (const a of hits) {
            firedAlerts[a.id] = now;
            await send(entry, {
              title: `🔔 ${a.sym} crossed $${a.price}`,
              body: `${a.sym} is now $${q.price.toFixed(2)} (${a.dir} your alert of $${a.price}).`,
              tag: `alert-${a.id}`,
              url: `/stock/${encodeURIComponent(a.sym)}`
            });
          }
          cfg.alerts = (cfg.alerts || []).filter((a) => !hits.includes(a));
          subsDirty = true;
        }
      }
    }

    /* Prune so the state never grows without bound. */
    for (const k of Object.keys(fired)) if (!k.endsWith(`|${today}`)) delete fired[k];
    for (const k of Object.keys(lastSmart)) if (now - (lastSmart[k]?.ts || 0) > 86_400_000) delete lastSmart[k];
    for (const k of Object.keys(firedAlerts)) if (now - firedAlerts[k] > 7 * 86_400_000) delete firedAlerts[k];
    await dbSet("push:state", { fired, lastSmart, firedAlerts });

    if (dead.size) subsDirty = true;
    if (subsDirty) {
      await dbSet("push:subs", all.filter((x) => !dead.has(x.subscription?.endpoint)));
    }

    return { ...counters, subs: subs.length, symbols: symbols.length, store: hasKV ? "kv" : "file" };
  } finally {
    if (locked) { try { await kv("DEL", "push:lock"); } catch {} }
    g.__psTicking = false;
  }
}
