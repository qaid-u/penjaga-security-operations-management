# Functional verification results — 24 October 2026

## Executed results

| Check | Actual result | Evidence |
| --- | --- | --- |
| Original/approved model identity, anchors, transforms, geometry, camera bounds, occlusion, timezone boundaries, marker semantics | 10 tests passed | `npm run test:building` |
| Evaluation CSV validation, empty-data behavior and synthetic arithmetic | 3 tests passed | `npm run test:evaluation` |
| 3D database/API regressions | 21 tests passed | `evidence/backend-tests.txt` |
| Phase 5 security, legacy data and production-mode configuration regressions | 12 tests passed; 33 combined backend tests passed | `evidence/backend-tests.txt` |
| Existing 3D browser regressions | 18 tests passed | `npm run test:building:browser` |
| Genuine-login demo workflows, account switch, corrupt storage, touch/pinch and private-file denial | 5 tests passed against actual synthetic DB | `npm run test:phase5:browser` |
| Controlled before/after rendering/API benchmarks | Both completed | `evidence/performance-before.json`, `evidence/performance-after.json` |
| Read-only query profiling | 13 read-query plans captured in each run | `evidence/sql-before.json`, `evidence/sql-after.json` |
| Build/lint/backend syntax | Build passed; one existing React Fast Refresh warning remains | `npm run check`; final execution log |
| Dependency audit | Frontend 0 / backend 0 known advisories at run time | `evidence/audit-*-after.json` |
| Docker Compose configuration | Passed `docker compose config --quiet` using synthetic placeholders | Configuration validation only; no containers deployed |

## Verified defect corrections

| ID/severity | Root cause | Correction and regression |
| --- | --- | --- |
| FIX-01 P1 | Global React Query cache persisted across identities; legacy keys omit user ID | New client per account/role, cancellation/clear on disposal; real two-guard switching test |
| FIX-02 P1 | Saved identity parsed without error handling | Validated parsing clears corrupt identity/token and returns login; browser regression |
| FIX-03 P1 | Legacy joins included every historical NLP row | Latest timestamp/ID lateral joins in report, action and dashboard queries; distinct-count/latest-risk assertions |
| FIX-04 P1 | PostgreSQL acquisition occurred outside controller try blocks | Acquire inside try; release/rollback guarded; simulated connection failure returns controlled response |
| FIX-05 P1 | Attachment authorization used substring-only references; MIME came from user filename | Exact stored reference comparison, signature-derived safe MIME, attachment/no-store/nosniff; owner/prefix/polyglot-name tests |
| FIX-06 P1 | Development root could serve private backend/runtime files; upload HTML changes triggered reloads | Vite filesystem deny rules and watcher exclusions; direct private-path requests denied |
| FIX-07 P1 | Imperative immediate camera changes did not always wake demand rendering | Explicit invalidate for preset/focus/dolly; reduced-motion pixel-change regression |
| FIX-08 P2 | Model fetch aborted/restarted by StrictMode and repeated after route visits | Shared in-flight request, bounded public-byte cache, component-owned parsed scenes; repeated-navigation benchmark and retry tests |
| FIX-09 P2 | Static geometry/light shadow map recomputed on camera movement | Render shadow map once per viewer scene; measured draw calls per main frame halved |
| FIX-10 P2 | Rejected forms could leave already-uploaded files; upload limit errors returned 500 | Failed-response cleanup and 400/413 mapping; multipart signature/missing-form/oversize tests |
| FIX-11 P2 | Guard dashboard used nonexistent `id_status`/`tarikh` fields | Use assignment ID and date text; real guard workflow no longer emits missing-key warning |
| FIX-12 P2 | Late attachment requests could allocate unreleased Blob URLs | Abort request on unmount and check active state before creating object URL |
| FIX-13 P1/P2 | Known dependency advisories and incompatible React 19 icon peer | Patched lockfiles/libraries; removed unused ORM/SQLite; clean audits and route/build regressions |

Initial failures were not reported as passes: a test used an unverified schedule URL (corrected to `/api/jadual/mingguan`); a connection-failure stub initially broke `pg`'s callback acquisition contract (corrected); normalized period test objects were replaced by actual query-shaped inputs after unknown-parameter rejection; the camera pixel test exposed FIX-07. The first orbit measurement crossed an overlay and was excluded; the final instrument excludes offscreen shadow clears from FPS. The final reports use only completed corrected runs.

No real participant study, physical-device study, production deployment, external penetration test, antivirus integration or backup-restore rehearsal was performed.
