# PENJAGA Deployment Runbook

## 1. Production Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer
- HTTPS reverse proxy or managed hosting with TLS
- Persistent storage for `backend/uploads`
- Secure backup location for PostgreSQL dumps and uploaded evidence

## 2. Environment Setup

Copy `backend/.env.production.example` to `backend/.env` and set real values.

Required production values:

- `NODE_ENV=production`
- `JWT_SECRET` with a long random value
- `FRONTEND_URL` matching the deployed frontend origin
- `DATABASE_URL` pointing to the production PostgreSQL database

The backend will refuse to start in production if `JWT_SECRET` is still the development default.

## 3. Database Setup

For first deployment:

```bash
createdb penjaga_db
psql -d penjaga_db -f backend/database/schema.sql
psql -d penjaga_db -f backend/database/seed.sql
```

Before future schema changes, create migration files instead of editing production tables manually.

## 4. Build And Start

Frontend:

```bash
npm install
npm run build
```

Backend:

```bash
cd backend
npm install --omit=dev
npm start
```

## 5. Health Checks

Basic API health:

```bash
curl https://your-api-domain.example/api/health
```

Readiness check with database connectivity:

```bash
curl https://your-api-domain.example/api/ready
```

Expected readiness response:

```json
{
  "ok": true,
  "database": "connected"
}
```

## 6. Smoke Test

Run after deployment:

```bash
cd backend
API_BASE_URL=https://your-api-domain.example/api SMOKE_USERNAME=admin SMOKE_PASSWORD=your-password npm run smoke
```

The smoke test verifies:

- API readiness
- Login
- Authenticated `/auth/me`
- Metadata loading
- Dashboard loading

## 7. Backups

Recommended daily backup:

```bash
pg_dump penjaga_db > backups/penjaga_db_$(date +%F).sql
```

Also back up:

- `backend/uploads`
- production `.env` in a secure secret manager

Test restore regularly:

```bash
createdb penjaga_restore_test
psql -d penjaga_restore_test -f backups/penjaga_db_YYYY-MM-DD.sql
```

## 8. Operational Monitoring

The backend writes one JSON log line per request with:

- timestamp
- method
- path
- status
- duration
- IP
- user ID when available

Forward these logs to your hosting provider, log collector, or server journal.

Watch especially for:

- repeated `401` and `429` on `/api/auth/login`
- `500` errors
- slow responses above 2000 ms
- failed readiness checks

## 9. Release Checklist

- `npm run check` passes
- `cd backend && node --check server.js` passes
- `/api/ready` returns `ok: true`
- `npm run smoke` passes against the deployed API
- Admin login works
- Guard can submit a report with attachment
- Chief can review report and export CSV
- Audit trail records the actions
- Backup job is scheduled
