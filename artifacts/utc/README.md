# UTC Johor exterior study — Pos UTC

Created in Blender on 25 October 2026 from the seven supplied street and aerial images for **Kaunter UTC Pejabat Setiausaha Kerajaan Johor — Pos UTC**. The model represents the exterior UTC Johor / Galleria @ Kotaraya corner complex. The counter's interior and exact position are not shown in the references and remain unconfirmed.

## Reference interpretation

The model separates three connected forms: a stepped white office tower with dark ribbon windows and an arched stone portico; the lower blue/red UTC wing with upper fins, horizontal louvres and a tall UTC JOHOR sign panel near the tower; and the broader mall on the adjoining street, with seven billowing silver facade panels, dark ribs, a pale folded roof and coral feature portal. The red rectangular gateway wraps the mall return elevation.

Ground/mezzanine glazing, a deep steel entrance canopy with triangular trusses, an open slatted walkway, entrance steps and ramp, a short cylindrical rooftop service drum, schematic roof plant, two streets, paving, blue parking strip and planting follow the visible exterior features. Text is converted local font geometry; no external fonts or image textures are needed. Commercial artwork, flags and detailed shop branding are omitted.

## Files

- `UTC_Johor_Exterior.blend`: standalone editable scene `UTC_Johor_Exterior_Study`, semantic collections, shared materials, daylight and presentation camera.
- `UTC_Johor_Exterior.glb`: binary glTF 2 containing only the UTC hierarchy, geometry and materials, without presentation camera/sun.
- `UTC_exterior_preview.png`, `UTC_street_preview.png`, `UTC_tower_preview.png`, `UTC_mall_preview.png`, `UTC_corner_preview.png`, `UTC_plan_preview.png`: elevated, UTC entrance, tower/portico, mall front, mall corner and plan views.
- `model_manifest.json`: references, identity, counts, bounds and limitations.
- `build_utc.py`, `finish_utc.py`: procedural source, run in order inside Blender. The build reads only whitelisted helper function definitions from `../bdara/build_bdara.py` and the facade helpers from `../rumah_ss_vip/build_residence.py`; it does not execute those models' scene setup. The finish uses temporary outputs before replacement, saves the isolated model and opens it as a normal editable file.
- `verify_utc.mjs`: actual Three.js GLTFLoader validation. Run `node artifacts/utc/verify_utc.mjs` from the repository root.
- `backups/Before_UTC_Creation_20261025.blend`: the Blender session before this model was created.

## Structure, scale and verification

Root: `UTC_Exterior`; building ID `UTC_JOHOR`; post name `Pos UTC` is metadata only. Structure, Roofscape, Glazing, Shading, Entrance, Signage, Site, Landscape and StreetFurniture groups contain editable meshes batched by component/material. The Presentation collection contains the camera and sunlight.

The mall front faces -Y, the UTC street faces -X and Z is up. The plinth is approximately 172 by 166 m and the tower reaches Z=62.85 m. Dimensions, window bands, roof junctions, rear elevations and site extent are interpreted rather than surveyed. The visual window bands do not establish floor numbers. Glazing uses layered facade geometry; portico arches are open. No interior plan, room allocation, operational route or security-post coordinate is inferred.

The GLB has 170 mesh objects, 58,930 triangles, 38 materials and 180 nodes, and is 2,895,524 bytes. Checks cover GLB header/length, exact manifest counts, finite geometry, transformed bounds, isolated identity, key masses, seven facade/roof groups, signage, canopy and adjoining street elevations. All six renders were visually inspected. These counts are not a device frame-rate benchmark.

The application deploys this reviewed model as `public/models/library/utc-johor.glb` and selects its separate UTC Johor identity with Pos UTC. Its interior position remains unconfirmed.
