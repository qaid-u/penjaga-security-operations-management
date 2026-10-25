# Phase 8 — Event understanding, clarification and 3D report context

PENJAGA now separates event assertions within a report instead of relying only on one report-level category. The existing report-level hybrid category, priority and conservative notification policy remain available. New event records and clarification answers support review; they do not approve reports or verify physical events.

## Guard workflow

Write the original narrative normally. After the existing typing pause, the assistant shows distinct event cards with original source passages, separate reported/suspected/negated/drill/unclear labels and bound times, assets and actions. Independent predicates are split; shared predicates can retain explicitly shared facts. Ambiguous associations are left unresolved. The 64-event processing cap is disclosed when reached.

The assistant asks at most one current clarification, prioritizing a conflicting post, uncertain assertion, ambiguous/missing post, missing time and missing action. Replies may select a supplied option, add bounded time/action text, choose **Tidak pasti**, or **Langkau**. Unknown/skipped fields remain recorded and are not asked repeatedly. The 100-answer budget stops further questions with unresolved work explicitly disclosed. All questions are optional; a helper outage does not block ordinary submission.

Answers are a separate conversation bound to the exact narrative and selected post using a draft hash. Changing either resets the draft conversation, including when an earlier text is restored. The server independently reconstructs and replays the offered-question sequence, rejects stale/forged/out-of-order replies and only accepts currently offered catalogue identities. Client-supplied analysis, coordinates, provenance and mappings are not trusted.

Submission stores the exact original narrative and a separate `nlp_context` JSON object. Background analysis reconstructs the events and validated answers from those inputs. Analysis metadata schema 3 stores the event records, truncation disclosure, dialogue and provenance. Job input identity covers narrative, post and clarification input; leased jobs recheck that identity before saving, including legacy jobs. No historical report is reanalysed automatically.

## Post identity and 3D viewing

Live location references use the server-owned official post catalogue and reviewed aliases. A general mention such as **lif LG** can offer the two DJM lift posts; an assigned reporting post gives context rather than proof of an event's location. Explicit names conflicting with the selected post remain unresolved until clarified. Only existing active references are offered, and official `id_pos` links must match their building/post identity.

Chiefs and administrators can open a confirmed mapped post in the 3D command centre. Stored-report links include building, post, report and event IDs. The 3D page checks the requested post belongs to the requested building, loads the report through the existing authorized API, and displays its exact supporting passage only when event, confirmed post and source offsets match. Invalid, conflicting, unavailable and inaccessible contexts show an explanation without fabricating a source card. Guards retain their existing report permissions and receive no new 3D permission.

Post identity does not verify a model coordinate. All current markers retain their estimated-position labeling. Event context links do not rewrite the report's assigned post, administrator mappings or existing operational counts.

## Model review

Gemini review remains optional and bounded, with exact original-source quotation validation and no tools or write authority. The event-aware prompt includes at most 24 event summaries and discloses truncation; original assertion status is distinguished from separate user clarification. Provider errors still mean unavailable review. Automated tests mock the provider; this phase does not claim live Gemini accuracy or an independently validated probability.

The existing worker still waits for bounded provider review before completing persistence and conservative notifications. Separating provider review from initial local processing remains a deployment limitation described in Phase 7.

## Installation and testing

Rerun `npm --prefix backend run migrate:nlp` on the intended database, after its normal private backup. The repeatable additive NLP migration now adds `tbl_laporan_harian.nlp_context`; it preserves original reports and results. Existing database volumes need this explicit migration; fresh initialization reads the updated migration. Restart the backend after updating. `migrate:nlp -- --inspect` reports whether clarification storage exists. The service reports migration-not-ready rather than accepting submissions on a missing schema.

- `npm run check`: lint, syntax and production build.
- `npm run test:nlp`: legacy/new NLP, provider validation and isolated database/API job tests.
- `npm run test:events`: event/dialogue, input validation and evaluation metric/import tests.
- `npm run evaluate:events`: disclosed local synthetic benchmark; no provider/network calls.
- `npm run test:phase8:browser`: optional dialogue, source preservation, saved context, mobile/role and failure-state interface scenarios.
- `npm run test:building:browser`: includes initial post selection, cross-building rejection and grounded event source-card scenarios.

See [evaluation protocol](psm-evaluation/PHASE8_NOVELTY_EVALUATION.md) and [annotation template](psm-evaluation/EVENT_ANNOTATION_TEMPLATE.jsonl). The committed benchmark contains 24 developer-authored synthetic reports with 29 annotated events. Its regression results are development evidence, including changes informed by those fixtures. The optional Gemini baseline is **not run** unless provenance-bearing external predictions are imported. No expert-labelled operational corpus, participant timing study or real-world accuracy claim is supplied. Fresh expert annotation and consenting participant evaluation remain necessary for final PSM research conclusions.

## Local verification — 26 October 2026

Passed: 107 backend checks, 33 building/model checks, 14 evaluation-tool checks, 43 building browser scenarios, 15 Phase 8 browser scenarios and five legacy Phase 7 browser scenarios. The production build and syntax/lint check passed, retaining the existing AuthContext Fast Refresh warning and large-bundle advisory. Browser fixtures use synthetic intercepted responses; database/API tests use isolated schemas.

Private recovery backups preceded additive migration of the local application and identified demonstration databases. The application retained all 102 reports, 17 posts and their existing mappings; fingerprints of original narratives/post assignments/mappings matched before and after. The demo retained its two reports and 15 posts. No historical AI backfill was triggered. Preservation evidence contains counts and fingerprints only: `artifacts/integration/phase8-database-verification.json`.

The running local demo backend was restarted. An authenticated guard HTTP smoke check used synthetic text, resolved two separate assertion states, offered two LG lift candidates, preserved **Tidak pasti**, suppressed the repeated question and left report-row counts unchanged. It made no provider calls. Evidence: `artifacts/integration/phase8-live-local-smoke.json`. The demo's missing fault category was added only to its identified synthetic configuration so the CCTV example can be exercised. Production accuracy and live Gemini accuracy remain unmeasured.

Reviewed mobile event-card screenshots are under `docs/testing/evidence/phase8-ui/`.
