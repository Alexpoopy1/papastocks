"use client";

import { useState } from "react";

/* Real company logo with graceful fallback chain:
   Parqet logo CDN → FMP logo CDN → lettered badge. All free, no keys. */
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

  if (symbol?.startsWith("^") || stage >= sources.length) {
    return (
      <div className="ticker-badge" style={{ width: size, height: size }}>
        {String(symbol || "?").replace("^", "").slice(0, 4)}
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
