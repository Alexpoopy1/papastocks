import { getSparks } from "@/lib/yahoo";

export async function GET(req) {
  const symbols = (new URL(req.url).searchParams.get("symbols") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 25);
  if (!symbols.length) return Response.json({ quotes: [] });
  try {
    const quotes = await getSparks(symbols);
    return Response.json({ quotes });
  } catch (e) {
    return Response.json({ quotes: [], error: String(e.message || e) }, { status: 502 });
  }
}
