# The Room — AI Workplace Communication Simulator

Single-file app. **Zero dependencies**: no React, no build step, no CDN, no web
fonts. `index.html` runs on its own from anywhere.

Modules: Interview Simulator · Workplace Scenarios · Presentation Studio
(reactive audience) · Progress & Profile.

---

## How the two files fit together

- **`index.html`** — the whole app. Your API key lives in *your browser*.
- **`api/chat.js`** — an optional **relay**. Some providers refuse direct calls
  from a browser (CORS); this forwards those requests server-side.

The client sends the relay `{ url, headers, body }` and the relay forwards it
verbatim. **These two must match** — if you swap in a different `chat.js`
(e.g. one that expects `{system, messages}` and reads env vars), every call
returns 400 and reports never generate.

No environment variables are needed. Deploy and go.

---

## Which providers need the relay?

| Provider | Direct from browser | Notes |
|---|---|---|
| **Groq** | ✗ needs relay | Free, fast, no card. Best default. |
| **Google Gemini** | ✓ | Free daily quota. `flash-lite` stretches furthest. |
| **OpenRouter** (Qwen, Llama, DeepSeek) | ✓ | Paid, cheap; some `:free` models. |
| **Anthropic Claude** | ✗ needs relay | Paid only. |

On **GitHub Pages** there is no server, so `api/chat.js` does nothing — use
**Gemini** or **OpenRouter** with the proxy toggle **off**.
For **Groq** or **Anthropic**, deploy to Vercel (below).

Use **Settings → Test connection** before a session. It tells you exactly what's
wrong (bad key, wrong model name, quota, proxy not deployed) instead of failing
mid-interview.

---

## Option A — GitHub Pages / Netlify / open the file

1. Commit `index.html`. Settings → Pages → pick the branch.
2. Open the site → sliders icon → **Gemini** (or OpenRouter) → paste key →
   proxy toggle **off** → **Test connection**.

## Option B — Vercel (adds Groq + Anthropic)

```
your-project/
├── index.html
├── package.json      ← { "type": "module" }
└── api/
    └── chat.js
```

`package.json` must contain exactly:

```json
{ "type": "module" }
```

Without it Vercel treats `chat.js` as CommonJS, `export default` throws, and the
function 500s. (Alternative: rename to `api/chat.mjs`.)

1. Push to GitHub → vercel.com → Add New Project → import the repo.
2. Framework preset **Other**. No build command. No env vars.
3. Deploy, open the Vercel URL → Settings → **Groq** → paste key → the proxy
   toggle switches on automatically → **Test connection**.

Check `/api/chat` is live: visiting it in a browser should return
`{"error":"Use POST..."}`. If you get a 404 or an HTML page, the function isn't
deployed and the app will say so.

> The relay only forwards to known model hosts (see `ALLOWED_HOSTS`), so a public
> deployment can't be turned into an open proxy. It will still spend *your*
> callers' keys, not yours — keys are never stored on the server.

---

## Picking a free model

- **Groq · `llama-3.3-70b-versatile`** — best free quality/quota balance. Needs
  the relay.
- **Gemini · `gemini-2.5-flash-lite`** — the most generous Gemini free quota, and
  works with no server at all.
- Avoid the weakest OpenRouter `:free` models — they ignore JSON instructions and
  produce flaky reports.

Free tiers cap **requests per day**, and limits change — check your provider's
dashboard. For long presentations set Settings → **Audience reaction pace** to
*Frugal*.

## Gotchas this app already handles

1. **Gemini 2.5+ thinking tokens** are billed against `maxOutputTokens`. Left on,
   the model burns the budget thinking and returns *empty text*. The app sends
   `thinkingBudget: 0`.
2. **Native JSON mode** (`response_format` / `responseMimeType`) is enabled for
   every report and structured call — this is what makes reports reliable.
3. **Reports never lose a session.** If the model returns malformed scores or
   nothing at all, the app coerces what came back, fills gaps from your measured
   pace/length/fillers, marks it **"Estimated locally,"** and still saves.

