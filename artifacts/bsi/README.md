# Bangunan Sultan Ismail, Kota Iskandar exterior study

A separate Blender model created on 25 October 2026 from the five supplied aerial and street photographs. This represents Bangunan Sultan Ismail (BSI), Kota Iskandar. Dimensions and hidden connections are approximate, without measured drawings.

## Reference interpretation

The aerial informs a large square main hall with an oval lattice skylight, a smaller octagonal front hall with a polygonal glazed cap, four outer terracotta-roofed blocks, connecting galleries and side courtyards. The entrance faces model -Y.

The street photographs inform the tall gateway tower: a genuinely open ground passage, cusped portal trim, paired columns, a large screened horseshoe side recess, middle pointed openings and balcony canopy, upper triple loggias, projecting cornices and brackets, a terracotta cap and gold finial. The small gold rosette is abstract decoration rather than a reproduction of official heraldry.

The surrounding study includes broad entrance steps, red/cream/charcoal star paving, raised garden terraces, yellow scroll hedges, palms, shade trees, a curved drive, reflecting basin, parking and street furniture. Small ceremonial ornaments are schematic silhouettes. Most facade windows and screens use layered recess geometry. Planting, paving and ornament are simplified.

## Files

- `Bangunan_Sultan_Ismail_Kota_Iskandar.blend`: standalone editable scene `BSI_KotaIskandar_Exterior_Study`, semantic collections, shared materials, daylight and a presentation camera.
- `Bangunan_Sultan_Ismail_Kota_Iskandar.glb`: self-contained binary glTF 2 geometry, hierarchy and materials, excluding the presentation camera and sunlight.
- `BSI_exterior_preview.png`, `BSI_tower_preview.png`, `BSI_front_preview.png`, `BSI_screened_arch_preview.png`, `BSI_plan_preview.png`: elevated, entrance, wide front, screened side and plan views.
- `model_manifest.json`: references, features, counts, bounds and limitations.
- `build_bsi.py`, `finish_bsi.py`: procedural source, run in order inside Blender. The build script reads only whitelisted helper function definitions from `../bdara/build_bdara.py` and the hip-roof helper from `../suk/build_suk.py`; it does not execute those models' scene setup. The finish script exports, renders, saves and opens the isolated model.
- `verify_bsi.mjs`: load/geometry checks using the project's Three.js GLTFLoader. Run `node artifacts/bsi/verify_bsi.mjs` from the repository root.
- `backups/Before_BSI_Creation_20261025.blend`: previous Blender session saved before creating this scene.

## Structure, scale and verification

Root: `BSI_Exterior`, with building identity `BSI_KOTA_ISKANDAR`. Semantic groups cover Structure, Roofscape, Glazing, Ornament, Entrance, Site, Landscape and StreetFurniture. The separate Presentation collection contains the camera and sunlight. Repeated details are batched by component and material.

Blender uses Z up and approximate metres. The site plinth is 248 by 256 m and the tower finial reaches Z=51 m. These are modelling estimates. The study contains no interiors, room allocations, floor numbering or security-post coordinates.

The export has 283 mesh objects, 317,140 triangles, 37 materials and 292 nodes, and is 16,283,000 bytes. Verification covers finite geometry, exact manifest counts, isolated BSI identity, the four wings, both skylights, entrance and paving, GLB header/length, coordinate conversion and successful GLTFLoader parsing. All five rendered views were visually inspected. These counts are not a device frame-rate benchmark.

This reviewed model is deployed as `public/models/library/bsi-kota-iskandar.glb` and selected as Sultan Ismail in the application. Its two official posts belong to BSI Kota Iskandar; Sultan Ibrahim Johor Bahru remains a separate, unmodeled building. BDMIM's use of the Salleh Perang geometry is recorded in `../bdmim/model_reference.json`.
