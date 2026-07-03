/* Buddy's brain, in order of preference:
   1. Google Gemini 2.5 Flash — very smart, free tier (needs GEMINI_API_KEY in .env.local,
      grab one free at https://aistudio.google.com/apikey)
   2. Pollinations (keyless fallback) so the app always answers. */

const SYSTEM_PROMPT = `You are "Buddy", the built-in market expert of a stock app used by a retiree called Papa.
You are sharp and genuinely knowledgeable about markets, companies, sectors, dividends, and investing history.
Explain things in plain, simple English — define any jargon in a few words.
Be specific: use the live numbers provided, compare to the 52-week range, mention what the company actually does when relevant.
Keep answers to 2-6 sentences, warm and confident. Give a clear opinion when asked, with one concrete reason.
Never mention that you are an AI, a language model, or a chatbot.
Never add disclaimers like "I'm not a financial advisor" or "this is not financial advice" — just answer helpfully.
Answer directly with no markdown headings or bullet lists — plain conversational sentences only.`;

function systemWithContext(context) {
  return SYSTEM_PROMPT + (context ? `\n\nLive data for this conversation:\n${context}` : "");
}

async function askGemini(messages, context) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no gemini key");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemWithContext(context) }] },
        contents: messages.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }]
        })),
        generationConfig: { temperature: 0.6, maxOutputTokens: 1200 }
      }),
      signal: AbortSignal.timeout(30000)
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text.trim()) throw new Error("gemini empty");
  return { reply: text.trim(), model: "gemini-2.5-flash" };
}

async function askPollinations(messages, context) {
  const res = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai-fast",
      messages: [{ role: "system", content: systemWithContext(context) }, ...messages]
    }),
    signal: AbortSignal.timeout(40000)
  });
  if (!res.ok) throw new Error(`pollinations ${res.status}`);
  const text = (await res.text()).trim();
  if (!text || text.length < 2) throw new Error("pollinations empty");
  return { reply: text, model: "openai-fast" };
}

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
  const ctx = String(context).slice(0, 4000);

  for (const ask of [askGemini, askPollinations]) {
    try {
      const out = await ask(trimmed, ctx);
      return Response.json(out);
    } catch {}
  }
  return Response.json(
    { reply: "", error: "Buddy is catching his breath — try again in a few seconds." },
    { status: 502 }
  );
}
