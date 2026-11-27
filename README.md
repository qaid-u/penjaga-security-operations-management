<div align="center">

# PENJAGA

### Sistem Pengurusan Operasi Keselamatan Berasaskan Kepintaran Buatan

Security operations platform for guard scheduling, daily reporting, follow-up actions and a 3D building command centre, with **local NLP risk scoring** (Multinomial Naive Bayes plus contextual rules) on every report.

![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)

[Live frontend preview](https://penjaga-security-preview.vercel.app) (sign-in disabled, no backend) | [Handover](docs/final/PROJECT_HANDOVER.md) | [Deployment](DEPLOYMENT.md)

</div>

---

## 🎬 Demo

Screenshots below are captured from the running system with synthetic demonstration data.

<p align="center">
  <img src="artifacts/integration/dashboard-model-showcase-card.png" alt="3D building showcase on the dashboard" width="100%"><br>
  <sub><b>3D building showcase</b>: browse the building models, pick a security post and open the 3D command centre (UTC Johor shown, 8 of 8).</sub>
</p>

<p align="center">
  <img src="docs/psm/evidence/02-admin-dashboard.png" alt="Admin analytics dashboard" width="49%">
  <img src="docs/psm/evidence/10-3d-overview.png" alt="3D security command centre" width="49%"><br>
  <sub><b>Left:</b> admin analytics dashboard (shift summary, open actions, NLP incident categories, risk distribution, report trend). <b>Right:</b> 3D command centre with numbered post markers, zone navigation and a location information panel.</sub>
</p>

<p align="center">
  <img src="docs/psm/evidence/06-report-submission.png" alt="Guard daily report form" width="49%">
  <img src="docs/testing/evidence/phase7-ui/guard-report-assistant.png" alt="Automatic report summary after submission" width="49%"><br>
  <sub><b>Left:</b> guard daily report form (post and shift, narrative, checklist, evidence attachments). <b>Right:</b> after submission, the automatic summary shows suggested report type, risk level, confidence hint and the sentence that drove the result.</sub>
</p>

<p align="center">
  <img src="docs/psm/evidence/07-nlp-categories.png" alt="NLP analysis review screen" width="70%"><br>
  <sub><b>NLP analysis</b>: reports with their risk badge and approval status, searchable and filterable, with a summary view per report.</sub>
</p>

More screenshots: [`docs/psm/evidence/`](docs/psm/evidence/) (17 screens), [`docs/testing/evidence/`](docs/testing/evidence/) and [`artifacts/`](artifacts/README.md) (building model previews). Demo accounts are listed under [Default login credentials](#default-login-credentials-demo); the demo data is synthetic, not operational.

## Features

- Role-based access (Pentadbir Sistem, Ketua Pengawal, Pengawal Keselamatan) with JWT auth, bcrypt, audit trail and notifications.
- Duty scheduling with CSV import and check-in/check-out attendance.
- Mobile-friendly daily reports with checklist and evidence attachments; chief review (approve/reject with comment); follow-up actions.
- **Local NLP**: trained Multinomial Naive Bayes model plus context-aware rules and database-configured keywords. Produces category, risk score (0-100), risk level and a short summary, stored in `tbl_hasil_nlp`; High/Critical risk notifies the Ketua Pengawal.
- Reports can contain reported, suspected, negated, drill or unclear events, with optional clarification questions stored separately from the original narrative.
- Optional Gemini review runs in an independent recoverable queue; it cannot suppress alerts or make official decisions.
- Automatic retraining only after the chief explicitly confirms a category (batches of 20 eligible new families, demo data excluded, candidate activated only after regression checks). See [automatic learning](docs/testing/AUTOMATIC_LEARNING.md).
- 3D command centre: eight building identities using six exterior models and 15 official security posts, with building-scoped operational records. See [building integration](docs/testing/BUILDING_LIBRARY_INTEGRATION.md).
- Not included: CCTV, IoT sensor or door access control integration. Scheduling and forecasts are not predicted by the model.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, React Router, Axios, Recharts |
| Backend | Node.js, Express.js, JWT, bcrypt |
| Database | PostgreSQL relational schema |
| NLP | Local multinomial Naive Bayes count model + rules (`backend/ml/`), optional Gemini review |
| 3D | Blender-authored GLB exterior models ([catalogue](artifacts/README.md)) |

## Quick start

```bash
npm install
cd backend && npm install && cd ..
createdb penjaga_db
# put credentials in backend/.env (see Configuration below), then:
npm --prefix backend run db:migrate -- --init
npm run dev:system        # starts/reuses backend + frontend with readiness checks
```

Open `http://localhost:5173/login` (use `localhost`; `127.0.0.1:5173` can fail because Vite may bind IPv6 `::1`). `dev:system` does not seed incidents, reset accounts or apply migrations automatically. See [working report flow](docs/testing/OPERATIONAL_FLOW.md).

<details>
<summary><b>Configuration (backend/.env)</b></summary>

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

Run the services separately:

```bash
cd backend && npm start     # API
npm run dev                 # frontend, http://localhost:5173/login
```

Health: `http://localhost:3000/api/health`. Readiness (with DB): `http://localhost:3000/api/ready`. Deployment smoke test: `cd backend && npm run smoke`.

Run the migration above and restart the backend after updating an existing installation. Model files in `public/models/` are publicly downloadable; operational data still requires an administrator or chief-guard account. Only the selected GLB is downloaded; the six optimized preview images total approximately 158 KB; DJM is the initial selection. Floor labels appear only where supplied; indoor coordinates remain unconfirmed. See [official DJM posts](docs/testing/DJM_OFFICIAL_POSTS.md).

</details>

<details id="default-login-credentials-demo">
<summary><b>Default login credentials (demo)</b></summary>

All demo accounts use password `Password123!`.

| Role | Username | Email |
| --- | --- | --- |
| Pentadbir Sistem | admin | admin@penjaga.local |
| Ketua Pengawal | ketua | ketua@penjaga.local |
| Pengawal Keselamatan | amir | amir@penjaga.local |
| Pengawal Keselamatan | siti | siti@penjaga.local |
| Pengawal Keselamatan | kumar | kumar@penjaga.local |

Usernames are matched case-insensitively and surrounding spaces are ignored. Sign in with the username, not the display name. Accounts with status `Tidak Aktif` are blocked until an administrator reactivates them. Logging out asks for confirmation first.

</details>

<details>
<summary><b>Main screens</b></summary>

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

</details>

<details>
<summary><b>How the NLP pipeline works</b></summary>

`textModel.js` validates and runs the saved multinomial Naive Bayes count model. `reportAnalysis.js` combines its output with context-aware category rules and active keywords from `tbl_kategori_insiden` (new reports use the latest saved rules; there is no separate NLP management screen).

When a guard submits a report, the backend: cleans the text, lowercases it, removes unnecessary symbols, detects configured keywords, classifies the incident category, calculates a risk score, assigns a risk level, generates a short summary, saves the result into `tbl_hasil_nlp`, and notifies Ketua Pengawal when risk is High or Critical.

Risk levels: Low 0-30, Medium 31-60, High 61-80, Critical 81-100.

Confidence is an uncalibrated relative model score or keyword coverage, not a probability of a real incident. Unsupported classifications remain Unknown. Local analysis and conservative risk alerts are committed first; optional external review comes after.

Training data (synthetic, disclosed): `backend/ml/data/nlp-training-samples.json`.

```bash
npm run train:nlp     # writes backend/ml/model/nlp-model.json
```

Synthetic evaluation is development evidence, not independently measured operational accuracy. See [classification model and data](docs/testing/AUTOMATIC_CLASSIFICATION.md), `backend/ml/README.md`, [Phase 7](docs/NLP_PHASE7.md) and [Phase 8](docs/NLP_PHASE8.md). Provider availability and operational accuracy still require independent verification.

</details>

<details>
<summary><b>API endpoints</b> (base URL <code>http://localhost:3000/api</code>)</summary>

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

</details>

<details>
<summary><b>Quality checks and manual testing checklist</b></summary>

Phase 5 validation and academic evaluation materials are in [docs/psm-evaluation](docs/psm-evaluation/SYSTEM_TEST_PLAN.md); human evaluation outcomes are pending collection.

```bash
npm run check                  # lint (front/back), backend syntax checks, smoke-test syntax, production build
npm run test:building
npm run test:evaluation
npm run test:backend
npm run test:building:browser
npm run test:phase5:browser
```

The last suite requires the separate synthetic demonstration database described in [DEMONSTRATION_CHECKLIST.md](docs/psm-evaluation/DEMONSTRATION_CHECKLIST.md); it never seeds the operational database, and 3D integration fixtures are rolled back. Use Node 24 with the committed lockfiles. Set `PLAYWRIGHT_CHANNEL=chromium` to use Playwright's bundled Chromium instead of Edge.

Manual checklist:

- `admin`: redirected to dashboard; creates users and posts, disables/enables accounts; Audit Trail logs important actions; Pemantauan laporan shows full NLP details; updates official follow-up status and sees Ketua progress notes.
- `ketua`: dashboard, semakan laporan and tindakan susulan available; marks a high-risk notification as read; approves/rejects reports with a comment (NLP details hidden after approving High/Critical); submits follow-up progress notes without changing official status.
- `amir`: a report containing `asap` or `terbakar` shows Critical; `rondaan selesai keadaan terkawal tiada insiden` shows Low.

</details>

<details>
<summary><b>Operational reference: guard counts per shift</b></summary>

| Hari | Syif | Waktu | Jumlah Anggota |
| --- | --- | --- | --- |
| Hari bekerja | Pagi | 07:00 AM - 04:00 PM | 24 orang, termasuk 12 orang syif pentadbiran |
| Hari bekerja | Petang | 02:45 PM - 11:45 PM | 12 orang |
| Hari bekerja | Malam | 11:00 PM - 08:00 AM | 12 orang |
| Hari tidak bekerja | Pagi | 07:00 AM - 04:00 PM | 12 orang |
| Hari tidak bekerja | Petang | 02:45 PM - 11:45 PM | 12 orang |
| Hari tidak bekerja | Malam | 11:00 PM - 08:00 AM | 12 orang |

The official post list is in `backend/database/seed.sql`.

</details>

<details>
<summary><b>Deployment</b></summary>

A sign-in-disabled frontend preview is hosted on Vercel at <https://penjaga-security-preview.vercel.app>. It is built with `VITE_PREVIEW_ONLY=true` and has no backend; a working Vercel deployment needs a hosted HTTPS API set in `VITE_API_URL`. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for production environment variables, build/start steps, readiness checks, smoke testing, backups and the release checklist.

</details>

## Project structure

```text
src/            React frontend
backend/        Express API, database migrations/seed, ml/ (NLP model + training)
public/models/  Deployed GLB exterior models
artifacts/      Blender sources, model previews, integration screenshots
docs/           Testing, PSM report, evaluation, handover (docs/final)
tests/          Test suites (Playwright configs at repo root)
scripts/        Dev/system scripts
```

## Documentation

[Handover](docs/final/PROJECT_HANDOVER.md) | [Implementation audit](docs/final/PROJECT_IMPLEMENTATION_AUDIT.md) | [Academic draft](docs/psm/FINAL_PSM_REPORT_DRAFT.md) | [Exterior model catalogue](artifacts/README.md)
