"use client";

import Link from "next/link";
import Sparkline from "./Sparkline";
import StockLogo from "./StockLogo";
import { fmtPrice, fmtPct } from "@/lib/format";

export default function StockRow({ quote, name }) {
  const up = (quote.changePct ?? 0) >= 0;
  return (
    <Link href={`/stock/${encodeURIComponent(quote.symbol)}`} className="stock-row fade-in">
      <StockLogo symbol={quote.symbol} />
      <div className="stock-name">
        <div className="sym">{quote.symbol}</div>
        {name ? <div className="co">{name}</div> : null}
      </div>
      <Sparkline data={quote.spark} up={up} />
      <div className="stock-price">
        <div className="px">${fmtPrice(quote.price)}</div>
        <span className={`chg ${up ? "up" : "down"}`}>{fmtPct(quote.changePct)}</span>
      </div>
    </Link>
  );
}
