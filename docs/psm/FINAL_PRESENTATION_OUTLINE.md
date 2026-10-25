# Final presentation outline

16 slides; editable deck accompanies this source. Working title and objectives require proposal alignment. Student/supervisor/session metadata are pending. Actual synthetic screenshots and editable diagrams replace fictional visuals.

## Slide 1 — PENJAGA

- An integrated web prototype
- Keyword-assisted incident categorization
- Academic demonstration • synthetic records

## Slide 2 — One record flow, several operational roles

- Assignments and attendance
- Reports and supervisory review
- Follow-up linked to the same incident

## Slide 3 — The engineering problem is integration

- Connect records across modules
- Enforce each role at the API
- Show spatial context without inventing physical facts

## Slide 4 — Three provisional engineering objectives

- Integrate authorized operational workflows
- Connect exterior anchors to stored post records
- Verify behavior and disclose evaluation limits

## Slide 5 — Three roles, explicit boundaries

- Administrator: users, posts, actions, mappings
- Chief: review and progress
- Guard: own schedule, attendance and reports

## Slide 6 — Inspect → implement → verify → refine

- Reuse the existing application
- Add exterior and database integration
- Test observed behavior and document gaps

## Slide 7 — The API is the authorization boundary

- React / Router / Query
- Express + JWT + role checks
- PostgreSQL + protected file storage

## Slide 8 — A report can be followed through its lifecycle

- Guard submits report and evidence
- Chief reviews stored classification
- Administrator acts; chief records progress

## Slide 9 — Blender source → GLB → browser scene

- 192 meshes • 57,310 triangles
- 13 materials • 2.54 MB GLB
- Approximate exterior; no surveyed dimensions

## Slide 10 — Select a place, inspect its linked records

- Orbit, zoom, pan and camera presets
- Seven selectable visualization anchors
- Explicit unlinked, filtered and unavailable states

## Slide 11 — A nullable mapping joins space to operations

- Anchor → location mapping → security post
- Post → assignments, attendance, reports and actions
- Latest analysis and bounded snapshot queries

## Slide 12 — Verification passed; performance remains conditional

- 69 existing checks + 2 Phase 6 tests
- Real API lifecycle and synthetic screenshots
- Software-renderer orbit: 13.79 / 19.49 FPS

## Slide 13 — Working integration does not prove user benefit

- No collected human evaluation results
- Trained artifact is not runtime inference
- Password and overnight-attendance gaps remain

## Slide 14 — The contribution is an inspectable integrated prototype

- Operational records share authorization and relationships
- 3D offers a database-connected entry point
- Claims stay within the available evidence

## Slide 15 — Finish validation before expanding claims

- Resolve password, attendance and validation gaps
- Integrate one NLP contract and evaluate a holdout
- Test devices, users, backups and approved hosting

## Slide 16 — Questions

- Demonstrated software integration
- Disclosed limitations
- Evidence available in the handover

## Media and sources

Slides9–11 use actual synthetic screenshots from evidence/. Slide7 uses an editable architecture diagram; slide11 an editable mapping flow; slide12 uses original Phase 5 numbers, not invented data. References and limits: FINAL_TESTING_REPORT.md and FINAL_PSM_REPORT_DRAFT.md. Full spoken notes are included in the editable deck.
