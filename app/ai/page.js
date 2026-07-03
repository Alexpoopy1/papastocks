"use client";

import { useEffect, useState } from "react";
import AIChat from "@/components/AIChat";
import { getWatchlist, getPortfolio } from "@/lib/store";

export default function AIPage() {
  const [context, setContext] = useState("");

  /* Give the AI live prices for Papa's watchlist so answers are grounded. */
  useEffect(() => {
    async function load() {
      try {
        const watch = getWatchlist();
        if (!watch.length) return;
        const res = await fetch(`/api/spark?symbols=${watch.join(",")}`);
        const { quotes = [] } = await res.json();
        const portfolio = getPortfolio();
        const lines = quotes.map((q) => {
          const h = portfolio[q.symbol];
          return `${q.symbol}: $${q.price?.toFixed(2)} (${q.changePct >= 0 ? "+" : ""}${q.changePct?.toFixed(2)}% today)${
            h ? ` — Papa owns ${h.shares} shares bought around $${h.cost}` : ""
          }`;
        });
        setContext(`Papa's watchlist right now:\n${lines.join("\n")}`);
      } catch {}
    }
    load();
  }, []);

  return (
    <>
      <h1 className="greeting serif">Ask anything, Papa.</h1>
      <p className="subgreet">Buddy knows today’s prices for your watchlist.</p>

      <AIChat
        context={context}
        suggestions={[
          "How are my stocks doing today?",
          "What does P/E ratio mean?",
          "Is it a good day to buy?",
          "Explain dividends simply"
        ]}
      />

    </>
  );
}
