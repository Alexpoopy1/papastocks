"use client";

import { useEffect, useRef, useState } from "react";

/* AI chat card wrapped in the animated rainbow gradient border. */
export default function AIChat({ context = "", intro, suggestions = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context })
      });
      const data = await res.json();
      const reply = data.reply || data.error || "Sorry, I couldn't answer that just now.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "I lost my connection — please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-frame">
      <div className="ai-inner">
        <div className="chat-scroll" ref={scrollRef}>
          {!messages.length && (
            <div className="msg ai">
              {intro || "Hi Papa! 👋 Ask me anything about your stocks — I'll keep it simple."}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "user" : "ai"}`}>
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="msg ai">
              <span className="typing"><i /><i /><i /></span>
            </div>
          )}
          {!messages.length && suggestions.length > 0 && (
            <div className="pill-row" style={{ marginTop: 4 }}>
              {suggestions.map((s) => (
                <button key={s} className="pill" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask a question…"
            disabled={busy}
          />
          <button className="chat-send" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 19V5m0 0-6 6m6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
