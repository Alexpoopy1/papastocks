"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StockLogo from "./StockLogo";

export default function SearchBar({ placeholder = "Search any stock…" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function go(sym) {
    setOpen(false);
    setQ("");
    router.push(`/stock/${encodeURIComponent(sym)}`);
  }

  return (
    <>
      <button className="searchbox" style={{ width: "100%" }} onClick={() => setOpen(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span>{placeholder}</span>
      </button>

      {open && (
        <div className="search-overlay fade-in">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <div className="searchbox" style={{ flex: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type a name or ticker (e.g. Apple)"
                autoCapitalize="characters"
              />
            </div>
            <button className="btn-ghost" onClick={() => { setOpen(false); setQ(""); }}>
              Cancel
            </button>
          </div>

          {busy && <div className="spin" />}
          {!busy && q && !results.length && <div className="empty">No matches for “{q}”</div>}
          {results.map((r) => (
            <button
              key={r.symbol}
              className="stock-row"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => go(r.symbol)}
            >
              <StockLogo symbol={r.symbol} />
              <div className="stock-name">
                <div className="sym">{r.symbol}</div>
                <div className="co">{r.name} · {r.exchange}</div>
              </div>
              <span style={{ color: "var(--text-faint)" }}>›</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
