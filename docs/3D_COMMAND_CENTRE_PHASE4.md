# PENJAGA — Phase 4

## Inspection and scope

Phase 4 extends the existing application and `/3d-command-centre`. Phase 1 was verified by parsing the approved GLB: 192 meshes, seven named anchors, material resources and ground geometry. The public GLB still matches the original export byte-for-byte. Phase 2's React Three Fiber viewer, CameraControls, navigation and authorization remain. Phase 3's real PostgreSQL mappings, overnight scheduling/attendance, latest NLP classifications, follow-up summaries, mapping audit and refresh paths were inspected and exercised in integration tests.

The exterior asset was explicitly approved for public delivery in Phase 2. Operational data stays in authenticated APIs and is never embedded into the model or a frontend fixture. Existing user changes to the Blender source are untouched.

No new libraries, schema migrations or seed records were needed for Phase 4. Run the Phase 3 migration on environments where it has not yet been applied. Restart the backend and restart/rebuild the frontend to load the new endpoints and components.

## Files and architecture

New components in `src/components/building/`:

- `buildingZones.js`: named mesh rules, verified zone discovery, camera preset labels.
- `AdvancedFilters.jsx` and `operationalFilters.js`: shared filter controls, Kuala Lumpur dates, quick ranges and reset defaults.
- `OperationalAnalytics.jsx`: functional, mode-specific metric cards.
- `IncidentHistory.jsx`: paginated chronological report list, selected metadata and explicit mapped-zone choices.

Updated components: `BuildingViewer.jsx`, `BuildingModel.jsx`, `BuildingHotspot.jsx`, `CameraController.jsx`, `modelGeometry.js`, `use3DOperations.js`, `operationalIndicators.js`, `OperationalToolbar.jsx`, `LocationInformationPanel.jsx`, `building.css`, and `src/pages/ThreeDCommandCentre.jsx`.

Backend: `backend/services/threeDService.js`, `backend/routes/threeDRoutes.js`, `backend/scripts/verify-3d-live.js`.

Tests: expanded `backend/tests/threeD.test.js`, `scripts/building-model.test.mjs`, `tests/building/operations-fixture.mjs`, and `tests/building/viewer.spec.mjs`; added `tests/building/advanced.spec.mjs`.

## Zones and floors

Only anchors with an actual position and nonempty matching mesh subset become zone options. Current zones:

| Zone | Existing mesh names/prefixes |
| --- | --- |
| Main entrance | `Entrance_*`, `SUK_Central_Entrance` |
| Central block | `Central_*`, `SUK_Main_Body*` |
| Left wing | `SUK_Left_*`, `Left_*`, excluding tower/oculus objects |
| Right wing | `SUK_Right_*`, `Right_*`, excluding tower/oculus objects |
| Front plaza | `SUK_Plaza*`, `SUK_Axial_Walk`, `SUK_Curved_Drive`, `SUK_Drive_Curb` |
| Left tower | `SUK_Left_Tower*`, `Left_Tower*`, `Left_Oculus*` |
| Right tower | `SUK_Right_Tower*`, `Right_Tower*`, `Right_Oculus*` |

Choosing a zone filters operational records to its currently mapped post, focuses its anchor, shows its associated hotspot and highlights actual geometry. Selecting a hotspot directly highlights that geometry without changing the report scope. Reset camera restores the entire-building view and clears the zone; Reset Filters also clears post/incident filters and restores the current Kuala Lumpur day and coverage mode.

Highlighting clones materials temporarily, adds a modest gold emissive tint to the selected subset and dims unrelated geometry. A layout-effect cleanup restores original materials before the asset is disposed. The GLB bytes, vertex data and original material properties are never rewritten.

The current model contains no verified separated floors. The UI explains this and provides zones instead of fabricated floor choices. To add floors later, obtain an authorized model containing verified floor groups, define reviewed floor membership and bounds, and associate anchors with verified floors. Do not derive interior floors from exterior window rows or tower dimensions. No exploded floors were added.

