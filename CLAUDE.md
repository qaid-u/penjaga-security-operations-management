# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PENJAGA (Sistem Pengurusan Operasi Keselamatan Berasaskan Kepintaran Buatan) is a security-operations app covering guard scheduling and attendance, daily incident reports with local NLP classification, review and follow-up, and a 3D building command centre. It has two npm projects: the root project is the React/Vite frontend plus the test tooling, and `backend/` is a separate CommonJS Express + PostgreSQL API with its own `package.json` and lockfile. Use Node 24.

The domain language is Malay. Table and column names (`tbl_laporan_harian`, `id_pengguna`, `kandungan_laporan`), role names, API error messages and UI text are all Malay. Keep new code consistent with that. The three roles are defined in `backend/config/roles.js`: `Pentadbir Sistem` (admin), `Ketua Pengawal` (chief) and `Pengawal Keselamatan` (guard).

## Commands

Install with `npm install` at the root and `npm --prefix backend install`.

| Task | Command |
| --- | --- |
| Frontend dev server (port 5173) | `npm run dev` |
| Backend only (port 3000, binds 127.0.0.1) | `npm --prefix backend start` (or `run dev` for nodemon) |
| Start or reuse both, with DB/model readiness checks | `npm run dev:system` |
| Main verification (CI gate) | `npm run check`: lint, `node --check` on backend entry points, production build |
| Lint | `npm run lint` |
| Backend unit/integration tests | `npm run test:backend` (`node --test backend/tests/*.test.js`) |
| Single backend test file | `node --test backend/tests/nlp-engine.test.js` |
| Single test by name | `node --test --test-name-pattern="pattern" backend/tests/<file>.test.js` |
| NLP / event-dialogue tests | `npm run test:nlp`, `npm run test:events` |
| Building/3D pure-logic tests | `npm run test:building` |
| Browser suites (Playwright) | `npm run test:building:browser`, `test:phase5:browser`, `test:phase8:browser`, `test:phase6` |
| Single Playwright spec | `npx playwright test --config playwright.phase8.config.mjs schedule-usability.spec.mjs` |
| Retrain the baseline NLP model | `npm run train:nlp` (writes `backend/ml/model/nlp-model.json`) |
| DB migrations | `npm --prefix backend run db:status`, `db:migrate`, `db:migrate -- --init` (empty DB only), `db:backup` |
| Deployment smoke test | `npm --prefix backend run smoke` |

Test environment notes:
- Playwright defaults to the system Edge (`channel: msedge`). Set `PLAYWRIGHT_CHANNEL=chromium` to use the bundled Chromium, as CI does.
- Each Playwright config starts its own Vite server on a fixed port (4175, 4176, 4180, …) with `reuseExistingServer: false`. Stop anything already using that port first.
- The phase8 browser specs intercept API calls and need no backend. The phase5 and phase6 specs run a real backend against isolated demo databases (`penjaga_phase5_demo` / `penjaga_phase6_demo`), prepared by `node backend/scripts/prepare-phase5-demo.js` and `npm run demo:phase6:prepare`. `backend/scripts/phase5-demo-config.js` refuses non-local hosts and other database names. Never point these at the operational database.
- DB-backed backend tests (e.g. `operational-flow.test.js`) create a disposable schema per run via `search_path` and run `migrate(pool,{initialize:true})` into it. They need a reachable local PostgreSQL configured in `backend/.env`.

## Architecture

### Backend (`backend/`)
- `server.js` wires helmet, CORS (`FRONTEND_URL`, comma-separated), `no-store` caching and IP rate limiting on `/api` and `/uploads`, then mounts `routes/*` → `controllers/*`. User and post CRUD, plus the authenticated `/uploads/:filename` evidence download, are defined inline in `server.js`. A download is served only when a DB row references the file and the caller's role or ownership allows it. The MIME type comes from file-signature sniffing, never from the filename.
- `server.js` also starts two long-running background workers on the same process: the NLP job worker (`services/nlpJobs.js`) and the automatic retraining worker (`services/automaticLearning.js`). Environment flags control them: `NLP_WORKER_ENABLED`, `NLP_AI_REVIEW_ENABLED`, `NLP_AUTO_TRAIN_ENABLED`, `NLP_RETRAIN_MIN_LABELS`. Express must stay a long-running service, not serverless.
- `middleware/auth.js`: `auth` verifies an HS256 JWT, then reloads the user from `tbl_pengguna` on every request and rejects inactive accounts. `requireRole(...)` enforces roles. Routes compare against `req.user.nama_peranan`. Guards are scoped to their own records inside the controllers, so enforce that on the backend for any new endpoint.
- In production, `JWT_SECRET` must be at least 32 characters and must not look like a placeholder, and `FRONTEND_URL` must be set. The server exits at startup if either check fails.
- Some routers are mounted twice under Malay and English paths (`/api/jadual` and `/api/schedules`, `/api/nlp` and `/api/nlp-training`).

