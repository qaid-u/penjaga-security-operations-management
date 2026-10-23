# Bangunan SUK exterior study

## A. What was created

A medium-detail exterior model built in the connected Blender session: symmetrical front wings, two tall front towers with circular-headed vertical glazing, central entrance facade, open entrance canopy and stairs, horseshoe window arches, paired columns and pilasters, terracotta hip roofs, connected rear wings, central rear hall, shallow courtyards, and a simplified landscaped forecourt with curved driveway.

Approximate modelling envelope: building 152 m wide; front towers about 32 m tall. These are design estimates from photographs, not measured dimensions. Front faces Blender -Y; Z is up; units are metres. GLB uses the standard Y-up conversion.

## B. Reference use

- Image 1, oblique aerial: roof arrangement, connected massing, projecting entrance canopy, rear volumes and curved forecourt.
- Image 2, wider aerial: broad axial site organization and distant administrative building silhouette. The prominent foreground complex is distinct and was not incorporated into the SUK model.
- Image 3, frontal: balanced wings, twin towers, long circular-headed tower glazing, central entrance hierarchy and repeating arch rhythm.
- Image 4, side view: tall glazed arches, paired columns, pilasters, cream stone palette, projecting cornices and building depth.

## C. Inferred areas

Rear elevations, courtyard dimensions, concealed roof junctions, building dimensions and precise site boundaries were approximated conservatively. The rear layout uses symmetry. Forecourt paving, paths and planting are schematic.

## D. Scene structure

Active scene: `SUK_Exterior_Study`; root: `SUK_Exterior`.

Collections: `Building_Main`, `Building_LeftWing`, `Building_RightWing`, `Building_CentralBlock`, `Roofs`, `Towers`, `Facade_Arches`, `Windows`, `Entrance`, `Ground`, `Hotspot_Anchors`, `Presentation`.

GLB retains corresponding `SUK_Group_*` hierarchy nodes and component metadata. Major named objects include `SUK_Main_Body`, `SUK_Left_Wing`, `SUK_Right_Wing`, `SUK_Central_Entrance`, `SUK_Left_Tower`, `SUK_Right_Tower`, `SUK_Rear_Hall`, `SUK_Ground`, and `SUK_Plaza`. Roof objects are named for their associated building mass.

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

## F. Output files and verification

- `Bangunan_SUK_Exterior.blend` — editable Blender scene, collections, materials, camera and daylight setup.
- `Bangunan_SUK_Exterior.glb` — 2,537,652 bytes; 192 mesh objects in the source scene; 57,422 scene triangles; 13 exported materials; 211 GLB nodes.
- `SUK_exterior_preview.png` — rendered elevated view.
- `model_manifest.json` — machine-readable dimensions disclaimer, file paths, counts and checks.
- `build_suk.py`, `finish_suk.py` — procedural source scripts. Run in order in a fresh Blender session; these are creation scripts, not idempotent update scripts.

Inspected material viewport views and the final render. Checked mirrored wing/tower positions, finite locations, all seven exported anchors, GLB magic/version/declared file length, and exclusion of starter objects. Browser performance has not been benchmarked.

## G. Limitations

This is an interpretive academic/demo exterior, not an architecturally exact reconstruction. Ornamentation is simplified; window recesses use layered facade geometry rather than fully cut wall openings. Hidden elevations and roof connections need measured drawings or more photographs for refinement. There are no interior rooms, security systems, surveillance layouts, cars or people. Materials use simple shared PBR settings without texture dependencies. Further draw-call consolidation and compression can be considered when integrating into the dashboard.
