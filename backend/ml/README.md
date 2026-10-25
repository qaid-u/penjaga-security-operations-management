# PENJAGA incident classification: verified runtime boundary

`nlpService.js` reads active categories, priorities and keyword arrays from PostgreSQL. It normalizes text and performs substring matching. Matching categories receive priority base scores (Low 10, Medium 35, High 65, Critical 85) plus 10 per distinct matched keyword. The largest score is clamped to 0–100; thresholds >80, >60, >30 produce Critical, High, Medium respectively. Otherwise risk is Low. No match defaults to Rondaan Biasa.

Confidence is matched-keyword coverage within the selected category, not a calibrated probability. Substring matches may produce false positives; negation, context and multilingual performance are not validated. Active categories are required for report submission.

## Experimental training

`npm run train:nlp` runs `backend/scripts/train-nlp-model.js` and replaces `model/nlp-model.json` using synthetic samples from `data/nlp-training-samples.json` and deterministic expansions. The script trains multinomial Naive Bayes and reports a synthetic validation result. It is not evidence of runtime accuracy or performance on independent operational data.

## Integration gap

The runtime reads the JSON for each report but consumes only a `weights` object. The checked-in Naive Bayes artifact has `categories`, vocabulary and count/metric fields, but no `weights`. Its learned counts therefore do not affect current classifications. There is no low-confidence model fallback implementation. `NLP_MODEL_PATH` changes the file path, not this contract.

Future work: choose one model format, integrate inference explicitly, validate against an independently labelled and consented holdout set, assess per-category precision/recall and calibration, and retain human review. Never commit confidential reports to training files.
