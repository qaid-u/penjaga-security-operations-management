# Phase 7 — Automatic report assistance and NLP review

The draft assistant and event representation are extended by [Phase 8](NLP_PHASE8.md). The fixed-question workflow and development scores below document the Phase 7 baseline, not the new event/dialogue evaluation.

This upgrade adds assistance to existing reporting and review workflows. Guards write and submit reports; chiefs inspect source-linked findings. Model and category maintenance stays in the administrator area. A review finding is an assessment of the analysis against the report text, not verification of a physical event.

## What runs automatically

1. After a short pause in typing, the local assistant proposes a title, shows details it can find in the narrative and asks at most two useful missing-detail questions. Applying a title is optional. The original narrative is not rewritten.
2. Submission saves the report and its analysis job. The interface shows **Sedang dianalisis** while background processing finishes. A draft-assistant or reviewer outage must not make a saved report disappear.
3. Local analysis uses the versioned trained Naive Bayes artifact and active category definitions. Context checks distinguish reported, suspected, negated, drill and unclear text. This is a limited statistical/rule-assisted implementation, not a general guarantee of Malay or English understanding.
4. When configured, Gemini receives the current report, selected analysis and permitted reference definitions for a bounded review. It has no tools or authority to approve records, alter mappings or close actions. Findings must quote a nonempty exact passage from the original narrative.
5. The report panel displays the stored analysis, extracted source passages, Gemini review state and related authorized reports. Technical provenance is available under a disclosure rather than in the primary user flow.

## Three distinct signals

| Signal | Meaning | What it does not establish |
|---|---|---|
| Local classification | A trained model/category configuration produced a suggestion | Operational accuracy or an incident probability |
| Local source checks | Deterministic checks found or did not find a textual inconsistency | An AI-provider review |
| Gemini review | The configured external model returned a validated review of supplied text | Physical truth, official approval or a guarantee of correctness |

The normal display uses **Tiada percanggahan dikesan**, **Perlu semakan**, and **Semakan AI belum tersedia**. Missing configuration, provider errors, rate limits, incomplete responses or invalid evidence must never be shown as a successful review. A stored score from the model is uncalibrated and must not be presented as the probability that an incident is real.

## Local model and data boundary

`backend/ml/textModel.js` shares preprocessing, training, artifact validation and inference. `backend/ml/reportAnalysis.js` produces the serializable analysis and source spans. `backend/scripts/train-nlp-model.js` writes the model artifact from the repository's synthetic source data.

The saved training experiment is not evidence of operational accuracy. Its grouped internal split and the separately authored challenge fixture answer different questions. Existing historical NLP records remain identifiable as legacy analyses, without inventing model provenance.

Run the independent synthetic challenge with:

```powershell
node --test tests/phase7/evaluation.test.mjs
node scripts/evaluate-nlp.mjs
```

The default report is `docs/testing/evidence/phase7-nlp-evaluation.json`. It records fixture/model hashes, actual local latency, per-class results, event-status results, High/Critical analysis outputs on denied/drill cases, a separately simulated conservative alert-policy count, approved-location identity matching and source-span validity. It makes no Gemini calls. Inspect its limitations and failures before drawing conclusions.

The 40 challenge cases are separately composed synthetic development material. Their expected labels are provisional author annotations, not domain-expert adjudications. They are excluded from training. Repeated inspection still turns a holdout into development evidence; obtain a fresh independently labelled set before reporting final academic or operational accuracy.

## Gemini configuration

Use the supported settings in `backend/.env.example`. `GEMINI_API_KEY` belongs only in the private backend environment. Never put it in a `VITE_` variable, browser bundle, report, screenshot, API response or Git history.

The reviewer reads configuration on the server. Fill the private key locally and set `NLP_AI_REVIEW_ENABLED=true` when enabling the connection; the example file starts with external review disabled. `NLP_AI_REVIEW_ENABLED=false` disables external review. `GEMINI_REVIEW_MODEL` selects the provider model and `NLP_REVIEW_TIMEOUT_MS` bounds its wait. `NLP_REVIEW_MAX_PER_HOUR` sets a per-process request budget; it is not a distributed account-wide quota. The Codex five-hour account allowance does not supply Gemini API usage or credentials. Provider calls have their own account limits and billing.

Each request contains report text and reference definitions needed for review. Keep demonstration and implementation tests synthetic. Do not bulk-send historical operational records merely to test the connection. A live provider smoke result proves connectivity and response validation for that case, not review accuracy.

## Persistence and recovery

Migration `004_nlp_review.sql` adds analysis metadata and separate job, feedback and alert-marker tables. It is additive; it does not seed reports or call Gemini. Back up and inspect an existing target before applying approved migrations. Synthetic demo databases remain separate from operational records.

The approved-target migration helper supports a read-only inspection and an additive apply:

```powershell
node backend/scripts/migrate-nlp.js --inspect
node backend/scripts/migrate-nlp.js
```

These commands read the private backend database configuration. Verify the target before applying. The Phase 6 synthetic preparation helper applies the additive migration only after validating its demonstration manifest.

Completed analyses are stored in `tbl_hasil_nlp`; pending/failed work belongs in `tbl_job_nlp`. Existing dashboard and 3D reads must retain the latest completed analysis during retries. Each result records report-text identity, pipeline/model provenance and reviewer findings. Failure messages returned to users must be sanitized.

