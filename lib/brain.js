/* Buddy's brain, shared by the chat and the Smart overview.
   Order of preference:
   1. Google Gemini 2.5 Flash — very smart, free tier
      (needs GEMINI_API_KEY in .env.local, free at https://aistudio.google.com/apikey)
   2. Pollinations (keyless) so an answer always comes back. */

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

/* Pollinations' keyless tier is rate-limited, so space calls out and retry once. */
let pollinationsGate = Promise.resolve();
const GAP_MS = 5500;

function throttled(fn) {
  const run = pollinationsGate.then(fn);
  pollinationsGate = run.catch(() => {}).then(
    () => new Promise((r) => setTimeout(r, GAP_MS))
  );
  return run;
}

async function askPollinations(messages, context) {
  try {
    return await throttled(() => callPollinations(messages, context));
  } catch {
    /* one retry after the gap — the free tier often succeeds on the second try */
    return throttled(() => callPollinations(messages, context));
  }
}

async function callPollinations(messages, context) {
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

export async function askBrain(messages, context) {
  let lastErr;
  for (const ask of [askGemini, askPollinations]) {
    try {
      return await ask(messages, String(context || "").slice(0, 4000));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("no brain available");
}
