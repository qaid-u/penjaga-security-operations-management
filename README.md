# PENJAGA - Sistem Pengurusan Operasi Keselamatan

Functional full-stack prototype for:

**Sistem Pengurusan Operasi Keselamatan Berasaskan Kepintaran Buatan (PENJAGA)**

The "AI" scope in this prototype is intentionally limited to local, rule-based NLP. It does not use external AI APIs, automated scheduling, forecasting, or machine-learning prediction.
It also does not include CCTV integration, IoT sensor integration, or door access control integration.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, React Router, Axios, Recharts
- Backend: Node.js, Express.js, PostgreSQL, JWT, bcrypt
- Database: PostgreSQL relational schema

## Install Dependencies

```bash
npm install
cd backend
npm install
```

## PostgreSQL Setup

Create a database:

```bash
createdb penjaga_db
```

Load schema and seed data:

```bash
psql -d penjaga_db -f backend/database/schema.sql
psql -d penjaga_db -f backend/database/seed.sql
node backend/scripts/migrate-3d.js
```

The 3D page uses the seven official security posts for Bangunan Dato’ Jaafar Muhammad. Floor labels are shown where supplied; indoor coordinates remain unconfirmed. See [official post configuration](docs/testing/DJM_OFFICIAL_POSTS.md). Restart the backend after updating an existing installation.

Editable Blender sources, GLB exports and preview images for the additional buildings are listed in the [exterior model catalogue](artifacts/README.md). BDMIM shares the BDMSP geometry, and Rumah SS/Rumah VIP share one residence asset. These standalone models, including UTC Johor, are prepared for later application integration; the current public viewer asset remains DJM. See the [model release checks](docs/testing/MODEL_LIBRARY_RELEASE.md).

Optional backend environment file: `backend/.env`

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=change-this-for-production
PGHOST=localhost
PGPORT=5432
PGDATABASE=penjaga_db
PGUSER=postgres
PGPASSWORD=postgres
```

You can also use `DATABASE_URL=postgres://user:password@localhost:5432/penjaga_db`.

## Run Backend

```bash
cd backend
npm start
```

API health check:

```bash
http://localhost:3000/api/health
```

Readiness check with database connectivity:

```bash
http://localhost:3000/api/ready
```

Deployment smoke test:

```bash
cd backend
npm run smoke
```

## Run Frontend

```bash
npm run dev
```

Open:

```bash
http://localhost:5173
```

## Quality Checks

Phase 5 validation and academic evaluation materials are in [docs/psm-evaluation](docs/psm-evaluation/SYSTEM_TEST_PLAN.md). The implementation audit, measured performance, security results, empty participant templates and synthetic demonstration guide are separate from human evaluation outcomes, which are pending collection.

```bash
npm run test:building
npm run test:evaluation
npm run test:backend
npm run test:building:browser
npm run test:phase5:browser
```

The last suite requires the separate synthetic demonstration database described in [DEMONSTRATION_CHECKLIST.md](docs/psm-evaluation/DEMONSTRATION_CHECKLIST.md). It never seeds the operational database. Existing 3D integration fixtures are rolled back. Use Node 24 with the committed root/backend lockfiles. Configure `PLAYWRIGHT_CHANNEL=chromium` when using Playwright's bundled Chromium instead of the workstation's Edge.

Run the main local verification suite:

```bash
npm run check
```

This runs frontend/backend linting, backend syntax checks, smoke-test syntax check, and the production frontend build.

## Default Login Credentials

All demo accounts use password:

```text
Password123!
```

| Role | Username | Email |
| --- | --- | --- |
| Pentadbir Sistem | admin | admin@penjaga.local |
| Ketua Pengawal | ketua | ketua@penjaga.local |
| Pengawal Keselamatan | amir | amir@penjaga.local |
| Pengawal Keselamatan | siti | siti@penjaga.local |
| Pengawal Keselamatan | kumar | kumar@penjaga.local |

## Main Screens

- Login
- Dashboard Analitik
- Dashboard Pengawal
- Laporan Harian, mobile-friendly
- Semakan Laporan
- Tindakan Susulan
- Audit Trail
- User Management
- Pos Kawalan Management
- Notification Page
- Latihan NLP
- Import Jadual CSV/PDF

## Operational Reference

Jumlah anggota pembantu keselamatan bagi setiap syif:

| Hari | Syif | Waktu | Jumlah Anggota |
| --- | --- | --- | --- |
| Hari bekerja | Pagi | 07:00 AM - 04:00 PM | 24 orang, termasuk 12 orang syif pentadbiran |
| Hari bekerja | Petang | 02:45 PM - 11:45 PM | 12 orang |
| Hari bekerja | Malam | 11:00 PM - 08:00 AM | 12 orang |
| Hari tidak bekerja | Pagi | 07:00 AM - 04:00 PM | 12 orang |
| Hari tidak bekerja | Petang | 02:45 PM - 11:45 PM | 12 orang |
| Hari tidak bekerja | Malam | 11:00 PM - 08:00 AM | 12 orang |

Senarai pos kawalan rasmi dimasukkan dalam `backend/database/seed.sql`.

## Rule-Based NLP

The verified runtime uses database-configured keyword rules:

