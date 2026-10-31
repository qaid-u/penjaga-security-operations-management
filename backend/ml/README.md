# PENJAGA hybrid incident classification

`nlpService.js` loads active database categories and the versioned model in `model/nlp-model.json`. `textModel.js` validates the multinomial Naive Bayes count format and preprocessing version before inference. `reportAnalysis.js` combines predictions with configured keywords and source-context rules. Missing or incompatible models fall back to rules with an explicit source-check finding.

The pipeline distinguishes reported, suspected, negated, drill and unclear events, retaining exact source spans. `eventDialogue.js` asks optional bounded questions; answers are validated against the original narrative, selected post and offered question sequence. Answers do not rewrite the original report or prove a physical location.

`npm run train:nlp` replaces the local count model using synthetic training samples. The runtime reloads changed model files. Confidence denotes an uncalibrated relative model score or keyword coverage; it is not an incident probability. Independent labelled operational evaluation is still required.

## Persistence and optional external review

Reports are committed with a durable local-analysis job. The local worker persists classification, evidence and deduplicated conservative notifications in one transaction. A separate worker claims pending review metadata on that saved analysis and invokes optional Gemini review. Provider latency never holds up the local queue or initial alerts.

Review leases expire after three minutes and are reclaimed at most three times. A crashed process leaves recoverable pending/processing metadata. Provider errors produce an unavailable review without undoing local results. The review worker checks the narrative/post/clarification hash again before attaching results, and cannot change risk scores, report decisions or mappings. Existing completed historical analyses are not automatically reanalysed or reviewed.

Enable external review explicitly using deployment configuration and a server-side API key. Tests mock provider responses; they do not establish live provider accuracy.
