"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AIChat from "@/components/AIChat";
import StockLogo from "@/components/StockLogo";
import {
  inWatchlist, toggleWatch, getPortfolio, setHolding,
  getAlerts, addAlert, removeAlert, onStoreChange,
  isSmartNotify, toggleSmartNotify, setSmartLast, setPref
} from "@/lib/store";
import { smartSummary } from "@/components/Notifier";
import { fmtPrice, fmtChange, fmtBig, timeAgo } from "@/lib/format";

const RANGES = [
  { id: "1d", label: "1D" },
  { id: "5d", label: "1W" },
  { id: "1mo", label: "1M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "5y", label: "5Y" }
];

function BigChart({ points, up }) {
  if (!points?.length) return <div className="spin" />;
  const W = 340, H = 150;
  const vals = points.map((p) => p.c);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const step = W / (points.length - 1 || 1);
  const xy = points.map((p, i) => [i * step, H - 8 - ((p.c - min) / span) * (H - 16)]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="fillgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon className="chart-fill" points={area} fill="url(#fillgrad)" />
      <polyline
        key={points.length + "-" + points[0]?.t}
        className="chart-line"
        pathLength="1"
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function StockPage() {
  const { symbol: raw } = useParams();
  const symbol = decodeURIComponent(String(raw || "")).toUpperCase();

  const [range, setRange] = useState("1d");
  const [data, setData] = useState(null);
  const [news, setNews] = useState(null);
  const [watched, setWatched] = useState(false);
  const [holding, setHoldingState] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [alertPrice, setAlertPrice] = useState("");
  const [toast, setToast] = useState("");
  const [smart, setSmart] = useState(false);

  useEffect(() => {
    setWatched(inWatchlist(symbol));
    const sync = () => {
      setWatched(inWatchlist(symbol));
      setHoldingState(getPortfolio()[symbol] || null);
      setAlerts(getAlerts().filter((a) => a.sym === symbol));
      setSmart(isSmartNotify(symbol));
    };
    sync();
    return onStoreChange(sync);
  }, [symbol]);

  useEffect(() => {
    let alive = true;
    setData(null);
    fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ error: true }));
    return () => { alive = false; };
  }, [symbol, range]);

  useEffect(() => {
    fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => setNews(d.news || []))
      .catch(() => setNews([]));
  }, [symbol]);

  function say(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  const price = data?.price;
  const chg = price != null && data?.prevClose != null ? price - data.prevClose : null;
  const chgPct = chg != null && data?.prevClose ? (chg / data.prevClose) * 100 : null;
  const up = (chg ?? 0) >= 0;

  const aiContext = useMemo(() => {
    if (!data || data.error) return `The user is asking about the stock ${symbol}.`;
    const headlines = (news || []).slice(0, 4).map((n) => `- ${n.title}`).join("\n");
    return `The user is viewing ${data.name} (${symbol}). Live data: price $${price?.toFixed(2)}, change today ${
      chgPct?.toFixed(2)
    }%, day range $${data.dayLow?.toFixed(2)}-$${data.dayHigh?.toFixed(2)}, 52-week range $${
      data.fiftyTwoWeekLow?.toFixed(2)
    }-$${data.fiftyTwoWeekHigh?.toFixed(2)}, volume ${data.volume}, exchange ${data.exchange}.${
      holding ? ` Papa owns ${holding.shares} shares bought around $${holding.cost}.` : ""
    }${headlines ? `\nRecent headlines:\n${headlines}` : ""}`;
  }, [data, symbol, holding, price, chgPct, news]);

  async function onSmartToggle() {
    const turningOn = !smart;
    if (turningOn && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        say("Allow notifications first (Settings tab)");
        return;
      }
      setPref("notifications", true);
    }
    const on = toggleSmartNotify(symbol);
    if (on && price != null) {
      setSmartLast(symbol, price);
      /* Instant first briefing so Papa sees what he signed up for. */
      try {
        const res = await fetch(`/api/spark?symbols=${symbol}`);
        const q = (await res.json()).quotes?.[0];
        const reg = await navigator.serviceWorker?.getRegistration();
        if (q && reg && Notification.permission === "granted") {
          reg.showNotification(`🤖 Smart updates ON for ${symbol}`, {
            body: smartSummary(q),
            icon: "/icon-192.png"
          });
        }
      } catch {}
      say(`Smart updates ON for ${symbol} 🤖`);
    } else if (!on) {
      say(`Smart updates off for ${symbol}`);
    }
  }

  return (
    <>
      <div className="topbar">
        <button className="btn-ghost" onClick={() => history.back()}>‹ Back</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn-ghost ${smart ? "smart-on" : ""}`} onClick={onSmartToggle}>
            {smart ? "🤖 Smart ON" : "🤖 Smart Notify"}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              const added = toggleWatch(symbol);
              say(added ? `${symbol} added to watchlist ⭐` : `${symbol} removed from watchlist`);
            }}
          >
            {watched ? "★" : "☆"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <StockLogo symbol={symbol} size={52} />
        <div>
          <h1 className="greeting serif" style={{ margin: 0 }}>{symbol}</h1>
          <p className="subgreet" style={{ margin: 0 }}>{data?.name || "Loading…"}</p>
        </div>
      </div>

      {data && !data.error && (
        <>
          <div style={{ fontSize: "2.2rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }} className="serif">
            ${fmtPrice(price)}
          </div>
          <span className={`chg ${up ? "up" : "down"}`} style={{ fontSize: ".95rem" }}>
            {fmtChange(chg, chgPct)} today
          </span>
        </>
      )}
      {data?.error && <div className="empty">Couldn’t load {symbol}. Check the ticker or try again.</div>}

      <div className="card" style={{ marginTop: 14, padding: "14px 10px 6px" }}>
        <BigChart points={data?.points} up={up} />
        <div className="range-row">
          {RANGES.map((r) => (
            <button key={r.id} className={`range-btn ${range === r.id ? "active" : ""}`} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {data && !data.error && (
        <>
          <div className="section-title">Key numbers</div>
          <div className="stat-grid">
            <div className="stat"><div className="k">Day range</div><div className="v">${fmtPrice(data.dayLow)} – ${fmtPrice(data.dayHigh)}</div></div>
            <div className="stat"><div className="k">Previous close</div><div className="v">${fmtPrice(data.prevClose)}</div></div>
            <div className="stat"><div className="k">52-week range</div><div className="v">${fmtPrice(data.fiftyTwoWeekLow)} – ${fmtPrice(data.fiftyTwoWeekHigh)}</div></div>
            <div className="stat"><div className="k">Volume</div><div className="v">{fmtBig(data.volume)}</div></div>
          </div>
        </>
      )}

      <div className="section-title">My shares</div>
      <div className="card">
        {holding && !showHoldingForm ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{holding.shares} shares</div>
              <div style={{ color: "var(--text-dim)", fontSize: ".85rem" }}>bought around ${fmtPrice(holding.cost)}</div>
              {price != null && (
                <span className={`chg ${price * holding.shares - holding.cost * holding.shares >= 0 ? "up" : "down"}`} style={{ marginTop: 6 }}>
                  {price * holding.shares - holding.cost * holding.shares >= 0 ? "+" : "−"}$
                  {fmtPrice(Math.abs(price * holding.shares - holding.cost * holding.shares))} overall
                </span>
              )}
            </div>
            <button className="btn-ghost" onClick={() => { setShares(String(holding.shares)); setCost(String(holding.cost)); setShowHoldingForm(true); }}>
              Edit
            </button>
          </div>
        ) : showHoldingForm ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input className="searchbox" placeholder="Number of shares" inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} />
            <input className="searchbox" placeholder="Price you paid per share ($)" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-primary"
                onClick={() => {
                  setHolding(symbol, parseFloat(shares) || 0, parseFloat(cost) || 0);
                  setShowHoldingForm(false);
                  say("Saved 💾");
                }}
              >
                Save
              </button>
              <button className="btn-ghost" onClick={() => setShowHoldingForm(false)}>Cancel</button>
            </div>
            {holding && (
              <button className="btn-ghost" style={{ color: "var(--down)" }} onClick={() => { setHolding(symbol, 0, 0); setShowHoldingForm(false); }}>
                Remove holding
              </button>
            )}
          </div>
        ) : (
          <button className="btn-ghost" style={{ width: "100%" }} onClick={() => { setShares(""); setCost(""); setShowHoldingForm(true); }}>
            + I own this stock
          </button>
        )}
      </div>

      <div className="section-title">Price alerts</div>
      <div className="card">
        {alerts.map((a) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span>🔔 Tell me when {a.dir} <b>${fmtPrice(a.price)}</b></span>
            <button className="btn-ghost" onClick={() => removeAlert(a.id)}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="searchbox"
            style={{ flex: 1 }}
            placeholder={price != null ? `Price, e.g. ${fmtPrice(price)}` : "Price"}
            inputMode="decimal"
            value={alertPrice}
            onChange={(e) => setAlertPrice(e.target.value)}
          />
          <button
            className="btn-ghost"
            onClick={() => {
              const p = parseFloat(alertPrice);
              if (!p) return say("Type a price first");
              addAlert(symbol, p > (price ?? 0) ? "above" : "below", p);
              setAlertPrice("");
              say("Alert set 🔔");
            }}
          >
            Add
          </button>
        </div>
        <div style={{ color: "var(--text-faint)", fontSize: ".76rem", marginTop: 8 }}>
          You’ll get a notification when the price crosses your number.
        </div>
      </div>

      <div className="section-title">Ask Buddy about {symbol} ✨</div>
      <AIChat
        context={aiContext}
        intro={`Hi Papa! Ask me anything about ${data?.name || symbol} — I can see today's numbers.`}
        suggestions={[`Should I be worried about ${symbol}?`, `Explain ${symbol} simply`, `Is ${symbol} near its yearly high?`]}
      />

      <div className="section-title">News about {symbol}</div>
      <div className="card" style={{ padding: "4px 16px" }}>
        {news === null && <div className="spin" />}
        {(news || []).slice(0, 6).map((n, i) => (
          <a key={i} className="news-item" href={n.link} target="_blank" rel="noreferrer">
            <div className="t">{n.title}</div>
            <div className="m">{n.publisher} · {timeAgo(n.time)}</div>
          </a>
        ))}
        {news !== null && !news.length && <div className="empty">No recent news found.</div>}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
