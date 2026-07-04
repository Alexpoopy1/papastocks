import { askBrain } from "@/lib/brain";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { messages = [], context = "" } = body;
  const trimmed = messages.slice(-12).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: String(m.content || "").slice(0, 3000)
  }));

  try {
    const out = await askBrain(trimmed, context);
    return Response.json(out);
  } catch {
    return Response.json(
      { reply: "", error: "Buddy is catching his breath — try again in a few seconds." },
      { status: 502 }
    );
  }
}
