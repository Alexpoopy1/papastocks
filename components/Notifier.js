"use client";

import { useEffect } from "react";
import { getWatchlist, getAlerts, removeAlert, getPrefs, shouldNotify, applyPrefsToDocument } from "@/lib/store";

/* Global engine: applies theme prefs, registers the service worker,
   and while the app is open polls prices to fire notifications for
   big moves and custom price alerts. */

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

async function checkPrices() {
  const prefs = getPrefs();
  if (!prefs.notifications) return;
  const watch = getWatchlist();
  const alerts = getAlerts();
  const symbols = [...new Set([...watch, ...alerts.map((a) => a.sym)])];
  if (!symbols.length) return;

  let quotes;
  try {
    const res = await fetch(`/api/spark?symbols=${symbols.join(",")}`);
    quotes = (await res.json()).quotes || [];
  } catch {
    return;
  }

  const threshold = Number(prefs.moveThreshold) || 3;
  for (const q of quotes) {
    if (q.changePct == null) continue;
    /* Big move up = good news / possible buy; big drop = warning. */
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

    /* Custom price alerts (fire once, then remove). */
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

    checkPrices();
    const id = setInterval(checkPrices, 60_000);
    const onVis = () => document.visibilityState === "visible" && checkPrices();
    document.addEventListener("visibilitychange", onVis);

    /* Gentle haptic tick whenever something tappable is opened. */
    const buzz = (e) => {
      if (e.target.closest("a, button, .stock-row, .tab, .pill, .theme-swatch, label.switch")) {
        try { navigator.vibrate?.(10); } catch {}
      }
    };
    document.addEventListener("click", buzz, true);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("click", buzz, true);
    };
  }, []);

  return null;
}