### Database
- `database/schema.sql` + `roles.sql` initialize an empty DB, then `database/migrations/NNN_name.sql` are applied in order by `database/migrate.js`. Each applied migration is recorded with a SHA-256 checksum (CRLF normalized) in `tbl_schema_migrations`.
- **Never edit an applied migration.** The runner aborts on checksum changes and on unknown applied versions. Add a new numbered file instead, with a unique 3-digit prefix matching `^\d{3}_[a-z0-9_]+\.sql$`.
- Docker Compose runs migrations before the API listens. `seed.sql` holds the official posts and demo data. Demo accounts (password `Password123!`, users `admin`/`ketua`/`amir`/`siti`/`kumar`) exist only in seeded/demo databases. Production gets its first admin via `backend/scripts/bootstrap-admin.js`.
- `config/dbOptions.js` accepts either `PG*` variables or `DATABASE_URL`, and handles TLS settings.

### Report → NLP pipeline (`backend/ml`, `backend/services/nlpJobs.js`)
1. Submitting a report commits it together with a durable row in `tbl_job_nlp`, keyed by an input hash of narrative + post + clarification answers.
2. The local worker runs `ml/nlpService.processNLP`. `textModel.js` validates and runs the Multinomial Naive Bayes count model. `reportAnalysis.js` combines it with the DB-configured keywords from `tbl_kategori_insiden` and with source-context rules for negation, drills and suspected or unclear events, producing per-event spans. `eventDialogue.js` and `clarificationInput.js` handle the optional clarification questions.
3. A single transaction saves the result to `tbl_hasil_nlp` (rich `metadata` JSON), updates the report's `tahap_risiko`, and inserts a deduplicated High/Critical notification for chiefs.
4. Optional Gemini review (`ml/geminiReviewer.js`) runs in a separate lease-based queue. It is advisory only: it cannot change risk scores or decisions, and it can never suppress the conservative alert. Before attaching its result, the worker re-checks the input hash.
5. Risk bands: Low 0–30, Medium 31–60, High 61–80, Critical 81–100. Confidence is an uncalibrated score, so do not present it as a probability.

Automatic learning: a chief's explicit category confirmation (separate from report approval) is captured as a label. Once 20 or more eligible new label families exist, a candidate model is trained in a worker thread. It is activated only if it passes regression checks, and it is stored in PostgreSQL. The tracked `nlp-model.json` is the fallback baseline. Demo data and the model's own predictions are never used for training.

### Frontend (`src/`)
- `App.jsx` defines role-gated routes using `<Protected roles={[...]}>`, with Malay paths: `/laporan`, `/semakan`, `/tindakan`, `/jadual`, `/pos`, `/pengguna`, `/audit`, `/notifikasi`, `/3d-command-centre`. Role gating on the frontend is presentation only. The backend is the authority.
- `src/api/axios.js` is the single API client. It reads `VITE_API_URL`, attaches the bearer token from `localStorage`, and redirects to `/login` on a 401. `VITE_API_ORIGIN` is used for upload and media URLs.
- The 3D command centre (`src/components/building/`, three.js via @react-three/fiber/drei) loads one GLB at a time from `public/models/`. Building and post metadata come from `backend/config/securityBuildings.json` and `djmSecurityPosts.json`, served through `/api/3d`. Marker positions are visual estimates. Blender sources live in `artifacts/`.
- `vite.config.js` contains a custom middleware that returns 403 for private paths (`backend/`, `docs/`, `artifacts/`, `.env*`, `*.local`, `*.log`, …). If a new top-level directory must stay private, add it to that list.

### Deployment
- Docker Compose (`docker-compose.yml`, `Dockerfile`, `nginx.conf`) runs PostgreSQL, the API and an Nginx-served React build on a single host. Only Nginx publishes a port.
- On Vercel, only the frontend is hosted. `npm run build:vercel` runs `scripts/check-vercel-config.mjs`, which requires `VITE_API_URL`.
- See `DEPLOYMENT.md` and `docs/final/DEPLOYMENT_GUIDE.md`.

## Repository conventions
- Hidden `.*.local/` directories and `*.local.log` files at the root are local test or runtime output (screenshots, logs, the demo cluster config at `.phase5-runtime.local/connection.json`). They are ignored, so do not commit them.
- `docs/` contains academic (PSM) and testing documentation. The `docs/testing/*.md` notes (AUTOMATIC_CLASSIFICATION, AUTOMATIC_LEARNING, OPERATIONAL_FLOW, SCHEDULE_USABILITY, …) describe the intended behavior of each feature and are useful context before changing it.
