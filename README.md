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
```

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
| GET | `/actions` | Ketua Pengawal |
| POST | `/actions` | Ketua Pengawal |
| PATCH | `/actions/:id` | Ketua Pengawal |
| GET | `/notifications` | Pentadbir Sistem, Ketua Pengawal |
| PATCH | `/notifications/:id/read` | Pentadbir Sistem, Ketua Pengawal |
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
- As `ketua`, create and update a follow-up action.
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
