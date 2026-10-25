# Exterior model library release checks — 25 October 2026

This records the source-model release before application integration. For the current integrated dashboard, viewer and building-scoped operations, see [BUILDING_LIBRARY_INTEGRATION.md](BUILDING_LIBRARY_INTEGRATION.md).

The [model catalogue](../../artifacts/README.md) links the current editable Blender files, GLB exports, previews, procedural sources and manifests. The release includes the refined DJM model and its official-post configuration, BDARA, BDMSP, BDMIM's reference to BDMSP, BSI Kota Iskandar, the shared Rumah SS/Rumah VIP asset and the new UTC Johor exterior.

UTC is a photograph-derived exterior of the connected tower, UTC wing and Galleria corner complex. Its saved model contains 170 mesh objects, 58,930 triangles and 38 materials. The GLB is 2,895,524 bytes and has no external texture dependency. Pos UTC is identity metadata; the counter position is unconfirmed. Dimensions and concealed geometry are approximate.

## Completed checks

| Check | Result |
| --- | --- |
| `npm run check` | Passed lint, server/script syntax and production build |
| `npm run test:building` | 12 passed |
| `node --test backend/tests/threeD.test.js` | 23 passed using isolated, rolled-back PostgreSQL fixtures |
| `npm run test:nlp` | 41 passed, including isolated queue fixtures; provider responses mocked |
| `npm run test:building:browser` | 19 passed in Edge, including desktop/mobile, access control and API errors |
| `node artifacts/bdara/verify_bdara.mjs` | Passed actual Three.js GLB load and geometry/identity checks |
| `node artifacts/bdmsp/verify_bdmsp.mjs` | Passed actual Three.js GLB load and geometry/identity checks |
| `node artifacts/bsi/verify_bsi.mjs` | Passed, including BDMIM reuse-source resolution |
| `node artifacts/rumah_ss_vip/verify_residence.mjs` | Passed, including separate shared identities, open porch passages and road visibility over grade changes |
| `node artifacts/utc/verify_utc.mjs` | Passed, including the seven facade/roof groups and adjoining street elevations |
| `git diff --check` | Passed |

All six UTC views were visually inspected. Blender was confirmed to have the standalone UTC scene open with the expected mesh count. The other new model folders retain their own documented visual checks. Geometry budgets and file sizes do not constitute device frame-rate benchmarks.

The build still reports the existing AuthContext Fast Refresh warning and large-bundle advisory. There were no lint errors or failed checks in the completed runs. Local database checks required access to the workstation's PostgreSQL service; the restricted execution attempt failed to connect and the subsequent authorised run passed.

Private `.env` settings, uploads, runtime data, dependencies, build output, test caches and automatic `.blend1` copies remain ignored. Explicitly named model recovery backups are included alongside their documented sources. The new assets do not change the application's current public DJM model or infer interior/post coordinates.