## Modes and marker semantics

Three principal views are available:

1. **Liputan operasi**: scheduled assignment counts and recorded check-in/out counts. Green indicates recorded check-in; blue indicates schedule or checkout records; gray indicates unavailable/no recorded data. Additional retained Phase 3 layers expose mapping, schedule and attendance separately.
2. **Klasifikasi laporan**: highest known stored risk among matching reports, with total count badges. Low=green, Medium=yellow, High=orange, Critical=red; absent/invalid NLP classification is Unknown/gray. Unknown counts remain visible alongside known severity.
3. **Tindakan susulan**: separate open, in-progress and completed counts. Blue indicates `Dalam Tindakan`; yellow indicates other open actions; green indicates completed actions with no remaining open actions. Zero and unavailable states remain distinguishable in text.

Gold denotes the selected hotspot; risk/status text remains available in its tooltip, accessible description, location list and panel. A selected marker is not a change to its recorded classification.

Mode changes preserve camera state and applicable dates. Markers, legend, analytics and queries change together. No overall safety score is calculated. Assignment/attendance records do not establish GPS position or physical presence; report classifications are stored prototype NLP output, not predictions.

## Incident aggregation and history

The service reads actual `tbl_laporan_harian` and uses the latest `tbl_hasil_nlp` row by `tarikh_analisis DESC, id_nlp DESC`. It does not use the report table's default Low value when NLP is absent. The classification and category come from the same latest row. `Unknown` category matches absent NLP.

Reports are constrained by post IDs and inclusive report dates, then intersected with severity, category, report-review status and relevant action-status filters. High/Critical is a convenience union of two stored severities. Official review statuses are `Dihantar`, `Diluluskan` and `Ditolak`; displayed totals include all of these unless filtered. A report count is not a count of confirmed incidents.

One report contributes once even if its post has multiple 3D mappings or multiple historical NLP results. Each action contributes once; progress rows do not multiply totals. Open means official status other than `Selesai`, with `Dalam Tindakan` a subset. When an action-status filter is applied, both qualifying reports and displayed action counts use that filter. Scheduling remains scoped to post/zone and operational day, independent of report severity/category filters.

History is sorted by report date, report time, then report ID, all descending. Page size is 20 in the UI and at most 50 in the API. It includes title, Kuala Lumpur date/time, post, stored category/risk, review status, follow-up status/counts and current mapping metadata. No narrative, evidence, processed NLP text or action narrative is exposed by the new endpoints.

Selecting a report with one applicable mapping highlights/focuses that anchor. With multiple mappings, the user explicitly chooses a zone; the service does not infer an incident's precise position. Unmapped reports remain in the list, clear any previous hotspot selection and explain that no 3D position exists. The report module link uses the verified `/semakan` route and supplies the report ID/title as a visible search reference; it does not invent unsupported deep-link parameters.

Counts are shown at actual mapped anchors. No continuous heatmap is drawn: report-to-post mapping does not provide geographic incident coordinates. Duplicate anchors for one post intentionally show that same post's data, while totals deduplicate the post.

## API and validation

All routes below are under `/api/3d`, use the existing JWT/account middleware, require administrator or chief-guard role, and send `Cache-Control: no-store`.

| Endpoint | Behavior |
| --- | --- |
| `GET /locations` | Existing mapping configuration; unchanged |
| `GET /overview` | Extended filtered metrics, per-location scope flag and deduplicated totals |
| `GET /locations/:id/summary` | Existing detail with the same filters; explicit `in_scope:false` when selected post/zone is excluded |
| `GET /incidents` | New paginated chronological report metadata, total count and mappings |
| `GET /filters` | New authorized post/category choices and server Kuala Lumpur date |
| `PATCH /locations/:id/mapping` | Existing administrator-only audited mapping write; unchanged |

