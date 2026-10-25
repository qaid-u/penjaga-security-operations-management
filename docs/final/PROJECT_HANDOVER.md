# PENJAGA final project handover

## Delivery state

Phase 6 preparation artifacts are complete within the available evidence. The prototype builds and local tests pass. Academic submission details, human evaluation and production release still require the actions below. Original operational databases were not reset, copied or seeded. Demonstration records are isolated and fictional. Blender source and backup were pushed to GitHub `main` in commit `2123350`; Phase 6 edits/documents are prepared locally and have not been pushed in this request.

## Stack and repository map

The installed stack uses React 19, Vite 8, Router 7, Tailwind 3, Axios, TanStack Query 5, Three.js, Fiber 9 and Drei 10; Express 4, pg8, bcrypt 6, multer 2, JWT 9 and PostgreSQL. Exact dependency resolution is in root/backend package-lock.json. Local verification used Node 24.15 and PostgreSQL 17; Compose specifies PostgreSQL 16. Images use Node 24.

| Location | Responsibility |
|---|---|
| src/App.jsx; src/context; src/layouts | Routes, identity/cache and navigation |
| src/pages | Operational role screens |
| src/components/building | Scene, camera, anchors, filters, panels and history |
| backend/server.js; routes; controllers | REST endpoints and operational writes |
| backend/middleware; config | JWT/role, uploads, limits and PostgreSQL options |
| backend/services/threeDService.js | Filtered mapping/snapshot/history data |
| backend/ml | Current keyword runtime and incompatible experimental training artifact |
| backend/database/schema.sql; roles.sql; migrations/003_lokasi_3d.sql | Actual schema, minimal role data and additive3D migration |
| backend/scripts | Safe demo/bootstrap/migration helpers; legacy replacement scripts must not target real data |
| backend/uploads | Private persistent evidence; excluded from Git/images |
| artifacts/suk | Blender source, backup, original GLB and historic evidence |
| public/models/Bangunan_SUK.glb | Approved publicly served demo exterior |
| tests; backend/tests; scripts/*test* | Browser, database, model and analyzer verification |
| docs/final; docs/psm; docs/psm-evaluation | Handover, academic preparation and original evaluation evidence |

## Run and maintain

Follow [installation](INSTALLATION_GUIDE.md) for dependencies, private environment files, empty-target schema/roles/migration and first administrator. Start backend from its directory with npm start, frontend from root with npm run dev. `/api/health` is process health; `/api/ready` is a database SELECT1 check. A schema-aware authorized read is also required.

Production preparation uses existing Compose/Nginx configuration; follow [deployment](DEPLOYMENT_GUIDE.md). Docker image startup and public TLS/backups remain unverified. Real release requires approval, a private administrator, reviewed categories/posts/weeks, approved mappings and tested recovery. No public deployment was performed.

The synthetic demo is reproduced by setting PHASE6_DEMO_PASSWORD privately, then `npm run demo:phase6:prepare` and `npm run test:phase6`. See [demo script](../psm/LIVE_DEMONSTRATION_SCRIPT.md). Optional isolated PostgreSQL stays under ignored `.phase5-runtime.local`. Stop it with `pg_ctl -D .phase5-runtime.local/data -m fast -w stop` only when no local tests use that cluster. This affects the isolated demo cluster only, not another PostgreSQL installation. No deletion is required.

API behavior/roles/parameters: [API reference](technical/API_REFERENCE.md).20-table schema and ERD: [database design](technical/DATABASE_DESIGN.md). Scene/data flow: [3D architecture](technical/3D_SYSTEM_ARCHITECTURE.md). General roles and file delivery: [system architecture](technical/SYSTEM_ARCHITECTURE.md). End-user instructions: [manual](USER_MANUAL.md).

## Quality evidence and changes

[Final testing report](../psm/FINAL_TESTING_REPORT.md) records69 existing automated checks plus two Phase 6 cases, build/lint/Compose results, original benchmark measurements and limitations. [Audit](PROJECT_IMPLEMENTATION_AUDIT.md) assigns actual status labels per module. [Screenshot index](../psm/evidence/SCREENSHOT_INDEX.md) contains 17 actual synthetic captures.

Final fixes address schedule calendar conversion and SQL status typing, current latest NLP analysis selection/title fields, and notification/audit connection failure handling. Docker contexts exclude secrets/uploads/local state, runtime versions align with Node 24, Compose initializes minimal roles instead of legacy demonstration accounts, and Nginx routing/caching respects protected evidence. A one-time administrator helper refuses overwriting existing accounts. CI now includes separate Phase 6 preparation and tests; remote execution of these new CI steps is pending publication.

## Known limitations and maintenance priorities

Broken password-change API/UI contract and current-date-only attendance must be resolved before operational release. Trained Naive Bayes counts are not used by the current keyword runtime. Keyword confidence is not a calibrated probability. Report CSV export has a visible control but no corresponding export endpoint. Some legacy validation and audit coverage remain incomplete. Metadata exposes guard names to authenticated users. JWTs reside in localStorage and logout does not revoke issued tokens. Rate limits are single-process. Signature validation is not malware scanning. Establish approved retention, role lifecycle and backup policies.

The exterior is approximate; mappings in the demo are fictional. No GPS, prediction, AI schedule optimization or synchronized digital twin exists. Software-renderer orbit results miss the provisional 30 FPS target. No physical-phone/user evaluation or independently labelled operational NLP accuracy is available.

Review dependency advisories at each release; previous zero-advisory snapshots are time-bound. Preserve schema and upload backups together. Avoid running legacy replace/reseed tools on real databases. Monitor sanitized API errors and connection availability, and retest latest-NLP and role/ownership behavior after relevant changes. Improve bundles only after profiling target devices. Keep original Blender and historic evidence files.

## Exact student actions before submission

1. Supply the approved proposal, exact objectives/title, official report template/rubric, student/matric/supervisor/programme/session details. Reconcile the provisional report and traceability matrix.
2. Review/expand the literature framework, retrieve full texts where marked pending, apply the required citation style, and verify figure/table numbering in the final university document.
3. Confirm evaluation requirements with the supervisor, obtain any necessary ethics/participant permission, collect real task/questionnaire data and run the existing analyzer. Replace pending results only with collected evidence; do not invent participants or SUS.
4. Rehearse the synthetic demo on the examiner computer, confirm current date/timezone and supported graphics, privately set the demo password, and time the 1697-word practice script to the official duration.
5. Open the editable16-slide deck in the intended presentation software, replace verified metadata and check typography. The deck was rendered/inspected in Artifact Session, not native PowerPoint.
6. Resolve or explicitly accept the documented functional release gaps with the supervisor. Keep them visible in conclusions and the live-demo scope.
7. If deployment is required, obtain explicit hosting/building/data approval, start Docker on the approved host, provision secrets/TLS privately, build/test images and verify database+upload recovery. Do not treat the current configuration as a successful deployment.
8. Review the local Phase 6 diff and preserve it in the desired Git history before handover. The Blender publication is already on main; no extra authorization was inferred to publish Phase 6 or production infrastructure.

## Deliverable entry points

- [Academic draft](../psm/FINAL_PSM_REPORT_DRAFT.md)
- [Traceability](../psm/REQUIREMENTS_TRACEABILITY_MATRIX.md)
- [Presentation outline](../psm/FINAL_PRESENTATION_OUTLINE.md), [speaker script](../psm/PRESENTATION_SCRIPT.md), [editable deck](../psm/presentation/PENJAGA_FINAL_PRESENTATION.pptx)
- [Viva:34 questions](../psm/VIVA_QUESTIONS_AND_ANSWERS.md)
- [Demonstration](../psm/LIVE_DEMONSTRATION_SCRIPT.md)

Prepared artifacts are not a substitute for supervisor approval, participant evidence or an approved production release.
