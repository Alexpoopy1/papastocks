import { tick } from "@/lib/push";

export const dynamic = "force-dynamic";

/* Cron/manual trigger for the price check + push send.
   A long-running server also runs this every minute on its own; on Vercel
   the cron in vercel.json (or an external pinger) must call this instead.

   If CRON_SECRET is set, callers must present it — Vercel's cron sends it
   as `Authorization: Bearer <secret>` automatically; external pingers can
   use `?secret=<secret>`. Without the env var the endpoint stays open. */

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const ok =
      req.headers.get("authorization") === `Bearer ${secret}` ||
      new URL(req.url).searchParams.get("secret") === secret;
    if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await tick());
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
