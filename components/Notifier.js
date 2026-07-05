"use client";

import { useEffect } from "react";
import {
  getWatchlist, getAlerts, removeAlert, getPrefs, shouldNotify,
  applyPrefsToDocument, getSmartNotify, getSmartLast, setSmartLast, onStoreChange
} from "@/lib/store";
import { smartSummary } from "@/lib/summary";
import { haptic } from "@/lib/haptics";

/* Global engine: applies theme prefs, registers the service worker,
   subscribes the device to real Web Push (works with the app closed),
   and keeps the server's copy of Papa's watchlist/alerts in sync.
   Falls back to in-app polling when push isn't available. */

export { smartSummary };

let pushActive = false;

function b64ToUint8(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function currentConfig() {
  const prefs = getPrefs();
  return {
    watchlist: getWatchlist(),
    smart: getSmartNotify(),
    alerts: getAlerts(),
    threshold: Number(prefs.moveThreshold) || 3,
    enabled: !!prefs.notifications
  };
}

async function syncPush() {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return false;

    const { key } = await (await fetch("/api/push/key")).json();
    if (!key) return false;
    const serverKey = b64ToUint8(key);

    /* If the server's VAPID key changed since this device subscribed, the
       old subscription is undeliverable — drop it and subscribe fresh. */
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      const cur = new Uint8Array(sub.options?.applicationServerKey || new ArrayBuffer(0));
      const same = cur.length === serverKey.length && cur.every((b, i) => b === serverKey[i]);
      if (!same) {
        try { await sub.unsubscribe(); } catch {}
        sub = null;
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: serverKey
      });
    }

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), config: currentConfig() })
    });
    pushActive = true;
    return true;
  } catch {
    return false;
  }
}

async function notify(title, body, tag) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      reg.showNotification(title, { body, tag, icon: "/icon-192.png", badge: "/icon-192.png" });
    } else {
      new Notification(title, { body, tag, icon: "/icon-192.png" });
    }
  } catch {}
}

/* In-app fallback poller — only runs when Web Push isn't active,
   so Papa never gets the same alert twice. */
async function checkPrices() {
  if (pushActive) return;
  const prefs = getPrefs();
  if (!prefs.notifications) return;
  const watch = getWatchlist();
  const alerts = getAlerts();
  const smart = getSmartNotify();
  const symbols = [...new Set([...watch, ...alerts.map((a) => a.sym), ...smart])];
  if (!symbols.length) return;

  let quotes;
  try {
    const res = await fetch(`/api/spark?symbols=${symbols.join(",")}`);
    quotes = (await res.json()).quotes || [];
  } catch {
    return;
  }

  const threshold = Number(prefs.moveThreshold) || 3;
  const lastTold = getSmartLast();

  for (const q of quotes) {
    if (q.changePct == null) continue;

    if (smart.includes(q.symbol) && q.price != null) {
      const last = lastTold[q.symbol];
      if (last == null || Math.abs(q.price - last) / last > 0.0005) {
        setSmartLast(q.symbol, q.price);
        if (last != null) {
          let body = smartSummary(q);
          try {
            const d = await fetch(`/api/overview?symbol=${q.symbol}`).then((r) => r.json());
            if (d.overview) body += `\n\n${d.overview}`;
          } catch {}
          notify(`🤖 ${q.symbol} update`, body, `smart-${q.symbol}`);
        }
      }
    }

    if (q.changePct >= threshold && shouldNotify(`up-${q.symbol}`)) {
      notify(
        `📈 ${q.symbol} is up ${q.changePct.toFixed(1)}% today!`,
        `Now $${q.price?.toFixed(2)}. Looking strong — might be worth a look, Papa.`,
        `up-${q.symbol}`
      );
    } else if (q.changePct <= -threshold && shouldNotify(`down-${q.symbol}`)) {
      notify(
        `📉 ${q.symbol} is down ${Math.abs(q.changePct).toFixed(1)}% today`,
        `Now $${q.price?.toFixed(2)}. Keep an eye on it — no need to panic.`,
        `down-${q.symbol}`
      );
    }

    for (const a of alerts.filter((a) => a.sym === q.symbol)) {
      const hit =
        (a.dir === "above" && q.price >= a.price) ||
        (a.dir === "below" && q.price <= a.price);
      if (hit) {
        notify(
          `🔔 ${a.sym} crossed $${a.price}`,
          `${a.sym} is now $${q.price?.toFixed(2)} (${a.dir} your alert of $${a.price}).`,
          `alert-${a.id}`
        );
        removeAlert(a.id);
      }
    }
  }
}

export default function Notifier() {
  useEffect(() => {
    applyPrefsToDocument();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    /* Subscribe to background push and keep server config fresh. */
    syncPush().then(() => checkPrices());
    const unsub = onStoreChange(() => { syncPush(); });

    const id = setInterval(checkPrices, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        syncPush();
        checkPrices();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    /* Gentle haptic tick whenever something tappable is opened. */
    const buzz = (e) => {
      if (e.target.closest("a, button, .stock-row, .tab, .pill, .theme-swatch, label.switch")) {
        haptic();
      }
    };
    document.addEventListener("click", buzz, true);

    return () => {
      clearInterval(id);
      unsub();
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("click", buzz, true);
    };
  }, []);

  return null;
}
