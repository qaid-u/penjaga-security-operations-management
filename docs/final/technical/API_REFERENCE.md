# API reference

Inspected from `backend/server.js`, every registered route and its controller/service. Prefixes below are complete paths. A = Pentadbir Sistem; C = Ketua Pengawal; G = Pengawal Keselamatan; All = all three authenticated roles. Protected requests require `Authorization: Bearer <token>`. The shared middleware adds 401 for missing/invalid/expired identity and 403 for an inactive account or unauthorized role to every protected endpoint below. Errors are JSON `{message}`; SQL/credentials are not returned. ID/FK validation is not uniformly strict in legacy endpoints; invalid legacy IDs may yield 500 rather than 400. This reference does not claim a fully validated OpenAPI contract.

Login tokens last 12 hours. The login limiter allows five failed attempts per 15 minutes per IP in one process; it is not distributed. Logout is local, with no server revocation endpoint. Password changes verify the current password, store a bcrypt hash, and are limited to five attempts per user per 15 minutes in one process.

## Implemented endpoints

| Method | Full path | Roles | Parameters / body | Success response | Endpoint errors |
|---|---|---|---|---|---|
| `GET` | `/api/health` | Public | None | 200 {status:OK,timestamp} | No DB check |
| `GET` | `/api/ready` | Public | None | 200 {status:Ready,db:Connected} | 503 unavailable database |
| `POST` | `/api/auth/login` | Public | JSON username,password | 200 {token,user:{id_pengguna,nama_penuh,nama_pengguna,emel,nama_peranan}} | 400 malformed; 401 credentials; 403 inactive; 429 attempt limit; 500 |
| `POST` | `/api/auth/change-password` | All | JSON currentPassword,newPassword (10+ characters, max 72 UTF-8 bytes) | 200 {message} | 400 invalid/current password; 429 attempt limit; 500 |
| `GET` | `/api/auth/me` | All | Bearer token | 200 {user} (current DB identity) | 401 missing/expired/invalid; 403 inactive; 500 |
| `GET` | `/api/meta` | All | None | 200 {roles,posts,categories,incidentCategories,checklist,guards} | 400 invalid input; 500 database/server failure |
| `GET` | `/api/users` | A | None | 200 user[] with role; excludes password hash | 400 invalid input; 500 database/server failure |
| `POST` | `/api/users` | A | JSON id_peranan,nama_penuh,nama_pengguna,emel,kata_laluan (10+),no_telefon optional | 201 public user row | 400 required/password; 409 duplicate email/username; 500 |
| `PATCH` | `/api/users/:id` | A | Path id; JSON id_peranan,status_akaun (Aktif/Tidak Aktif) | 200 public user row | 400 status; 404 missing; 500 |
| `GET` | `/api/posts` | A | None | 200 post[] | 400 invalid input; 500 database/server failure |
| `POST` | `/api/posts` | A | JSON nama_pos; optional nama_bangunan,lokasi,waktu_operasi | 200 {message} | 400 invalid input; 500 database/server failure |
| `PATCH` | `/api/posts/:id` | A | Path id; JSON status_pos (Aktif/Tidak Aktif) | 200 {message} | 400 status; 404 missing; 500 |
| `GET` | `/api/reports` | All; G own only | Query page,limit,search,status,post,shift,risk,date,attention; follow_up=pending selects approved reports requiring action with no existing action | 200 {data:report[],meta:{total,page,limit,totalPages}} | 400 invalid input; 500 database/server failure |
| `GET` | `/api/reports/export.csv` | All; G own only | Same filters as report list | CSV attachment, up to 10,000 matching reports | 400 invalid filters or export too large; 500 |
| `GET` | `/api/reports/:id` | All; G own only | Path id | 200 {report,reviews:[],checklist:[],actions:[]} | 403 another guard owner; 404 absent; 500 |
| `POST` | `/api/reports` | G | JSON or multipart: id_pos,id_kategori_insiden optional,tajuk_laporan,kandungan_laporan,syif,tarikh_laporan,masa_laporan,checklist (array or JSON string); lampiran_fail files max 6 | 201 {message,id_laporan,report,nlp:{kategori_dikesan,tahap_risiko,skor_risiko,kata_kunci_dikesan,tahap_keyakinan}} | 400 fields/checklist/file; 413 size; 500 including missing active categories |
| `PATCH` | `/api/reports/:id/review` | C | Path id; JSON status approved/Disahkan or rejected/Ditolak,comment,requiresFollowUp boolean | 200 {message}; stores Diluluskan/Ditolak | 400 status/types; 404 missing; 409 already reviewed; 500 |
| `GET` | `/api/actions` | A,C | None | 200 action[] joined to report/post/latest NLP and progress_notes | 400 invalid input; 500 database/server failure |
| `POST` | `/api/actions` | A | JSON id_laporan,pegawai_bertanggungjawab,tindakan_diambil; optional tahap_keutamaan,tarikh_mula,catatan_tindakan | 201 action row | 400 fields/priority; 404 report; 409 unapproved or existing action; 500 |
| `PATCH` | `/api/actions/:id` | A | Path id; JSON status_tindakan (Baru/Dalam Tindakan/Selesai),catatan_tindakan | 200 action row | 400 status; 404 missing; 500 |
| `POST` | `/api/actions/:id/progress` | C | Path action id; JSON or multipart catatan_progress; lampiran_fail max 3 | 201 progress row | 400 notes/file; 404 action; 413 size; 500 |
| `POST` | `/api/actions/:id/request-update` | A | Path action id; JSON or multipart catatan_progress; lampiran_fail max 3 | 201 progress row | 400 notes/file; 404 action; 413 size; 500 |
| `GET` | `/api/jadual/mingguan` | A,C | None | 200 week[] | 500 |
| `GET` | `/api/jadual/mingguan/:id` | A,C | Path week id | 200 week row | 404 missing; 500 |
| `GET` | `/api/jadual/mingguan/:id/coverage-summary` | A,C | Path week id; optional date=YYYY-MM-DD within that week; omitted date returns weekly totals | 200 {coverage,details,coverageByPost,totalRequired,totalAssigned,shortage,activeDutyCount,absentGuardCount,uncoveredPosts} | 400 invalid/out-of-week date; 404 missing; 500 |
| `GET` | `/api/jadual/my-schedule` | G | None | 200 own assignment[] from the current Kuala Lumpur date onward, plus eligible overnight shifts; includes can_check_in and can_check_out | 500 |
| `GET` | `/api/jadual/keperluan-pos` | A,C | None | 200 requirement[] joined to post | 500 |
| `POST` | `/api/jadual/keperluan-pos` | A,C | JSON id_pos,syif,bilangan_diperlukan integer >=0,status_aktif optional | 200 upserted requirement row | 400 input; 500 |
| `POST` | `/api/jadual/check-conflict` | A,C | JSON id_pengguna,tarikh_tugas,masa_mula,masa_tamat,id_jadual optional | 200 {ok,critical:string[]} | 400 input; 500 |
| `POST` | `/api/jadual/mingguan/:id/assignments` | A,C | Path week id; JSON assignment fields below | 201 assignment row | 400 date/time/fields; 404 week; 409 overlap/chief locked; 500 |
| `PUT` | `/api/jadual/assignments/:id` | A,C | Path assignment id; JSON assignment fields below | 200 assignment row | 400 date/time/fields; 404 assignment/week; 409 overlap/chief locked; 500 |
| `DELETE` | `/api/jadual/assignments/:id` | A,C | Path assignment id | 200 {message} | 404 absent or chief locked; 500 |
| `POST` | `/api/jadual/mingguan/:id/import-csv` | A | Multipart jadual_fail CSV; exact header fields below | 200 {imported} | 400 CSV/row/conflict; 404 week; 413 size; 500 |
| `POST` | `/api/jadual/mingguan/:id/upload-pdf` | A | Multipart jadual_fail PDF | 201 file row | 400 missing/signature; 404 week; 413 size; 500 |
| `POST` | `/api/jadual/mingguan/:id/:action` | A | Path week id; action confirm/lock/unlock | 200 week row; status Disahkan/Dikunci/Draf | 400 action; 404 week; 500 |
| `POST` | `/api/jadual/assignments/:id/check-in` | G owner | Path assignment id; no body | 200 attendance row; assignment becomes Hadir | 404 not own or outside eligible attendance date/time; 409 duplicate; 500 |
| `POST` | `/api/jadual/assignments/:id/check-out` | G owner | Path assignment id; no body | 200 attendance row; assignment becomes Selesai | 404 not own or outside eligible attendance date; 409 no active check-in; 500 |
| `GET` | `/api/dashboard` | A,C | Query date or from/to,location (post ID),risk | 200 {cards,priority,trend,byCategory,byRisk,keywords,latest,insights} | 400 invalid input; 500 database/server failure |
| `GET` | `/api/dashboard/guard` | G | None | 200 {today,duty:assignment[]} | 400 invalid input; 500 database/server failure |
| `GET` | `/api/audit` | A | Query page,limit<=100,user,role,pos,module,activity,status,dateMode,date,month,year,format=csv | 200 {data,meta}; CSV attachment if requested (max10,000 rows) | 400 invalid input; 500 database/server failure |
| `GET` | `/api/notifications` | All own only | Query page (50 per page), unread=true optional | 200 notification[] | 400 invalid input; 500 database/server failure |
| `GET` | `/api/notifications/unread-count` | All own only | None | 200 {unread}, across all pages | 500 database failure |
| `PATCH` | `/api/notifications/read-all` | All own only | No body | 200 {updated}; marks own unread records read | 500 database failure |
| `PATCH` | `/api/notifications/:id/read` | All own only | Path notification id | 200 {message} | 404 absent or other owner; 500 |
| `GET` | `/api/nlp-training/` | A | None | 200 category[] | 500 |
| `POST` | `/api/nlp-training/` | A | JSON nama_kategori,tahap_keutamaan,kata_kunci_rujukan array or comma-separated; optional penerangan_kategori | 201 category row | 400 fields/priority; 409 duplicate; 500 |
| `PATCH` | `/api/nlp-training/:id` | A | Path category id; JSON optional nama_kategori,tahap_keutamaan,penerangan_kategori,kata_kunci_rujukan,status_kategori | 200 category row | 400 priority/status/keywords; 404 missing; 409 duplicate; 500 |
| `DELETE` | `/api/nlp-training/:id` | A | Path category id | 200 {deactivated:boolean}; referenced category deactivated, otherwise removed | 404 missing; 500 |
| `GET` | `/api/nlp-training/analysis/:reportId` | A | Path report id | 200 latest NLP row | 404 no analysis; 500 |
| `GET` | `/api/nlp-training/:reportId` | A | Path report id (analysis alias) | 200 latest NLP row | 404 no analysis; 500 |
| `GET` | `/api/3d/locations` | A,C | None; query parameters rejected | 200 location[] | 400 query present; 503 DB/migration |
| `GET` | `/api/3d/overview` | A,C | Common 3D filters below | 200 {period,refreshed_at,locations,totals} | 400 filters; 503 |
| `GET` | `/api/3d/incidents` | A,C | Common filters plus page,limit | 200 {items,total,page,limit,period,refreshed_at} | 400 filters/pagination; 503 |
| `GET` | `/api/3d/filters` | A,C | None | 200 {posts,categories,today,timezone} | 503 |
| `GET` | `/api/3d/locations/:id/summary` | A,C | Positive path ID; common filters | 200 location/mapping state, linked,in_scope,post,metrics,assignments,reports,actions,limits (lists omitted for unlinked/out-of-scope) | 400 ID/filters; 404 location; 503 |
| `PATCH` | `/api/3d/locations/:id/mapping` | A | Positive path ID; JSON id_pos=null or active existing post ID | 200 updated location row | 400 mapping; 404 location; 400 ineligible post; 503 |
| `GET` | `/uploads/:filename` | All; G referenced ownership | Path safe single filename; Authorization required | 200 protected binary download, no-store/nosniff | 401 invalid token; 404 invalid/unreferenced/other-owner/missing file; 500 |

