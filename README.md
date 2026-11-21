# IELTS Practice Studio

Practice all four Academic IELTS modules with exam-style tasks, instant marking and examiner-style AI feedback.

- **Computer-delivered test screens:** full-screen layout like the real computer test — split passage/questions with a draggable divider, text highlighting, question flags, a numbered navigator, countdown timer, exam mode (timed, auto-submit) and practice mode, then a review mode with explanations. Full Reading, Listening and Writing tests as well as single sets.
- **Listening & Reading:** original passages and recordings with natural multi-speaker voices (Gemini TTS), marked on the server against hidden answer keys. Exam-mode audio plays once, then 2 minutes to check.
- **Writing:** Task 1 (charts, processes) and Task 2 on a split screen with live word count, scored on the four official criteria; the full test combines both (Task 2 counts double).
- **Speaking:** a talking examiner asks every Part 1–3 question out loud, gives 1 minute to prepare Part 2, records only the candidate and scores the whole test. Single-answer recording is still available.
- **Full mock test:** Listening → Reading → Writing → Speaking with a server-kept clock per section and an overall band report.
- **Progress:** dashboard with an estimated overall band, target tracking, per-module stats and full attempt history, including word-level diffs between essay revisions.
- **Payments:** prepaid Pro (৳300 / 1 month, ৳600 / 3 months, ৳1,500 / 12 months) via SSLCommerz — bKash, Nagad, Rocket and Visa/Mastercard/Amex. Confirmed server-side; buying again extends Pro.
- **Sign-in:** email + password (with verification) or **Continue with Google** (OAuth 2.0 + PKCE).
- **Admin area (`/admin`):** revenue stats, all payments with search/filters, approve or reject held payments, give/extend/remove Pro, audit log. Access via `ADMIN_EMAILS`.
- **Content editor (`/admin/content`):** Gemini drafts new Reading passages, Listening parts, Writing tasks and Speaking topics (or copy a built-in set as a template); edit as JSON with a live preview; every answer is checked against the text before publishing; publishing records the listening audio and examiner questions with Gemini TTS. Published tests appear in the practice lists and mock tests.
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

**Natural voices (once):** run `npm run audio:generate`. It uses your `GEMINI_API_KEY` to render the listening recordings and the speaking examiner's questions to MP3 files in `public/`, and records them in `src/content/audio-manifest.json`. If it stops (free-tier rate limit), run it again later: finished clips are cached in `.cache/tts`. Until then the examiner uses the browser's built-in voice.

With no `MONGODB_URI`, development uses an in-memory MongoDB, and emails (verification links) are printed to the server log.

**On your phone (same Wi-Fi):** open the "Network" URL that `npm run dev` prints (e.g. `http://192.168.0.107:3000`). Recording audio needs HTTPS on anything except localhost, so for Speaking practice on a phone run `npm run dev:https` and accept the browser's certificate warning. Google sign-in only works from `localhost` or your real domain (Google rejects private IP addresses).

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
| `npm run audio:generate` | Render listening recordings and examiner questions with Gemini TTS (`-- --force` to redo, `-- listening` / `-- speaking` to limit) |
| `npm run audio:generate:offline` | Old offline robotic voices (needs `espeak-ng`, `mbrola`, `ffmpeg`) |

## Architecture

```
src/
  app/                 Routes. (auth) = sign-in flows, (app) = signed-in area, api/ = JSON API
  components/          UI (ui.tsx primitives; cbt/ computer-test screens; practice/, mock/, dashboard/, history/, auth/)
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

- Run `npm run audio:generate` and listen to every clip once; re-render any that sound wrong with `-- --force <id>`.
- Add a privacy policy and terms (audio is sent to Google's Gemini API for assessment; on Gemini's free tier, Google may use inputs to improve its products — use a paid tier for user data).
- Get a live SSLCommerz merchant account, set `SSLCOMMERZ_MODE=live` and register the IPN URL (`/api/billing/sslcommerz/ipn`). Prices and limits live in `src/lib/plans.ts`.
- Payments marked "Under review" (amount mismatch or high-risk flag) need a manual decision; see HANDOFF.md.
- Calibrate AI scores against a sample of essays/recordings with known examiner bands, and adjust prompts (versioned in `src/server/ai/*`).

## License

Proprietary. All rights reserved.
