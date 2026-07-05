import { saveSubscription, removeSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { subscription, config } = body || {};
  if (!subscription?.endpoint) return Response.json({ error: "subscription required" }, { status: 400 });
  const count = await saveSubscription(subscription, config);
  return Response.json({ ok: true, devices: count });
}

export async function DELETE(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (body?.endpoint) await removeSubscription(body.endpoint);
  return Response.json({ ok: true });
}
