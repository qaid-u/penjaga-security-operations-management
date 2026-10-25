# Rumah SS / Rumah VIP shared exterior study

Created in Blender on 25 October 2026 from the eight supplied street and aerial images. One geometry asset is shared by **Kediaman Rasmi Setiausaha Kerajaan Johor — Pos Rumah SS** and **Rumah VIP Setiausaha Kerajaan Johor — Pos Rumah VIP**, as the user requested. Their identities are recorded separately in `shared_model_reference.json` and the manifest.

## Reference interpretation

The principal house is a long two-storey colonial bungalow with grey stone lower walls, white plaster above, deep dark eaves and intersecting terracotta hip roofs. Raised tile courses, ridge caps, stone joints, white-framed French doors, small railed balconies and tiled door canopies follow the close views. The projecting entrance has open ground-floor arches and a recessed upper balcony with doors.

The compound includes a two-storey white annex, low linking gallery, three detached hipped lodges, a small utility pavilion, an open-sided court pavilion and a low covered walk. The aerial informs their general arrangement; hidden connections and dimensions are interpreted. The foreground has red paving with pale grid bands, a planted arrival island, looping drive, schematic parking and sloping lawns. Retaining walls, a white balustraded landscape stair, pale entrance panels, mature conifers, shade trees and palms follow the wider views.

## Files

- `Rumah_SS_VIP_Shared_Exterior.blend`: standalone editable scene `Rumah_SS_VIP_Shared_Exterior_Study`, with semantic collections, shared materials, daylight and a camera.
- `Rumah_SS_VIP_Shared_Exterior.glb`: one self-contained binary glTF 2 model for both residence identities, excluding presentation camera and sunlight.
- `Rumah_SS_VIP_exterior_preview.png`, `Rumah_SS_VIP_house_preview.png`, `Rumah_SS_VIP_porch_preview.png`, `Rumah_SS_VIP_annex_preview.png`, `Rumah_SS_VIP_approach_preview.png`, `Rumah_SS_VIP_plan_preview.png`: overall, house, porch, annex, hillside approach and plan views.
- `model_manifest.json`: references, features, counts, bounds, checks and limitations.
- `shared_model_reference.json`: two distinct building/post identities linked to the same geometry and editable source.
- `build_residence.py`, `finish_residence.py`: procedural source, run in order inside Blender. The build reads only whitelisted geometry helper function definitions from `../bdara/build_bdara.py`; it does not execute that building's scene setup. The finish exports, renders and saves an isolated editable file using temporary output files before replacement.
- `verify_residence.mjs`: export validation with the project's actual Three.js GLTFLoader. Run `node artifacts/rumah_ss_vip/verify_residence.mjs` from the repository root.
- `backups/Before_Residence_Creation_20261025.blend`: previous Blender session saved before this model was created.

## Scale, structure and verification

Root: `RUMAH_Shared_Exterior`, with shared model ID `JOHOR_SS_VIP_RESIDENCE`. Structure, Roofscape, Glazing, Ornament, Entrance, Site, Landscape and StreetFurniture groups contain editable meshes batched by component/material. The Presentation collection contains the camera and sunlight.

Blender front is -Y, Z is up, and units are approximate metres. The plinth is 148 by 234 m; the main house is approximately 48 by 17 m, with a roof ridge at Z=18 m. Tree crowns extend beyond the plinth bounds. These are modelling estimates, not a survey. Roof junctions, grades, concealed rear details, materials, vegetation and furniture are simplified.

The GLB has 284 mesh objects, 122,560 triangles, 34 materials and 293 nodes, and is 5,517,040 bytes. Checks cover its header/length, matching manifest counts, finite geometry, transformed bounds, isolated residence identity, major buildings, both porch door levels, open porch passages and road visibility above terrain at grade changes. All six views were visually inspected. These are geometry/transfer checks rather than device frame-rate measurements.

The model contains no interiors, floor labels, room allocations or security-post coordinates. Court use is not inferred. The pale entrance panels contain no invented lettering or heraldry. The two post names are identity metadata rather than placed scene markers. The application deploys one `public/models/library/rumah-ss-vip.glb` for its separate Rumah SS and Rumah VIP choices, each scoped to its own operational record.
