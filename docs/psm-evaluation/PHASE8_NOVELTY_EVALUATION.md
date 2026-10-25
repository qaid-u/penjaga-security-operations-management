# PENJAGA Phase 8: event extraction and adaptive clarification evaluation

This package evaluates a specific engineering contribution: preserving several source-grounded events in one Malay/English report, keeping each event's assertion and location uncertainty separate, and asking one relevant clarification at a time. It does not establish that the approach is novel across published research, or that it improves real guard performance.

**Collection status: no expert-labelled operational reports or participant trials have been collected by this package.** The supplied 24 reports, 29 events and 11 answers are explicitly synthetic developer-authored regression examples. Their expected labels are provisional author annotations. These examples have been inspected while developing the implementation, so they are a development set, not an independent holdout. A perfect result on them only establishes that the disclosed checks currently pass.

## Run the local benchmark

From the repository root:

```powershell
node --test scripts/event-dialogue-evaluation.test.mjs
node scripts/evaluate-event-dialogue.mjs --output docs/psm-evaluation/evidence/phase8-synthetic.json
```

The first command tests metric arithmetic, omitted/extra events, malformed input, provider provenance, de-identification checks, grouped splits and local replay. The second creates a reproducible result with the fixture/model/engine hashes and case-level scores. Without `--output`, JSON is printed to the terminal. No network request, Gemini request, database write or notification occurs.

The fixture is `tests/phase8/evaluation-fixtures.json`. It covers all eight categories; Malay, English and mixed reports; multiple event categories and repeated same-category incidents; explicit negation, drills, suspicion, hypothetical and double-negative contexts; two approved LG post candidates; unknown locations; selected-post context; and unknown/skip clarification answers. Its catalogue includes approved legacy zones and DJM post identifiers. The LG aliases are synthetic ambiguity stressors, not claims about a production catalogue.

## What is compared

| Method | Input and retained output | Evaluation interpretation |
| --- | --- | --- |
| `keyword` | Current existing `keywordBaseline` category/keywords; one report-wide occurrence assumption; no extracted fields | Implemented keyword baseline. Its `reported` status is the baseline's implicit occurrence assumption, not a new assertion classifier. Empty field output is scored as omissions where gold fields exist. |
| `reportHybrid` | Current report-level hybrid category/status and report-wide extraction; projected into at most one event | An ablation of event segmentation using retained report-level output, not a historical replay of an older revision. It combines trained inference and contextual rules. |
| `eventDialogue` | The same hybrid report classifier, plus clause/category events and source-grounded field binding before answers | Measures whether keeping event structure prevents report-wide information from being collapsed or attached to the wrong incident. |
| `geminiOnly` | Optional externally supplied predictions on the same original texts/catalogue | **Not run** unless predictions with provenance are explicitly supplied. The evaluator never calls a provider. |

All methods receive the same original report texts and category/location definitions. The local hybrid methods load the same saved model. The report-category prediction for `eventDialogue` is deliberately identical to `reportHybrid`: event segmentation is not a separate primary-category classifier. Do not claim an additional report-category improvement from comparing those two columns.

The legacy adapters use their returned matched keywords as source anchors where available; otherwise they use the whole report. This uses no gold label to select an event. The report adapter retains report-wide fields rather than borrowing the new event-specific binding. A single unambiguous legacy location suggestion is projected as a confirmed identity for this comparison; this is an evaluation convention, not a change to application behaviour. Read the per-case results when a report contains several locations.

## Metrics and denominators

