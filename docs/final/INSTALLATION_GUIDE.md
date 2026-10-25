# Installation guide

Use Node.js24 and npm, Git, PostgreSQL 16+ (local verification used17), and Edge/Chromium with WebGL. Docker Desktop is optional. Check `node --version`, `npm --version`, `psql --version`; install the tools before continuing. Commands below run from the repository root in PowerShell unless noted.

```powershell
npm ci
npm --prefix backend ci
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
```

Edit local files with private database settings and a unique JWT secret. Never commit them. Root `.env` configures Vite, `backend/.env` configures Express when started from backend; helper migration scripts explicitly load backend/.env. Use `VITE_API_URL=http://localhost:3000/api` and `VITE_API_ORIGIN=http://localhost:3000` for local development. Vite settings are public build-time values; never place a secret in a VITE_ variable.

## New database only

Create an approved empty database and login role using your PostgreSQL administration tools. Set PGHOST/PGPORT/PGUSER/PGDATABASE for psql; pass passwords through a secure prompt or private environment. Do not point initialization at existing operational data without inspection and backup.

```powershell
psql -v ON_ERROR_STOP=1 -f backend/database/schema.sql
psql -v ON_ERROR_STOP=1 -f backend/database/roles.sql
psql -v ON_ERROR_STOP=1 -f backend/database/migrations/003_lokasi_3d.sql
```

The legacy `seed.sql` contains demonstration accounts and operational-looking reference data; it is not a production initialization requirement. Do not run reset/replacement/seed-expo scripts against a real database. Existing targets follow [migration procedure](DEPLOYMENT_GUIDE.md).

Create the first administrator with private BOOTSTRAP_USERNAME, BOOTSTRAP_EMAIL, BOOTSTRAP_NAME and BOOTSTRAP_PASSWORD environment values. Do not paste passwords into screenshots or a published terminal transcript. From backend:

```powershell
Set-Location backend
node scripts/bootstrap-admin.js
npm start
```

The helper refuses an existing active administrator or duplicate account; it never resets a password. The initial administrator must configure active NLP categories, users, posts and approved weeks before normal reports/schedules work. There is no week-create endpoint. Setup of real weekly records requires an approved administrator/database process.

In a second terminal at the repository root:

```powershell
npm run dev -- --host 127.0.0.1
```

Open the displayed local URL (normally localhost:5173). Login with the privately provisioned account. `/api/health` checks process health; `/api/ready` checks database connectivity, not schema completeness. Verify model, metadata and an authorized read before demonstration.

## Isolated reproducible academic demo

Follow [live demonstration](../psm/LIVE_DEMONSTRATION_SCRIPT.md). It creates only `penjaga_phase6_demo` on a local server, never resets existing databases, and requires PHASE6_DEMO_PASSWORD. Optional standalone cluster: `node backend/scripts/start-phase5-postgres.js` (PostgreSQL binaries must be in PATH; binds127.0.0.1:55435 and stores private settings in ignored `.phase5-runtime.local`). Keep these local credentials private.

## Verification

```powershell
npm run check
npm run test:building
npm run test:evaluation
npm run test:backend
npm run test:building:browser
npm run test:phase5:browser
npx playwright test --config playwright.phase6.config.mjs
```

Backend/Phase 5 tests require the separate identified Phase 5 synthetic database (`node backend/scripts/prepare-phase5-demo.js`). Phase 6 requires its own seed and password variable. Browser configs use Edge by default; set PLAYWRIGHT_CHANNEL to an installed compatible channel if needed. Tests are not permitted against real operational databases.

If login fails, check readiness, correct database, account status and role rows. If reports fail, ensure active categories exist. If 3D is unlinked, configure only approved mappings; never invent real links for a demo. Password-change failure is a documented missing API, not a database-installation error. A WebGL error requires supported browser/driver or the text fallback. See [deployment troubleshooting](DEPLOYMENT_GUIDE.md).