## Shared parameter contracts

All `/api/jadual` suffixes and roles are also registered at **`/api/schedules`**. All `/api/nlp-training` suffixes and roles are also registered at **`/api/nlp`**. These are router aliases, not different implementations. Trailing slashes are optional under Express defaults.

Assignment bodies: `id_pengguna,id_pos,tarikh_tugas` (real YYYY-MM-DD), `syif` (Pagi/Petang/Malam/Office Hour), `masa_mula,masa_tamat` (HH:MM or HH:MM:SS), optional `catatan`. Equal start/end is rejected; earlier end means next day. Date must lie within the selected week. Guard ID and post ID are foreign keys; active-user/role suitability is not comprehensively enforced. Schedule locking restricts chief edits; administrators retain override permission. Confirmation/locking is administrator-only. No create-week endpoint exists: provision weeks through an approved setup/import process.

CSV headers: `id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat,catatan`. Quoted values are parsed, all rows are validated and the transaction rolls back on failure. Uploaded CSV/PDF files are at most 8 MiB. Evidence permits JPEG, PNG, WebP, PDF with MIME/signature checks, at most 8 MiB each; report max 6, progress/request max 3. These signature checks are not malware scanning. Report checklist entries use `{id_checklist,jawapan,catatan?}` with Ya/Tidak/Tidak Berkaitan. Empty arrays currently pass; completeness of every active checklist is not enforced.