* **Report category:** accuracy, confusion matrix, per-class precision/recall/F1, and macro-F1 across the eight fixed categories plus `Unknown`, on the same reports. Category does not mean that an incident actually occurred. For example, a denied fire can have a routine primary category while retaining a negated fire event.
* **Event detection:** maximum-cardinality, one-to-one matching by overlap of original source anchors. Matching never uses gold category or status. Exact incident evidence is preferred to a broad event source. Repeated incidents in different clauses have different anchors. Missing and extra events respectively count as false negatives and false positives.
* **Event category and status:** confusion/accuracy for each annotated event after source matching; a missing prediction is an explicit incorrect `Unknown`/`missing` result. Event category macro-F1 uses the fixed eight categories; status macro-F1 uses `reported`, `suspected`, `negated`, `drill`, `unclear`. Fixed labels with zero support contribute zero F1; inspect support before interpreting small subsets.
* **Joint event F1:** a true positive requires a matched source, correct category and correct assertion status. Wrong labels, missing events and extra events lower this score. This prevents good status accuracy on only the detected events from hiding omissions.
* **Field extraction:** micro precision/recall/F1 for per-event normalized times, asset strings and action strings, including missed events and unpaired predicted fields. Time values use explicit normalized `HH:mm` where available and preserve an explicit `role: "action"`, so an action time cannot be credited as an occurrence time; asset/action values are case/whitespace normalized source text. This measures extraction and binding, not paraphrase similarity, action completion, urgency or semantic truth. Empty field sets with nothing to score produce `null`, not a successful zero-error accuracy.
* **Location:** exact state-and-identity accuracy (`confirmed`/`ambiguous`/`unresolved` plus catalogue identity), identity accuracy on gold confirmed locations, and preservation of an unresolved identity. A missed event does not receive credit for preserving unknown. Unsupported confirmations count any predicted identity that differs from its matched gold identity or belongs to an unmatched event. An always-abstaining system can preserve unknown, so read this alongside confirmed-location accuracy and event recall.
* **Unsupported affirmative claims:** count an affirmative/suspected category with no matching gold event/category, or whose matching gold mention is negated, a drill or unclear. This is an annotation-relative incident check. It does not verify arbitrary statements against the outside world. Verbatim source-offset auditing is reported separately; correct offsets alone do not prove entailment.
* **Question burden:** initial visible count, all active candidate count, annotated necessary candidates, unnecessary candidates, and replayed answer count. Dormant validation candidates for denied/drill events are excluded from active burden. The old report-level static question count is shown for context. Counts with different information coverage do not establish faster completion or lower user effort. One visible question at a time does not imply one question for the whole report.

Precision is `TP/(TP+FP)`, recall is `TP/(TP+FN)`, and F1 is `2TP/(2TP+FP+FN)`. Empty denominators are `null`; real omissions remain errors. The event matching is an overlap-based development measure, not strict named-entity boundary accuracy. Case-level scores expose its behaviour when several events share a clause.

The original fixture snapshot (`48ff6c9b346bec4bf2188aee9ce2b0827d2bf733a30b7d3a40ca69c56d08a45a`) produced the following local development results when introduced. Rerun the command and retain its hashes before quoting a score, because engine/model changes can change these values.

| Development measure | Keyword | Report hybrid | Event/dialogue before answers |
| --- | ---: | ---: | ---: |
| Report category accuracy | 15/24 | 23/24 | 23/24, same classifier |
| Joint event category/status F1 | 0.491 | 0.694 | 1.000 |
| Event-bound time F1 | 0.000 | 0.842 | 1.000 |
| Event-bound asset F1 | 0.000 | 0.667 | 1.000 |
| Event-bound action F1 | 0.000 | 0.952 | 1.000 |
| Exact location state/identity | 2/29 | 15/29 | 29/29 |
| Unsupported affirmative claims | 10 | 1 | 0 |

There is still a disclosed primary-category failure: F08 is a routine patrol in the author annotation, while the report-level hybrid predicts facility damage. Event-level output retains its routine event. Gemini-only accuracy, expert agreement and participant outcomes remain **not run/pending collection**, not zero. No significance, generalization, provider superiority or operational-safety claim follows from this table. Shared-predicate F23 exposed a binding defect during development and helped refine the rule, which is another reason these cases cannot serve as a final holdout.

## Clarification is additional evidence

Only F15, F16, F20 and F24 include synthetic user replies. Replay answers the **actual current visible question**; it never jumps to a convenient hidden candidate. If the expected sequence cannot be reached, unreplayed replies and errors remain visible. Unknown and skip answers preserve the absence of a fact. A selected post supplies context and candidates; it is not silently treated as a verified incident location.

