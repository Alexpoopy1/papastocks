"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StockRow from "@/components/StockRow";
import Sparkline from "@/components/Sparkline";
import { fmtPrice, fmtPct, timeAgo } from "@/lib/format";

const INDICES = [
  { sym: "^GSPC", label: "S&P 500" },
  { sym: "^DJI", label: "Dow Jones" },
  { sym: "^IXIC", label: "Nasdaq" }
];

export default function Markets() {
  const [idx, setIdx] = useState(null);
  const [trending, setTrending] = useState(null);
  const [news, setNews] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [a, b, c] = await Promise.all([
          fetch(`/api/spark?symbols=${encodeURIComponent(INDICES.map((i) => i.sym).join(","))}`).then((r) => r.json()),
          fetch("/api/trending").then((r) => r.json()),
          fetch("/api/news").then((r) => r.json())
        ]);
        if (!alive) return;
        setIdx(a.quotes || []);
        setTrending(b.quotes || []);
        setNews(c.news || []);
      } catch {
        if (!alive) return;
        setIdx([]); setTrending([]); setNews([]);
      }
    }
    load();
    const id = setInterval(load, 90_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const movers = [...(trending || [])].sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0));
  const gainers = movers.filter((q) => (q.changePct ?? 0) > 0).slice(0, 5);
  const losers = movers.filter((q) => (q.changePct ?? 0) < 0).slice(0, 5);

  return (
    <>
      <h1 className="greeting serif">Markets</h1>
      <p className="subgreet">The big picture, at a glance.</p>

      <div className="section-title">Major indexes</div>
      {idx === null && <div className="spin" />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {(idx || []).map((q, i) => {
          const up = (q.changePct ?? 0) >= 0;
          return (
            <div className="card" key={q.symbol} style={{ padding: 12 }}>
              <div style={{ fontSize: ".72rem", color: "var(--text-faint)", fontWeight: 700 }}>
                {INDICES.find((x) => x.sym === q.symbol)?.label || q.symbol}
              </div>
              <div style={{ fontWeight: 800, margin: "2px 0", fontVariantNumeric: "tabular-nums" }}>
                {fmtPrice(q.price)}
              </div>
              <span className={`chg ${up ? "up" : "down"}`} style={{ fontSize: ".7rem" }}>{fmtPct(q.changePct)}</span>
              <div style={{ marginTop: 6 }}>
                <Sparkline data={q.spark} up={up} width={86} height={24} />
              </div>
            </div>
          );
        })}
      </div>

      {gainers.length > 0 && <div className="section-title">Today’s gainers 🟢</div>}
      {gainers.map((q) => <StockRow key={q.symbol} quote={q} />)}

      {losers.length > 0 && <div className="section-title">Today’s losers 🔴</div>}
      {losers.map((q) => <StockRow key={q.symbol} quote={q} />)}

      {trending !== null && !trending.length && (
        <div className="empty">Couldn’t load trending stocks right now.</div>
      )}

      <div className="section-title">Market news</div>
      {news === null && <div className="spin" />}
      <div className="card" style={{ padding: "4px 16px" }}>
        {(news || []).slice(0, 8).map((n, i) => (
          <a key={i} className="news-item" href={n.link} target="_blank" rel="noreferrer">
            <div className="t">{n.title}</div>
            <div className="m">{n.publisher} · {timeAgo(n.time)}</div>
          </a>
        ))}
        {news !== null && !news.length && <div className="empty">No news right now.</div>}
      </div>
    </>
  );
}