## Question drill (record → Whisper → rewrites)

After any interview or presentation, hit **Take questions**. Every question from
the session lists on the left; each highlights in turn with a 3-second countdown,
then records your voice. Hit **Stop & next** and that answer transcribes in the
background while you answer the next one. At the end it waits for any stragglers,
then the AI writes a stronger version of each answer **in your own words**.

Transcription uses **Whisper Large v3** (the real open-source model) served free
by Groq — 2,000 transcriptions/day, 25MB per clip. Settings → **Voice recording**:
paste a Groq key (or leave blank if Groq is already your provider). It needs the
relay deployed, because audio can't be posted to Groq from a browser.

`whisper-large-v3-turbo` is the default (fastest); `whisper-large-v3` is the most
accurate. Without a Groq key the drill falls back to typing.

## Speaking

- The in-session mic uses the browser recogniser (**Chrome / Edge** only, and
  noticeably less accurate). The question drill uses Whisper instead.
- Needs **HTTPS or localhost** — Pages and Vercel both qualify. Opening the file
  from disk may block the mic; run `python3 -m http.server` and use
  `localhost:8000`.
- The presentation camera self-view is a **mirror only** — no eye-contact or
  posture scoring.

## Case study (EY SAT)

A fourth module: **Case study**. Pick firm → service line → team → level, choose
one of 10 cases, set your timings, and take it.

- **Read** the case against a countdown (3/5/10/15 min or untimed) with the data
  exhibit pinned beside it.
- **Present** out loud. The browser recogniser drives the live transcript while
  MediaRecorder feeds **Whisper** for the accurate final one.
- **Panel Q&A** — questions are generated from *what you actually said*, tagged
  easy/medium/hard, 2–5 of them.
- **Debrief** — scored on structure, commercial judgement, use of the data,
  recommendation, clarity and presence; the angles you missed; and your whole
  presentation rewritten **in your own voice, better ordered**. Saved to Progress
  and reopenable like any other report.

Only **EY → Strategy and Transactions** is enabled (Parthenon, VME, Transaction
Diligence, Corporate Finance, TSE, TRS, Infrastructure). The other firms and
service lines are visible but greyed out.

The 10 cases are set against real FY2026 conditions — AI-driven power demand and
the utility deal wave, the carve-out surge, the PE exit backlog, private credit's
first cycle test, the pharma patent cliff, tariffs and inflation, European defence,
Japanese outbound M&A, and infrastructure rotation. **The companies are fictional**;
the market context is real.

## Your own question banks

Setup → **Your question banks**. Drop in `.docx`, `.txt`, `.md` or `.csv` (PDF
isn't supported offline — paste the text). They're parsed into individual
questions, stored in this browser, and reused in every future interview.
Numbering (`1.` `2)` `Q4:` `-` `•`) is stripped; short lines ending in `:`
become section headings.

Choose the blend with **How much to use them**: ignore / mostly tailored /
balanced / mostly bank / bank only.

How it works, and why it's cheap: your questions are ranked against your CV and
the JD **locally** by keyword overlap (no API call), the best ~45 are shortlisted,
then **one** planning call weaves the chosen number of bank questions with fresh
CV-tailored ones and orders them easiest-first. During the interview the rail
tags each question **my bank** / **follow-up**, so you can see the blend live.
The interviewer still improvises follow-ups off your answers.

You can also drop a `questions.json` next to `index.html`
(`{"name":"HR Bank","questions":["...","..."]}`) and it auto-loads — same-origin,
so it isn't a CDN request.

## Progress archive

Every finished report is stored in full — scores, summary, transcript, Q&A. In
**Progress & profile**, click any past session to reopen its complete report.
Rewrites you generate are cached back into the record, so reopening is free.

Full reports are big, so if `localStorage` fills up the app strips the heavy
payload off the *oldest* sessions first (they stay in the trend chart, marked
"report cleared for space") rather than dropping the new one.

## Data

Profile, scores, reports and history live in `localStorage` on your device.
Nothing is uploaded.
