/* Server-side helpers for Yahoo Finance's free public endpoints. */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function yfetch(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 30 }
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  return res.json();
}

/* Quote + intraday sparkline for up to ~20 symbols in one call. */
export async function getSparks(symbols) {
  const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(
    symbols.join(",")
  )}&range=1d&interval=5m&includePrePost=false`;
  const data = await yfetch(url);
  const out = [];
  /* Response is a flat map: { SYM: { close: [...], previousClose, ... } } */
  for (const sym of Object.keys(data || {})) {
    const r = data[sym];
    if (!r || typeof r !== "object") continue;
    const closes = (r.close || []).filter((v) => v != null);
    if (!closes.length) continue;
    const price = closes[closes.length - 1];
    const prev = r.chartPreviousClose ?? r.previousClose ?? null;
    out.push({
      symbol: r.symbol || sym,
      price,
      prevClose: prev,
      change: prev != null ? price - prev : null,
      changePct: prev ? ((price - prev) / prev) * 100 : null,
      spark: closes,
      marketState: null
    });
  }
  /* Keep the caller's requested order. */
  out.sort((a, b) => symbols.indexOf(a.symbol) - symbols.indexOf(b.symbol));
  return out;
}

/* Full chart + rich meta for one symbol. */
export async function getChart(symbol, range = "1d") {
  const intervals = {
    "1d": "5m",
    "5d": "15m",
    "1mo": "1d",
    "6mo": "1d",
    ytd: "1d",
    "1y": "1wk",
    "5y": "1mo",
    max: "3mo"
  };
  const interval = intervals[range] || "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplit`;
  const data = await yfetch(url);
  const r = data?.chart?.result?.[0];
  if (!r) throw new Error("no data");
  const q = r.indicators?.quote?.[0] || {};
  const points = [];
  (r.timestamp || []).forEach((t, i) => {
    if (q.close?.[i] != null) points.push({ t, c: q.close[i] });
  });
  const m = r.meta || {};
  return {
    symbol: m.symbol,
    name: m.longName || m.shortName || m.symbol,
    currency: m.currency,
    price: m.regularMarketPrice,
    prevClose: m.chartPreviousClose ?? m.previousClose,
    dayHigh: m.regularMarketDayHigh,
    dayLow: m.regularMarketDayLow,
    volume: m.regularMarketVolume,
    fiftyTwoWeekHigh: m.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: m.fiftyTwoWeekLow,
    marketState: m.marketState,
    exchange: m.fullExchangeName || m.exchangeName,
    points
  };
}
