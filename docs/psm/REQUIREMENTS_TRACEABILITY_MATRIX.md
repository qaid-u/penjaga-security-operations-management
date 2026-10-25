# Provisional requirements traceability matrix

Approved proposal/objectives were not available. O1/O2/O3 are the reconstructed engineering objectives in the report draft and must not be presented as official objectives. Requirements below describe observable capabilities and explicit gaps. Verified is limited to the stated automated/local verification scope. Phase 6 source files and screens are relative to the repository unless linked.

| ID | Objective basis | Requirement | Implementation source | Verification method / observed result | Completion status | Evidence |
|---|---|---|---|---|---|---|
| R01 | O1 provisional | Authenticate identities and enforce roles | src/App.jsx; backend/middleware/auth.js | JWT/role API tests and browser navigation | Verified | backend/tests/phase5.test.js; threeD.test.js |
| R02 | O1 provisional | Manage users and posts | backend/server.js; UsersPage.jsx; PostsPage.jsx | Source inspection, read screens and role-denial tests | Partially Implemented | evidence/09-user-management.png; audit |
| R03 | O1 provisional | Assign guards and reject interval conflicts | backend/controllers/scheduleController.js | Real API create/conflict/lock and coverage assertions | Verified | evidence/phase6-workflow-results.json |
| R04 | O1 provisional | Record attendance for owning guard | backend/controllers/scheduleController.js | Real current-day check-in/out and duplicate/ownership denial | Partially Implemented | evidence/phase6-workflow-results.json; overnight limit |
| R05 | O1 provisional | Submit report/checklist/evidence | backend/controllers/reportController.js; middleware/upload.js | Multipart real API and exact download ownership checks | Verified | tests/phase6/final.spec.mjs; backend/tests/phase5.test.js |
| R06 | O1 provisional | Store and explain current incident classification | backend/ml/nlpService.js | Synthetic report produces High/75 using active keyword | Verified | evidence/16-stored-nlp-analysis.png; workflow results |
| R07 | No approved objective found | Use trained NLP inference at runtime | backend/scripts/train-nlp-model.js; ml/nlpService.js | Artifact/runtime contract inspection, no weights assertion | Broken | backend/ml/README.md; audit |
| R08 | O1 provisional | Chief reviews, admin acts, chief adds progress | backend/controllers/reportController.js; actionController.js | Real API lifecycle and unauthorized review denial | Verified | evidence/phase6-workflow-results.json |
| R09 | O1 provisional | Notify chief for high-risk submissions | backend/routes/notificationRoutes.js | Real list and mark-read after rule-generated High report | Verified | evidence/phase6-workflow-results.json |
| R10 | O1 provisional | Provide audit/export evidence | backend/routes/auditRoutes.js; utils/audit.js | Source inspection and audited writes | Partially Implemented | audit; attendance not explicitly audited |
| R11 | O2 provisional | Deliver exterior GLB and compatible anchors | public/models/Bangunan_SUK.glb; buildingHotspots.js | 10 model/logic checks, real WebGL screenshot | Verified | scripts/building-model.test.mjs; evidence/17-building-canvas.png |
| R12 | O2 provisional | Camera, zone, marker and history interaction | src/components/building/* | 18 isolated browser tests plus genuine workflows | Verified | tests/building/*; tests/phase5/workflows.spec.mjs |
| R13 | O2 provisional | Map approved anchors to authorized post records | backend/services/threeDService.js | Nullable mapping/latest NLP/deduplication/roles DB tests | Verified | backend/tests/threeD.test.js; P6 workflow |
| R14 | O3 provisional | Measure rendering/API performance | tests/phase5/benchmark.spec.mjs | Recorded before/after software-renderer benchmark | Verified | ../psm-evaluation/PERFORMANCE_BENCHMARK.md |
| R15 | O3 provisional | Demonstrate human usability improvement | docs/psm-evaluation evaluation instruments | No participants or outcomes collected | Not Tested | ../psm-evaluation/EVALUATION_ANALYSIS.md |
| R16 | O3 provisional | Prepare install/deploy/handover | Dockerfiles; docker-compose.yml; nginx.conf; docs/final | Build/lint/Compose validation; no image startup | Partially Implemented | ../final/DEPLOYMENT_GUIDE.md |
| R17 | No approved objective found | Change password through visible screen | src/pages/ChangePasswordPage.jsx | Actual missing endpoint404 assertion | Broken | evidence/phase6-workflow-results.json |
| R18 | O3 provisional | Produce academic/presentation/demo package | docs/psm; docs/final | Content consistency and rendered-slide review | Verified | FINAL_PRESENTATION_OUTLINE.md; PROJECT_HANDOVER |

No completion percentage is calculated: requirements differ in importance and approval is pending. Before submission, insert exact approved objective wording/IDs, reconcile scope, review evidence with the supervisor and retain unresolved results as pending. Test-case counts are not requirement-coverage percentages.