Common parameters: `date`, `from`, `to`, `zone` (one of seven allowed anchor IDs), `post` (positive integer), `mapping` (`all`, `linked`, `unlinked`), `risk` (`Low`, `Medium`, `High`, `Critical`, `Unknown`, `HighCritical`), `category` (exact stored value, maximum 100 characters), `report_status`, `action_status` (`Baru`, `Dalam Tindakan`, `Selesai`). Empty optional filters mean unrestricted. The backward-compatible API default mapping scope is `linked`; the Phase 4 UI explicitly requests `all` by default so unmapped history can be discovered.

History adds `page` (1–10000) and `limit` (1–50). Dates must be real ISO calendar dates between 1900 and 2100, with a report range of at most 366 inclusive days. Invalid arrays, enum values, identifiers and ranges return 400. Missing location returns 404, unauthenticated/expired sessions 401, forbidden roles 403 and unavailable operational storage 503 with sanitized messages. SQL values are bound parameters. Reads use read-only repeatable-read transactions.

Unlinked means no active 3D mapping, not an inactive operational post. Historical records from inactive posts remain inspectable. Mapping setup continues to allow only existing active posts. Mapping queries intersect with zone/post filters; an unmapped zone does not silently expand to other posts.

## Analytics and filter consistency

The existing overview endpoint supplies analytics, avoiding a duplicate `/analytics` endpoint. Totals count distinct scoped posts, scheduled assignments, current recorded check-in states, reports, High/Critical reports, open actions, completed actions and reports without active mapping. All applicable filters are shared with history and selected-location queries. The toolbar exposes the snapshot period; active filters are visible even when mobile filter controls are collapsed.

Card actions open the corresponding mapping/schedule/attendance layer, switch to incident history, apply High/Critical, show unmapped reports, or open follow-up history (completed actions apply `Selesai`). These controls are disabled when their snapshot is unavailable or failed. An open-action card opens the relevant follow-up panel, where official action status can be filtered.

The date input initializes in `Asia/Kuala_Lumpur`. Today/7-day/30-day shortcuts use the server date returned by `/filters` when available, otherwise an explicit Kuala Lumpur date. Date arithmetic uses UTC calendar components to avoid browser timezone/DST drift. The operational duty day is independent of report range; overnight scheduling retains Phase 3's half-open overlap rules.

## Query synchronization and performance

React Query keys include account, role, mode, period, applicable filters, selected location, mapping revision and history page. Detail/history requests receive abort signals; no previous-location placeholder data is displayed. Mapping invalidation refreshes all 3D queries. Camera changes do not fetch data or reload the model. Filtering resets pagination to page 1 and clears previous incident selection.

Operational queries retain 30-second freshness, 60-second cache retention and configurable foreground-only polling (default 60 seconds; `VITE_3D_REFRESH_MS=0` disables it). Filter references are fresh for five minutes and do not poll. Manual refresh requests references, overview, selected summary and visible history. Each panel reports its successful timestamp and explicit failed/stale states. Separately fetched snapshots can differ briefly if records change between requests; no continuous streaming claim is made.

History uses server pagination and aggregation rather than downloading all reports. Queries use a fixed number of round trips, not a request per hotspot/report. Existing Phase 3 indexes cover post/date, latest NLP, mapping IDs and progress; the existing unique action/report index supports follow-up lookups. No speculative indexes were added. Production-scale profiling remains future work.

Rendering retains the lazy-loaded viewer, demand-driven canvas, bounded pixel ratio and existing 1024px shadow map. Material effects run on selection changes, not per frame. BuildingModel is memoized. Six coarse opaque building meshes are used for hotspot occlusion rays instead of raycasting the entire detailed facade. Hidden markers remain reachable through the normal location list. No postprocessing or independent per-marker animation loops were added. Hover scaling uses CSS and honors reduced motion.

## Camera, mobile and accessibility

