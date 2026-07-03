"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StockLogo from "@/components/StockLogo";
import { getWatchlist } from "@/lib/store";
import { fmtPrice, fmtPct } from "@/lib/format";

/* "Papa's Perfect Picks" — a simple, transparent momentum score:
   + intraday trend (price vs. session average)
   + day change strength
   Ranked and labelled Buy-look / Watch / Careful.                */

function scoreQuote(q) {
  if (q.price == null || !q.spark?.length) return null;
  const avg = q.spark.reduce((a, b) => a + b, 0) / q.spark.length;
  const trendPct = ((q.price - avg) / avg) * 100;       // above/below session average
  const momentum = q.changePct ?? 0;
  const score = Math.round(52 + momentum * 3.5 + trendPct * 2.5);
  return Math.max(1, Math.min(99, score));
}

function label(score) {
  if (score >= 62) return { badge: "buy", text: "LOOKS STRONG" };
  if (score >= 45) return { badge: "watch", text: "STEADY — WATCH" };
  return { badge: "avoid", text: "WEAK TODAY" };
}

function reason(q, score) {
  const dir = (q.changePct ?? 0) >= 0 ? "up" : "down";
  const pieces = [];
  pieces.push(`${q.symbol} is ${dir} ${Math.abs(q.changePct ?? 0).toFixed(2)}% today at $${fmtPrice(q.price)}.`);
  if (score >= 62) pieces.push("It's trading above its average for the day — buyers are in charge right now.");
  else if (score >= 45) pieces.push("It's holding steady around its daily average — no rush either way.");
  else pieces.push("It's been sliding below its daily average — better to wait and watch.");
  return pieces.join(" ");
}

export default function Picks() {
  const [picks, setPicks] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const watch = getWatchlist();
        const [w, t] = await Promise.all([
          watch.length
            ? fetch(`/api/spark?symbols=${watch.join(",")}`).then((r) => r.json())
            : { quotes: [] },
          fetch("/api/trending").then((r) => r.json())
        ]);
        if (!alive) return;
        const seen = new Set();
        const all = [...(w.quotes || []), ...(t.quotes || [])].filter((q) => {
          if (seen.has(q.symbol)) return false;
          seen.add(q.symbol);
          return true;
        });
        const scored = all
          .map((q) => ({ q, score: scoreQuote(q) }))
          .filter((x) => x.score != null)
          .sort((a, b) => b.score - a.score);
        setPicks(scored);
      } catch {
        if (alive) setPicks([]);
      }
    }
    load();
    const id = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <>
      <h1 className="greeting serif">Papa’s Perfect Picks</h1>
      <p className="subgreet">Today’s strongest stocks from your watchlist and what’s trending, ranked for you.</p>

      {picks === null && <div className="spin" />}
      {picks !== null && !picks.length && (
        <div className="empty">Couldn’t rank stocks right now — try again in a minute.</div>
      )}

      {(picks || []).map(({ q, score }) => {
        const l = label(score);
        return (
          <Link href={`/stock/${encodeURIComponent(q.symbol)}`} key={q.symbol} className="pick-card fade-in" style={{ display: "block" }}>
            <div className="pick-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StockLogo symbol={q.symbol} />
                <div>
                  <div style={{ fontWeight: 700 }}>{q.symbol}</div>
                  <span className={`badge ${l.badge}`}>{l.text}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="score-ring" style={{ color: score >= 62 ? "var(--up)" : score >= 45 ? "#fbbf24" : "var(--down)" }}>
                  {score}
                </div>
                <div style={{ fontSize: ".68rem", color: "var(--text-faint)" }}>momentum score</div>
              </div>
            </div>
            <div className="pick-reason">{reason(q, score)}</div>
            <div style={{ marginTop: 8, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              ${fmtPrice(q.price)}{" "}
              <span className={`chg ${(q.changePct ?? 0) >= 0 ? "up" : "down"}`}>{fmtPct(q.changePct)}</span>
            </div>
          </Link>
        );
      })}

      <p className="disclaimer">Momentum scores refresh all through the trading day ❤️</p>
    </>
  );
}
