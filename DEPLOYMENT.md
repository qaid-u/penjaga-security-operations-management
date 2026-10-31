# PENJAGA deployment

PENJAGA uses React, Express and standard PostgreSQL. No external backend platform is required. The full operator reference is [the deployment guide](docs/final/DEPLOYMENT_GUIDE.md).

## One-server deployment with Docker Compose

Configure private values using `.env.deployment.example`: database credentials, a unique JWT secret and the exact public frontend origin. Keep this file outside Git. Configure HTTPS at the intended reverse proxy before public access.

```sh
docker compose --env-file .env.deployment config --quiet
docker compose --env-file .env.deployment up -d --build
```

Compose runs PostgreSQL, the Express API, and Nginx serving the React build. Only Nginx publishes a port. Database records and uploaded evidence use persistent volumes. The API runs ordered database migrations before listening; a failed migration prevents startup. A new database gets the schema and three role definitions, with no demo accounts or report seeds. Existing databases are upgraded without resetting records.

Create the first administrator using `backend/scripts/bootstrap-admin.js` and private `BOOTSTRAP_*` environment values. Configure users and operational records through the application.

## PostgreSQL on a separate host

Express accepts either `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, or a private `DATABASE_URL`. Use verified TLS for remote database connections. URL connections in production verify certificates by default; provide `PGSSL_CA` when your database requires a private CA. `PGSSLMODE=disable` is for an explicitly trusted internal connection. No hostname-specific connection rules are used.

Keep existing Express authentication and authorization. Frontend environment variables contain only the public API address; database credentials belong exclusively on the backend.

## Migrations and recovery

Run from the repository root:

```sh
npm --prefix backend run db:status
# Stop application writers, back up database and uploads, then upgrade:
npm --prefix backend run db:backup
npm --prefix backend run db:migrate
# Only for an empty database:
npm --prefix backend run db:migrate -- --init
```

Each migration is recorded with a SHA-256 checksum. Modified applied migrations and unknown versions stop the upgrade. New migrations and ledger entries commit together. Migration 007 converts the recognized historical action label `Dalam Proses` to `Dalam Tindakan`, auditing each change and preserving IDs, content and operational dates. Other invalid legacy data causes rollback; no records are deleted. Existing `migrate:3d` and `migrate:nlp` commands delegate to the same runner.

The backup command requires installed PostgreSQL client utilities (on PATH, or set `PG_BIN`). It creates a private ignored backup directory containing a custom-format database dump, uploaded evidence and a manifest. Run it during a maintenance window with application writers stopped for a consistent database/evidence backup. Test restoration into a separate database before relying on it for recovery; never overwrite the live database to test a backup.

Verify `/api/health`, `/api/ready`, role-specific login, reporting, attendance, attachments and exports after deployment. A successful local test or Git push is not a production deployment.
