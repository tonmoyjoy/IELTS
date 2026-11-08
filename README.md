# IELTS Practice Studio

Practice all four Academic IELTS modules with exam-style tasks, instant marking and examiner-style AI feedback.

- **Listening & Reading:** original passages and recordings, marked on the server against hidden answer keys, converted to an estimated band with an explanation for every answer.
- **Writing:** timed Task 1 (charts, processes) and Task 2 essays, scored on the four official criteria.
- **Speaking:** timed Part 1–3 simulation plus recorded answers. The AI hears the audio, so pronunciation and fluency are judged from speech, not guessed from text.
- **Progress:** dashboard with an estimated overall band, target tracking, per-module stats and full attempt history, including word-level diffs between essay revisions.
- **Payments:** prepaid Pro (৳300 / 1 month, ৳600 / 3 months, ৳1,500 / 12 months) via SSLCommerz — bKash, Nagad, Rocket and Visa/Mastercard/Amex. Confirmed server-side; buying again extends Pro.
- **Eye-friendly design:** warm sepia light theme and night mode (WCAG AA contrast), serif reading face, adjustable text size, optional 20-20-20 eye-rest reminders.

> Scores are practice estimates, not official IELTS results.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · MongoDB/Mongoose · Google Gemini (`@google/genai`) · SSLCommerz · Zod · Vitest · Playwright · Sentry (optional)

## Quick start

```bash
nvm use            # Node 22
npm install
cp .env.example .env.local   # add GEMINI_API_KEY to try AI scoring
npm run dev        # http://localhost:3000
```

With no `MONGODB_URI`, development uses an in-memory MongoDB, and emails (verification links) are printed to the server log.

### Docker

```bash
cp .env.example .env    # set GEMINI_API_KEY (and RESEND_* to send real email)
docker compose up --build
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, run production |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript (with generated route types) |
| `npm test` | Unit tests (no database needed) |
| `npm run test:integration` | Route handlers against a real MongoDB (`TEST_MONGODB_URI`, or in-memory) |
| `npm run test:e2e` | Playwright against the production build (`E2E_MONGODB_URI`) |
| `npm run test:smoke` | Post-deploy checks against `BASE_URL` |
| `npm run verify` | Lint + typecheck + unit tests + build |
| `npm run audio:generate` | Re-render listening MP3s from the scripts (needs `espeak-ng`, `mbrola`, `ffmpeg`) |

## Architecture

```
src/
  app/                 Routes. (auth) = sign-in flows, (app) = signed-in area, api/ = JSON API
  components/          UI (ui.tsx primitives; practice/, dashboard/, history/, auth/)
  content/             Public practice content: passages, questions, tasks (no answers)
  lib/                 Client-safe helpers: band maths, text, API client, SSE reader, plans
  server/              Server-only code
    auth/              JWT sessions with token-version revocation, cookies, passwords
    ai/                Gemini client, writing/speaking examiners, prompt hardening, error mapping
    audio/             Server-side recording length (incl. browser WebM with no duration)
    billing/           Daily quotas, SSLCommerz client, checkout + payment confirmation
    content/           Answer keys and listening scripts (never sent before submission)
    http/              Error handling, JSON validation, CSRF origin guard, client IP
    practice/          Grading
    security/          Rate limiting (memory / Upstash), CSP
    services/          Auth and attempt use-cases
  proxy.ts             Per-request CSP nonce; redirects for signed-out users
```

Key design decisions:

- **The server decides every score.** Clients send answers or audio; the server grades, measures recording length and computes overall bands from criterion scores. Client-supplied scores, durations and prompts are ignored.
- **The AI is treated as untrusted.** System instructions are separate from candidate text, essays are wrapped in tagged data blocks, output is schema-validated (one retry), criteria are snapped to half bands and the overall band is derived on the server.
- **Sessions are revocable.** A JWT carries a token version that is checked against the database on every request; a password reset signs out every device.
- **Quotas are atomic.** A conditional `$inc` plus a unique `(user, day)` index means concurrent requests cannot exceed a plan's daily limit; failed AI calls are refunded.

## Deployment

1. Provision MongoDB (Atlas or self-hosted) and a Resend account with a verified sending domain.
2. Set the production variables from `.env.example`: `MONGODB_URI`, `JWT_SECRET` (32+ chars), `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `GEMINI_API_KEY`.
3. **Serverless (Vercel):** also set `RATE_LIMIT_STORE=upstash` with Upstash credentials. **Single server / Docker:** the default in-memory limiter is correct.
4. Behind a proxy other than Vercel, set `TRUST_PROXY_HOPS` or `CLIENT_IP_HEADER` so rate limits see real client IPs.
5. For payments set `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_MODE`, and register the IPN URL in the SSLCommerz panel.
6. After deploying, run `BASE_URL=https://your-domain npm run test:smoke`.

The app validates its configuration on the first request and fails loudly if anything required is missing.

## Before charging money

- Replace the synthetic listening audio (`public/listening/*.mp3`) with human or neural-TTS recordings of the same scripts; answer keys depend only on the script text.
- Add a privacy policy and terms (audio is sent to Google's Gemini API for assessment; on Gemini's free tier, Google may use inputs to improve its products — use a paid tier for user data).
- Get a live SSLCommerz merchant account, set `SSLCOMMERZ_MODE=live` and register the IPN URL (`/api/billing/sslcommerz/ipn`). Prices and limits live in `src/lib/plans.ts`.
- Payments marked "Under review" (amount mismatch or high-risk flag) need a manual decision; see HANDOFF.md.
- Calibrate AI scores against a sample of essays/recordings with known examiner bands, and adjust prompts (versioned in `src/server/ai/*`).

## License

Proprietary. All rights reserved.