The report has two separately labelled results on these same four reports:

1. `beforeOnSameReports` scores the original texts against their original annotations.
2. `afterWithAdditionalUserFacts` scores the answered events against annotations extended only by the explicitly supplied synthetic facts. Original source text/evidence remains separate from `clarifiedTime`, `clarifiedAction` and clarification provenance.

All 11 supplied replies currently replay. Three previously unstated actions, one time and two location identities are supplied by those scripts; they were not extracted from the original reports. The after score is a test of accepting and attaching additional information. It is not an improvement in original-text extraction accuracy or evidence that humans will supply accurate answers. A participant comparison must separately measure completion, accuracy, total interactions, unknown/skip use and time for the same tasks, with order counterbalanced.

## Optional Gemini-only baseline import

Prepare a local, blinded packet without gold annotations or synthetic replies:

```powershell
node scripts/evaluate-event-dialogue.mjs --export-provider-input artifacts/phase8-provider-input.json
```

This only writes a file. It contains the exact `promptText`, its SHA-256 and the source fixture SHA-256. No provider request occurs. An operator can run that unchanged prompt independently with a chosen Gemini model, capture the raw response, and wrap its predictions with truthful provenance. Record the exact model identifier, UTC generation time, prompt hash, fixture hash and that the output was not human-edited. Keep the original response and inference settings with the experiment record. Deterministic schema conversion is acceptable if documented; correcting predictions by hand is not an independent baseline. For operational reports, use only data cleared for that external experiment; this package does not authorize disclosure.

The supplied import must have this structure; placeholders below must be replaced with actual run metadata:

```json
{
  "provenance": {
    "provider": "Google Gemini",
    "mode": "gemini-only",
    "model": "ACTUAL_MODEL_IDENTIFIER",
    "generatedAt": "ACTUAL_UTC_TIMESTAMP",
    "promptSha256": "ACTUAL_64_CHARACTER_LOWERCASE_HEX_HASH",
    "fixtureSha256": "ACTUAL_64_CHARACTER_LOWERCASE_HEX_HASH",
    "humanEdited": false
  },
  "predictions": [
    {
      "id": "F01",
      "reportCategory": "Kebakaran",
      "events": [
        {
          "category": "Kebakaran",
          "status": "reported",
          "source": {"text": "Api", "start": 0, "end": 3},
          "evidence": [{"text": "Api", "start": 0, "end": 3}],
          "times": [], "assets": [], "actions": [],
          "location": {"state": "unresolved", "confirmed": null}
        }
      ]
    }
  ]
}
```

The F01 fragment above is a **schema example**, not a Gemini prediction or a complete/correct annotation. Every original-text extraction item must have verbatim `text`, `start`, `end`; times can also include `normalizedTime`. Offsets are zero-based JavaScript UTF-16 indices into the unchanged original report. A confirmed location requires an `id_lokasi` from that fixture catalogue. Duplicate IDs, foreign categories/locations, invalid offsets or missing provenance fail validation.

```powershell
node scripts/evaluate-event-dialogue.mjs --gemini-predictions artifacts/actual-gemini-predictions.json --output docs/psm-evaluation/evidence/phase8-with-external-baseline.json
```

Without a file, `geminiOnly.status` is `not-run` and there are no numeric provider accuracy fields. A partial import is labelled `partial`; its comparison includes all local metrics recomputed on exactly the same supplied subset. Do not compare its partial score with the full local dataset. The script validates recorded provenance and schema; it cannot independently prove who generated a file.

## Collect a fresh expert holdout

Start with **200–300 newly collected, de-identified reports** as a planning target, then revise the sample target after examining category/status support and the desired uncertainty bounds. This is not a claim that 200–300 samples establish operational reliability. Include ordinary reports and rare categories, code-switching, spelling variation, multiple incidents, uncertain/negated/drill mentions, LG ambiguity and out-of-catalogue locations. Record the sampling method and missing strata. Do not pad the holdout with paraphrases of this fixture, training samples or already-inspected development incidents.

