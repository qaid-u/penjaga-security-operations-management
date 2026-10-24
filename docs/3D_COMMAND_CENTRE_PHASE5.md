# PENJAGA — Phase 5 completion record

Phase 5 audited the existing system, repaired verified defects, measured rendering/API behavior and prepared academic evaluation materials. Phases 3/4 source and tests from the same authorized implementation are included in the release so the validated result is reproducible.

## A. Repository implementation status

See [implementation audit](psm-evaluation/IMPLEMENTATION_AUDIT.md) for COMPLETE/PARTIAL/MISSING classifications based on actual code and tests. Functional exterior/model/API integration is complete within its documented scope. Real-site mappings, representative hardware acceptance, human evaluation outcomes and production acceptance remain separate prerequisites.

## B–C. Functional and database verification

Actual results are in [functional test results](psm-evaluation/FUNCTIONAL_TEST_RESULTS.md). Verification includes 10 model/logic tests, 33 backend integration/security tests, 18 existing 3D browser regressions, 5 real-login/database end-to-end tests and 3 evaluation-analysis tests. The prior 3D fixture schema is transactional and rolled back. Phase 5 mutation/evidence tests run only against a separate local synthetic database. No operational mappings or records were changed to create evidence.

The separate demo contains four fictional users, three posts, 240 reports, two schematic mappings, schedules/overnight attendance and follow-up states. Its preparation script refuses to overwrite an unidentified nonempty database. Local runtime credentials are randomly generated and ignored; public demonstration application credentials are confined to this synthetic dataset.

## D. Security findings

[Security report](psm-evaluation/SECURITY_TEST_REPORT.md) documents tested JWT/current-role behavior, report/action permissions, exact evidence ownership, byte-derived MIME, upload cleanup/limits, input bounds, private development files, origin policy and TLS configuration. Audits fell from 16 frontend/11 backend advisories to zero known advisories in both trees. This is bounded local validation, not certification of production security.

## E–F. Rendering and backend performance

[Benchmark report](psm-evaluation/PERFORMANCE_BENCHMARK.md) retains actual before/after JSON and query plans. On software WebGL, desktop orbit increased from 9.95 to 13.79 FPS and mobile emulation from 10.83 to 19.49 FPS; draw calls per main frame fell from 384 to 192. Four return visits caused four additional model fetch/revalidation requests before and zero after caching. The 30 FPS provisional goal was not met in this environment. API timing results are mixed; no universal speedup is claimed. The repaired dashboard's latest-analysis correctness has a measured latency cost on this fixture.

## G–I. Accessibility, fixes and automated coverage

Keyboard/list access, visible labels, reduced-motion presets, mobile sheet/focus return, tablet/mobile overflow and emulated one-finger/two-finger interaction were exercised. A previously idle reduced-motion camera now explicitly invalidates the demand-driven canvas. Account cache separation, saved-identity recovery, latest-analysis joins, database acquisition handling, file delivery and cleanup, Blob URL cleanup and guard dashboard field/key fixes are listed with regression evidence in the results document. No model decimation or source rewrite was performed.

## J–L. Academic materials

Prepared under `docs/psm-evaluation/`: system plan/results, security report, benchmark, UAT protocol, custom questionnaire, empty task/questionnaire CSVs, reproducible descriptive task analysis, limitations, demonstration guide, implementation audit and deployment checklist. The [case matrix](testing/PHASE5_TEST_PLAN.md) includes objectives, conditions, steps, expected/actual results, status and evidence.

The UAT compares conventional A and 3D B with counterbalanced order, equivalent synthetic tasks, completion/time/error/accuracy/interaction measures and explicit limitations. Human participants and questionnaire responses are **Pending Data Collection**. The custom questionnaire is not SUS. The analyzer produces no invented outcomes for empty templates and makes no significance claim.

## M–O. Readiness, limitations and next steps

Build/start and Compose configuration were verified locally; a disposable-database CI workflow was added. Actual hosting, remote certificate chain, backup restoration, representative physical devices and university participant evaluation remain unperformed. Existing chunk advisories and one Fast Refresh warning are recorded. See [deployment checklist](psm-evaluation/DEPLOYMENT_READINESS.md) and [known limitations](psm-evaluation/KNOWN_LIMITATIONS.md).

Next steps: run CI after the authorized source push; provision reviewed real mappings; conduct the planned human study and physical hardware measurements; complete deployment-specific security/backup/operator acceptance before any production release. No unrelated feature phase or production deployment was initiated.
