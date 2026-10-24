# Deployment readiness checklist

This checklist separates local evidence from operator acceptance. **No production deployment was performed.** Pushing source to GitHub does not satisfy the pending items.

| Item | Status | Required evidence/action |
| --- | --- | --- |
| Locked dependencies/build | Verified locally | Root/frontend build and actual backend startup/tests; root/backend npm audits currently report zero advisories |
| PostgreSQL schema/migrations | Verified locally | Phase 3 migration applied to existing DB; demo initialization tested. Fresh Compose volumes now include migration 003. Existing volumes require `node backend/scripts/migrate-3d.js` explicitly. Never reset a production DB to apply it. |
| Backend health/readiness | Verified locally | `/api/health`, DB reads and genuine-login workflows worked on the synthetic instance; existing operational smoke is recorded separately |
| Compose interpolation | Verified locally | `docker compose config --quiet` passed with synthetic placeholders |
| Docker image build/host startup | Not Run | Build/run on approved target and repeat health/readiness/smoke; configuration validation is not deployment |
| CORS/security headers | Verified in local production-mode test | Exact frontend origin allowed; foreign origin denied; nosniff present. Set actual `FRONTEND_URL` list. |
| JWT secret/account provisioning | Pending operator | Generate unique secret ≥32 characters; placeholders are rejected. Provision approved accounts and remove development/demo credentials from production data. |
| Reverse-proxy trust | Pending topology review | `TRUST_PROXY=1` only behind one trusted inaccessible-directly proxy; otherwise retain 0 and validate actual forwarded-IP behavior |
| Database TLS/least privilege | Partial | Code verifies configured certificates and bounds acquisition to 5 seconds. Validate real certificate/CA with `PGSSL_CA`, network restrictions, DB role privileges and provider settings. `PGSSLMODE=disable` must be confined to an explicitly approved trusted network. |
| Evidence delivery | Verified locally / hosting pending | Exact authorization, safe MIME, no-store/download headers and upload rejection cleanup tested. Protect upload volume; reverse-proxy `/uploads` to API, never serve it as public static files. Set gateway size/time limits. |
| Model/public assets | Reviewed | Only previously approved exterior GLB is public. Restricted future assets require an authenticated delivery design and separate approval. |
| Private files and credentials | Verified locally / hosting pending | Vite denies backend/runtime/private-data paths; runtime config and participant raw data are ignored. Publish only built `dist`, not the repository root. |
| Logs/monitoring | Partial | Sanitized server diagnostics; define access, retention, rotation, alerting and incident response on target |
| Backups/restore/rollback | Not Run | Rehearse DB/upload backups and restoration; record rollback procedure before release |
| Representative hardware/operational acceptance | Not Run | Meet agreed performance/accessibility targets and approve real mappings/data-quality checks |
| CI pipeline | Added; remote result pending push | Workflow builds/tests against disposable PostgreSQL and runs both audits. A local pass is not a remote CI result. |

Use the separate synthetic demonstration guide for academic evaluation. Consult `DEPLOYMENT.md` for hosting details; new production settings/migration notes below supersede older examples that omit them.
