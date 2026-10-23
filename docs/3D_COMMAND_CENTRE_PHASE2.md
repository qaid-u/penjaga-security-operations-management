# PENJAGA — Phase 2: Interactive 3D Command Centre

## Entry point and authorization

`/3d-command-centre` shows **Pusat Kawalan Keselamatan 3D**, with subtitle **Visualisasi Interaktif Bangunan SUK**, inside the existing `Protected` / `Shell` layout. The navigation item is **Pusat Kawalan 3D**. Both the route and navigation use the existing `ROLE.admin` (`Pentadbir Sistem`) and `ROLE.chief` (`Ketua Pengawal`). Guards receive the existing access-denied screen; anonymous users go to login. Authentication and PostgreSQL schema are unchanged.

The page is lazy-loaded so other pages do not load the 3D renderer. This phase makes no backend requests for staffing or surveillance. All staffing, guard, shift and incident values are explicitly demonstration data.

## Dependencies

Browser verification exposed an existing startup defect: `src/main.jsx` mounted `App` without the existing `AuthProvider`, while `App` calls `useAuth()`. The entry point now wraps `App` in that provider. No replacement authentication implementation was introduced.

Installed versions: Three.js 0.180.0, React Three Fiber 9.4.0 and Drei 10.7.6, compatible with this project's React 19. Playwright is a development-only dependency for browser verification. The lockfile records exact resolutions.

Installation required `--legacy-peer-deps` because the existing dependency tree includes a Lucide version whose declared React peer range ends at React 18. Use `npm ci --legacy-peer-deps` to reproduce this tree. No forced package upgrades or audit fixes were applied. npm reports 15 dependency vulnerabilities across the project; these need a separate dependency review.

## Asset configuration and inspection

Original: `artifacts/suk/Bangunan_SUK_Exterior.glb`.

Approved public copy: `public/models/Bangunan_SUK.glb`. The user explicitly approved public distribution of this generated exterior demo model. Anyone with its URL can retrieve it; page authorization does not protect public assets. Do not put restricted future models here.

Default URL uses Vite's `BASE_URL` plus `models/Bangunan_SUK.glb`. Override at build time using `VITE_BUILDING_MODEL_URL`. The loader expects a self-contained GLB; a remote URL must support CORS. For deployment beneath a subpath, configure Vite base and the application's existing router deployment together. There are no local Windows paths in browser code.

Inspection found a valid GLB 2.0 file, 192 meshes, 13 materials, seven named anchors, and the existing site ground. File size is 2,537,652 bytes. The original and public copy have identical SHA-256 hashes. No extra ground is generated when `SUK_Ground` exists. The site is approximately 192 m wide, with original modelling units retained. Geometry is an interpretive exterior reconstruction, not a survey.

Blender exported to glTF Y-up. No extra root rotation or normalization is applied. `updateMatrixWorld(true)` followed by each anchor's `getWorldPosition()` resolves the complete parent hierarchy. For example, the entrance is approximately `(0, 7, 44)` in Three.js, corresponding to Blender `(0, -44, 7)`.

## Components

All viewer modules live in `src/components/building/`:

| Module | Responsibility |
| --- | --- |
| `BuildingViewer.jsx` | WebGL 2 detection, error boundary, canvas, context-loss recovery, location list, responsive layout |
| `useBuildingAsset.js` | Fetch progress, timeout, cancellation, GLB parsing and owned-resource cleanup |
| `BuildingModel.jsx` | Preserve imported materials and geometry; optional ground fallback |
| `BuildingHotspot.jsx` | World-positioned, accessible HTML markers with hover and selected states |
| `CameraController.jsx` | Drei CameraControls, framing, focus, zoom, reset and reduced-motion support |
| `ViewerToolbar.jsx` | Touch-sized reset, zoom and marker-toggle controls |
| `LocationInformationPanel.jsx` | Reusable location details and explicitly labelled demo staffing |
| `BuildingLoadingState.jsx` | Download progress, errors and retry |
| `modelGeometry.js` | Geometry validation, world positions, camera poses and shared-resource disposal |
| `buildingConfig.js` | Configurable asset URL, DPR, background and timeout |
| `buildingHotspots.js` | Location labels, descriptions and mock data |
| `building.css` | Responsive canvas and marker states |

