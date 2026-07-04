import webpush from "web-push";
import fs from "fs";
import path from "path";
import { getSparks } from "./yahoo";
import { smartSummary } from "./summary";
import { getOverview } from "./overview";

/* Server-side push engine.
   Keeps device subscriptions on disk, polls Yahoo every minute while the
   server runs, and sends real Web Push notifications — so alerts arrive
   even when the app (or the whole phone browser) is closed.

   Deploy note: on serverless hosts the interval can't run between requests —
   point a cron at GET /api/push/tick every minute instead. */

const STORE_FILE = path.join(process.cwd(), ".push-store.json");
const VAPID_FILE = path.join(process.cwd(), ".vapid.json");
const SMART_MIN_GAP = 4 * 60 * 1000;   // don't smart-ping the same stock more than ~every 4 min
const SMART_MIN_MOVE = 0.0005;         // 0.05% price change counts as "updated"

function state() {
  const g = globalThis;
  if (!g.__psPush) {
    let vapid;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    } else {
      try {
        vapid = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
      } catch {
        vapid = webpush.generateVAPIDKeys();
        try { fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid)); } catch {}
      }
    }
    webpush.setVapidDetails("mailto:papastocks@example.com", vapid.publicKey, vapid.privateKey);

    let subs = [];
    try { subs = JSON.parse(fs.readFileSync(STORE_FILE, "utf8")).subs || []; } catch {}

    g.__psPush = { vapid, subs, fired: {}, lastSmart: {}, timer: null, ticking: false };
  }
  return g.__psPush;
}

function persist() {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify({ subs: state().subs }, null, 2)); } catch {}
}

export function getPublicKey() {
  ensureLoop();
  return state().vapid.publicKey;
}

export function saveSubscription(subscription, config) {
  const s = state();
  const i = s.subs.findIndex((x) => x.subscription?.endpoint === subscription.endpoint);
  const entry = { subscription, config: config || {} };
  if (i >= 0) s.subs[i] = entry;
  else s.subs.push(entry);
  persist();
  ensureLoop();
  return s.subs.length;
}

export function removeSubscription(endpoint) {
  const s = state();
  s.subs = s.subs.filter((x) => x.subscription?.endpoint !== endpoint);
  persist();
}

export function ensureLoop() {
  const s = state();
  if (!s.timer) {
    s.timer = setInterval(() => tick().catch(() => {}), 60_000);
    if (s.timer.unref) s.timer.unref();
  }
}

async function send(entry, payload, counters) {
  try {
    await webpush.sendNotification(entry.subscription, JSON.stringify(payload), { TTL: 3600 });
    counters.sent++;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      removeSubscription(entry.subscription.endpoint);
      counters.expired++;
    } else {
      counters.failed++;
    }
  }
}

export async function tick() {
  const s = state();
  if (s.ticking) return { skipped: "busy" };
  s.ticking = true;
  const counters = { sent: 0, failed: 0, expired: 0, checked: 0 };
  try {
    ensureLoop();
    const subs = s.subs.filter((x) => x.config?.enabled !== false);
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
    const today = new Date().toDateString();

    for (const q of quotes) {
      if (q.changePct == null || q.price == null) continue;

      for (const entry of [...subs]) {
        const cfg = entry.config || {};
        const id = (entry.subscription?.endpoint || "").slice(-24);
        const threshold = Number(cfg.threshold) || 3;
        const watches = (cfg.watchlist || []).includes(q.symbol);

        /* Smart Notify: rich update + overview every time the price really moves. */
        if ((cfg.smart || []).includes(q.symbol)) {
          const key = `${id}|${q.symbol}`;
          const last = s.lastSmart[key];
          const moved = !last || Math.abs(q.price - last.price) / last.price > SMART_MIN_MOVE;
          const spaced = !last || Date.now() - last.ts > SMART_MIN_GAP;
          if (moved && spaced) {
            s.lastSmart[key] = { price: q.price, ts: Date.now() };
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
              }, counters);
            }
          }
        }

        /* Big daily moves on watched stocks — once per direction per day. */
        if (watches && Math.abs(q.changePct) >= threshold) {
          const dir = q.changePct > 0 ? "up" : "down";
          const key = `${id}|${dir}-${q.symbol}|${today}`;
          if (!s.fired[key]) {
            s.fired[key] = true;
            await send(entry, {
              title: dir === "up"
                ? `📈 ${q.symbol} is up ${q.changePct.toFixed(1)}% today!`
                : `📉 ${q.symbol} is down ${Math.abs(q.changePct).toFixed(1)}% today`,
              body: dir === "up"
                ? `Now $${q.price.toFixed(2)}. Looking strong — might be worth a look, Papa.`
                : `Now $${q.price.toFixed(2)}. Keep an eye on it — no need to panic.`,
              tag: `${dir}-${q.symbol}`,
              url: `/stock/${encodeURIComponent(q.symbol)}`
            }, counters);
          }
        }

        /* Custom price alerts — fire once, then drop from this device's config. */
        const hits = (cfg.alerts || []).filter(
          (a) => a.sym === q.symbol &&
            ((a.dir === "above" && q.price >= a.price) || (a.dir === "below" && q.price <= a.price))
        );
        if (hits.length) {
          for (const a of hits) {
            await send(entry, {
              title: `🔔 ${a.sym} crossed $${a.price}`,
              body: `${a.sym} is now $${q.price.toFixed(2)} (${a.dir} your alert of $${a.price}).`,
              tag: `alert-${a.id}`,
              url: `/stock/${encodeURIComponent(a.sym)}`
            }, counters);
          }
          cfg.alerts = (cfg.alerts || []).filter((a) => !hits.includes(a));
          persist();
        }
      }
    }
    return { ...counters, subs: subs.length, symbols: symbols.length };
  } finally {
    s.ticking = false;
  }
}