Common 3D query: `date` duty date (default Kuala Lumpur today), `from,to` report period (default duty date), valid dates 1900–2100 and max 366 inclusive days; `zone` one of seven HOTSPOT IDs; `mapping=all|linked|unlinked` (API default linked); `post` positive integer; `risk=Low|Medium|High|Critical|Unknown|HighCritical`; `category` <=100 characters; `report_status=Dihantar|Diluluskan|Ditolak`; `action_status=Baru|Dalam Tindakan|Selesai`. Empty optional values are accepted. Unknown query keys are rejected. History pagination defaults page1, limit20 and allows page<=10,000, limit<=50. Summary bounds: assignments200/reports10/actions20. `/locations` accepts no filters.

Report-list pagination uses page and limit. Inspect `reportController.js` before adding unsupported search filters. Legacy dashboard filters are distinct from 3D filters and use `location`, not `post`. Metadata currently exposes guard names to all authenticated roles; use approved synthetic data for public demonstrations.

## Example lifecycle

1. POST login; retain token outside logs.
2. GET meta for eligible post/checklist IDs.
3. Guard POST report; read its stored NLP response.
4. Chief PATCH review with approved and follow-up flag.
5. Administrator POST action; chief POST progress.
6. Administrator GET selected 3D summary with explicit dates.

