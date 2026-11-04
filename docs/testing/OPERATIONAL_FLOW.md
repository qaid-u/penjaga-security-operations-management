# Working local report flow

Run `npm run dev:system` from the repository root. It checks PostgreSQL, the analysis schema, active categories and the saved model, then starts or reuses the API and frontend. Newly started API processes enable the background classification worker. Existing healthy services are reused; the command only stops its own child processes on Ctrl+C. Database initialization and migrations remain explicit maintainer operations.

1. Guard submits the report with post, shift, narrative, checklist and optional evidence. PostgreSQL saves the original narrative and a durable pending classification job.
2. The background worker loads the saved model, stores category/risk suggestions and emits applicable alerts. No manual analysis or training screen is required. Classification does not approve a report or create an action.
3. Chief approves or rejects the report and explicitly decides whether follow-up is required. This human decision can proceed when AI classification is unavailable.
4. Approval requiring follow-up notifies administrators and places the report in the admin's follow-up candidates. Chief approval no longer creates a placeholder action or assigns the chief as its owner.
5. Admin creates the actual action and responsible officer, updates its status, requests progress where needed, and closes it after reviewing the chief's progress.
6. Report lifecycle follows the explicit follow-up decision, including low-risk reports requiring action and high-risk reports requiring no action. An approved report without required follow-up is complete.

Existing action records and operational reports are retained. No generated training examples or end-to-end test incidents are inserted into the local application database.

`backend/tests/operational-flow.test.js` runs real password authentication, report submission, the actual asynchronous worker, ownership restrictions, notification delivery, chief review, admin action creation, duplicate protection, chief progress, admin closure, dashboard totals and CSV access in a disposable PostgreSQL schema. It does not call `runOne` manually to simulate a running worker. The schema and synthetic accounts are removed afterward. Browser tests cover the simplified report UI and role-driven lifecycle states.

Verification: 134 backend tests and 18 browser workflow checks passed. Lint and production build passed with the existing Fast Refresh and bundle-size warnings. `npm run dev:system` verified the running local frontend/API and model `nb-v2-8372800163d5`. The local API was restarted to activate the handoff fix with its background worker enabled. No public deployment was performed.

## Optional demo records

`npm run seed:demo` adds one labelled local-development batch: 28 reports over four weeks (8 submitted, 16 approved, 4 rejected), 8 follow-up actions, 4 approved reports awaiting action creation, up to 14 assignments and 7 past attendance records. All titles/notes use `[DEMO OPS V1]`; analysis metadata declares the records synthetic. Reports belong to the designated `test_pengawal` account and example reviews use `test_ketua`. No accounts, passwords, active-post settings or training data are changed.

The current classifier computes the saved classifications. No fabricated confidence/risk results are hardcoded and no demo alerts are sent to other users. All writes commit atomically. A batch audit marker prevents duplicate insertion, existing records are retained, overlapping guard assignments are skipped, and locked weeks are respected. The CLI refuses production or remote database targets. `backend/tests/demo-records.test.js` verifies preservation, classifier records, scheduling conflicts and safe repeated execution in a disposable schema.

At the user's request, the batch was applied locally on 2 November 2026: 28 reports, 8 actions, 14 assignments and 7 attendance records were added. The original 103 reports were retained.
