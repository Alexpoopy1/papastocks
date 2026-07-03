import { yfetch, getSparks } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await yfetch("https://query1.finance.yahoo.com/v1/finance/trending/US?count=12");
    const symbols = (data?.finance?.result?.[0]?.quotes || [])
      .map((q) => q.symbol)
      .filter((s) => s && !s.includes("=") && !s.startsWith("^"))
      .slice(0, 10);
    const quotes = symbols.length ? await getSparks(symbols) : [];
    return Response.json({ quotes });
  } catch (e) {
    return Response.json({ quotes: [], error: String(e.message || e) }, { status: 502 });
  }
}
