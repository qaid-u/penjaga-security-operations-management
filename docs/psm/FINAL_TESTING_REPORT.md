# Final testing and performance report

Collection window:24–25 October 2026, Kuala Lumpur. Results describe local synthetic verification, not participant outcomes or production certification. Historical Phase 5 evidence remains unchanged in `docs/psm-evaluation/evidence`; new synthetic evidence is in `docs/psm/evidence`.

## Final command results

| Command | Actual result | Scope |
|---|---|---|
| npm run check | Passed; one existing AuthContext Fast Refresh warning; bundle-size warning | ESLint, specified syntax checks and Vite 8.3.5 production build |
| npm run test:backend | 33 passed,0 failed | Real PostgreSQL/JWT, authorization, input, latest-analysis, uploads and connection errors |
| npm run test:building | 10 passed,0 failed | Approved GLB equality, geometry/materials/anchors, cameras, zones and logic |
| npm run test:evaluation | 3 passed,0 failed | Empty data, arithmetic example and CSV validation; not human results |
| npm run test:building:browser | 18 passed,0 failed | Isolated/mocked API3D browser behavior, failures, camera/modes/history/mobile |
| npm run test:phase5:browser | 5 passed,0 failed | Genuine login/API, mapped panel/history, identity cache, private files and emulated touch |
| npm run test:phase6 | 2 passed on final run | Real synthetic lifecycle and 17 actual screenshot captures |
| docker compose --env-file .env.deployment.example config --quiet | Passed | Compose interpolation/structure only, with nonsecret placeholders |
| Local production-build GLB preview | HTTP200, correct glTF signature,2,537,652bytes and matching SHA-256 | Built static asset delivery only; not hosted Nginx |
| docker info | Unavailable daemon | Docker Desktop Linux engine pipe missing; images not built/run |

Existing suites total 69 test cases. With two Phase 6 cases, total 71; a multi-assertion workflow is one test case. No percentage of complete product behavior is inferred. An intermediate Phase 6 rerun encountered a Windows screenshot-file write error; buffer-based writes/retry were added and the final complete run passed. A date rollover also exposed the need to select current-day synthetic records; the demo now appends dated records without overwriting history.

## Functional/database/authorization verification

`tests/phase6/final.spec.mjs` creates or reuses identified current-day synthetic records only. Real logins, unauthenticated401, guard management/3D403, schedule save/conflict/confirm/lock/chief denial/unlock, coverage totals, owning check-in/out, duplicate/other-owner denial, invalid checklist400, multipart evidence, another guard report denial, exact upload authorization, chief review, official action, chief progress and notification list/read were exercised. Selected3D summaries include the newly application-classified report. The sanitized JSON contains methods/paths/statuses without passwords, tokens or operational bodies.

Phase 5 PostgreSQL tests additionally cover prior-day overnight overlap, midnight boundaries, nullable/repeated mappings, latest NLP tie ordering, Unknown labels, multi-anchor deduplication, bounded pagination/filter validation and failed connections. The final date-string/SQL-type corrections were exercised through actual database-backed write workflows. Notification/audit DB acquisition was moved inside controlled try/finally paths and failure cases were verified. NLP detail now selects the latest timestamp/ID and includes report title/narrative; the regression uses a report with two analyses. Bootstrap-admin source is syntax checked; a production account/bootstrap lifecycle is not claimed tested.

## Rendering/responsiveness and screenshots

Model checks confirm2,537,652 bytes,192 meshes,57,310 triangles,13 materials and seven anchors. Actual Edge screenshots show the approximate exterior and fictional mapped records. Automated mobile/tablet/touch/keyboard/reduced-motion/WebGL-failure cases passed in the stated browser environment. Emulated mobile is not physical-device testing; no full WCAG conformance claim is made. [Screenshot index](evidence/SCREENSHOT_INDEX.md).

## Original Phase 5 benchmark (no new timing run in Phase 6)

Conditions: Edge Chromium headless, SwiftShader software WebGL, localhost/no throttling, Node 24.15, Windows, i7-12650H,16 logical CPUs. Original measurements are retained as collected; representative graphics hardware and phones remain pending.

| Metric | Before | After | Interpretation |
|---|---:|---:|---|
| Desktop model-ready |4321 ms|3471 ms| One recorded local run per condition |
| Desktop orbit |9.95 FPS|13.79 FPS| Below provisional 30 FPS target |
| Emulated mobile model-ready |2036 ms|1894 ms| Not physical-phone network/device |
| Emulated mobile orbit |10.83 FPS|19.49 FPS| Below provisional 30 FPS target |
| Draws per rendered frame |384|192| Static-shadow change |
| GLB revisit fetch/revalidation events (4 visits) |4|0| Session asset caching |
| Heap delta after4 visits + GC |3.373 MB|3.309 MB| Does not prove leak freedom |
| Desktop / mobile selection after |—|467 ms /915 ms| Software-renderer interaction |

After animation FPS: desktop7.67, emulated mobile17.18. Node-side parse median29.84→15.38 ms was not an isolated browser parser improvement and must not be presented as one. API seven-sample medians: overview29.89→19.59 ms; summary34.57→25.77 ms; incidents31.80→31.14 ms; legacy dashboard20.61→56.16 ms. Correct latest-analysis semantics can increase cost. Do not claim every endpoint became faster or use these samples as a statistically established effect. Full originals: `../psm-evaluation/evidence/performance-before.json`, `performance-after.json`, `PERFORMANCE_BENCHMARK.md`.

## Security snapshot

Phase 5 audit counts: frontend16 before→0 reported after; backend11 (including2 critical)→0 after. These snapshots reflect dependencies at collection time, not a guarantee of no vulnerabilities. Production CORS/headers/TLS certificate policy and authorization denials were tested in documented scopes. API/upload no-store, exact references and private Vite file denial are covered. Final deployment preparation improves image exclusions and Nginx routing; runtime image behavior awaits a working Docker engine.

## Known defects and unverified results

- Broken: password-change UI calls absent endpoint (404 verified).
- Partial: attendance mutations require assignment date=current_date; yesterday's overnight checkout is unsupported.
- Broken contract: saved Naive Bayes artifact has no runtime weights; current classifier is keyword-based.
- Partial: guard eligibility and legacy field validation, checklist completeness, attendance audit coverage; report CSV control has no export endpoint (source inspected).
- Pending: human participant evaluation, SUS/task outcomes, representative GPU/phone/browser matrix, independent labelled NLP holdout, production TLS/hosting/image scan and backup restore.

No NLP accuracy, user satisfaction, response-time benefit or physical-building safety measure is fabricated. Academic conclusions must remain within these boundaries.
