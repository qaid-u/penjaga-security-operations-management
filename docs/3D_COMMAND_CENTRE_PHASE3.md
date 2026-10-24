# PENJAGA — Phase 3 operational database integration

## Scope and verified relationships

The existing `/3d-command-centre` page, approved public exterior GLB, camera controls, world-positioned anchors, protected navigation and authentication remain in use. Operational demonstration values were removed from `buildingHotspots.js`. Architectural names/descriptions remain explanatory model metadata, not evidence that a security post exists there.

Relationships verified from `backend/database/schema.sql` and existing controllers:

- `tbl_pos_kawalan.id_pos` is the post key.
- `tbl_jadual_bertugas` references a post, user and `tbl_jadual_mingguan`; the weekly status controls whether an assignment is counted as confirmed.
- `tbl_kehadiran_tugas` references an assignment and user. An existing unique index allows one attendance record per assignment.
- `tbl_laporan_harian` references a post. NLP analyses reference reports; multiple analyses can exist, so Phase 3 selects the latest by analysis timestamp and NLP ID.
- `tbl_tindakan_susulan` references a report; `tbl_progress_tindakan` references an action. Progress records never replace the official action status.
- Existing administrator/chief report-reading permissions are retained. Only chiefs may approve/reject reports; only administrators manage official follow-up status. No new review/action writes are exposed by the 3D API.

## Migration and deployment

Migration: `backend/database/migrations/003_lokasi_3d.sql`.

Run from the repository root:

```sh
node backend/scripts/migrate-3d.js --inspect
node backend/scripts/migrate-3d.js
```

Alternatively, `npm --prefix backend run migrate:3d`. The script loads the existing `backend/.env`, uses the existing PostgreSQL pool, applies the SQL in a transaction with an advisory lock, a five-second lock timeout and a sixty-second statement timeout. Failure rolls back. No existing tables are dropped or recreated. It is safe to rerun: seeds use `ON CONFLICT DO NOTHING`, preserving mapping choices and location IDs. Restart the backend after deploying code to register `/api/3d`; restart/rebuild Vite as usual.

The migration was applied successfully to the configured database. Its timezone was verified as `Asia/Kuala_Lumpur`. Seven architectural anchors exist and initially have no post mapping. No existing security post was guessed, created or linked automatically.

`tbl_lokasi_3d` has:

| Column | Definition |
| --- | --- |
| `id_lokasi` | Serial primary key |
| `hotspot_id` | Unique varchar, constrained to the seven model anchor identifiers |
| `nama_paparan`, `kawasan` | Display name and architectural area |
| `label_aras` | Nullable verified floor label; initially unknown |
| `id_pos` | Nullable integer FK to `tbl_pos_kawalan`, `ON DELETE SET NULL` |
| `status_aktif` | Active boolean, default true |
| `tarikh_dicipta`, `tarikh_kemaskini` | Timestamps with time zone |

Indexes cover mapping post IDs, post/duty-date lookup, post/report-date lookup, latest report NLP and latest action progress. Deleting a post removes its link instead of silently attaching the location to a newly seeded post. A database reset is not part of this migration.

## API and permissions

All endpoints use the existing JWT authentication middleware, which validates the account and current database role. Reads allow **Pentadbir Sistem** and **Ketua Pengawal**. **Pengawal Keselamatan** is rejected. Responses have `Cache-Control: no-store`.

| Method and route | Permission | Purpose |
| --- | --- | --- |
| `GET /api/3d/locations` | Admin/chief | Configured architectural locations and optional post IDs |
| `GET /api/3d/overview` | Admin/chief | Lightweight metrics for all mapped locations, deduplicated post totals |
| `GET /api/3d/locations/:id/summary` | Admin/chief | Selected location, post, schedule/attendance and report/action summaries |
| `PATCH /api/3d/locations/:id/mapping` | Admin only | `{ "id_pos": 123 }` to link an existing active post, or `{ "id_pos": null }` to unlink |

