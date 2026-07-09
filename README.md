# The Room — AI Workplace Communication Simulator

A single-file web app. **Zero dependencies**: no React, no build step, no CDN,
no web fonts. `index.html` runs on its own, offline, from anywhere.

Modules: Interview Simulator · Workplace Scenarios · Presentation Studio
(reactive audience) · Progress & Profile.

---

## Option A — Static hosting (GitHub Pages, Netlify, or just open the file)

1. Commit `index.html` to your repo (root or `/docs`).
2. Settings → Pages → pick that branch/folder.
3. Open the site, click the **sliders icon**, choose a provider, paste your API key, Save.

The key is stored in *your own browser's* localStorage. Nothing is sent anywhere
except directly to the model provider you chose. This is fine for personal use
even on a public URL — every visitor has their own empty storage.

Browsers can only call providers that permit cross-origin requests:

| Provider | Direct from browser? |
|---|---|
| Google Gemini | yes |
| Anthropic Claude | yes |
| OpenRouter (incl. Qwen, Llama, DeepSeek) | yes |
| OpenAI direct | usually blocked → use Option B |
| Alibaba DashScope (Qwen) | usually blocked → use Option B |

**Cheapest way to start:** Gemini (`gemini-2.5-flash`) has a free tier.
**Want Qwen without a server:** pick *OpenAI-compatible* → **OpenRouter** preset.

---

## Option B — Vercel (key stays on the server, every provider works)

Use this if you want the key hidden, or you need OpenAI-direct / DashScope.

```
your-repo/
  index.html
  api/chat.js
```

1. Push to GitHub, then "Add New Project" on vercel.com and import the repo.
2. Framework preset: **Other**. No build command. Output directory: leave blank.
3. Add Environment Variables (Project → Settings → Environment Variables):

| Name | Example |
|---|---|
| `PROVIDER` | `gemini` · `anthropic` · `openai` |
| `API_KEY` | your key |
| `MODEL` | `gemini-2.5-flash` |
| `BASE_URL` | only if `PROVIDER=openai` |

   Qwen via DashScope:
   `PROVIDER=openai`,
   `BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`,
   `MODEL=qwen-plus`

4. Deploy. Open the site → sliders icon → provider **“Server proxy”** → leave
   the URL as `/api/chat` → Save.

Now the browser calls only your own `/api/chat`, and the key never leaves Vercel.

> A deployed proxy will happily answer anyone who finds the URL. If the site is
> public, set `ALLOW_ORIGIN` to your domain and consider adding auth.

---

## Speaking & the audience

- **Mic (speech-to-text)** works in **Chrome / Edge**. Safari is patchy,
  Firefox doesn't support it. Without it you can still type, and the
  presentation timer/meters still work.
- The mic needs **HTTPS or `localhost`** — GitHub Pages and Vercel both qualify.
  Opening `index.html` straight off disk (`file://`) may block the mic in some
  browsers; if so, run `python3 -m http.server` and visit `localhost:8000`.
- The Presentation Studio's **camera self-view is a mirror only** — there is no
  automated eye-contact, posture or gesture scoring.
- Voice analysis measures **loudness/energy and pace**, not pitch or tone.
- Audience reactions refresh roughly every 14 seconds, driven by what you
  actually said. Long talks make a steady trickle of small model calls — use a
  cheap/fast model (`gemini-2.5-flash`, `qwen-flash`) for these.

## Data

Everything (profile, scores, session history) lives in `localStorage` on your
device. Clearing site data resets it. Nothing is uploaded.
