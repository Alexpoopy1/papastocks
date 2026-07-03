"use client";

import { useEffect } from "react";
import {
  getWatchlist, getAlerts, removeAlert, getPrefs, shouldNotify,
  applyPrefsToDocument, getSmartNotify, getSmartLast, setSmartLast
} from "@/lib/store";
import { haptic } from "@/lib/haptics";

/* Global engine: applies theme prefs, registers the service worker,
   and while the app is open polls prices to fire notifications for
   big moves, custom price alerts, and Smart Notify updates. */

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

/* Build a rich, plain-English snapshot from intraday spark data. */
export function smartSummary(q) {
  const bits = [];
  const pct = q.changePct ?? 0;
  const dir = pct >= 0 ? "up" : "down";
  bits.push(`$${q.price?.toFixed(2)}, ${dir} ${Math.abs(pct).toFixed(2)}% today.`);

  if (q.spark?.length > 3) {
    const hi = Math.max(...q.spark);
    const lo = Math.min(...q.spark);
    const avg = q.spark.reduce((a, b) => a + b, 0) / q.spark.length;
    const posInRange = hi === lo ? 0.5 : (q.price - lo) / (hi - lo);

    if (posInRange > 0.85) bits.push(`Trading near today's high of $${hi.toFixed(2)}.`);
    else if (posInRange < 0.15) bits.push(`Sitting near today's low of $${lo.toFixed(2)}.`);
    else bits.push(`Today's range: $${lo.toFixed(2)}–$${hi.toFixed(2)}.`);

    if (q.price > avg * 1.002) bits.push("Buyers are in charge — it's above its session average.");
    else if (q.price < avg * 0.998) bits.push("Sellers have the edge — it's below its session average.");
    else bits.push("Holding steady around its session average.");

    const half = q.spark.slice(-Math.max(3, Math.floor(q.spark.length / 4)));
    const recent = (half[half.length - 1] - half[0]) / half[0] * 100;
    if (recent > 0.35) bits.push("Momentum is picking up right now. 📈");
    else if (recent < -0.35) bits.push("It's been slipping in the last stretch. 📉");
  }
  return bits.join(" ");
}

async function checkPrices() {
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

    /* Smart Notify: a rich update every time the price actually changes. */
    if (smart.includes(q.symbol) && q.price != null) {
      const last = lastTold[q.symbol];
      if (last == null || Math.abs(q.price - last) / last > 0.0005) {
        setSmartLast(q.symbol, q.price);
        if (last != null) {
          notify(`🤖 ${q.symbol} update`, smartSummary(q), `smart-${q.symbol}`);
        }
      }
    }

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
        haptic();
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
