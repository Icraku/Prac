// api/chat.js — Vercel Serverless Function
//
// Keeps your API key on the server (never shipped to the browser) and
// normalises Anthropic / Gemini / any OpenAI-compatible provider behind
// one endpoint: POST /api/chat  ->  { text: "..." }
//
// Set these Environment Variables in your Vercel project:
//   PROVIDER   anthropic | gemini | openai        (default: gemini)
//   API_KEY    your provider key                  (required)
//   MODEL      e.g. gemini-2.5-flash              (default per provider)
//   BASE_URL   only for PROVIDER=openai           (default: OpenRouter)
//
// Examples:
//   Qwen via OpenRouter -> PROVIDER=openai  BASE_URL=https://openrouter.ai/api/v1  MODEL=qwen/qwen3-max
//   Qwen via DashScope  -> PROVIDER=openai  BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1  MODEL=qwen-plus
//   Gemini              -> PROVIDER=gemini  MODEL=gemini-2.5-flash
//   Claude              -> PROVIDER=anthropic  MODEL=claude-sonnet-5

const DEFAULT_MODEL = {
  anthropic: "claude-sonnet-5",
  gemini: "gemini-2.5-flash",
  openai: "qwen/qwen3-max",
};

export default async function handler(req, res) {
  // Same-origin in normal use. Loosen only if you serve the HTML elsewhere.
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const provider = (process.env.PROVIDER || "gemini").toLowerCase();
  const apiKey = process.env.API_KEY;
  const model = process.env.MODEL || DEFAULT_MODEL[provider] || "gemini-2.5-flash";
  const baseUrl = (process.env.BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");

  if (!apiKey) return res.status(500).json({ error: "API_KEY env var is not set" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { system = "", messages = [], maxTokens = 1000 } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages[] is required" });
  }
  // Light guard so a public deployment can't be used as a free general-purpose relay.
  const capped = Math.min(Number(maxTokens) || 1200, 4000);

  try {
    let text = "";

    if (provider === "gemini") {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) + ":generateContent";
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            maxOutputTokens: capped,
            temperature: 0.9,
            // On Gemini 2.5+/3.x, "thinking" tokens are charged against maxOutputTokens.
            // Left enabled, the model can spend the entire budget thinking and return
            // empty text (finishReason MAX_TOKENS). Disable it.
            ...(/gemini-(2\.5|3)/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      });
      const d = await json(r);
      const parts = d?.candidates?.[0]?.content?.parts || [];
      text = parts.map((p) => p.text || "").join("");

    } else if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, max_tokens: capped, system, messages }),
      });
      const d = await json(r);
      text = (d.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n");

    } else {
      // OpenAI-compatible: OpenRouter, DashScope/Qwen, OpenAI, Groq, local...
      const r = await fetch(baseUrl + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        body: JSON.stringify({
          model,
          max_tokens: capped,
          temperature: 0.9,
          messages: [{ role: "system", content: system }, ...messages],
        }),
      });
      const d = await json(r);
      text = d?.choices?.[0]?.message?.content || "";
    }

    return res.status(200).json({ text: (text || "").trim() });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err).slice(0, 300) });
  }
}

async function json(r) {
  if (!r.ok) {
    const t = await r.text();
    throw new Error("upstream " + r.status + ": " + t.slice(0, 200));
  }
  return r.json();
}
