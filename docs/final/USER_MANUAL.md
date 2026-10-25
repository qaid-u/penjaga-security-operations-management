# PENJAGA user manual

This manual reflects the implemented role permissions. Screenshots use only `penjaga_phase6_demo`; names, incidents, posts and mappings are fictional. [Screenshot index](../psm/evidence/SCREENSHOT_INDEX.md) provides actual images. Arrange a private account with the administrator; no passwords are printed here.

## Sign in, session and navigation

Open /login, enter Nama pengguna and Kata laluan, then Log Masuk. Administrators/chiefs open Dashboard; guards open their personal dashboard. Use the side menu (Buka menu on mobile) to reach permitted screens. Logout ends the local browser session. An expired/invalid token requires login again. Do not share a browser session across roles without logging out. The visible Tukar Kata Laluan screen currently calls a missing endpoint; password changes are unsupported and must not be demonstrated as successful.

## Pentadbir Sistem

1. Dashboard: inspect report summaries and filters; Unknown means no valid latest analysis, not low risk. Counts reflect stored records and selected periods.
2. Pengurusan Pengguna (/pengguna): view accounts, add a user with an appropriate role and a password of at least10 characters, update role/status. Verify identity privately before assigning privileges. There is no password-reset workflow.
3. Pos Kawalan (/pos): add an authorized post and update active status. Do not copy sensitive building information into public demos.
4. Jadual (/jadual): choose an existing week, review post/shift staffing requirements, assign a guard/date/post/shift, check conflicts and save. Confirm, lock or unlock as needed. A chief cannot change a locked schedule; administrators retain override rights. No automatic AI schedule generator or week-create API exists. CSV and PDF controls accept approved files up to8 MiB; retain validation feedback if a row fails.
5. Semakan Laporan (/semakan): monitor reports and stored classification. Approval/rejection is the chief's permission; administrators cannot use the review write endpoint.
6. Tindakan Susulan (/tindakan): create an official action only after a report is approved, assign a responsible officer, update Baru/Dalam Tindakan/Selesai and request an update. Chief progress notes do not independently change official action status.
7. Latihan NLP (/nlp): manage active category priorities and keyword references. These configure current keyword rules; this screen does not activate the saved Naive Bayes model. Check changes using synthetic text before operational use.
8. Audit Trail (/audit): inspect filters and export permitted CSV. Keep exports private; audit coverage is not complete for every event (attendance writes lack explicit audit entries).
9. Pusat Kawalan 3D: follow the shared instructions below. Mapping controls are administrator-only. Link only an approved active post to a named visualization anchor, or clear the link. A fictional demo mapping must never be presented as a verified building assignment.

## Ketua Pengawal

Open Dashboard for permitted summaries. Use Jadual to view/assign staff and requirements where the week is not locked. Confirmation/locking/import writes remain administrator-only. In Semakan Laporan, read the report, evidence and NLP result before approving/rejecting once; choose follow-up when needed. Use Tindakan Susulan to add progress notes/evidence; request the administrator to change official action status. Read high-risk notifications and mark them read. Access 3D information and filters, without mapping edits or user/NLP/audit administration.

## Pengawal Keselamatan

Use the personal dashboard and Jadual to see your own current/future assignments. Check in once for today's own assignment; check out after check-in. These actions record timestamps, not GPS proof. The current after-midnight limitation prevents checking out yesterday's overnight assignment; report this to the administrator rather than inventing attendance.

Open Hantar Laporan (/laporan), select the post, shift, date and time, enter a meaningful title/narrative, and answer checklist entries using Ya/Tidak/Tidak Berkaitan. Attach only authorized JPEG/PNG/WebP/PDF evidence (max 6, each8 MiB). Submit and inspect the saved result/history. The classifier is a keyword-based aid; its severity/confidence must not replace human judgment. Empty checklist arrays currently pass the API, so users should complete all relevant visible items. Guards can access their own reports and referenced evidence, not another guard's reports or management3D. Read personal notifications in /notifikasi.

## Shared 3D controls (administrator/chief)

Open Pusat Kawalan3D; wait for the exterior to load. Orbit by dragging, zoom with wheel/pinch, pan with supported controls, or use Pratetap kamera. Choose a numbered hotspot or zone to focus/highlight it. Select dates in MYT and optional post/risk/category/report/action filters. Select Lapisan penanda for implemented incident/operational modes. The information panel shows mapped post, planned guards, recorded attendance, incidents and action progress. Browse Sejarah laporan and open a report's permitted module. Clear filters if a selected location is outside scope. Belum dipautkan means no mapping, not zero risk. Unknown analysis is not Low risk. Escape/close returns from the mobile information sheet.

The model is an approximate exterior. Displayed schedules/attendance are stored records, not physical guard locations. No predictive risk or fully synchronized digital twin is provided. If WebGL/API loading fails, read the fallback message and retry/check readiness with the maintainer. Human accessibility acceptance and physical-phone testing remain pending.
