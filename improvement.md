# Improvement plan — status

The original plan documents in `improvements/` were written before the hardening pass. Their status:

| Area | Status |
| --- | --- |
| 01 Testing and CI | Done: unit, integration (real MongoDB) and Playwright E2E suites; GitHub Actions CI |
| 02 AI reliability | Done: schema-validated output, retry, server-derived bands, prompt versioning, injection hardening |
| 03 Audio pipeline | Done: server-side duration measurement, single multimodal assessment, upload fallback |
| 04 Security | Done: see `SECURITY.md` |
| 05 Analytics | Done: dashboard with estimated overall, target band, per-module stats, trend, history |
| 06 User experience | Done: per-module practice pages, consistent design system, dark mode, mobile, a11y basics |
| 07 Deployment | Done: Docker, docker-compose, health check, env validation, smoke test |
| 08 Portfolio documentation | Done: README, SECURITY.md |
| 09 Local development performance | Done: offline fonts, in-memory dev database |

Open items before charging money are listed under "Before charging money" in `README.md`.
