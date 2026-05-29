# IELTS Practice Studio

AI-powered IELTS preparation platform for Speaking, Writing, Reading, and Listening practice.

The app helps learners practise modern IELTS-style tasks, receive AI feedback, track module-wise progress, and review previous attempts from one dashboard.

## Features

### Authentication

- Email/password registration and login
- Password hashing with `bcryptjs`
- JWT session cookie authentication
- Protected dashboard and exam APIs
- Duplicate email prevention
- Basic same-origin request guard for sensitive mutations
- Upstash Redis rate limiting in production, with in-memory fallback for local development

### Speaking Practice

- Browser microphone recording
- Minimum recording duration: 30 seconds
- Maximum recording duration: 5 minutes
- Audio preview before submission
- Gemini-powered transcription
- IELTS Speaking-style evaluation
- Criteria breakdown:
  - Fluency and coherence
  - Lexical resource
  - Grammatical range and accuracy
  - Estimated pronunciation
- Streaming evaluation response
- Recent transcript history

### Writing Practice

- IELTS Academic Task 1 and Task 2 prompts
- Word count tracking
- Minimum word validation
- Gemini-powered writing evaluation
- Band score, strengths, improvement points, and criteria breakdown
- Writing history page with side-by-side revision comparison and diff highlighting

### Reading Practice

- IELTS-style academic reading mini passage
- True/False/Not Given and short-answer style questions
- Automatic answer checking
- Saved reading attempt scores

### Listening Practice

- IELTS Section 1-style listening drill
- Real MP3 playback through the Web Audio API
- Form completion and sentence completion questions
- Automatic answer checking
- Saved listening attempt scores

### Analytics

- Speaking band trend chart
- All-module progress chart
- Per-module average score
- Per-module attempt count
- Latest module score
- Saved attempt history

### AI Reliability

- Gemini model configuration
- Prompt version metadata
- AI provider/model metadata saved with attempts
- Safer JSON parsing for AI responses
- User-friendly quota and API-key error messages

## Tech Stack

- **Framework:** Next.js 16 App Router
- **UI:** React 19, Tailwind CSS 4
- **Database:** MongoDB with Mongoose
- **Auth:** JWT cookies with `jose`
- **Password hashing:** `bcryptjs`
- **AI:** Google Gemini via `@google/generative-ai`
- **Charts:** Recharts
- **Validation:** Zod
- **Local fallback DB:** `mongodb-memory-server` in development when MongoDB is unavailable

## Architecture

```text
Browser
  |
  |-- Auth pages: register / login
  |-- Dashboard: IELTS hub, recorder, analytics
  |
Next.js App Router
  |
  |-- Proxy protection
  |     - protects dashboard
  |     - protects exam/practice APIs
  |
  |-- API routes
  |     - /api/auth/register
  |     - /api/auth/login
  |     - /api/auth/logout
  |     - /api/auth/me
  |     - /api/exam/analyze
  |     - /api/exam/results
  |     - /api/writing/evaluate
  |     - /api/practice/attempts
  |
  |-- Services
  |     - Gemini audio transcription
  |     - Gemini speaking evaluation
  |     - Gemini writing evaluation
  |     - rate limiting
  |     - same-origin guards
  |
MongoDB
  |
  |-- users
  |-- testresults
  |-- practiceattempts
```

## Data Models

### User

Stores account credentials and linked speaking tests.

```text
email
password hash
tests[]
timestamps
```

### TestResult

Stores detailed Speaking attempts.

```text
user
transcript
bandScore
breakdown
summary
audio metadata
AI metadata
date
timestamps
```

### PracticeAttempt

Stores cross-module attempts for Speaking, Writing, Reading, and Listening analytics.

```text
user
module
title
score
rawScore
totalQuestions
summary
details
AI metadata
date
timestamps
```

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <your-repo-folder>
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

Create `.env.local` in the project root:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/ielts-examiner
JWT_SECRET=change-this-to-a-long-random-secret
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=your_google_ai_studio_key

# Optional model overrides
# GEMINI_TRANSCRIBE_MODEL=gemini-2.5-flash-lite
# GEMINI_MODEL=gemini-2.5-flash-lite

# Optional production rate limiting
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
```

Notes:

- `JWT_SECRET` must be at least 16 characters.
- In development, if MongoDB is missing or unreachable, the app falls back to in-memory MongoDB.
- In-memory MongoDB data is lost when the server restarts.
- For production, use a real MongoDB database such as MongoDB Atlas.

### 4. Run the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev
```

Start the Next.js development server.

```bash
npm run build
```

Create a production build.

```bash
npm run start
```

