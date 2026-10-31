# Deployment preparation and release guide

Status: local build and database backup/restore verified; image execution, hosted TLS and production recovery remain unverified. No public deployment was authorized or performed. Local database upgrade evidence is in [database validation](../testing/DATABASE_UPGRADE.md). Historical Phase 6 release findings remain in the [audit](PROJECT_IMPLEMENTATION_AUDIT.md); verify current implementation before treating those findings as open.

## Prerequisites and configuration

Reuse the repository's Nginx/frontend, Express/backend and PostgreSQL Compose services. Use Node 24/npm for host builds. Restrict database credentials to the application database and store secrets outside version control. A new deployment needs a private copy of `.env.deployment.example`; replace every placeholder before any production startup. `docker compose --env-file <private-file> config --quiet` validates interpolation without printing secrets. Docker Desktop/server must be running to build images.

| Actual setting | Meaning |
|---|---|
| NODE_ENV | production enables secret and allowed-origin startup checks |
| PORT | backend port; Compose3000, not published directly |
| JWT_SECRET | unique random >=32 characters; template strings rejected |
| FRONTEND_URL | explicit comma-separated allowed browser origins; no trailing slash |
| TRUST_PROXY | 1 only behind the intended single trusted proxy, otherwise0 |
| PGHOST,PGPORT,PGDATABASE,PGUSER,PGPASSWORD | direct PostgreSQL connection |
| DATABASE_URL | alternative connection string; do not expose in logs |
| PGSSL,PGSSLMODE,PGSSL_CA | verified certificate/TLS settings; see dbOptions.js |
| PGOPTIONS | defaults to `-c timezone=Asia/Kuala_Lumpur`; explicit options override this |
| PG_BIN | PostgreSQL client binary directory for the host backup command, if not on PATH |
| VITE_API_URL | public build-time API base, Compose /api |
| VITE_API_ORIGIN | public backend origin for downloads; blank for same-origin |
| NLP_MODEL_PATH | optional file path; does not resolve the trained-inference mismatch |

Uploads have a fixed `backend/uploads` root and Compose persistent volume; there is no UPLOAD_DIR environment variable. Do not introduce fictitious settings. Node environment loading depends on current directory; start host backend from backend, or inject environment explicitly through the service manager.

## New and existing PostgreSQL targets

For a new empty target, configure the private backend connection and run `npm --prefix backend run db:migrate -- --init`. Compose executes this migration runner before starting the API on both fresh and existing volumes. It creates the base schema, role definitions and all ordered migrations, with no demo accounts or report seeds. Provision one private administrator with `backend/scripts/bootstrap-admin.js` and BOOTSTRAP_* variables; the tool refuses an existing active administrator. Configure actual categories/posts/users and authorized weekly rows separately.

For an existing target:

1. Record PostgreSQL/version/timezone and inspect actual tables/columns/indexes and current mappings. `npm --prefix backend run db:status` is read-only when run with the intended private configuration.
2. Take a verified backup and test restore into a separate database. Retain uploads from the same recovery window. Schedule a maintenance window for any schema/index lock.
3. Compare existing schema with [database design](technical/DATABASE_DESIGN.md). CREATE TABLE IF NOT EXISTS is not a general reconciliation mechanism. Do not apply destructive reset scripts or blindly rerun reference seeds.
4. Apply pending migrations using `npm --prefix backend run db:migrate`. The transaction uses advisory locks, a 5s lock timeout and a 120s statement timeout; existing hotspot mappings are preserved. Applied file checksums must match. Migration 007 audits conversion of the known historical action label; unrecognized invalid data rolls back the upgrade. Large tables may need a separately planned index maintenance window. Stop on errors and investigate rather than dropping data.
5. Re-inspect, verify foreign keys/indexes, and exercise health/readiness and authorized queries. No existing operational database migration was executed during Phase 6.

## Build and start (after explicit deployment approval)

