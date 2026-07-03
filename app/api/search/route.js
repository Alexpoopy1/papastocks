import { yfetch } from "@/lib/yahoo";

export async function GET(req) {
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q.trim()) return Response.json({ results: [] });
  try {
    const data = await yfetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        q
      )}&quotesCount=10&newsCount=0&listsCount=0`
    );
    const results = (data.quotes || [])
      .filter((r) => r.symbol && (r.quoteType === "EQUITY" || r.quoteType === "ETF" || r.quoteType === "INDEX"))
      .map((r) => ({
        symbol: r.symbol,
        name: r.shortname || r.longname || r.symbol,
        exchange: r.exchDisp || "",
        type: r.quoteType
      }));
    return Response.json({ results });
  } catch (e) {
    return Response.json({ results: [], error: String(e.message || e) }, { status: 502 });
  }
}
