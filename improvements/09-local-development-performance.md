# Local Development Performance

## Current Issue

Next.js reports a slow filesystem when running from `D:\claude`:

```text
Slow filesystem detected
```

The first request can take a long time because `next dev` compiles routes on demand and writes many files under `.next/dev`.

## Fixes Already Applied

1. Added `allowedDevOrigins` for the LAN address used in the warning:

```ts
allowedDevOrigins: ["192.168.68.104"]
```

This removes the blocked HMR request when testing from `http://192.168.68.104:3000`.

## Recommended Local Fix

Move the project to a fast local folder that is not synced, network-backed, or heavily scanned by antivirus.

Good examples:

```powershell
C:\Projects\claude
C:\dev\claude
```

Then run:

```powershell
npm install
npm run dev
```

## Optional Windows Fixes

1. Add the project folder to Windows Defender exclusions.
2. Avoid running the project from OneDrive, external drives, mapped drives, or synced folders.
3. Delete `.next` after moving the project so Next.js can rebuild cleanly.

## Why This Matters

The log shows most of the slow request was Next.js compile time, not application code:

```text
GET / 200 in 32.0s (next.js: 31.7s, application-code: 311ms)
```

That means the app code is not the main bottleneck. The dev filesystem and first-time route compilation are.
