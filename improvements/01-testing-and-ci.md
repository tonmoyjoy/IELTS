# Testing and CI

## Goal

Make the app trustworthy by proving that authentication, protected routes, scoring flows, and builds work automatically.

## Improvements

1. Add route handler tests for auth APIs.
   - Register success
   - Duplicate email
   - Login success
   - Invalid credentials
   - Logout clears cookie
   - `/api/auth/me` requires a valid token

2. Add protected API tests.
   - `/api/exam/results` rejects unauthenticated requests
   - `/api/exam/analyze` rejects unauthenticated requests
   - Invalid multipart requests return clear validation errors

3. Add Playwright end-to-end tests.
   - Register a user
   - Login
   - Open dashboard
   - Verify protected redirect behavior
   - Logout

4. Add CI workflow.
   - Run `npm run lint`
   - Run TypeScript checks
   - Run `npm run build`
   - Run unit tests
   - Run E2E tests against a local server

## Resume Value

This shows production engineering habits: test coverage, regression prevention, CI automation, and confidence around authentication.
