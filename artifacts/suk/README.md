# Bangunan SUK exterior study

## A. What was created

A medium-detail exterior model built in the connected Blender session: symmetrical front wings, two tall front towers with circular-headed vertical glazing, central entrance facade, open entrance canopy and stairs, horseshoe window arches, paired columns and pilasters, terracotta hip roofs, four rear roof volumes, an axial gallery and garden courtyard, and a landscaped forecourt with curved driveway.

Refined on 25 October 2026 using the additional aerial and two street photographs. The former speculative single rear hall and belvedere are archived in a hidden collection, excluded from export. Two large outer rear halls and two smaller inner pavilions now frame the open central garden axis. Side access courts include parking bays, schematic vehicles, planted medians, palms, cypresses, clipped hedges, shade trees, lamps, barrier props and an unlettered stone sign. These are visual reference details, not operational security placements.

Approximate modelling envelope: building 152 m wide; front towers about 32 m tall. These are design estimates from photographs, not measured dimensions. Front faces Blender -Y; Z is up; units are metres. GLB uses the standard Y-up conversion.

## B. Reference use

- Image 1, oblique aerial: roof arrangement, connected massing, projecting entrance canopy, rear volumes and curved forecourt.
- Image 2, wider aerial: broad axial site organization and distant administrative building silhouette. The prominent foreground complex is distinct and was not incorporated into the SUK model.
- Image 3, frontal: balanced wings, twin towers, long circular-headed tower glazing, central entrance hierarchy and repeating arch rhythm.
- Image 4, side view: tall glazed arches, paired columns, pilasters, cream stone palette, projecting cornices and building depth.
- October refinement image 1, top aerial: four rear roof volumes, central open axis and side access courts.
- October refinement images 2–3, street views: opposing arched elevations, lower windows, planted medians, parking, entrance props and perimeter planting.

## C. Inferred areas

Rear elevations, courtyard dimensions, concealed roof junctions, building dimensions and precise site boundaries were approximated conservatively. The rear layout uses symmetry. Forecourt paving, paths and planting are schematic.

## D. Scene structure

Active scene: `SUK_Exterior_Study`; root: `SUK_Exterior`.

Collections: `Building_Main`, `Building_LeftWing`, `Building_RightWing`, `Building_CentralBlock`, `Roofs`, `Towers`, `Facade_Arches`, `Windows`, `Entrance`, `Ground`, `Hotspot_Anchors`, `Presentation`.

GLB retains corresponding `SUK_Group_*` hierarchy nodes and component metadata. Major named objects include `SUK_Main_Body`, `SUK_Left_Wing`, `SUK_Right_Wing`, `SUK_Central_Entrance`, `SUK_Left_Tower`, `SUK_Right_Tower`, `SUK_Left_InnerPavilion`, `SUK_Right_InnerPavilion`, `SUK_Central_AxialGallery`, `SUK_Rear_EntryPavilion`, `SUK_Ground`, and `SUK_Plaza`. Roof objects are named for their associated building mass. Previous speculative masses remain in `SUK_Archived_Reference_Masses`, hidden and excluded from GLB.

The original starter scene is preserved separately in the Blender file; its cube, light and camera are excluded from the GLB.

## E. Hotspot anchors

All seven are present as named empty nodes in Blender and the exported GLB:

- `HOTSPOT_MAIN_ENTRANCE`
- `HOTSPOT_CENTRAL_BLOCK`
- `HOTSPOT_LEFT_WING`
- `HOTSPOT_RIGHT_WING`
- `HOTSPOT_FRONT_PLAZA`
- `HOTSPOT_LEFT_TOWER`
- `HOTSPOT_RIGHT_TOWER`

These mark exterior UI focus locations only.

The operational post catalogue now uses separate `POST_DJM_*` identities for the seven official posts. Their indoor coordinates are unconfirmed and do not reuse these exterior anchors. See `docs/testing/DJM_OFFICIAL_POSTS.md` for the names, floor labels and migration behaviour.

## F. Output files and verification

- `Bangunan_SUK_Exterior.blend` — editable Blender scene, collections, materials, camera and daylight setup.
- `Bangunan_SUK_Exterior.glb` — 8,808,384 bytes; 287 exported mesh objects; 185,786 source mesh triangles; 27 exported materials; 306 GLB nodes. An identical copy is served from `public/models/Bangunan_SUK.glb`.
- `SUK_refined_preview.png`, `SUK_refined_side_preview.png` — current rendered elevated and side views. `SUK_exterior_preview.png` preserves the earlier version.
- `model_manifest.json` — machine-readable dimensions disclaimer, file paths, counts and checks.
- `build_suk.py`, `finish_suk.py` — procedural source scripts. Run in order in a fresh Blender session; these are creation scripts, not idempotent update scripts.
- `refine_suk_references.py`, `finish_refined_suk.py` — run in order with the SUK exterior scene open to regenerate the reference additions and save/export. The refinement script replaces its own generated objects and retains archived original masses. Do not rerun the original creation scripts over the refined scene.
- `backups/Bangunan_SUK_Exterior_before_refinement_20261025.blend` and `.glb` — pre-refinement scene and export.

Inspected material viewport views and elevated/side renders. Checked mirrored wing/tower positions, finite locations, unchanged positions of all seven exported anchors, GLB magic/version/declared file length, and exclusion of starter, presentation and archived objects. App model tests enforce fewer than 350 mesh objects, 200,000 triangles and 12 MiB. These are geometry/transfer budgets, not a device frame-rate benchmark.

Refinement verification: `npm run test:building` passed 11 checks; `npm run test:building:browser` passed all 18 desktop/mobile workflow checks using the actual refined GLB with synthetic operational API responses; `npm run build` passed (existing bundle size advisory remains). Current browser evidence uses `refined-browser-*.png`; historical phase screenshots are preserved. Zone highlighting and coarse marker occlusion include the new central gallery and rear building masses.

## G. Limitations

This is an interpretive academic/demo exterior, not an architecturally exact reconstruction. Ornamentation is simplified; window recesses use layered facade geometry rather than fully cut wall openings. Hidden elevations and roof connections need measured drawings or more photographs for refinement. There are no interior rooms, surveillance layouts or people. Cars, landscaping and entrance props are schematic. The seven existing application locations retain their original anchors; no new database locations are inferred. Materials use simple shared PBR settings without texture dependencies. Geometry is batched by component/material for the web; further compression remains possible.
