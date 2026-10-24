# System test plan

The executable case matrix is [PHASE5_TEST_PLAN](../testing/PHASE5_TEST_PLAN.md). It records IDs, modules, objectives, preconditions, steps, expected/actual results, status, evidence and notes. [Functional results](FUNCTIONAL_TEST_RESULTS.md), [security results](SECURITY_TEST_REPORT.md) and [performance measurements](PERFORMANCE_BENCHMARK.md) provide the execution record.

Environments:

- Workstation: Windows, Node 24, PostgreSQL 17; Edge Chromium with SwiftShader software WebGL. Fixed desktop/tablet/mobile viewports and reduced-motion/touch emulation as specified in tests.
- Existing operational database: read-only smoke checks; 3D integration fixtures live in a unique transaction schema and are rolled back. No real mapping or operational row is changed for evidence.
- Separate local cluster at 127.0.0.1:55435, database `penjaga_phase5_demo`: four synthetic users, three posts, 240 reports and explicitly fictional mappings. Legacy security/mutation regressions are confined here and restore their temporary changes.

Priority: P0/P1 confidentiality, authorization, account isolation and data correctness; then error recovery and core interactions; then rendering/network efficiency and accessibility. Tests never reset the operational database. Model identity checks protect the approved asset.

Acceptance requires passing available functional/security/build checks and explicit disclosure of failed provisional goals or untested environments. Human UAT and production readiness are separate gates, not inferred from automated passes. Git push does not constitute deployment or academic acceptance.