Alert behavior remains conservative during this upgrade. Gemini findings do not suppress an existing qualifying alert. A report-level alert marker prevents repeated job retries from sending the same initial alert again. The chief's official review and administrator's action permissions remain unchanged. Feedback records a correction or helpfulness judgment; it does not silently retrain or promote a model.

## Locations and related reports

Location extraction may resolve only approved exterior names/aliases and preserve the quoted text. Unknown or ambiguous mentions should stay unresolved. A suggested report location is distinct from an administrator's persistent hotspot-to-post mapping; the assistant must never create an anchor or alter that mapping.

The first related-report implementation uses local TF-IDF text similarity. It is labelled as related text, not a multilingual embedding-based semantic search or proof that two reports describe the same event. Candidates must be restricted to records the caller may access before results/snippets are returned. A guard may not retrieve another guard's report through this feature.

## UI verification

```powershell
npx playwright test --config playwright.phase7.config.mjs
```

These tests use intercepted synthetic API responses to isolate interface behavior. They check title opt-in, preservation of source text, submission during a helper outage, pending/completed analysis states, unavailable-Gemini honesty, mobile layout and role-specific controls. They do not prove database authorization or live Gemini behavior; those require the backend integration/provider tests and disclosed connection checks.

Actual UI captures from this isolated suite, when collected, are under `docs/testing/evidence/phase7-ui/`. They are synthetic interface evidence, not live operational records or proof of external-provider accuracy.

## Recorded development results

The first execution was archived as [initial evaluation](testing/evidence/phase7-nlp-evaluation-initial.json). General context-rule fixes followed feedback, so the [current evaluation](testing/evidence/phase7-nlp-evaluation.json) is explicitly **development before/after evidence**, not an untouched independent holdout or final operational accuracy.

| Measure | Initial run | Current development run |
|---|---:|---:|
| Synthetic challenge cases | 40 | 40 |
| Hybrid-analysis category macro-F1 | 0.911 | 0.911 |
| Keyword baseline category macro-F1 | 0.615 | 0.615 |
| Event-status accuracy | 0.825 | 0.900 |
| High/Critical analysis outputs on eight denied/drill cases | 2 / 8 | 0 / 8 |
| Invalid distinct source spans | 0 / 90 | 0 / 92 |

The current approved-zone identity check matched all 13 annotated synthetic cases. This tiny alias/identity subset is not an architectural-accuracy or general named-entity extraction result. The current measured local median/p95 was 0.523 / 2.319 ms; it excludes model-file loading and Gemini/network time, and is not a production latency guarantee. Exact hashes, runtime policy and per-case failures are in the JSON.

The analysis result is hybrid: the current run used trained inference as the decision source in 19 cases, context keywords in 9, and returned Unknown in 12. Aggregate scores must not be attributed to the Naive Bayes classifier alone. English coverage, morphological wording and postposed uncertainty still have recorded failures.

**Alert interpretation:** the legacy JSON key `falseHighAlerts` measures analysis risk outputs, not database notifications. The separately simulated conservative policy still qualifies 5 / 8 denied/drill cases because it retains original keyword alerts. No actual alerts were emitted by the evaluator, and the reviewer does not suppress them. Do not claim the analysis metric proves fewer operational notifications.

The isolated browser suite passed **5 / 5** after its mock routes/selectors were corrected. Screenshots in [phase7-ui](testing/evidence/phase7-ui/) were visually inspected: desktop guard report, mobile review finding, chief feedback and administrator maintenance disclosure. All API responses in that suite were mocked synthetic data. These results do not establish live Gemini accuracy, database access control or participant usability.

## Remaining validation

- Domain-expert annotation of independent Malay, English and mixed-language reports.
- Negation, drill, quotation, ambiguity and multiple-event recall on a fresh holdout.
- Whether model review catches errors without introducing new ones or delaying urgent work.
- Extraction completeness and location disambiguation, beyond verbatim-span validity.
- Related-report relevance and user task performance.
- Target-device/browser usability and background-worker recovery under realistic load.

See [test plan](testing/NLP_PHASE7_TEST_PLAN.md) for the detailed release checks. Existing Phase 5/6 evidence remains historical and should not be rewritten as evidence of these new features.

## Published snapshot status — 25 October 2026

This snapshot includes the Phase 6 delivery package and the implemented Phase 7 local classifier, source checks, Gemini adapter, durable jobs and simplified interface. It is development work, not an operational release certification.

- Updated 29 October 2026: local analysis and conservative alerts now persist before optional Gemini review. Review runs independently using durable metadata leases; provider latency no longer blocks the local queue. Earlier latency findings describe the previous implementation.
- A live Gemini request has not been verified. The latest local smoke check returned NOT_CONFIGURED; provider tests used mocked responses. The private key must be configured and the backend restarted before running the synthetic connection check.
- Existing Phase 6 documents and presentation describe their dated verification snapshot. Phase 7 changes supersede the old statement that trained inference is disconnected. Current capabilities and limitations are described in this document.
- The additive migration was applied to the local development database after a private recovery backup. The 102 historical reports were retained, with no historical AI backfill triggered.
