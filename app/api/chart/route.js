import { getChart } from "@/lib/yahoo";

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const symbol = (p.get("symbol") || "").toUpperCase();
  const range = p.get("range") || "1d";
  if (!symbol) return Response.json({ error: "symbol required" }, { status: 400 });
  try {
    return Response.json(await getChart(symbol, range));
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