- Database-configured keyword rules at runtime. The saved Naive Bayes training artifact is not compatible with the runtime `weights` contract.
- Active keywords are read from `tbl_kategori_insiden`; no confidence-based fallback is implemented.

When a Pengawal Keselamatan submits a daily report, the backend:

1. Cleans the text
2. Converts it to lowercase
3. Removes unnecessary symbols
4. Detects configured keywords
5. Classifies incident category
6. Calculates a risk score
7. Assigns risk level
8. Generates a short summary
9. Saves the result into `tbl_hasil_nlp`
10. Creates a notification for Ketua Pengawal when the risk is High or Critical

Pentadbir Sistem can tune the active NLP keywords and risk level in the Latihan NLP screen. New reports use the latest saved keyword rules.

## Train NLP Model

Realistic dummy training data is stored in:

```text
backend/ml/data/nlp-training-samples.json
```

Train or retrain the local model:

```bash
npm run train:nlp
```

The generated model is saved to:

```text
backend/ml/model/nlp-model.json
```

Training produces an experimental artifact; it does not activate the saved Naive Bayes classifier in the current runtime. See `backend/ml/README.md`.

Risk levels:

- Low: 0-30
- Medium: 31-60
- High: 61-80
- Critical: 81-100

## API Endpoint List

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Role |
| --- | --- | --- |
| GET | `/health` | Public |
| POST | `/auth/login` | Public |
| GET | `/auth/me` | Authenticated |
| GET | `/meta` | Authenticated |
| GET | `/reports` | All roles, scoped for Pengawal |
| POST | `/reports` | Pengawal Keselamatan |
| PATCH | `/reports/:id/review` | Ketua Pengawal |
| GET | `/dashboard` | Pentadbir Sistem, Ketua Pengawal |
| GET | `/guard-dashboard` | Pengawal Keselamatan |
| GET | `/actions` | Pentadbir Sistem, Ketua Pengawal |
| POST | `/actions` | Pentadbir Sistem |
| POST | `/actions/:id/progress` | Ketua Pengawal |
| PATCH | `/actions/:id` | Pentadbir Sistem |
| GET | `/nlp/:reportId` | Pentadbir Sistem |
| GET | `/nlp-training` | Pentadbir Sistem |
| PATCH | `/nlp-training/:id` | Pentadbir Sistem |
| GET | `/schedules` | All roles, scoped for Pengawal |
| POST | `/schedules` | Pentadbir Sistem, Ketua Pengawal |
| POST | `/schedules/import` | Pentadbir Sistem, Ketua Pengawal |
| PATCH | `/schedules/:id` | Pentadbir Sistem, Ketua Pengawal |
| PATCH | `/schedules/:id/check-in` | Pengawal Keselamatan |
| PATCH | `/schedules/:id/check-out` | Pengawal Keselamatan |
| GET | `/notifications` | All roles, own notifications |
| PATCH | `/notifications/:id/read` | All roles, own notifications |
| GET | `/audit` | Pentadbir Sistem |
| GET | `/users` | Pentadbir Sistem |
| POST | `/users` | Pentadbir Sistem |
| PATCH | `/users/:id` | Pentadbir Sistem |
| GET | `/posts` | Pentadbir Sistem |
| POST | `/posts` | Pentadbir Sistem |
| PATCH | `/posts/:id` | Pentadbir Sistem |

## Simple Testing Checklist

- Login as `admin`; confirm redirect to dashboard.
- Login as `ketua`; confirm dashboard, semakan laporan, and tindakan susulan are available.
- Login as `ketua`; open Notifikasi and mark a high-risk notification as read.
- Login as `amir`; submit a report containing `asap` or `terbakar`; confirm NLP shows Critical.
- Submit a normal report containing `rondaan selesai keadaan terkawal tiada insiden`; confirm Low risk.
- As `ketua`, approve or reject a submitted report with a comment.
- As `ketua`, approve a High/Critical report and confirm NLP details are hidden.
- As `ketua`, submit a follow-up progress note without changing official status.
- As `admin`, view Ketua progress notes and update official follow-up action status.
- As `admin`, open Analisis NLP and confirm full NLP details are visible.
- As `admin`, create a user and disable or enable an account.
- As `admin`, create a new pos kawalan.
- As `admin`, open Audit Trail and confirm important actions are logged.

## Screenshot Targets for Chapter 4

- `/login`
- `/dashboard`
- `/pengawal`
- `/laporan` in a mobile viewport
- `/semakan`
- `/tindakan`
- `/audit`
- `/notifikasi`

## Deployment

See `DEPLOYMENT.md` for production environment variables, build/start steps, readiness checks, smoke testing, backups, and release checklist.

## Final delivery (Phase 6)

Start with [handover](docs/final/PROJECT_HANDOVER.md), [implementation audit](docs/final/PROJECT_IMPLEMENTATION_AUDIT.md) and [academic draft](docs/psm/FINAL_PSM_REPORT_DRAFT.md). Deployment remains subject to the documented release checks.

## NLP upgrade development snapshot

See [Phase 7 implementation and limitations](docs/NLP_PHASE7.md) for trained inference, automatic source checks, the Gemini review connection, simplified reporting and test evidence. External review should remain disabled for operational use until alert persistence is separated from provider latency.