Overview and summary accept `date=YYYY-MM-DD`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`. `date` defaults to the current Kuala Lumpur date; report dates default to that date. Dates must exist, be between 1900 and 2100, be ordered, and span no more than 366 inclusive days. IDs must be positive PostgreSQL integer values. SQL values are parameterized.

Unlinked or inactive locations return a valid summary with `linked: false` and a reason, without invented zero metrics or staffing. Unknown locations return 404; malformed requests return 400; auth failures use existing 401/403 behavior; operational database failures return a sanitized 503. Authentication lookup failures retain the existing middleware's 500 response. No SQL or connection details are returned to clients.

Summary queries run in a read-only repeatable-read transaction. Overview executes bounded set-based aggregation across distinct linked posts rather than one query per hotspot. Detail lists are bounded at 200 assignments, 10 recent reports and 20 actions; aggregate counts describe the full filtered set. Reporting metadata excludes narratives, evidence, contact details and private progress notes.

Mapping updates lock the location row, validate the active post and approved anchor, update the FK, and write `UPDATE_3D_MAPPING` through the existing `logAudit` function in one transaction. The audit payload records the old and new post IDs. There are no report approval, action creation, or action status writes in this module.

## Schedule and attendance semantics

The selected operational period is a Kuala Lumpur calendar day, `[00:00, next 00:00)`. Duties overlap that interval. When end time is less than or equal to start time, the end is on the following day, matching the existing scheduler's overnight convention. Previous-day duties that extend into the selected day are included; duties ending exactly at its midnight are excluded.

`Disahkan` and `Dikunci` weekly schedules count as confirmed. Other weekly statuses are separately counted as not confirmed. Assignment dates, times, weekly status and assignment status are displayed. Empty schedules indicate no recorded assignments, not a verified security incident. Coverage means scheduled assignments, not a comparison against staffing requirements.

Attendance joins on both assignment ID and assigned user. `Checked In` requires a stored check-in; `Checked Out` requires both timestamps; absent check-in is `No Check-In Recorded`; inconsistent checkout-only or reversed timestamps are `Unknown`. Empty assignment lists show no scheduled duty. Stored timestamp-without-zone attendance/progress values are interpreted using the configured application's verified Kuala Lumpur convention, then returned as timezone-aware instants. This assumes historical records were written under that same convention.

These are assignment-based attendance records. They do not establish physical presence at the hotspot, GPS position, or continuously live tracking.

## Reports, NLP and follow-up

Reports are filtered by actual `id_pos` and the inclusive report-date range. Each report contributes once using its latest stored NLP result. Valid levels are `Low`, `Medium`, `High`, `Critical`; absent or unsupported classification is `Unknown`, rather than falling back to the report table's default Low value. Report title, date, status and category are displayed; narratives/evidence remain in existing authorized modules.

Incident mode shows the highest known stored classification in the selected range and indicates any unknown results. This is historical report metadata from a limited NLP prototype, not a calibrated prediction or a label that the building is unsafe. All stored report review statuses remain distinguishable in the recent list; counts do not imply reports have been approved.

Follow-up counts cover actions attached to reports in the same date range. Open means official status other than `Selesai`; `Dalam Tindakan` is a subset of open. Completed actions use `Selesai`. Latest progress type, timestamp and response-request flag are shown without narrative or attachments. Progress entries do not multiply action counts.

## Frontend architecture and refresh

- `use3DOperations.js`: shared overview/selected-summary React Query hooks using existing Axios, plus mapping mutation/invalidation.
- `OperationalToolbar.jsx`: operational day, report range, independent marker layers, legend, manual refresh and snapshot age.
- `LocationMappingPanel.jsx`: administrator-only mapping of approved model anchors to posts fetched from the existing admin `/api/posts` endpoint.
- `LocationInformationPanel.jsx`: loading/empty/error/stale states; real post details, schedules, attendance, recent reports, classifications and follow-ups in collapsible sections.
- `operationalIndicators.js`: explicit per-dimension text/color mappings and Malay messages.
- `BuildingViewer.jsx` / `BuildingHotspot.jsx`: retain 3D behavior while consuming operational indicators. Data errors do not unmount the canvas.

Query keys include identity, role, selected location, mapping revision/post ID and date filters. There is no previous-location placeholder data. Axios consumes React Query's abort signal so rapid selection changes cancel or ignore older requests. Only the selected location fetches detail; no detail request is made without a resolved selection. Mapping changes invalidate the `threeD` cache namespace and update the selected summary.

Freshness is 30 seconds; inactive caches are kept for 60 seconds. Polling defaults to 60 seconds while the page is active and pauses in background tabs. `VITE_3D_REFRESH_MS=0` disables polling; positive settings are clamped to at least 60 seconds. This build-time configuration requires a frontend restart/rebuild. Manual refresh updates overview and selected detail without reloading the model. Failed refreshes explicitly mark retained data as potentially stale and show the last successful server timestamp. The existing Axios interceptor redirects expired sessions to login.

Marker layers are mapping, schedule, attendance, incident classification and follow-up. Status text is available in the location list and accessible marker descriptions, so meaning does not depend only on color. Selected markers remain gold. Schedule/attendance do not become red threat indicators.

The approved Phase 2 public exterior model remains public; operational records are fetched only from authenticated APIs and are not embedded in the GLB.

## Navigation and initial setup

Sign in as an administrator, open **Pusat Kawalan 3D**, expand **Pemetaan lokasi**, and select only a post whose relationship to that architectural area is verified. Save the link; select the hotspot and appropriate dates. Chiefs can inspect but cannot modify links.

Links open the verified general routes `/jadual`, `/semakan`, and `/tindakan`. Those modules do not currently accept verified location/report deep-link parameters, so none are invented. Use their existing filters/details flows. Existing approval and follow-up permissions are unchanged.

## Tests and execution

```sh
npm run check
npm run test:building
node --test backend/tests/threeD.test.js
node backend/scripts/verify-3d-live.js
npm run test:building:browser
git diff --check
```

The database integration suite uses the configured PostgreSQL connection but creates a unique schema inside an outer transaction. Test records, schema creation and audit rows are rolled back in cleanup. Service transactions are represented by savepoints inside that test transaction. It executes actual SQL and actual JWT/account/role middleware through a temporary local Express listener; no production mappings or users are changed. It fails rather than silently skipping when the database is unavailable.

The live verification script starts the current backend temporarily on an ephemeral port, runs the existing smoke test, and reads Phase 3 locations/overview/all configured summaries. It uses `SMOKE_USERNAME` / `SMOKE_PASSWORD` or the existing smoke script's development defaults. JWTs are kept in memory and are not logged. Login creates normal authentication audit records. No mapping is changed.

Browser tests use explicitly labelled fixtures only in test files. They cover the linked panel, unknown fields, loading, refresh and date changes, delayed-response switching, mapping/unmapping, chief restrictions, API failures, expired sessions, all seven marker clicks, camera controls, mobile keyboard/layout behavior, guard rejection, download retry and WebGL failure. API fixture tests do not substitute for the real PostgreSQL/API tests described above.

## Completion verification (24 October 2026)

- `npm run check`: passed lint, backend syntax checks and production build, with the existing warnings noted below.
- Additional syntax checks for the 3D route, service, migration runner and live verification script: passed.
- `npm run test:building`: 5 passed.
- `node --test backend/tests/threeD.test.js`: 15 passed, 0 failed, using actual PostgreSQL and rolled-back fixtures.
- `node backend/scripts/verify-3d-live.js`: passed existing authentication/dashboard smoke checks and all Phase 3 read endpoints; seven locations and zero linked posts were returned. No mappings changed.
- Playwright browser suite: 11 passed, including the Phase 2 regression scenarios and Phase 3 operational scenarios.
- Desktop and mobile screenshots were visually reviewed; they show the initial unlinked state, with mobile selection retaining its information panel below the viewer.
- `git diff --check`: passed.

## Limitations and Phase 4 candidates

No real hotspot-to-post relationships were inferred; operational details remain empty until an administrator supplies verified mappings. Physical phone gestures, other browsers and large production workloads need further testing. No claim of GPS surveillance, predictive incidents, or continuous live monitoring is made.

Existing lint warnings, React Router migration advisories, Vite large-chunk warnings, and the old dashboard's concurrent-query deprecation remain outside this integration. Existing live smoke tests cover login, account metadata and dashboard reads, not every legacy mutation workflow.

Possible Phase 4 work, not implemented here: reviewed stable post/location master data, verified filtered deep links, evidence-based performance profiling, finer pagination, user-controlled polling, and operational data-quality review. Do not enable streaming or predictive claims without a separate approved scope.
