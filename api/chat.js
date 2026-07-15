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

// Vercel's default JSON body limit is 1MB — base64 audio is far bigger, so raise it.
export const config = { api: { bodyParser: { sizeLimit: "30mb" } }, maxDuration: 60 };

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
  if (!payload) {
    return res.status(400).json({ error: "Expected a JSON body." });
  }

  // ---- Audio path: Whisper transcription --------------------------------
  // Transcription needs multipart/form-data, which can't ride inside JSON.
  // The client sends base64; we rebuild the form here and post it upstream.
  if (payload.audio) {
    let host2;
    try { host2 = new URL(payload.url).hostname; }
    catch { return res.status(400).json({ error: "Malformed audio url" }); }
    if (!ALLOWED_HOSTS.some((h) => host2 === h || host2.endsWith("." + h))) {
      return res.status(403).json({ error: "Host not allowed: " + host2 });
    }
    try {
      const bytes = Buffer.from(payload.audio, "base64");
      if (bytes.length > 25 * 1024 * 1024) {
        return res.status(413).json({ error: "Audio over 25MB (Groq free-tier limit)." });
      }
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: payload.mime || "audio/webm" }), payload.filename || "audio.webm");
      form.append("model", payload.model || "whisper-large-v3-turbo");
      form.append("response_format", "json");
      if (payload.language) form.append("language", payload.language);
      if (payload.prompt) form.append("prompt", payload.prompt);

      const up = await fetch(payload.url, {
        method: "POST",
        // Only the auth header — fetch must set its own multipart boundary.
        headers: { Authorization: (payload.headers && payload.headers.Authorization) || "" },
        body: form,
      });
      const t = await up.text();
      res.status(up.status);
      try { return res.json(JSON.parse(t)); }
      catch { return res.json({ error: "Transcription returned non-JSON (" + up.status + "): " + t.slice(0, 200) }); }
    } catch (err) {
      return res.status(502).json({ error: "Transcription relay failed: " + String(err.message || err).slice(0, 200) });
    }
  }

  if (!payload.url || !payload.body) {
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
