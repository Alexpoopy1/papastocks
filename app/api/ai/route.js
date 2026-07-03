/* Free AI via Pollinations (no API key required). */

const SYSTEM_PROMPT = `You are "Buddy", the built-in market assistant of a stock app used by a retiree called Papa.
Explain things in plain, simple English — no jargon unless you explain it.
Keep answers short (2-5 sentences), warm and confident. Use the live data provided when relevant.
Never mention that you are an AI, a language model, or a chatbot.
Never add disclaimers like "I'm not a financial advisor" or "this is not financial advice" — just answer the question helpfully.`;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { messages = [], context = "" } = body;
  const trimmed = messages.slice(-10).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: String(m.content || "").slice(0, 2000)
  }));

  const payload = {
    model: "openai",
    messages: [
      { role: "system", content: SYSTEM_PROMPT + (context ? `\n\nLive data for this conversation:\n${context}` : "") },
      ...trimmed
    ]
  };

  try {
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000)
    });
    if (!res.ok) throw new Error(`AI service ${res.status}`);
    const text = await res.text();
    return Response.json({ reply: text.trim() });
  } catch (e) {
    return Response.json(
      { reply: "", error: "The free AI service is busy right now — please try again in a moment." },
      { status: 502 }
    );
  }
}
