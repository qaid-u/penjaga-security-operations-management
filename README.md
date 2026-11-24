# PENJAGA - Sistem Pengurusan Operasi Keselamatan

Functional full-stack prototype for:

**Sistem Pengurusan Operasi Keselamatan Berasaskan Kepintaran Buatan (PENJAGA)**

Report classification uses a locally trained Multinomial Naive Bayes model with contextual rules. Administrators read category/risk suggestions directly in reports; there is no separate NLP management screen. Training is a maintainer task using disclosed synthetic examples. See [classification model and data](docs/testing/AUTOMATIC_CLASSIFICATION.md). Optional external review remains a separate, explicitly configured backend feature; it is not required for local classification. Scheduling and forecasts are not predicted by this model.

New reports can also support automatic retraining after the chief explicitly confirms a category during approval. Batches start at 20 eligible new families, exclude demo data and activate a candidate only after regression checks. See [automatic learning](docs/testing/AUTOMATIC_LEARNING.md). Ordinary insertion/approval never trains on the model's own guesses.
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

Configure private database credentials in `backend/.env`, then initialize an empty database:

```bash
npm --prefix backend run db:migrate -- --init
```

The dashboard features a visual building showcase. The 3D command centre offers eight building identities using six exterior models, with 15 official security posts and building-scoped operational records. Floor labels are shown only where supplied; indoor coordinates remain unconfirmed. Run the migration above and restart the backend after updating an existing installation. See [building integration](docs/testing/BUILDING_LIBRARY_INTEGRATION.md) and the [official DJM post configuration](docs/testing/DJM_OFFICIAL_POSTS.md).

Editable Blender sources, deployed GLB exports and preview images are listed in the [exterior model catalogue](artifacts/README.md). BDMIM shares BDMSP geometry, and Rumah SS/Rumah VIP share one residence asset while retaining separate post records. Only the selected GLB is downloaded; the six optimized preview images total approximately 158 KB. DJM is the initial selection. Model files in `public/models/` are publicly downloadable; access to operational data still requires an administrator or chief-guard account.

Optional backend environment file: `backend/.env`

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=change-this-for-production
PGHOST=localhost
PGPORT=5432
PGDATABASE=penjaga_db
PGUSER=your_database_role
PGPASSWORD=your_private_database_password
```

You can also use `DATABASE_URL=postgres://user:password@localhost:5432/penjaga_db`.

## Run Backend

To start or reuse both local services with database/model readiness checks, run `npm run dev:system` from the repository root. Open `http://localhost:5173/login` (Vite listens on `localhost`, which may resolve to IPv6 `::1`, so `127.0.0.1:5173` can fail). This requires configured PostgreSQL credentials and an initialized schema. It does not seed incidents, reset accounts or apply migrations automatically. See [working report flow](docs/testing/OPERATIONAL_FLOW.md).

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
http://localhost:5173/login
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

Usernames are matched case-insensitively and surrounding spaces are ignored, so `Amir` and ` amir ` both sign in as `amir`. Sign in with the username, not the full display name. Accounts with status `Tidak Aktif` are blocked until an administrator reactivates them. Logging out asks for confirmation first.

## Main Screens

| Screen | Path | Roles |
| --- | --- | --- |
| Log masuk | `/login` | Public |
| Ringkasan (dashboard) | `/dashboard` | Pentadbir Sistem, Ketua Pengawal |
| Ringkasan pengawal | `/pengawal` | Pengawal Keselamatan |
| Jadual bertugas (incl. CSV import, attendance) | `/jadual` | All roles |
| Laporan harian, mobile-friendly | `/laporan` | Pengawal Keselamatan |
| Semakan / pemantauan laporan (incl. NLP results) | `/semakan` | Pentadbir Sistem, Ketua Pengawal |
| Tindakan susulan | `/tindakan` | Pentadbir Sistem, Ketua Pengawal |
| Pusat Kawalan 3D | `/3d-command-centre` | Pentadbir Sistem, Ketua Pengawal |
| Pengguna | `/pengguna` | Pentadbir Sistem |
| Pos kawalan | `/pos` | Pentadbir Sistem |
| Rekod aktiviti (audit trail) | `/audit` | Pentadbir Sistem |
| Notifikasi | `/notifikasi` | All roles |
| Tukar kata laluan | `/kata-laluan` | All roles |

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

## Hybrid NLP and event clarification

The runtime combines trained inference with database-configured rules and source-context checks:

- `textModel.js` validates and runs the saved multinomial Naive Bayes count model. `reportAnalysis.js` combines its output with context-aware category rules and active keywords from `tbl_kategori_insiden`.
- Reports can contain separate reported, suspected, negated, drill or unclear events. Optional clarification answers are stored separately from the original narrative and validated against the draft and offered question sequence.
- Confidence is an uncalibrated relative model score or keyword coverage, not a probability of a real incident. Unsupported classifications remain Unknown.
- Local analysis and conservative risk alerts are committed first. Optional Gemini review runs in an independent recoverable queue and cannot suppress alerts or make official decisions.

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

Active NLP keywords and risk levels are stored in `tbl_kategori_insiden`; new reports use the latest saved keyword rules. There is no separate NLP management screen — NLP results are shown in report review.

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

Training produces a versioned count model used by the runtime. Synthetic evaluation is development evidence, not independently measured operational accuracy. See `backend/ml/README.md`.

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
| POST | `/auth/change-password` | Authenticated; current password required |
| GET | `/meta` | Authenticated |
| GET | `/reports` | All roles, scoped for Pengawal |
| GET | `/reports/export.csv` | All roles, scoped for Pengawal; same filters as report list |
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
| GET | `/audit?format=csv` | Pentadbir Sistem; current audit filters supported |
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
- As `admin`, open Pemantauan laporan and confirm full NLP details are visible.
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

A sign-in-disabled frontend preview is hosted on Vercel at <https://penjaga-security-preview.vercel.app>. It is built with `VITE_PREVIEW_ONLY=true` and has no backend; a working Vercel deployment needs a hosted HTTPS API set in `VITE_API_URL` (see `DEPLOYMENT.md`).

See `DEPLOYMENT.md` for production environment variables, build/start steps, readiness checks, smoke testing, backups, and release checklist.

## Final delivery (Phase 6)

Start with [handover](docs/final/PROJECT_HANDOVER.md), [implementation audit](docs/final/PROJECT_IMPLEMENTATION_AUDIT.md) and [academic draft](docs/psm/FINAL_PSM_REPORT_DRAFT.md). Deployment remains subject to the documented release checks.

## NLP upgrade development snapshot

See [Phase 7](docs/NLP_PHASE7.md) and [Phase 8](docs/NLP_PHASE8.md) for trained inference, source checks and event clarification. Local classification and alerts now persist before optional external review. Provider availability and operational accuracy still require independent verification.
