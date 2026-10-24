# Reproducible synthetic demonstration

## Preparation

1. Install root/backend dependencies with their lockfiles (`npm ci`, `npm --prefix backend ci`). Have local PostgreSQL tools available.
2. Run `node backend/scripts/prepare-phase5-demo.js`. It creates only the fixed local database `penjaga_phase5_demo`; it refuses to replace a non-demo/nonempty database. Existing demo data is retained on reruns.
3. If the existing database role lacks CREATEDB (as on the evaluation workstation), run `node backend/scripts/start-phase5-postgres.js` and repeat preparation. This creates a separate cluster under ignored `.phase5-runtime.local`, bound to 127.0.0.1:55435 with a random private database credential. Existing PostgreSQL services are untouched. PostgreSQL `initdb`/`pg_ctl` must be on PATH. Do not expose this cluster outside the workstation.
4. Run `node backend/scripts/phase5-demo-server.js` (API port 3095). Start Vite with `VITE_API_URL=http://127.0.0.1:3095/api` and `VITE_API_ORIGIN=http://127.0.0.1:3095`. These are frontend process environment variables, not production settings. In PowerShell set `$env:VITE_API_URL=...` and `$env:VITE_API_ORIGIN=...` before `npm run dev`.
5. Demo usernames: `demo_admin`, `demo_chief`, `demo_guard_a`, `demo_guard_b`. The fixture-only default password is `Demo-Penjaga-2026!`; `PHASE5_DEMO_PASSWORD` can override it on first creation. These accounts exist solely in the synthetic database. Existing demo databases are not silently reseeded when the password variable changes.
6. Dataset date: **24 October 2026**; report range **25 September–24 October 2026**. It contains four fictional accounts, three fictional posts, 240 synthetic reports, two mapped anchors, two duties (one overnight), stored attendance and three official action states. Report 240 has no NLP analysis. Report 1 has two analyses; its latest classification is High.

## Presentation

- Login as demo_chief/admin and open Pusat Kawalan 3D.
- Set the duty date and report range above; explain that schematic mappings are synthetic.
- Rotate/zoom, select Pos A's main-entrance anchor, inspect its overnight duty/check-in and distinguish recorded attendance from physical location.
- Select the left wing/Pos B, inspect Demo guard_b and missing check-in.
- Switch to Incident Analysis, filter High and open DEMO Laporan 1; its latest stored severity is High, not the older Low result.
- Inspect related action `Dalam Tindakan`, then show report 3's completed action.
- Show an unmapped report without assigning it a building position.
- Open the existing report module and return to the viewer.
- Demonstrate presets, keyboard location selection, mobile panel and retry/empty states if appropriate.
- Explain exterior-only floors and point-count indicators; no interior floor plan or continuous geographic heatmap is claimed.

Use `npm run test:phase5:browser` for the automated genuine-login/API workflow. Do not use real operational incidents or personal records in the presentation. Human UAT must follow its separate plan.

To stop the optional standalone cluster, run `pg_ctl -D .phase5-runtime.local/data -m fast -w stop` after stopping demo clients. This stops only the explicitly named demo cluster. Data persists for the next session; do not delete it to reset tests. Keep the runtime directory out of Git and backups intended for publication.