Overview, front, left, right and top presets derive target/distance from actual scene bounds and viewport aspect. Selected-location focus uses the real anchor, keeps the camera outside the exterior and increases distance for narrow viewports. All transitions use the existing single Drei CameraControls instance, bounded movement and reduced-motion settings. Mode changes leave the selected preset intact.

Zone selectors and the collapsible location list are ordinary keyboard controls. Hotspot selection moves focus to the location panel. On mobile, it becomes a scrollable nonmodal bottom sheet above the existing navigation, with a close button/Escape and focus return. The sheet does not trap focus. Advanced filters start collapsed on narrow viewports. Analytics/history sit beneath the viewer. Normal data navigation remains available when WebGL is unavailable or the model download fails; no canvas interaction is required to read a mapped summary.

## Verification

Commands:

```sh
npm run check
npm run test:building
node --test backend/tests/threeD.test.js
node backend/scripts/verify-3d-live.js
npm run test:building:browser
git diff --check
```

The integration suite executes actual PostgreSQL and JWT/role middleware in a unique schema inside a rolled-back transaction. It covers Phase 3 regression paths plus pagination, latest NLP, multiple mappings, empty/unmapped reports, filter intersections, deduplicated totals, invalid inputs, expired JWT and new-route permissions. Browser fixtures live only under `tests/`; they test rendering and interactions independently of the database suite. The live script starts a temporary backend and reads actual records without changing mappings; login produces normal authentication audit records.

Results on 24 October 2026:

- `npm run check`: passed lint, existing backend syntax checks and production build. Three pre-existing lint warnings and large-bundle advisories remain; no new lint errors.
- Additional syntax checks for the 3D service, router and live verification script: passed.
- `npm run test:building`: **10 passed**, including asset identity, real geometry/zone membership, camera framing, coarse occlusion, Kuala Lumpur date boundaries and marker semantics.
- `node --test backend/tests/threeD.test.js`: **21 passed**, zero failures. The deliberate connection-failure case emits an expected sanitized `ECONNREFUSED` log.
- Full Playwright suite: **18 passed**, covering prior viewer/operations regressions plus zone selection, presets, mode persistence without model reloads, history pagination/filtering/mapping, analytics actions, backend recovery, tablet/mobile keyboard, reduced motion, touch emulation and data access without WebGL.
- Live smoke and 3D checks: passed against the configured database. Existing smoke returned 17 posts, 22 guards and 102 reports. The 366-day history query returned 102 reports, including 53 stored High/Critical classifications, with 20 records per first page. Overview/history totals agreed. Seven anchors exist and zero posts are mapped; the 102 historical reports therefore remain correctly unmapped. No mapping was changed.
- Desktop, mobile, history and selected-left-wing screenshots were reviewed under `artifacts/suk/phase4-*.png`. Screenshots contain explicitly labelled test fixtures, not an assertion about current real staffing/incidents.
- `git diff --check`: passed.

## Limitations and future work

- Seven architectural anchors are present; live verification found zero mapped posts. An administrator must supply verified mappings before physical-zone indicators can represent operational posts. Unmapped incident history works now.
- No floor navigation without verified separated geometry. No incident heatmap without meaningful coordinates. No invented GPS, CCTV, access-control or patrol data.
- Coarse exterior occlusion is intentionally approximate; internal rooms and precise incident positions are not modeled.
- The existing report module does not provide a verified report-ID deep link; navigation opens its authorized general list.
- Physical touch-device gestures, other browser engines and production workload performance need further validation beyond emulation.
- Existing three lint warnings, React Router advisories, large bundle warnings and an existing dashboard PostgreSQL concurrent-query deprecation are outside this phase.

Recommended Phase 5 candidates: approved floor-separated assets and reference mapping review; verified report detail routes; measured query/render profiling; richer pagination if data volume warrants it; operational data-quality tooling. Phase 5 is not implemented automatically.
