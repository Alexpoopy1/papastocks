"use client";

import { useState } from "react";

/* Real company logo with graceful fallback chain:
   Parqet logo CDN → FMP logo CDN → colorful monogram badge.
   All free, no keys. */

function hueFor(sym) {
  let h = 0;
  for (const c of sym) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export default function StockLogo({ symbol, size = 42 }) {
  const [stage, setStage] = useState(0);
  const sym = String(symbol || "");
  const isCrypto = /-(USD|EUR|BTC)$/.test(sym);
  const base = sym.split(".")[0].split("-")[0];
  const sources = isCrypto
    ? [`https://assets.parqet.com/logos/crypto/${encodeURIComponent(base)}?format=png&size=100`]
    : [
        `https://assets.parqet.com/logos/symbol/${encodeURIComponent(base)}?format=png&size=100`,
        `https://financialmodelingprep.com/image-stock/${encodeURIComponent(base)}.png`
      ];

  if (sym.startsWith("^") || stage >= sources.length) {
    const h = hueFor(base || "?");
    return (
      <div
        className="ticker-badge"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, hsl(${h}, 52%, 42%), hsl(${(h + 45) % 360}, 55%, 30%))`,
          color: "#fff",
          textShadow: "0 1px 3px rgba(0,0,0,.35)",
          fontSize: base.length > 3 ? "0.62rem" : "0.78rem",
          letterSpacing: "0.02em"
        }}
      >
        {(base || sym.replace("^", "")).slice(0, 4)}
      </div>
    );
  }

  return (
    <img
      className="stock-logo"
      style={{ width: size, height: size }}
      src={sources[stage]}
      alt=""
      loading="lazy"
      onError={() => setStage((s) => s + 1)}
    />
  );
}
