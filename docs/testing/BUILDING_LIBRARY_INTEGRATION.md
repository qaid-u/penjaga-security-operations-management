# Building library integration

The administrator and chief-guard dashboard now presents the real exterior models as its main showcase. The 3D command centre places the interactive scene above operational controls and offers a visual picker, building selector, camera presets, zoom/reset and full-screen viewing. Direct links use `/3d-command-centre?building=ID`. Guard permissions are unchanged.

| Building ID | Model asset | Official posts |
| --- | --- | --- |
| DJM | `models/Bangunan_SUK.glb` | Seven existing DJM identities, including the supplied floor labels |
| BDARA | `models/library/bdara.glb` | Pos BDARA |
| BDMSP | `models/library/bdmsp.glb` | Pos BDMSP |
| BDMIM | Same BDMSP asset | Pos BDMIM |
| BSI_KOTA_ISKANDAR | `models/library/bsi-kota-iskandar.glb` | Pos Pejabat Jurutulis; Pos Dewan Undangan Negeri (DUN) |
| RUMAH_SS | `models/library/rumah-ss-vip.glb` | Pos Rumah SS |
| RUMAH_VIP | Same residence asset | Pos Rumah VIP |
| UTC_JOHOR | `models/library/utc-johor.glb` | Pos UTC |

The two shared-model pairs retain separate building and post identities. C1S and Sultan Ibrahim Johor Bahru records remain available in existing operational modules; no model is substituted for either. The BSI alias `Bangunan Sultan Ismail (BSI)` identifies the existing Kota Iskandar records and is distinct from Sultan Ibrahim.

## Data and installation

Run `node backend/scripts/migrate-3d.js` and restart the backend. It applies migrations 003, 005 and 006 in a transaction, reuses matching existing post IDs, refuses ambiguous duplicates, and preserves reports, schedules, hours, administrator links/unlinks and inactive exterior history. Fresh Docker initialization includes 006. The synthetic demo upgrade also registers the modeled buildings without replacing operational records.

Every 3D read and mapping request accepts a validated `building` query parameter. Omission defaults to DJM for compatibility. Location summaries, post/category references, history, metrics and mapping writes enforce that scope. Query-cache keys include building and signed-in identity. Switching buildings resets the selected post and filters, and abandoned requests cannot display another building's summary. NLP recognition accepts the official names while keeping source evidence and uncertainty rules.

Post coordinates remain unconfirmed and API responses return `position: null`. Selecting a post opens its record without placing an indoor marker, moving the camera to a guessed wing or inventing a floor. Models are approximate exteriors. Operating data is stored-record information rather than GPS monitoring or a prediction.

## Assets and performance

Six unique GLBs total 49,743,368 bytes. Only the selected model is requested; sharing reuses the same URL. The byte cache keeps at most one completed asset, and each parsed scene's geometries/materials/textures are disposed when its view unmounts. Demand-driven rendering, limited pixel ratio, reduced-motion handling and a non-WebGL post-list fallback remain supported.

Six WebP previews total 157,708 bytes, so the dashboard adds no extra WebGL canvas or eager GLB downloads. `scripts/prepare-building-assets.py` regenerates public copies and optimized previews from reviewed source artifacts using Python/Pillow; its `--check` option verifies copies without rewriting. The public manifest records hashes. Asset checks run through `npm run test:building` in CI. A custom `VITE_BUILDING_MODEL_URL` continues to override only the default DJM asset.

All deployed GLBs and previews are public files; authenticated operational APIs retain their existing administrator/chief roles. Blender sources, recovery backups and private environment settings are not served by the development server. Asset sizes are not a device frame-rate benchmark.

## Verification

- `npm run check`: lint, syntax and production build.
- `npm run test:building`: 20 model, catalogue, geometry, frustum, byte-copy and existing DJM checks.
- `node --test backend/tests/threeD.test.js`: 29 isolated PostgreSQL/API checks, including cross-building rejection, repeat migration, shared-identity separation and matching rules.
- `npm run test:nlp`: 42 NLP/reviewer/queue checks with provider responses mocked.
- `npm run test:building:browser`: 26 browser scenarios, including eight building choices, shared geometry, stale-response cancellation, mobile/WebGL fallback, dashboard showcase, roles and existing operational controls. Set `BUILDING_TEST_PORT` to use an unused local test port.

The local database migration and authenticated HTTP probes succeeded for all eight buildings and 15 linked official posts. Verification preserved every existing post row and all 17 posts, 102 reports and 8 duty records. Summary evidence is in `artifacts/integration/database-verification.json`; UI screenshots in the same folder use synthetic test records. Existing Fast Refresh and large-bundle build advisories remain separate from test failures.