```powershell
npm ci
npm --prefix backend ci
npm run check
# Deployment host only, after replacing private placeholders:
docker compose --env-file <private-env-file> config --quiet
docker compose --env-file <private-env-file> build
docker compose --env-file <private-env-file> up -d
```

These last commands are preparation instructions, not an execution claim. Compose publishes port80 for Nginx. PostgreSQL/backend have no host ports. Configure an approved HTTPS endpoint/certificate and proxy trust boundary before public use. The sample Nginx config has no certificate or HSTS deployment policy. If another proxy terminates TLS, ensure the backend sees the intended trusted source and forwarded protocol; do not blindly increase TRUST_PROXY. Bind/restrict network access according to the approved host arrangement.

Nginx gives `/api/` and `/uploads/` prefix precedence and no-store responses; file-extension routing cannot bypass protected downloads. Hashed `/assets/` receive immutable caching; `/index.html` revalidates. `/models/` returns404 for missing GLBs rather than the SPA shell, with one-hour revalidation. React routes fall back to index. Max multipart body is50 MiB, compatible with six 8 MiB report files plus overhead. Backend per-file/type/ownership checks remain authoritative.

Docker contexts exclude private .env files, uploads, local PostgreSQL state and academic evidence. Images copy only the required runtime source/dependencies; reviewed public GLB is included through frontend public assets. Node 24 is aligned with local checks. Pin container image digests and scan built images during a real release; no image scanning result is claimed here.

## Model distribution

The user approved the exterior demo GLB in public/models. Served file: `public/models/Bangunan_SUK.glb`, 2,537,652 bytes. Source and backup remain in artifacts/suk and were explicitly pushed to GitHub main. This asset is conceptual, not surveyed. Operational APIs remain authenticated; asset privacy and API authorization are separate boundaries. Recheck approval before replacing the exterior or adding internal plans.

## Health, smoke and troubleshooting

`GET /api/health` should return200; `/api/ready`200 only when PostgreSQL answers SELECT1 (503 otherwise). Test a real authorized metadata/dashboard request to validate schema. Verify login with each role, guard3D403, upload authorization, a known mapped synthetic hotspot and missing GLB404. Inspect browser network errors and sanitized service logs. A404 password-change call is a known missing endpoint. No active categories can cause report submission500. Wrong API build values require rebuilding Vite; runtime editing alone cannot change an already-built bundle. Unlinked anchors must stay unlinked until an authorized administrator maps approved posts.

## Backup and recovery

Define an approved recovery point/time objective before release. For a host installation, stop application writers and run `npm --prefix backend run db:backup` with PostgreSQL client utilities on PATH or `PG_BIN` configured. The ignored private output directory contains a custom-format database dump, evidence files and a manifest. Incomplete backups have no completed manifest. The command checks archive readability; only an actual isolated restore proves recovery. Encrypt and restrict retained backups, and copy them to approved backup storage. Deployment configuration/secrets need separate protected recovery storage.

For Docker deployments, run the PostgreSQL client inside the database container and archive the uploads volume while application writers are stopped. On a Linux hosting shell, `docker compose exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > database.dump` exports the database without placing credentials on the command line; archive `/app/uploads` from the backend container separately. Do not publish a database port just to take a backup.

Test `pg_restore` into a new isolated database, verify attachments/relationships and record checksums, then document results. Never restore over the live database for a recovery test. A local restore on 31 October 2026 matched all 23 pre-upgrade tables and 103 reports; this does not establish production recovery readiness. Preserve the previous image/version and compatible database backup before schema changes; an application rollback alone cannot undo data/schema changes safely.

## Release gates still open

Hosting/domain/TLS approval; secrets and account provisioning; backup restoration; production images; supported hardware/mobile/browser matrix; human usability evaluation; meaningful NLP holdout evaluation; password-change and overnight-attendance resolution; upload malware-scanning and operational retention policy review. Current artifacts support an academic synthetic demo, not a certified production service.
