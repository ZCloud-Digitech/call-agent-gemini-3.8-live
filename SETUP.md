# 🎙️ Restaurant Voice Agent — Gemini 3.8 Live (Tanglish Setup)

Un stack: **React (Vite) + Cloudflare Worker + Firebase**, voice model
**`gemini-3.8-live`**. Card வேண்டாம், Gmail போதும். Phone number வேண்டாம் —
browser mic/speaker-ஏ போதும்.

## Architecture

```
Browser (React) ──①──► Cloudflare Worker ──②──► Google (real API key)
    │                  (ephemeral token தரும்)
    └───③ WebSocket audio (ephemeral token) ──► gemini-3.8-live
    │
    └───④ booking ──► Firebase (Firestore)
```

- **Worker** — Google API key-ஐ safe-ஆ vachu, browser-ku short-life token தரும்.
- **React** — mic PCM-ஐ WebSocket vazhiya Gemini Live-ku anuppum, agent குரலை play பண்ணும்.
- **Firebase** — booking save.

---

## ⚡ Local run (.env setup)

Secrets ellam rendu file-la — rendum `.gitignore`-la irukku, commit aagadhu.

| File | Enna podanum |
|------|--------------|
| `worker/.dev.vars` | `GEMINI_API_KEY` (AI Studio key) |
| `web/.env` | `VITE_TOKEN_URL` (local-la `http://localhost:8787`) + `VITE_FIREBASE_*` |

```bash
# Terminal 1 — Worker (token server)
cd worker
npm install
npm run dev            # http://localhost:8787

# Terminal 2 — React app
cd web
npm install
npm run dev            # http://localhost:5173
```

`.env` maathina `npm run dev`-a restart pannu (Vite start-la mattum read pannum).
Deploy pannumbodhu `VITE_TOKEN_URL`-a un `*.workers.dev` URL-ku maathu.

---

## Step 1 — Gemini API key (FREE, card வேண்டாம்)

1. **aistudio.google.com** → un Gmail (nex.x.startup@gmail.com) vachu login.
2. **Get API key** → create. Card கேட்காது, free tier உடனே active.

## Step 2 — Cloudflare Worker deploy

```bash
cd worker
npm install -g wrangler              # mudhal thadava mattum
npx wrangler login
npx wrangler secret put GEMINI_API_KEY   # un key-ஐ paste pannu
npx wrangler deploy
```

Deploy URL (ex: `https://gemini-voice-token.santhosh.workers.dev`)-ஐ
`web/src/VoiceAgent.jsx`-la `TOKEN_URL`-la podu.

## Step 3 — Firebase

1. console.firebase.google.com → Add project (free Spark).
2. Firestore → Create → test mode.
3. Config-ஐ `web/src/firebase.js`-la podu.

## Step 4 — React app

```bash
cd web
npm install
npm install @google/genai firebase
npm run dev
```

Browser open → **"Pesa aarambi"** → mic allow → Tanglish-la pesu! 🎉

---

## Business-ku customize (3 இடம் மட்டும்)

| Enna maathanum | File |
|----------------|------|
| Restaurant details / prompt | `VoiceAgent.jsx` → `INSTRUCTIONS` |
| Worker URL | `VoiceAgent.jsx` → `TOKEN_URL` |
| Firebase project | `firebase.js` → `firebaseConfig` |

## Cost

| Part | Cost |
|------|------|
| Gemini API key | **Free tier** (card வேண்டாம், rate limit உண்டு) |
| Cloudflare Worker | Free (100k req/day) |
| Firebase (Spark) | Free |
| Hosting (Cloudflare Pages) | Free |

Start பண்ண **முழுக்க free**. Limit அடிச்சா மட்டும் paid-ku போகலாம்.

---

## ⚠️ Mukkiyamana note (padichுko)

Gemini Live API + `@google/genai` SDK fast-ஆ update aagum. Keezha
details deploy பண்ணும்போது மாறலாம் — error வந்தா exact message vachu fix:

- **Ephemeral token endpoint** (`/v1alpha/auth_tokens`) — SDK version-la
  slight-ஆ மாறலாம், [docs](https://ai.google.dev/gemini-api/docs/ephemeral-tokens) check.
- **Received audio field** (`msg.data`) — SDK message shape மாறலாம்.
  Console-la `msg` print panni, audio எந்த field-la வருதுnu paaru.
- **Model id** `gemini-3.8-live` — [current models](https://ai.google.dev/gemini-api/docs/models) confirm.
- Mic capture-ku `ScriptProcessorNode` use பண்ணியிருக்கேன் (எல்லா browser-லயும்
  work aagum, aana old API). Later `AudioWorklet`-ku upgrade பண்ணலாம்.

Error வந்தா exact message-ஐ paste பண்ணு — udane fix panni தரேன்.

## Next steps

- **Booking auto-save:** Gemini "function calling" add panni, booking-ஐ
  `saveBooking()` vazhiya Firestore-la தானா save.
- **Real phone calls:** Twilio connect.
- **Multi-business dashboard:** un CRM-la ovvoru client bookings காட்டு.