1. Obtain the relevant institution's data-access and research approvals for the intended collection. De-identify before annotation or export. Replace direct identifiers with stable placeholders such as `[PERSON_1]`, `[PHONE_1]`, `[EMAIL_1]`, `[ID_1]`, `[VEHICLE_1]`, `[ADDRESS_1]`, `[DATE_1]`. Keep any re-identification key outside this repository. Review indirect identifiers manually. Finalize the redacted text before recording offsets.
2. Freeze a catalogue/taxonomy snapshot. Give every report a pseudonymous `reportId`, `incidentGroup` and `sourceGroup`. Reports from the same underlying incident share the incident group; duplicates, translations, paraphrases and extracts from the same original source family share the source group. Preserve those links even when wording differs.
3. Have **two domain annotators label independently**, blind to system output and each other's labels, using separate JSONL files with the same report IDs. Pilot a small subset to clarify guidelines, then exclude or re-label that pilot before the final holdout is frozen. Preserve the independent versions and report pre-adjudication category/status agreement, event matching and disagreements. Do not present post-adjudication agreement as independent agreement.
4. Have a third domain reviewer or a documented consensus process adjudicate disagreements. Produce one `annotationState: "adjudicated"` row per report. Log the rationale and guideline version outside any identifying source data. No names or credentials of experts are implied by this template.
5. Freeze grouped train/development/holdout assignments **before training, prompt selection or threshold tuning**. The supplied splitter hashes connected incident/source groups at approximate 60/20/20 proportions. All transitive links stay together. Small/linked datasets may yield empty partitions or poor class balance; inspect the manifest and predeclare any group-level stratification method before running models. Keep the final holdout closed until the comparison is fixed; a holdout inspected for fixes becomes development data and needs replacing.

`EVENT_ANNOTATION_TEMPLATE.jsonl` is deliberately blank and marked `isTemplate: true`; the collector rejects it as collected data. Replace it only with actual authorized, de-identified annotations, set `isTemplate: false`, and keep one report per line. Required fields are shown in that file. `reportCategory` becomes the fixture's `expectedReportCategory`; adjudicated `events` and `clarificationNeeds` use the same shape as the synthetic fixture. Record the actual catalogue version and copy its approved location definitions into any independent evaluation fixture. Do not reuse fixture database IDs without the corresponding snapshot.

For each event, label a category, one assertion status, an exact category/predicate `anchor`, location state/identity and **all** stated times/assets/actions. Keep separately occurring events separate even when the category repeats. Bind a shared fact to both events only when the sentence explicitly supplies the shared context. An action-only adjacent sentence belongs to an event only when the binding is unambiguous. Do not guess a time, building, pos, action or urgency. A bare floor/alias or selected report post is a candidate; confirm only a unique explicit approved display name or a separately recorded clarification. Unresolved out-of-taxonomy material has no invented event category. Identify missing information worth asking with `{ "eventIndex": 0, "field": "location" }` entries; fields are `status`, `location`, `time`, `action`. Denied/drill events need no operational questions, and routine patrols need no incident-action question.

An event annotation for the synthetic text `Api di LG.` could be:

```json
{"category":"Kebakaran","status":"reported","anchor":{"text":"Api","start":0,"end":3},"location":{"state":"ambiguous","confirmed":null},"times":[],"assets":[],"actions":[]}
```

The validator checks required fields, unique pseudonymous IDs, allowed placeholder forms, redaction-list agreement, common email/phone/identity-number patterns, assertion vocabulary, event offsets and location state/identity consistency. These checks cannot guarantee anonymity; an authorized human must review names, indirect identifiers, free text and the catalogue snapshot. Independent annotation drafts are valid collector records, but the splitter accepts only adjudicated rows. Run it on the adjudicated file:

```powershell
node scripts/evaluate-event-dialogue.mjs --annotations artifacts/adjudicated-event-reports.jsonl --split-seed penjaga-holdout-v1 --output artifacts/event-holdout-manifest.json
```

The result is a manifest of report IDs, not new training data and not an evaluation result. Until actual adjudicated annotations and a frozen holdout exist, report the collection and independent validation as pending. Until real participants complete the relevant comparison, report human benefit as unmeasured.
