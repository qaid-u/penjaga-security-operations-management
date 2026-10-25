# Estimated post placement

The 3D viewer displays all 15 official posts belonging to the eight modeled building entries. Positions are illustrative estimates calculated from exterior geometry. Exterior photographs and approximate models cannot establish exact room locations, office sides, floor heights, lift shafts or indoor counters. Every current estimate therefore has low confidence.

## Placement choices

| Building / post | Display placement and assumption |
| --- | --- |
| DJM — Lobi Utama | Approach to the modeled main entrance platform. |
| DJM — Bilik Kawalan CCTV | Lower front façade near the entrance core; the actual CCTV room is unknown. |
| DJM — Tingkat 3 Pejabat Setiausaha Kerajaan Johor | Upper left façade, interpolated at 70% of the main body's height; the supplied floor label is retained, while the side and height are assumptions. |
| DJM — Tingkat 4 Hadapan Pejabat Menteri Besar Johor | Upper right front façade, at 92% of the main body's height; the office side and height are assumptions. |
| DJM — Tingkat 4 Belakang Pejabat Menteri Besar Johor | Corresponding rear façade, with a rear camera approach; the supplied rear/floor label is retained. |
| DJM — Lif LG Pejabat Setiausaha Kerajaan Johor | Base of the left tower as an exterior proxy; no basement or verified lift shaft is modeled. |
| DJM — Lif LG Pejabat Menteri Besar Johor | Base of the right tower as an exterior proxy; the office-side split and lift core are assumptions. |
| BDARA — Pos BDARA | Approach to the main entrance platform. |
| BDMSP — Pos BDMSP | Approach beneath the A-frame entrance roof. |
| BDMIM — Pos BDMIM | Same geometric entrance proxy as the shared BDMSP model, with its own post and operational identity. |
| BSI Kota Iskandar — Pejabat Jurutulis | Side of the axial entrance gallery; no actual office floor or room is inferred. |
| BSI Kota Iskandar — DUN | Exterior edge of the modeled main hall as a visual association; the specific hall entrance/post is unconfirmed. |
| Rumah SS — Pos Rumah SS | Entrance-pavilion approach; a guardhouse location cannot be established from the supplied images. |
| Rumah VIP — Pos Rumah VIP | Same shared-model entrance proxy, retaining a separate building/post identity. |
| UTC Johor — Pos UTC | Public street-entrance canopy on the model's west façade; the indoor counter's floor and room remain unknown. |

C1S and Sultan Ibrahim Johor Bahru have no model in the library, so no substitute placement is invented for their operational records.

## Calculation and data boundaries

`src/components/building/postPlacements.js` contains a whitelist of official post IDs and named exported model features. For each feature's world bounding box, a rule calculates:

`estimate = bounds.min + bounds.size × fractional_position + exterior_offset`

The rule supplies a readable basis, anchor name, building/model identity, method version and known floor label. The shipped assets resolve every stated anchor. If a custom replacement model lacks all reference features, or a post has no rule, the estimate is unavailable and no marker is shown; the post list remains usable.

The calculated coordinate is stored only in the loaded view's `estimatedPosition`. The catalogue and API retain `position: null` and `positionStatus: unconfirmed`. Calculation does not modify the scene, public GLBs, Blender files or database. Shared models do not share post identities or records. Operational colors/counts continue to describe stored reports, schedules and attendance rather than the certainty of a location.

## Viewer behavior

- Amber dashed numbered markers and “Anggaran” labels distinguish estimates. Nearby callouts spread apart on screen with guide lines back to their estimated model points, preserving tappable areas on phones. A visible notice and selected-post panel state the low confidence and placement basis.
- “Penanda anggaran” toggles the overlays. List selection and post records work with markers hidden or WebGL unavailable.
- Selecting a marker/list item focuses the illustrative position. Rear DJM and west UTC locations use matching exterior viewing directions. Markers remain visible through exterior geometry as navigation callouts.
- Known floor labels remain unchanged; no floor, room, guardhouse or lift geometry is created.
- Model status distinguishes loading, ready and unavailable graphics. Camera controls disable when graphics are unavailable; the official post list and records remain usable. The marker notice distinguishes shown, hidden and unavailable estimates.
- At laptop/tablet widths, selecting a post opens its details in a visible side drawer. Phones use the bottom sheet and larger screens retain the side panel. Escape or the close control returns keyboard focus to the selecting marker/list item.

## Marker performance

All callouts for a camera share one cached projection/layout. Camera view/lens matrices, viewport dimensions and post IDs/order/coordinates invalidate that cache; unchanged frames reuse it. Leader lines only update changed endpoints. Camera entries and DOM endpoint entries use weak references so departed views can be collected.

The regression benchmark performs 60 moving-camera frames with seven callouts and requires 60 layout calculations instead of 420 (85.7% fewer). Local execution times are printed for diagnosis; they are not a browser frame-rate claim. Cache tests also verify projected anchor accuracy, invalidation, separate camera identities, and the absence of source-coordinate mutation.

## Verification

Run `npm run test:building` for catalogue/model and placement checks. The placement tests cover all six GLBs and eight identities, finite coordinates near the modeled site, visible-height bounds, real anchor provenance, low confidence, original floor labels and the absence of scene/catalogue mutation. A post-like object name alone cannot turn an estimate into a verified coordinate.

Run `npm run test:building:browser` for marker selection, amber dashed styling, the uncertainty/basis panel, toggling, shared-model separation, camera controls, operational filters and the non-WebGL fallback. Browser operational data is synthetic.

Local verification on 25 October 2026 passed all 33 model/placement/layout/cache checks and all 35 browser scenarios. The 375px touch scenario reached and tapped every DJM marker separately and read its corresponding estimate panel. Additional scenarios cover keyboard focus return, missing reference geometry, pending downloads and actual graphics-context loss/retry. The production build passed; lint reported no errors and retained the existing AuthContext Fast Refresh warning. The existing bundle-size build advisory remains. The reviewed compact preview is `artifacts/integration/estimated-markers.png`.
