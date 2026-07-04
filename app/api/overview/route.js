import { askBrain } from "@/lib/brain";
import { getChart, yfetch } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

/* Smart overview: a short, plain-English briefing on one stock,
   grounded in live numbers and today's headlines.
   Server-cached per symbol so the rate-limited free model isn't hammered. */

const cache = new Map();
const TTL = 15 * 60 * 1000;

export async function GET(req) {
  const symbol = (new URL(req.url).searchParams.get("symbol") || "").toUpperCase();
  if (!symbol) return Response.json({ error: "symbol required" }, { status: 400 });

  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.ts < TTL) {
    return Response.json({ overview: hit.text, cached: true });
  }

  try {
    const [chart, newsData] = await Promise.all([
      getChart(symbol, "1d"),
      yfetch(
        `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=4`
      ).catch(() => ({ news: [] }))
    ]);

    const chg = chart.price != null && chart.prevClose != null ? chart.price - chart.prevClose : null;
    const chgPct = chg != null && chart.prevClose ? (chg / chart.prevClose) * 100 : null;
    const headlines = (newsData.news || []).map((n) => `- ${n.title}`).join("\n");

    const context = `${chart.name} (${symbol}) on ${chart.exchange}: price $${chart.price?.toFixed(2)}, today ${
      chgPct != null ? (chgPct >= 0 ? "+" : "") + chgPct.toFixed(2) + "%" : "n/a"
    }, day range $${chart.dayLow?.toFixed(2)}-$${chart.dayHigh?.toFixed(2)}, 52-week range $${
      chart.fiftyTwoWeekLow?.toFixed(2)
    }-$${chart.fiftyTwoWeekHigh?.toFixed(2)}, volume ${chart.volume}.${
      headlines ? `\nToday's headlines:\n${headlines}` : ""
    }`;

    let reply, model;
    try {
      ({ reply, model } = await askBrain(
        [
          {
            role: "user",
            content: `Give Papa a smart 2-3 sentence overview of ${chart.name} (${symbol}) right now: what the company does in a few words, how the stock is moving today and where it sits in its yearly range, and the single most useful thing from the headlines if any. Plain conversational English.`
          }
        ],
        context
      ));
    } catch {
      /* Model busy — build a solid overview straight from the data. */
      reply = dataOverview(chart, chgPct, newsData.news || []);
      model = "data";
    }

    cache.set(symbol, { text: reply, ts: Date.now() });
    return Response.json({ overview: reply, model });
  } catch (e) {
    return Response.json({ overview: "", error: String(e.message || e) }, { status: 502 });
  }
}

function dataOverview(chart, chgPct, news) {
  const bits = [];
  const dir = (chgPct ?? 0) >= 0 ? "up" : "down";
  bits.push(
    `${chart.name} is trading at $${chart.price?.toFixed(2)}, ${dir} ${Math.abs(chgPct ?? 0).toFixed(2)}% today.`
  );
  if (chart.fiftyTwoWeekHigh != null && chart.fiftyTwoWeekLow != null && chart.price != null) {
    const span = chart.fiftyTwoWeekHigh - chart.fiftyTwoWeekLow || 1;
    const pos = (chart.price - chart.fiftyTwoWeekLow) / span;
    if (pos > 0.85) bits.push(`It's near the top of its 52-week range ($${chart.fiftyTwoWeekLow.toFixed(2)}–$${chart.fiftyTwoWeekHigh.toFixed(2)}) — the market has been rewarding it.`);
    else if (pos < 0.2) bits.push(`It's near the bottom of its 52-week range ($${chart.fiftyTwoWeekLow.toFixed(2)}–$${chart.fiftyTwoWeekHigh.toFixed(2)}) — it's been a tough year for this one.`);
    else bits.push(`Over the past year it has traded between $${chart.fiftyTwoWeekLow.toFixed(2)} and $${chart.fiftyTwoWeekHigh.toFixed(2)}, and it's sitting in the middle of that range.`);
  }
  if (news[0]?.title) bits.push(`In the news: “${news[0].title}”.`);
  return bits.join(" ");
}
