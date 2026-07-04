import { getOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const symbol = (new URL(req.url).searchParams.get("symbol") || "").toUpperCase();
  if (!symbol) return Response.json({ error: "symbol required" }, { status: 400 });
  try {
    return Response.json(await getOverview(symbol));
  } catch (e) {
    return Response.json({ overview: "", error: String(e.message || e) }, { status: 502 });
  }
}
