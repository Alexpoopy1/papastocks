# 📈 PapaStocks

A beautiful, installable iOS web app (PWA) built with **Next.js + npm** that gives Papa
live stock prices, smart buy ideas, alerts when things move, and a friendly AI buddy —
all with **100% free APIs, no keys, no accounts**.

The default **"Manus Dark"** theme is modeled on the manus.im / arena.ai look:
near-black canvas, soft charcoal cards, warm ivory text and an elegant serif display font.

---

## Run it

```bash
npm install
npm run dev        # development on http://localhost:3000
npm run build      # production build
npm start          # production server
```

To put it on Papa's iPhone: host it (Vercel is free — `npx vercel`), open the link in
**Safari → Share → Add to Home Screen**. It becomes a full-screen app with its own icon,
and that's also what enables notifications on iOS (16.4+).

## The 18 features

1. **Live stock prices** — real quotes from Yahoo Finance's free API, auto-refreshing every minute
2. **Mini sparkline charts** on every stock row showing today's shape
3. **Big interactive price chart** per stock with 1D / 1W / 1M / 6M / 1Y / 5Y ranges
4. **Search any stock** by name or ticker ("coca cola" → KO)
5. **Watchlist** — star stocks to follow; saved on the device
6. **Portfolio tracker** — enter shares + what he paid, see live total value and profit/loss
7. **Papa's Perfect Picks** — daily momentum ranking of his watchlist + trending stocks, with a score and a plain-English reason ("buyers are in charge right now")
8. **Smart notifications** — automatic alert when any watched stock jumps or drops past his threshold (2% / 3% / 5%), phrased kindly ("no need to panic")
9. **Custom price alerts** — "tell me when AAPL crosses $250," fires once then cleans itself up
10. **Test alert button** so he can see what a notification looks like
11. **AI stock buddy** — free AI (Pollinations, no key needed) that answers questions in simple language, *grounded in live prices* for his watchlist and the stock he's viewing, wrapped in an **animated rainbow gradient border** ✨
12. **Suggested questions** ("What does P/E mean?") so he never faces an empty chat box
13. **Market overview** — S&P 500, Dow, Nasdaq with mini charts
14. **Today's gainers & losers** from trending tickers
15. **Market & per-stock news** with source and "2h ago" timestamps
16. **Key numbers** per stock — day range, 52-week range, previous close, volume
17. **5 themes** — Manus Dark (default), Daylight, Midnight Blue, Forest, High Contrast — plus a **Big Text** mode for comfy reading
18. **Full PWA** — add to Home Screen, custom app icon, splash colors, offline shell via service worker, safe-area aware iPhone layout with a native-feeling tab bar

## Free services used

| What | Service | Key needed? |
|---|---|---|
| Quotes, charts, search, trending, news | Yahoo Finance public endpoints (proxied through Next.js API routes) | No |
| Buddy chat (smart mode) | Google Gemini 2.5 Flash free tier | Free key — put `GEMINI_API_KEY=...` in `.env.local` (get one at https://aistudio.google.com/apikey) |
| Buddy chat (fallback) | text.pollinations.ai | No |

## Notes

- Notifications are real Web Push — they arrive even with the app fully closed. On a
  long-running server it just works; on Vercel you need a KV store and a cron hitting
  `/api/push/tick` — see **[PRODUCTION.md](PRODUCTION.md)** for the 5-minute setup.
- Prices can be delayed a few minutes. PapaStocks is for information only — not financial advice. ❤️
