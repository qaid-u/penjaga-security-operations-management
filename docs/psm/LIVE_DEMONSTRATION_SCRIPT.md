# Live demonstration script

Use only the isolated `penjaga_phase6_demo`. All DEMO names, reports, posts, attendance and anchor mappings are fictional. The application produces new report classifications through its actual API. Never point this script at an operational database or present fictional mappings as actual building locations.

## Reproduce the local setup

Install dependencies using the installation guide. Use a local PostgreSQL server whose role may create a database, or the optional isolated cluster:

```powershell
node backend/scripts/start-phase5-postgres.js
```

Set PHASE6_DEMO_PASSWORD privately in the current terminal (10+ characters; do not include the value in recorded material). Then:

```powershell
npm run demo:phase6:prepare
npm run test:phase6
```

The seed refuses an unidentified nonempty database and never truncates existing records. Repeated preparation retains existing synthetic data, appending a current demo week only when needed. The lifecycle test uses current-day records; repeating on another date appends that day's report/assignments rather than changing older rows. After an interrupted run, rerun to continue identified records. The manifest is version 1. The demo accounts are demo_admin, demo_chief, demo_guard_a and demo_guard_b; their password is the private seed variable, never shown in this document. Phase 5 fixtures are a separate database and remain unchanged.

For a manual session, start `node backend/scripts/phase6-demo-server.js` in one terminal. In another set VITE_API_URL=http://127.0.0.1:3096/api and VITE_API_ORIGIN=http://127.0.0.1:3096, then run `npm run dev -- --host 127.0.0.1 --port 4177 --strictPort`. Open http://127.0.0.1:4177. Check /api/ready first. Database timezone should be Asia/Kuala_Lumpur; calendar-sensitive verification was confirmed locally with that setting. Keep local processes private and stop them after rehearsal. Restarting a Vite build requires the same public API values.

## Demonstration sequence (about 8–10 minutes, adjustable)

1. **Administrator login.** Explain the current database role check and protected routes. Show the sidebar; do not expose the password or token.
2. **Dashboard.** Explain that these counts come from synthetic stored records, not a live government system. Describe selected date/risk filters.
3. **Scheduling.** Open Jadual and choose the current DEMO Phase 6 week. Show the guard/date/post/shift. Explain manual assignment, overlap validation and the administrator's confirmation/lock controls. The automated setup already tests conflict and locked-chief rejection; demonstrate an extra edit only on synthetic records. There is no automatic optimizer or week-create API.
4. **Guard workflow.** Log out, sign in as demo_guard_a, show personal schedule and recorded check-in/out. These are stored timestamps, not GPS evidence. A completed daily attendance record will reject another check-in. After-midnight checkout for yesterday's assignment is unsupported; do not attempt it as a success case.
5. **Report and evidence.** Open Hantar Laporan. Show the existing DEMO Phase 6 pencerobohan record, or submit a new clearly labelled synthetic report with all relevant checklist answers and a harmless evidence file. Use the narrative 'Simulasi pencerobohan di zon sintetik. Tiada insiden sebenar.' Active demo categories yield High, score 75 from one keyword and High priority. Negation/context is not understood; this is precisely why human review remains necessary.
6. **NLP result and review.** Log in as administrator to inspect Analisis NLP, open the report's NLP result and explain keyword coverage confidence. To review a new submitted report, switch to demo_chief; read the narrative/evidence and approve with a synthetic comment. Previously approved reports cannot be approved twice. Do not call the saved Naive Bayes metrics runtime accuracy.
7. **Action and notification.** Show the existing approved report's official action. Administrator controls status; chief adds progress. Show a High-risk notification. No email/SMS delivery or automatic escalation is claimed.
8. **3D exterior.** As administrator or chief, open Pusat Kawalan3D. Orbit, zoom, pan, select an overview preset, then choose Pintu Masuk Utama. The focus camera and panel should show DEMO PosA. Explicitly identify the model as an approximate exterior and the anchor mapping as fictional.
9. **Linked records and advanced controls.** Set MYT dates to the report/assignment day. Show recorded attendance, the High report and follow-up. Select incident marker mode, zone navigation and risk filters, then inspect Sejarah laporan. Select an unlinked anchor to show its honest empty mapping state. Clear filters when returning to the overview.
10. **Role boundary and conclusion.** Log in as a guard and show that the 3D menu is unavailable; direct /3d-command-centre navigation is denied. Explain that API denials are also tested. Conclude with integration evidence and pending human/device/deployment evaluation.

## Rehearsal and fallback

Before presentation, run the commands once, verify current dates and confirm 17 screenshots exist. Use the actual screenshots/deck as a clearly labelled recorded fallback if WebGL or connectivity fails; never imply a static screenshot is a successful live action. Keep a local copy of the GLB and documentation. Close other graphics-heavy apps. Do not expose local .env, database backups or operational data on screen. The password-change feature is omitted because its endpoint is missing.
