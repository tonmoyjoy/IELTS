# Security

## Goal

Harden the authentication and AI endpoints so the app is safer to deploy publicly.

## Improvements

1. Add rate limiting.
   - Login
   - Registration
   - Transcription and scoring
   - Password reset when added

2. Add CSRF protection for cookie-authenticated mutations.
   - Login
   - Register
   - Logout
   - Exam analysis

3. Improve password and account flows.
   - Email verification
   - Password reset
   - Stronger password validation
   - Optional account deletion

4. Add audit logging.
   - Login attempts
   - Failed login attempts
   - Scoring requests
   - Account changes

5. Protect secrets.
   - Document required environment variables
   - Validate secrets on app startup
   - Avoid logging API keys or tokens

## Resume Value

Security improvements make the project look deployment-ready instead of demo-only.
