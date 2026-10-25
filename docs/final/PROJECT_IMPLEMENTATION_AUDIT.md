# Final implementation audit

Inspection and automated verification: 24–25 October 2026 (Asia/Kuala_Lumpur). This audit supersedes aspirational claims in earlier phase instructions. Approved proposal, supervisor feedback, official UTHM template and rubric were not found. Academic objectives remain provisional.

Evidence key: P5 = `docs/psm-evaluation/evidence/` and Phase 5 test documents; P6 = `docs/psm/evidence/phase6-workflow-results.json` plus 17 synthetic screenshots; code tests = repository scripts. Verified means observed within the stated automated/local scope, not production certification or human acceptance.

| Feature | Status | Sources | Dependencies | Verified behavior and evidence | Limits |
|---|---|---|---|---|---|
| Login/JWT | Verified | backend/controllers/authController.js; middleware/auth.js; src/context/AuthContext.jsx | pg, bcrypt, jsonwebtoken | Real logins; missing/expired/forged JWT and inactive accounts rejected (P5/P6) | Token localStorage, 12h lifetime; no server logout revocation |
| Protected navigation/logout | Verified | src/App.jsx; layouts/Shell.jsx; context/AuthContext.jsx | Router, Query | Role routes; malformed storage recovery; account-switch cache isolation (P5 browser) | Not exhaustive accessibility testing |
| Password change | Broken | src/pages/ChangePasswordPage.jsx; backend/routes/authRoutes.js | Axios; absent backend handler | Form calls /auth/change-password; 404 confirmed P6 | Do not use in live demo; no password-reset flow |
| User management | Partially Implemented | backend/server.js; src/pages/UsersPage.jsx | pg, bcrypt | Admin list/create/status/role source; guard API denial P5/P6; actual screen P6 | Not every create/edit UI path tested; no reset workflow |
| Post management | Partially Implemented | backend/server.js; src/pages/PostsPage.jsx | pg | Admin reads/create/status handlers; screen/source inspection | Lifecycle mutations not comprehensively tested |
| Weekly schedules | Verified | scheduleController.js; scheduleRoutes.js; SchedulePage.jsx | pg, multer | Assignment create, overlap rejection, confirmation, locking/chief denial and coverage totals P6 | No week-create API; no AI optimizer; global shortage may hide per-post imbalance |
| Overnight schedules | Verified | scheduleController.js; threeDService.js | PostgreSQL interval SQL | Save overnight interval P6; adjacent-day overlap and 3D semantics P5 | Attendance write limitation below |
| Attendance | Partially Implemented | scheduleController.js; GuardDashboard.jsx; SchedulePage.jsx | pg, ownership JWT | Owning guard check-in/out; duplicate/other-owner rejection P6 | Only current_date assignments; yesterday's overnight duty cannot check out after midnight; no GPS/biometric proof |
| Daily reports | Verified | reportController.js; DailyReport.jsx | pg, classifier, multer | API submission, stored NLP, checklist and protected evidence P6 | Empty checklist allowed; report dates/shifts not uniformly validated |
| NLP rules | Verified | backend/ml/nlpService.js; nlpController.js | active PostgreSQL categories | Synthetic pencerobohan -> High, score 75, persisted through actual submission P6 | Keyword substring/negation limits; confidence is keyword coverage |
| Trained NLP inference | Broken | scripts/train-nlp-model.js; ml/model/nlp-model.json; ml/nlpService.js | JSON artifact contract | Artifact has no weights; current runtime ignores learned NB counts P6/source | Saved synthetic training metrics are not runtime accuracy; no predictive AI |
| NLP category administration | Partially Implemented | nlpController.js; NlpTrainingPage.jsx | pg | Admin-only handlers and screenshot; referenced categories deactivate on delete | CRUD combinations not all exercised |
| Report review | Verified | reportController.js; ReviewReports.jsx | transactions, chief role | Chief approval; administrator write denied P5/P6 | Manual review, no external signature |
| Follow-up actions/progress | Verified | actionController.js; FollowUp.jsx | pg, multer | Approved-report action, administrator status, chief progress P6; latest NLP P5 | No automatic escalation scheduler |
| Notifications | Verified | notificationRoutes.js; NotificationsPage.jsx | pg | High-risk chief notification, own list/read P6 | Latest50 only; no push/email/SMS |
| Dashboards | Verified | dashboardController.js; Dashboard.jsx; GuardDashboard.jsx | pg, Recharts | Latest NLP/Unknown semantics P5; actual synthetic screens P6 | Local evidence only; latest-analysis correction can cost query time |
| Audit trail | Partially Implemented | auditRoutes.js; utils/audit.js; AuditTrail.jsx | pg, CSV helpers | Login/report/review/action/mapping audit writes; source-inspected filtered export | Attendance writes do not call logAudit; not a tamper-proof audit store |
| Exterior model | Verified | artifacts/suk/*.blend/.glb; public/models/Bangunan_SUK.glb | Blender export, Three | Geometry/material/anchor tests; browser screenshots P5/P6 | Approximate exterior; no architectural dimensional validation |
| 3D camera/hotspots/zones/modes | Verified | src/components/building/* | Fiber, Drei, Three | 18 browser regressions, model checks, actual P6 selected-panel/history screenshots | Software-renderer performance below provisional 30 FPS target |
| 3D PostgreSQL mapping/filter/history | Verified | threeDRoutes.js; threeDService.js; use3DOperations.js | pg, roles, repeatable read | Nullable mappings, duplicate prevention, filters, bounded history, role checks P5/P6 | Real operational anchors were unlinked in prior read smoke; demo mappings are fictional |
| Predictive risk / live physical twin | Missing | no sensor/forecast pipeline | Not present | UI explicitly explains limitation | Polling stored records is not live physical synchronization |
| Deployment configuration | Partially Implemented | Dockerfile; backend/Dockerfile; docker-compose.yml; nginx.conf | Node 24, Nginx, PostgreSQL 16 | Build/check passed; Compose syntax valid; context excludes secrets/uploads; fresh install roles only | Docker daemon unavailable; images, TLS, backup restore and real host untested |
| Human usability evaluation | Not Tested | docs/psm-evaluation instruments/templates | approved participants/consent | Empty-data analyzer test prevents invented results | No collected SUS/task results; no causal usability claim |

## Changes made during final preparation

Fixed PostgreSQL DATE conversion in assignment validation and coverage calculations by requesting calendar strings from SQL. Fixed ambiguous SQL parameter types in week/action status updates after a real API failure. Corrected NLP detail selection to latest timestamp/ID with report title/narrative. Added controlled database acquisition in notification/audit routes. Tightened Docker contexts; aligned Node 24; protected Nginx API/upload routing and missing GLB responses; removed automatic legacy demo seeding from Compose. Added a no-overwrite initial-administrator tool and isolated Phase 6 seed/server/testing.

No production infrastructure or operational records were changed. Blender source and backup were pushed to GitHub main in `2123350`; subsequent Phase 6 work remains local unless separately published.

## Release priorities

1. Resolve password-change backend/UI mismatch and after-midnight attendance before operational use.
2. Validate active-guard assignment suitability, checklist completeness and legacy input validation.
3. Establish production TLS, recovery, logging/retention, multi-instance rate limiting and deployment tests.
4. Integrate and independently evaluate trained NLP before making ML accuracy claims.
5. Validate target hardware/browser performance and complete consented user evaluation.
