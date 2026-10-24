# Reproducible evaluation analysis

Status: **Pending Data Collection**. Templates contain headers only. No participant outcomes or statistical significance are claimed.

Run `node scripts/analyze-evaluation.mjs <task-data.csv>`. Without an argument it reads the empty repository template and returns zero participants, null rates/times and zero pairs. The script validates participant codes, interfaces, task IDs, nonnegative times/integer errors/interactions, binary completion/accuracy and unique participant/interface/task rows. Preserve raw observations separately; never commit identifiable participant data.

For each task/interface it reports unique participant n, trials, completion rate, mean/median time among successful completions, total navigation errors, accuracy rate and mean interaction count. Failed trial times are retained in source data but excluded from successful-time summaries. Always show failure rates beside timing results so a fast average cannot hide failed tasks.

For each task it calculates B−A completion-time differences for participants who completed both trials, with pair count and mean/median difference. Negative values favor B on time. Incomplete pairs remain represented in group completion/accuracy summaries; do not quietly impute them. Inspect task set, order, device and prior-experience effects before attributing differences to the interface.

Use the custom questionnaire's standard 1–5 coding, report valid n/missing n per item and show distributions/median. No SUS conversion applies. The included task analyzer does not score questionnaires or infer significance. If inferential testing is later proposed, agree the method with the supervisor, justify sample size/assumptions and account for paired design and multiple outcomes before running it. Avoid causal/general population claims from a small convenience sample.

`node --test scripts/evaluation-analysis.test.mjs` checks empty-data behavior, arithmetic on clearly synthetic test fixtures, CSV quoting and validation. Synthetic unit fixtures are not research observations.
