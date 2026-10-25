# Viva questions and answers

Answers reflect the inspected prototype, not a completed organizational study.

## 1. Why PENJAGA?

It integrates related security-operation records and provides a spatial entry point. Specific organizational benefits remain hypotheses until stakeholder evidence and evaluation exist.

## 2. What problem has been verified?

The engineering task of linking role-authorized modules to shared PostgreSQL records and named exterior anchors is demonstrated. No measured organizational baseline was supplied.

## 3. Why React?

It fits the existing component-based application and integrates Router, Query and React Three Fiber. No benchmark establishes it as universally superior.

## 4. Why PostgreSQL?

The actual design needs foreign keys, transactions, interval queries, indexes and consistent relational joins. These features support the implemented workflows.

## 5. Why Express?

It is the existing REST server and provides middleware boundaries for authentication, roles, errors and uploads.

## 6. Why Blender?

It supplies editable exterior modelling and GLB export. Source and backup remain available for authorized future refinement.

## 7. Why React Three Fiber rather than Unity?

It integrates Three.js scenes with the existing React web interface and state. No comparative Unity study was performed.

## 8. How does GLB integration work?

The approved GLB is served from public/models, loaded into Three.js, and inspected for geometry, materials and seven named anchors. Camera and marker components use that resolved scene.

## 9. How do hotspots link to the database?

tbl_lokasi_3d has a unique allowlisted hotspot ID and nullable id_pos foreign key. An administrator maps it to an active post; the API resolves related records.

## 10. What is useful about 3D?

It offers recognizable exterior regions as an alternative navigation path. Improved task speed or comprehension has not been measured.

## 11. How does authentication work?

Login compares a bcrypt password hash and signs a 12-hour JWT. Middleware validates HS256/expiry and reloads the current account and role from PostgreSQL.

## 12. Is logout server-side revocation?

No. It clears local browser credentials/cache. An issued token remains valid until expiry unless account status or current role invalidates access; there is no revocation list.

## 13. How are roles enforced?

Express requireRole checks protect endpoints independently of frontend route/menu controls. Guard ownership further restricts report/evidence and attendance access.

## 14. How are schedule conflicts checked?

SQL compares half-open time intervals including adjacent days and next-day ends. A guard-level advisory transaction lock serializes save checks.

## 15. Is scheduling AI-optimized?

No. Users assign guards manually; the application rejects invalid dates, equal times and overlapping intervals.

## 16. How are incidents classified?

Active category keyword substrings are matched after normalization. Matching categories receive priority base plus10 per distinct matched keyword; maximum score is clamped0–100.

## 17. Is the trained NLP model used at runtime?

No for the checked-in Naive Bayes artifact. Runtime expects weights; the artifact stores other learned fields and has no weights. Training metrics cannot be reported as runtime accuracy.

## 18. What are severity thresholds?

Scores>80 are Critical, >60 High, >30 Medium, otherwise Low. Priority bases are10/35/65/85. These are heuristic rules, not calibrated incident probabilities.

## 19. What does confidence mean?

Matched keyword count divided by configured keyword count in the selected category, capped at1. It is not a probability of correct classification.

## 20. How is attendance recorded?

An owning guard checks in/out against an assignment dated current_date. A unique index prevents duplicate attendance; timestamps do not prove physical presence. Yesterday’s overnight checkout is a known limit.

## 21. Is it a real-time digital twin?

No. It polls stored operational data and lacks physical sensors, bidirectional synchronization and predictive validation. The accurate term is interactive 3D operational visualization.

## 22. How accurate is the building?

It is an approximate exterior derived from photographs. Dimensions, interiors and official floor layouts were not surveyed or validated.

## 23. How are building and operational privacy separated?

The user approved public demo-exterior delivery and source publication. Operational APIs/uploads remain authenticated. Other building references and real data require their own approval.

## 24. What tests passed?

69 existing automated checks were rerun successfully, plus two Phase 6 lifecycle/screenshot tests. Categories and conditions are detailed in FINAL_TESTING_REPORT; counts are not participant numbers.

## 25. What performance was measured?

Phase 5 Edge headless SwiftShader desktop orbit13.79 FPS and emulated mobile19.49 FPS; model-ready3.47s/1.89s. These remain below a provisional 30 FPS target and are not physical-phone results.

## 26. Did every API become faster?

No. The legacy dashboard median increased from20.61 ms to56.16 ms after latest-analysis correctness changes. Report the original per-endpoint data.

## 27. How was usability evaluated?

Instruments and an empty-data-safe analyzer exist, but no participant outcomes were collected. No SUS, satisfaction or task-time benefit is claimed.

## 28. Which objectives were achieved?

The provisional engineering objectives have source/test evidence. Official achievement cannot be finalized until they are reconciled with the approved proposal.

## 29. What was a concrete technical challenge?

Maintaining consistent latest-analysis and mapping semantics across dashboard, history and selected-location queries, while distinguishing Unknown/unlinked/error states. Tests document these cases; this is not an invented personal reflection.

## 30. Why does an unmapped location show no records?

A visual anchor alone does not establish a real post. Nullable mapping preserves that distinction and avoids invented operations.

## 31. How are uploads protected?

MIME/signature/size/count validation and exact database-reference checks guard downloads; a guard must own a report or qualifying assignment reference. Signature checks are not antivirus scanning.

## 32. Is production deployment complete?

No. Build and Compose syntax were checked, but Docker image execution, TLS, backups/restoration and approved hosting remain unverified. No public deployment was performed.

## 33. What defects remain?

Missing password-change API, after-midnight attendance restriction, trained-inference mismatch, incomplete validation/audit coverage and hardware/usability evaluation gaps.

## 34. What should be improved first?

Resolve functional release gaps, establish one NLP inference contract with independent labels, test representative devices/users, and validate production recovery before expanding claims.
