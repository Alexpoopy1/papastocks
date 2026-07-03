"use client";

import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import StockRow from "@/components/StockRow";
import { getWatchlist, getPortfolio, onStoreChange } from "@/lib/store";
import { fmtPrice, fmtPct } from "@/lib/format";

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const [quotes, setQuotes] = useState(null);
  const [watch, setWatch] = useState([]);
  const [portfolio, setPortfolio] = useState({});

  useEffect(() => {
    setWatch(getWatchlist());
    setPortfolio(getPortfolio());
    return onStoreChange(() => {
      setWatch(getWatchlist());
      setPortfolio(getPortfolio());
    });
  }, []);

  useEffect(() => {
    if (!watch.length) {
      setQuotes([]);
      return;
    }
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/spark?symbols=${watch.join(",")}`);
        const data = await res.json();
        if (alive) setQuotes(data.quotes || []);
      } catch {
        if (alive) setQuotes([]);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [watch]);

  /* Portfolio totals from live quotes. */
  let value = 0, cost = 0, hasHoldings = false;
  if (quotes) {
    for (const [sym, h] of Object.entries(portfolio)) {
      const q = quotes.find((x) => x.symbol === sym);
      if (q?.price != null) {
        hasHoldings = true;
        value += q.price * h.shares;
        cost += h.cost * h.shares;
      }
    }
  }
  const pl = value - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;

  return (
    <>
      <div className="topbar">
        <div className="logo"><span className="logo-dot">📈</span> PapaStocks</div>
      </div>
      <h1 className="greeting serif">{greetingWord()}, Papa.</h1>
      <p className="subgreet">Here’s how your stocks are doing today.</p>

      <SearchBar />

      {hasHoldings && (
        <>
          <div className="section-title">My portfolio</div>
          <div className="card">
            <div style={{ color: "var(--text-faint)", fontSize: ".78rem", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Total value
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, margin: "4px 0" }} className="serif">
              ${fmtPrice(value)}
            </div>
            <span className={`chg ${pl >= 0 ? "up" : "down"}`}>
              {pl >= 0 ? "+" : "−"}${fmtPrice(Math.abs(pl))} ({fmtPct(plPct)}) all time
            </span>
          </div>
        </>
      )}

      <div className="section-title">My watchlist</div>
      {quotes === null && (
        <div>
          <div className="skeleton" /><div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
        </div>
      )}
      {quotes !== null && !quotes.length && (
        <div className="empty">Your watchlist is empty.<br />Search for a stock above to add one. 🔍</div>
      )}
      {(quotes || []).map((q) => (
        <StockRow key={q.symbol} quote={q} />
      ))}

      <p className="disclaimer">Live market data · refreshes every minute ❤️</p>
    </>
  );
}
