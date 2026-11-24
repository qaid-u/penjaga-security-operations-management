# Automatic learning from newly reviewed reports

New reports are classified immediately using the current model. A chief can use **Sahkan kategori** to accept or correct a category independently of report approval. The training checkbox is off by default. A validation saved with this checkbox off stays in the report record and is excluded from training.

## Eligibility

- The report must be approved, and the same chief must have explicitly confirmed the category and opted into training. Existing explicit confirmations submitted through the legacy approval API keep their training preference.
- Validation accepts active incident categories. Training uses the subset supported by the current model.
- Demo/synthetic/example records are excluded by title markers and protected analysis metadata. The 28 seeded demo reports are not training observations.
- Content hashes must still match the original labelled narrative. Historical approvals are not automatically backfilled as labels.
- Case/whitespace/punctuation-normalized copies and numeric variants share a family. Conflicting category labels in a family exclude that family. This is basic duplicate detection, not proof of semantic independence.
- Exact normalized synthetic-corpus families are excluded from operational learning.

The family hash permanently assigns roughly 20% to validation. An example does not move from validation into training on the next run. This prevents count-only split changes from leaking previously trained cases into evaluation.

## Trigger and training

`NLP_AUTO_TRAIN_ENABLED` defaults to enabled. Approval wakes the worker; a 30-second check also resumes work after restart. It requires at least **20 new eligible families** since the last completed attempt (`NLP_RETRAIN_MIN_LABELS` can raise this), at least two training categories, and at least four validation examples covering two categories. A batch waits if those conditions are not met.

Training runs in a bounded worker thread and never blocks the report HTTP request. It rebuilds the count model from the fixed synthetic training partition plus the eligible operational training partition. It does not repeatedly add labels to prior model counts, and it never includes validation cases in training. The latest 2,000 reviewed rows are considered to bound resources; duplicates/invalid rows may reduce the usable total. Inference settings and neutral-word exclusions come from the baseline configuration rather than being retuned against each small operational validation batch.

## Evaluation and activation

The candidate is compared with the incumbent on the fixed synthetic development partition and the operational validation partition. Macro-F1, accuracy and every class's recall must not regress. Fixed negation/drill checks also reject High/Critical analysis outputs on those denial/simulation cases. These are development regression checks, not an independent estimate of operational accuracy or a guarantee about notification false positives.

Only a passing candidate is activated. PostgreSQL atomically deactivates the prior model and activates the new version; a unique index permits only one active model. Rejected/failed runs retain the current model. A report/label change invalidates its training snapshot; additional reports arriving during training are retained for the next batch. Session advisory locks prevent concurrent model promotion across API processes. Interrupted runs can retry after a cooldown, at most three attempts.

Inference reads the active database artifact, falling back to the original file baseline if no operational model is active or the stored format is incompatible. Existing stored report analyses and official decisions are not rewritten when a new model is promoted. New analyses record the model actually used.

## Storage and privacy

Migration 008 adds `tbl_model_labels` and `tbl_model_training_runs`. Confirmations, hashes, partition assignments, run metrics, version history and active model artifacts are stored in PostgreSQL. No automatic training process writes operational narratives, datasets or model vocabulary into Git-tracked files. Model vocabulary can contain operational words and therefore must be protected with database backups and access controls just like reports. No external AI/network service is used for retraining.

The standalone NLP management screen remains removed. The category confirmation is a normal report-review field, not a training dashboard. Database backups include the learning tables. Operator rollback can use the retained database model history; no public deployment or operational-accuracy certification is implied.

## Validation

Backend tests cover role restrictions, explicit opt-in labels, ordinary approval without learning, demo exclusion, duplicate/conflicting families, changed source text, real worker-thread computation, retry behavior, private model storage, activation, incumbent retention and fallback. Deterministic injected quality decisions test registry transactions independently of metric outcomes; they are not accuracy evidence. Browser checks verify an initially blank category choice and submission only with chief approval.

On 2 November 2026, migration 008 was applied to local PostgreSQL after a private database/evidence backup. All original table record checksums were preserved and all 131 reports remained. The new label and training-run tables started empty: no seeded demo or old approval was treated as a new human label.
