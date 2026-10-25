# Phase 7 NLP verification plan

Use synthetic fixtures and isolated demo databases. No test may reset or export an operational database, expose a provider secret, or claim mocked responses as a live Gemini result.

## Verification layers

| ID | Layer | Case | Expected result |
|---|---|---|---|
| N01 | Local model | Training artifact loaded by runtime inference | Shared tokenization and validated versioned counts are used; no incompatible weights contract |
| N02 | Local model | Malformed artifact or no relevant trained terms | Controlled fallback/review state, explicit provenance |
| N03 | Context | Explicitly denied fire/intrusion/loss | Event context records denial; no invented reported event |
| N04 | Context | Drill/hypothetical/suspected incident | Distinct event status and an honest urgency/review interpretation |
| N05 | Context | Negated first clause plus actual second incident | The actual event is preserved; whole-report blanket negation is rejected |
| N06 | Evidence | Every excerpt and extracted detail | Valid offsets into the exact original narrative; unsupported text is rejected |
| N07 | Location | Known, unknown and ambiguous mentions | Only approved identities suggested; no persistent mapping changes |
| N08 | Report write | Model/provider temporarily unavailable | Report/checklist/evidence persist; analysis state is pending/failed/unavailable |
| N09 | Queue | Retry, concurrency and lease recovery | One applicable completion per job; an old worker cannot overwrite another completion |
| N10 | Queue | Reanalysis while previous result exists | Previous completed result remains readable; new work has explicit provenance |
| N11 | Alert | High-risk result retried/reanalysed | Qualifying initial alert emitted once; reviewer cannot silently suppress it |
| N12 | Gemini validation | Malformed JSON, unknown category, missing quote, invented quote | Unavailable/invalid review state, sanitized error and no official write |
| N13 | Gemini validation | Original report contains prompt-like instructions | Data is treated as untrusted text; no tools/secrets/approval authority |
| N14 | API authorization | Analysis/similar/reanalyse/feedback with missing token or wrong role | Existing authentication, role and ownership boundaries enforced |
| N15 | Related text | Another guard's closely matching report | Excluded from a guard's candidate results/snippets |
| N16 | Helper UI | Manual title and narrative already entered | No automatic overwrite; applying a proposed title is explicit |
| N17 | Helper UI | Assistant error or stale response | Form remains usable; stale suggestions do not replace current input |
| N18 | Review UI | Local source check with Gemini unavailable | Distinct labels; no "AI review passed" or fabricated confidence |
| N19 | Review UI | Pending job becomes completed | Bounded polling, clear status and updated result without losing report |
| N20 | Review UI | Chief feedback versus administrator maintenance | Feedback concerns one analysis; global category controls remain administrator-only |
| N21 | Mobile | 390px-wide reporting/review | Controls remain usable; no page-level horizontal overflow |
| N22 | Regression | Existing report/review/action/3D/API tests | No role bypass, broken uploads or latest-analysis regressions |

## Independent synthetic challenge

Fixture: `tests/phase7/fixtures/independent-challenges.json`, version `phase7-challenge-v1`, 40 synthetic cases.

It includes eight existing categories; affirmative Malay and English cases; denied, drill and suspected events; mixed affirmative/negated contexts; invalid time; unknown/ambiguous locations; and prompt-like text. These examples were separately authored rather than copied from the training sample file. Labels remain provisional and require expert review.

Run:

```powershell
node --test tests/phase7/evaluation.test.mjs
node scripts/evaluate-nlp.mjs
```

Metrics are emitted from actual executions, never prefilled:

- Category accuracy, macro-F1 and per-category precision/recall/F1 over explicitly category-labelled cases, with a fixed taxonomy.
- The same category comparison for the legacy keyword baseline when exposed by the engine.
- Event-status confusion and accuracy across the five declared states.
- High/Critical analysis outputs on the denied/drill subset, with a separate simulated conservative alert-policy count. Neither is a count of actual database notifications.
- Exact-source-span validity. A valid quote is not proof of semantic completeness or physical truth.
- Local median/p95/maximum inference duration, excluding file loading and all network/provider time.

Do not tune against the challenge until it passes and then present the result as an untouched holdout. Failures should be disclosed. A new expert-labelled, source-separated dataset is required for final model-selection and operational claims.

## Interface suite

`playwright.phase7.config.mjs` serves Vite on 127.0.0.1:4179 and intercepts requests to a synthetic API origin. No backend/database or Gemini key is needed. It must be run after the frontend files are complete, separately from shared-port suites.

```powershell
npx playwright test --config playwright.phase7.config.mjs
```

Capture paths are `docs/testing/evidence/phase7-ui/`. The images are actual browser renders using mocked synthetic API data. The current five-case interface suite passed and the four captures were visually inspected. They do not certify a live provider or database integration.

## Genuine integration and provider evidence

Use the isolated demo server/database and the real authorization middleware for N08–N15. Inject a deterministic reviewer into backend tests to exercise validation and failure behavior without external costs. Log only sanitized request status/evidence identifiers. A separately recorded live Gemini smoke may confirm one synthetic request's connectivity; do not infer broad reviewer quality from it.

Before release, record commands, exact pass/fail counts, model/fixture versions, provider mode and any pending cases. Keep existing Phase 5/6 evidence separate. Rollout decisions require stronger independently labelled results than this small development challenge.
