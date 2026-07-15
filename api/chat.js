// api/chat.js — Vercel Serverless Function (relay)
//
// Contract (matches the client in index.html):
//   POST /api/chat   { url, headers, body }
//   -> forwards verbatim to `url`, returns the provider's JSON unchanged.
//
// Why a relay: some providers (Groq, Anthropic) refuse direct browser calls
// (CORS). This forwards them server-side. Your API key stays in YOUR browser
// and is passed through per-request — so switching providers or keys in the UI
// just works, with no environment variables to configure.
//
// No env vars needed. Deploy and go.

const ALLOWED_HOSTS = [
  "api.groq.com",
  "api.anthropic.com",
  "api.openai.com",
  "generativelanguage.googleapis.com",
  "openrouter.ai",
  "api.cerebras.ai",
  "api.mistral.ai",
  "api.deepseek.com",
  "dashscope-intl.aliyuncs.com",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST. This endpoint relays model API calls." });
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }
  if (!payload || !payload.url || !payload.body) {
    return res.status(400).json({
      error: "Expected JSON { url, headers, body }. Got: " + JSON.stringify(payload || {}).slice(0, 160),
    });
  }

  // Only relay to known model providers — otherwise this becomes an open proxy
  // that anyone who finds the URL could point at any server on the internet.
  let host;
  try {
    host = new URL(payload.url).hostname;
  } catch {
    return res.status(400).json({ error: "Malformed url: " + String(payload.url).slice(0, 120) });
  }
  const ok = ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  if (!ok) {
    return res.status(403).json({
      error: "Host not allowed: " + host + ". Add it to ALLOWED_HOSTS in api/chat.js if you trust it.",
    });
  }

  try {
    const upstream = await fetch(payload.url, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, payload.headers || {}),
      body: JSON.stringify(payload.body),
    });

    const text = await upstream.text();

    // Pass the provider's status and JSON straight through, so the client's
    // existing error handling (401 = bad key, 429 = quota, etc.) still works.
    res.status(upstream.status);
    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.json({
        error: "Provider returned non-JSON (status " + upstream.status + "): " + text.slice(0, 300),
      });
    }
  } catch (err) {
    return res.status(502).json({ error: "Relay could not reach provider: " + String(err.message || err).slice(0, 200) });
  }
}