Run the production build.

```bash
npm run lint
```

Run ESLint.

```bash
npm run typecheck
```

Run TypeScript checks.

```bash
npm run test:e2e
```

Run Playwright end-to-end tests.

```bash
npm run test:unit
```

Run unit/route-handler tests for core auth + protected API flows.

```bash
npm test
```

Run the full automated suite (unit + Playwright).

```bash
npm run test:auth
```

Run the auth smoke test against a running app instance.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Production only | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign auth tokens |
| `APP_URL` | Production recommended | Canonical deployed app URL, e.g. `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | Production recommended | Public deployed app URL |
| `ALLOWED_ORIGINS` | No | Comma-separated extra origins for custom domains or previews |
| `GEMINI_API_KEY` | Yes for AI features | Google AI Studio API key |
| `GEMINI_TRANSCRIBE_MODEL` | No | Gemini model for transcription |
| `GEMINI_MODEL` | No | Gemini model for evaluation |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST URL for production rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token |
| `RESEND_API_KEY` | No | Sends verification and password reset emails when configured |
| `EMAIL_FROM` | No | Sender address for auth emails |
| `AI_EVAL_PROVIDER` | No | Optional evaluator provider override |
| `OPENAI_API_KEY` | No | Only needed if OpenAI evaluation is re-enabled |
| `OPENAI_EVAL_MODEL` | No | Optional OpenAI evaluator model |

## Security Notes

This project includes practical baseline security:

- HTTP-only auth cookie
- JWT token verification in protected routes
- Password hashing with bcrypt
- Duplicate email protection
- Same-origin mutation guard
- Rate limiting for sensitive APIs

For production, add:

- Persistent distributed rate limiting, such as Redis
- CSRF token flow
- Email verification
- Password reset
- Audit logging
- Error monitoring
- Strong secret management

## Vercel Deployment

Recommended deployment stack:

- **Frontend/API:** Vercel
- **Database:** MongoDB Atlas
- **AI:** Google AI Studio / Gemini API
- **Rate limiting:** Upstash Redis REST API

Before deploying:

1. Set all required environment variables in your hosting dashboard.
2. Use a production MongoDB URI.
3. Use a strong `JWT_SECRET`.
4. Regenerate any API keys that were exposed during development.
5. Set `APP_URL` and `NEXT_PUBLIC_APP_URL` to your deployed Vercel URL.
6. If you use a custom domain, add it to `ALLOWED_ORIGINS`.
7. Run:

```bash
npm run lint
npm run build
```

### Required Vercel Environment Variables

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-long-random-production-secret
APP_URL=https://your-project.vercel.app
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
GEMINI_API_KEY=your-google-ai-studio-key
```

### Optional Vercel Environment Variables

```env
ALLOWED_ORIGINS=https://your-project.vercel.app,https://your-custom-domain.com
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=re_...
EMAIL_FROM=IELTS Practice Studio <onboarding@resend.dev>
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_TRANSCRIBE_MODEL=gemini-2.5-flash-lite
```

### Fixing "Cross-origin request blocked"

If login or registration shows `Cross-origin request blocked` after deployment:

1. Copy your live Vercel URL.
2. In Vercel Project Settings, open Environment Variables.
3. Set:

```env
APP_URL=https://your-project.vercel.app
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

4. If using a custom domain, add:

```env
ALLOWED_ORIGINS=https://your-project.vercel.app,https://your-custom-domain.com
```

5. Redeploy the project.

The app also reads Vercel forwarded host headers and `VERCEL_URL`, so most deployments work automatically. `APP_URL` is the most reliable explicit production setting.

## GitHub Checklist

Before pushing publicly:

- Remove real secrets from `.env.local`
- Keep `.env.local` ignored by Git
- Use `.env.example` for placeholder values
- Add screenshots or a short demo GIF
- Add a live deployment link if available
- Run lint and build successfully

Useful commands:

```bash
git status
git add .
git commit -m "Build IELTS practice studio"
git push origin main
```

## Current Limitations

- Reading and listening include starter drills; more full-length practice sets can be added.
- Rate limiting uses Upstash Redis when configured and falls back to in-memory limits.
- Gemini quota depends on the API key/project limits.
- AI scores are practice feedback, not official IELTS results.

## Roadmap

- Add full-length Listening tests with more audio sets
- Add full Reading tests with 40 questions
- Add more Writing history analytics
- Expand Speaking timed mode with saved phase recordings
- Add user profile and target band planning
- Add Docker Compose for local MongoDB setup

## License

This project is intended as a portfolio and learning project. Add your preferred license before publishing publicly.
