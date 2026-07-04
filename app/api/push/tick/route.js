import { tick } from "@/lib/push";

export const dynamic = "force-dynamic";

/* Manual/cron trigger for the price check + push send.
   The server also runs this every minute on its own while it's up;
   on serverless hosts, point a 1-minute cron here instead. */

export async function GET() {
  try {
    return Response.json(await tick());
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
