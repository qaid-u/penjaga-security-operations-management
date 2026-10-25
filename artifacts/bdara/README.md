# Bangunan Dato’ Abdul Rahman Andak exterior study

A separate Blender model created from the four user-supplied screenshots on 25 October 2026. This is a photograph-derived exterior study with estimated proportions, not a measured architectural reconstruction.

The aerial reference establishes two bowed building rows, four wings and a central spine. Street views inform the layered pale metal roofs, deep eaves, stacked central gables, front portico, teal-grey ribbon glazing, cream spandrels, external shading rails and slender poles. The taller faceted pavilion is placed on the rear west wing as an interpretation of the oblique view. The side drive-through canopy's precise location is not confirmed by the images.

The site includes curved parking courts, schematic vehicles, lawns, a patterned pedestrian axis, two small water features, abstract metal forms, palms, shade trees, benches, bins, lamps and accessible parking markings. Neighbouring residential towers, map labels and street-view interface overlays are not incorporated.

## Files

- `Bangunan_Dato_Abdul_Rahman_Andak.blend`: standalone editable scene `BDARA_Exterior_Study`, semantic collections, shared materials, daylight and presentation camera.
- `Bangunan_Dato_Abdul_Rahman_Andak.glb`: binary glTF 2 export, with BDARA geometry/hierarchy/materials only.
- `BDARA_exterior_preview.png`, `BDARA_front_preview.png`, `BDARA_side_preview.png`, `BDARA_plan_preview.png`: elevated, pedestrian-axis, end-pavilion and top views.
- `model_manifest.json`: geometry counts, bounds, reference filenames, checks and limitations.
- `build_bdara.py`, `finish_bdara.py`: procedural source. Run in order inside Blender; creation operates only on the owned BDARA scene. The finish script writes a standalone file containing this scene and its dependencies.
- `verify_bdara.mjs`: load/geometry/export check using the project's existing Three.js loader. Run `node artifacts/bdara/verify_bdara.mjs` from the repository root.
- `backups/Before_BDARA_Creation_20261025.blend`: previous Blender session backup.

## Structure and dimensions

Root: `BDARA_Exterior`. Groups/collections: Structure, Roofscape, Glazing, Shading, Entrance, Site, Landscape, StreetFurniture and Presentation, each prefixed `BDARA_`. Geometry is batched by component and material. Export excludes the camera and daylight sun and has no external texture files.

Blender front faces -Y, with Z up and approximate metre units. The working site plinth is 236 × 222 m; the building is approximately 190 m wide and the tallest gable is about 29 m. These values are modelling estimates. Three principal window bands and the taller pavilion are visual features, not confirmation of floor numbers or interior levels.

The export contains 182 mesh objects, 206,786 triangles, 28 materials and 191 nodes, and is 10,497,372 bytes. Geometry validation and a real Three.js load are checked; these counts are not a hardware frame-rate benchmark.

## Scope and verification

The model contains no interiors, room/agency allocations, security devices or security-post coordinates. Hidden roof connections, floor heights, canopy placement, ornament, parking and site extents are interpreted. Its reviewed GLB is deployed as `public/models/library/bdara.glb` and selected as BDARA in the application. The existing DJM source remains separate.

Checks cover one standalone BDARA scene, the four wing masses and roof groups, finite mesh coordinates/bounds, valid GLB length/version, isolation from SUK/operational node identities, shared materials and successful GLTFLoader parsing. Elevated, front, side and plan views are visually inspected.