The page itself is `src/pages/ThreeDCommandCentre.jsx`.

## Hotspot mapping

| Exported node | Label |
| --- | --- |
| `HOTSPOT_MAIN_ENTRANCE` | Pintu Masuk Utama |
| `HOTSPOT_CENTRAL_BLOCK` | Blok Tengah |
| `HOTSPOT_LEFT_WING` | Sayap Kiri |
| `HOTSPOT_RIGHT_WING` | Sayap Kanan |
| `HOTSPOT_FRONT_PLAZA` | Plaza Hadapan |
| `HOTSPOT_LEFT_TOWER` | Menara Kiri |
| `HOTSPOT_RIGHT_TOWER` | Menara Kanan |

All expected anchors exist. No guessed fallback positions are needed. If a replacement asset lacks an anchor, its list entry is disabled and marked as missing rather than placed at an invented location. The same selection state drives the marker, camera and information panel. The keyboard-accessible list remains usable when markers are hidden.

## Camera and rendering

Left drag rotates; wheel or pinch zooms; right drag or two-finger movement pans. Toolbar zoom controls and reset are also available. Overview distance uses the model's bounding sphere and the canvas aspect ratio to frame the full site on desktop and narrow screens. Focus approaches current facade anchors from +Z, beyond the site's front bound. The focus endpoints remain outside geometry; arbitrary user orbit/pan is not a collision-based walkthrough. Polar limits prevent underground views; distance and target boundaries constrain navigation. Reset clears the information panel and returns to the full-building perspective. Reduced-motion preference removes smooth transitions.

Ambient and directional lighting preserve the source PBR materials. A single 1024-pixel shadow map, DPR capped at 1.5, and demand rendering avoid expensive post-processing and an idle animation loop. Geometry/material/texture disposal deduplicates shared resources. Pending downloads are aborted on unmount, and late parsing results are disposed. A failed request, malformed GLB, unsupported WebGL, render exception or lost context produces an explanation and retry control.

## Phase 3 actions and backend requirements

Existing general routes `/jadual` and `/semakan` were inspected. They do not accept verified location-specific parameters for these anchors, and no model-to-`id_pos` mapping exists. Therefore Lihat Jadual, Lihat Laporan and Butiran Lokasi are disabled with a Phase 3 explanation.

Next phase should introduce a reviewed anchor-to-post mapping, role-authorized read endpoints for schedules/reports, and stable location identifiers. Keep demo data distinct from operational records, define loading/error/empty states, then enable only actions backed by validated routes and permissions. Restricted assets would require authenticated delivery. No database migration is included in this phase.

## Verification

Commands:

```sh
npm run check
npm run test:building
npm run test:building:browser
```

`check` runs the existing lint, backend syntax checks and production build. The model suite validates source equality, actual GLB parsing, anchors/materials/ground, transformed parents, focus positions and mobile framing.

The browser suite starts a local Vite server on port 4175 and uses installed Microsoft Edge with software WebGL. It seeds only local client auth state for role checks; it does not authenticate against production or verify JWT issuance. Browser tests cover all seven markers, panel updates, reset/zoom/rotation, keyboard selection, mobile width, role rejection, download retry and unsupported WebGL. Physical touch gestures and real backend workflows require device / integration testing. Test traces and failure screenshots go to ignored `test-results/`; presentation captures go to `artifacts/suk/phase2-*.png`.

Final results: `npm run check` passed; the model suite passed 5/5 tests; the Edge browser suite passed 5/5 scenarios in 57.1 seconds. Desktop and 390-pixel mobile screenshots were visually inspected. The public GLB and production `dist/models/Bangunan_SUK.glb` also have identical SHA-256 hashes.

The production build passes with a large-chunk advisory for the existing application and the lazy 3D bundle. Lint has three existing warnings in AuthContext and GuardDashboard, with no errors. The browser run reports existing React Router v7 migration advisories. There were no uncaught page errors in the successful desktop scenario. This verifies frontend routing and interaction using local test identities; real JWT login, database-backed pages, physical touch/pinch gestures, context-loss simulation and other browsers remain unverified.
