import { yfetch } from "@/lib/yahoo";

export async function GET(req) {
  const q = new URL(req.url).searchParams.get("symbol") || "stock market";
  try {
    const data = await yfetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        q
      )}&quotesCount=0&newsCount=10`
    );
    const news = (data.news || []).map((n) => ({
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      time: n.providerPublishTime
    }));
    return Response.json({ news });
  } catch (e) {
    return Response.json({ news: [], error: String(e.message || e) }, { status: 502 });
  }
}
