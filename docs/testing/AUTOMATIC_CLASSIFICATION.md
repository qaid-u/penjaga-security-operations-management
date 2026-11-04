# Automatic report classification

Newly approved reports can now feed [automatic learning](AUTOMATIC_LEARNING.md) when the chief explicitly confirms a category. Raw inserts and ordinary approvals do not retrain on unverified predictions. The fixed 2,000-example synthetic baseline remains the initial model; evaluated operational versions are stored privately in PostgreSQL.

Administrators and chief guards read category/risk suggestions in the normal report document. The standalone NLP page, draft analysis assistant, technical event panels, model settings and feedback controls have been removed from the user interface. Old `/nlp` administrator bookmarks redirect to report monitoring. Report submission automatically queues local classification; the short result panel refreshes while the job is pending. Human approval and follow-up permissions are unchanged.

Historical analysis records and the internal report-analysis APIs are retained. There is no database reset, bulk relabelling of historical reports, or insertion of generated training examples as operational incidents. New analyses record the actual model version. The runtime reloads the model file when it changes.

## Data provenance and splits

All examples are fictional, authored/generated for this project. They contain no operational source records, personal identifiers or verified incident claims. The labels are provisional developer annotations and require domain-expert review before operational accuracy claims.

- `backend/ml/data/classification-scenarios.json`: 80 newly authored scenario descriptions, ten per category.
- `backend/ml/data/nlp-training-samples.json`: 64 existing authored synthetic seed reports.
- The generator also creates 288 existing event/location examples and four wording variants per new scenario, including its original wording.
- `backend/ml/data/classification-expansion.json`: 168 additional authored scenarios, 21 per category, including Malay and English descriptions. Neutral framing variants share the same scenario group; 166 additional examples per category are retained to reach the fixed target.
- `backend/ml/data/classification-corpus.json`: exactly 2,000 examples, balanced at 250 per category.
- `backend/ml/data/classification-splits.json`: 1,576 training examples and 424 development examples. Variants from the same source/event family remain in one partition. Duplicated normalized texts cannot cross partitions. Variant counts are not counts of independent incidents.

The taxonomy is Rondaan Biasa, Pencerobohan, Kebakaran, Pergaduhan, Kehilangan Aset, Vandalisme, Keselamatan Fizikal and Kerosakan Kemudahan. The trained target is incident topic. Event assertion (reported, suspected, denied, drill, unclear) and risk/urgency use contextual policies, so a mention of fire does not by itself establish a real fire. No trained risk-probability model is claimed.

## Model and evaluation

The count-based Multinomial Naive Bayes classifier uses the existing validated Malay/English token preprocessing, unigrams, bigrams and smoothing. The saved artifact is `backend/ml/model/nlp-model.json`, version `nb-v2-8372800163d5`. Only the training partition contributes model counts. Generated examples are not inserted into PostgreSQL or automatically treated as human-approved training labels.

The classifier-only development macro-F1 is **78.2%** on 424 grouped synthetic development examples. Neutral report boilerplate is excluded from training features. A fixed 36-setting search chooses smoothing, bigram weight and class prior using only this development partition. The selected setting is alpha 0.05, bigram weight 0 (unigram inference), and empirical class priors. Because this partition is used for selection, its score is optimistic rather than an unbiased final holdout result. The preceding 82.2% score used a different, smaller partition and is not directly comparable. Per-category precision, recall, F1 and confusion counts are in `backend/ml/model/classification-training-report.json`. This is a development benchmark, not an independent field evaluation or a calibrated confidence probability.

The separate existing 40-case synthetic challenge was not added to training. The combined classifier/context-rule pipeline achieved category macro-F1 **95.7%**, compared with **95.0%** for the preceding 672-example model/pipeline run. Event-status accuracy remained **90.0%**. These aggregate pipeline scores must not be attributed to the classifier alone. The separate challenge was not used by the training or hyperparameter-selection code. Repeated inspection still makes this a development challenge; obtain fresh, expert-labelled data for final claims.

The new analysis produced no High/Critical outputs on eight denied/drill challenge cases. The separately simulated conservative notification policy would still alert on five of those eight, because its existing keyword-based safeguard was retained. These are different measures; no claim that all false alerts were eliminated is justified. Full evidence, cases, source-span checks and limitations are in `docs/testing/evidence/classification-2000-evaluation.json`.

On the fixed 276-example subset of additional development families, the previous classifier scored 75.2% macro-F1 and the expanded classifier scored 68.6%. This regression is retained in `docs/testing/evidence/classification-2000-comparison.json`; more synthetic variants do not imply universally better classification. New data needs expert label review and a fresh independent evaluation before claims of operational improvement.

## Maintainer commands

```sh
npm run train:nlp
node --test backend/tests/classification-data.test.js backend/tests/nlp-engine.test.js
node scripts/evaluate-nlp.mjs --output docs/testing/evidence/classification-evaluation.json
```

Training persists the disclosed corpus, group-separated split, model and per-class evaluation report. Keep the separate challenge out of training and tuning. Review vocabulary, labels, class-level errors and real operating conditions before a new release. A future operational dataset needs authorized, de-identified reports with independently checked category labels; synthetic examples alone cannot establish readiness for unattended security decisions.