A successful API result records a database event, not physical guard location. Integration assertions: `tests/phase6/final.spec.mjs`; sanitized response statuses: `../../psm/evidence/phase6-workflow-results.json`. Never paste real bearer tokens or operational request bodies into documentation.

Daily coverage uses one day of post requirements and returns assigned guards in `coverageByPost[].assignments`. Shortage is summed per post/shift; excess staffing at one post cannot offset a shortage elsewhere. Calendar dates remain `YYYY-MM-DD`.

The notification centre refreshes every 30 seconds while active. Follow-up requests notify active chief guards; chief progress updates notify active administrators. Report review notifies the submitting guard, and approval requiring follow-up also notifies administrators. Unread counts include older records beyond the first 50.

## Calendar exports and compact operation views

Reports (including `/reports/export.csv`), `/audit` and `/dashboard` accept `from=YYYY-MM-DD&to=YYYY-MM-DD`. Both bounds are required, inclusive, and validated; reversed or invalid dates return 400. Other filters and role restrictions still apply. Weekly exports use Monday through Sunday; monthly and yearly exports use full calendar boundaries, including leap years. CSV exports retain their 10,000-record limit and report ownership rules.

The report and audit lists show eight records per page. Scheduling and follow-ups show six expandable records per page; search and building/status filters operate on the complete loaded collection before paging. Admin and chief dashboards appear before the building previews. Dashboard CSV and standalone SVG downloads can use their own calendar period; browser printing supports PDF. Report statistics follow the selected period, while operational backlog and today’s schedule remain explicitly labelled current snapshots.

## Dashboard analytics semantics

The dashboard opens on the latest 14 calendar days in Kuala Lumpur. `insights.period` describes the requested window and its observed end (at most today). Bounded periods compare with the immediately preceding interval of the same observed length; all-time and future-only periods have no comparison. The daily series includes zero-report dates and is capped at the final 366 days for long windows; aggregate totals still cover the full observed interval.

`insights.current` and `previous` contain total, classified, High/Critical, reviewed and attachment counts. Risk share divides High/Critical by valid classified reports; classification coverage and completed reviews divide by total reports. Empty denominators and zero-volume baselines produce unavailable rates, not invented percentage changes. Risk-share changes are percentage points. Latest stored NLP classifications are used; missing or invalid classifications remain Unknown.

`insights.posts` lists up to five posts ordered by High/Critical report count, then report volume. Source links preserve period and risk filters. `insights.backlog` groups currently submitted reports into 0–2, 3–6 and 7+ calendar days since report date, using the post/risk scope across all dates. These are descriptive reporting measures, not incident rates, safety scores, guard performance measures, SLA calculations or forecasts. CSV and SVG exports include the observed dates, denominators and comparison context.
