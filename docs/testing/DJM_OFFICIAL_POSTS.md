# Official posts for Bangunan Dato’ Jaafar Muhammad

The user supplied the seven posts below for this building at Kota Iskandar. The 3D asset is an approximate exterior. Operational post identities are separate from its seven architectural landmarks.

| Post | Floor label | 3D position |
| --- | --- | --- |
| Pos Lobi Utama | Not supplied | Unconfirmed |
| Pos Bilik Kawalan CCTV | Not supplied | Unconfirmed |
| Pos Tingkat 3 Pejabat Setiausaha Kerajaan Johor | Tingkat 3 | Unconfirmed |
| Pos Tingkat 4 Hadapan Pejabat Menteri Besar Johor | Tingkat 4 | Unconfirmed |
| Pos Tingkat 4 Belakang Pejabat Menteri Besar Johor | Tingkat 4 | Unconfirmed |
| Pos Lif LG Pejabat Setiausaha Kerajaan Johor | LG | Unconfirmed |
| Pos Lif LG Pejabat Menteri Besar Johor | LG | Unconfirmed |

## Application behaviour

- The post list, filter, information panel and NLP location recognition use these official names. The labels do not imply floor geometry, room dimensions or exact coordinates.
- All post positions remain `null`. Selecting a post opens its operational record without creating an indoor marker, highlighting an assumed wing or moving the exterior camera. Exterior orbit/zoom/presets remain available.
- Overview/history/reference queries are scoped to this building. Posts in the other buildings remain in the general post-management, reporting and scheduling modules.
- Administrator linking accepts only a record with the matching official post name and building. A database link does not confirm a physical 3D position.
- Organisation-wide staffing figures, shift times and the ambiguously attached office-hour notes were not applied as building-specific staffing or opening hours. Existing operating-hour values are retained; newly required post records do not invent hours.

## Existing installations

Run `node backend/scripts/migrate-3d.js`, then restart the backend and reload the 3D page. The script applies migrations 003 and 005 together in a transaction. It reuses matching existing post IDs, creates only missing official posts, and fails on ambiguous duplicates rather than choosing an arbitrary record.

Official locations use `POST_DJM_*` identities. The old `HOTSPOT_*` rows and links are retained as inactive history; their GLB anchors remain unchanged as architectural landmarks. Reports, schedules, users and other buildings' posts are not deleted or reassigned. Repeating the migration preserves administrator links/unlinks and does not add duplicate posts.

Fresh Docker database initialization includes migration 005. Existing Docker volumes still require the migration command. The backend's catalogue is `backend/config/djmSecurityPosts.json`; its public mirror is `src/components/building/djmSecurityPosts.json`. Model tests enforce that both copies match, so the development server can keep the entire backend directory private.

The named Phase 5/6 synthetic demo databases can be upgraded with their existing preparation scripts. Only identified synthetic `DEMO Pos A/B` records are renamed to the first two official identities; their IDs, synthetic reports and schedules are retained. Other databases never use that synthetic-data conversion.

## Verification

- `npm run test:building`: public asset identity, unchanged architectural anchors, floor labels, unconfirmed post positions and matching catalogues.
- `node --test backend/tests/threeD.test.js`: real PostgreSQL migration/API checks in a rolled-back schema, including duplicate handling, other-building exclusion, matching rules, history and roles.
- `npm run test:building:browser`: official list/filter/panel, floor labels, desktop/mobile controls, no fake indoor markers, errors and access control.
- `npm run test:phase5:browser`: genuine login and database-backed workflows against the isolated synthetic demo.
- `npm run test:nlp`: official name extraction plus NLP/reviewer/queue regressions; AI-provider responses are mocked.

Current browser evidence is saved under `artifacts/suk/djm-posts-*.png`; earlier model and phase evidence remains historical.

Verified on 25 October 2026: 12 model checks, 23 PostgreSQL/API checks, 19 building browser checks, 5 genuine-login demo workflows and 41 NLP/reviewer/queue checks passed. `npm run check` passed with the existing Fast Refresh and bundle-size advisories. A direct read of `penjaga_db` confirmed all 17 post records remain, exactly seven DJM locations are linked, and all seven positions remain unconfirmed. Each current database summary returned successfully.

The existing manual demo at `http://127.0.0.1:4177` was upgraded and its API restarted. Genuine demo login, all seven choices, the Level 3 label and absence of indoor markers were verified without mocked API responses; evidence: `artifacts/suk/djm-posts-manual-demo.png`.
