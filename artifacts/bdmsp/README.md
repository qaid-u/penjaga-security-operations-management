# Bangunan Dato' Mohamad Salleh Perang exterior study

A separate Blender model created on 25 October 2026 from the user-supplied aerial and street screenshots. The sixth image repeats the fourth view. Dimensions and hidden connections are approximate, without measured drawings.

## Reference interpretation

The aerial informs two long wings meeting a taller central hub in a shallow V. The outer ends sweep approximately 16 degrees toward the landscaped approach. The street views inform the distinctive inclined roof screens: individual brown louvres with air gaps, exposed rafters/purlins, diagonal masts and knee braces above a lower weather roof. Three principal wing window bands stand over open parking pilotis; these are visual bands, not confirmed floor numbers.

The entrance has repeated nested timber A-frames, bundled rafters, a tiled gable canopy with rounded tile rolls, triangular glazing, square stone feet, a raised platform, central access steps and broad flanking stairs. White concrete slab frames, green window bays, grey cladding, horizontal sunshades and open end terraces follow the side and close-front references.

Site features include the red/cream/grey patterned garden axis, a paved arrival court, small rectangular water features with schematic metal forms, palms, mature shade trees, clipped planting, benches, lamps, perimeter parking, cars, accessible-space markings and paved undercroft-access barrier props. These are visual exterior features, not operational placements. Map labels do not determine agency allocations or interior/security-post locations.

## Files

- `Bangunan_Dato_Mohamad_Salleh_Perang.blend`: standalone editable scene `BDMSP_Exterior_Study`, with semantic collections, shared materials, daylight and a presentation camera.
- `Bangunan_Dato_Mohamad_Salleh_Perang.glb`: binary glTF 2 export containing only BDMSP geometry/hierarchy/materials.
- `BDMSP_exterior_preview.png`, `BDMSP_entrance_preview.png`, `BDMSP_front_preview.png`, `BDMSP_side_preview.png`, `BDMSP_plan_preview.png`: elevated, entrance, front, end-facade and plan views.
- `model_manifest.json`: references, geometry counts, bounds, checks and limitations.
- `build_bdmsp.py`, `finish_bdmsp.py`: procedural source, run in order inside Blender. The build script imports only whitelisted geometry helper definitions from `../bdara/build_bdara.py`; it does not execute the other model's scene setup. The finish script saves the isolated model and opens it as a normal editable file.
- `verify_bdmsp.mjs`: real Three.js GLB load and geometry checks. Run `node artifacts/bdmsp/verify_bdmsp.mjs` from the repository root.
- `backups/Before_BDMSP_Creation_20261025.blend`: previous Blender session backup.

## Structure, scale and verification

Root: `BDMSP_Exterior`. Semantic groups: Structure, Roofscape, Glazing, Shading, Entrance, Site, Landscape, StreetFurniture and Presentation, each prefixed `BDMSP_`. Detailed slats, frames, planting and furniture are batched by component/material. Export excludes the presentation camera/sun and contains no external texture dependencies.

Blender front is -Y, Z is up and units are approximate metres. The working plinth is 228 × 214 m, the building is approximately 170 m wide, and the highest roof-screen edge is about 34 m. These are modelling estimates. The model contains no interiors, internal agency plans, floor labels or security-post coordinates. Roof pitches, support sizes, end terraces, site boundaries and concealed rear elevations are interpreted.

The export has 167 mesh objects, 109,216 triangles, 35 materials and 176 nodes, and is 5,742,048 bytes. The checks cover a single standalone BDMSP scene, both wings, seven separately named roof-screen groups, the entrance and paved approaches, finite geometry, valid GLB length/version and successful GLTFLoader parsing. Elevated, entrance, front, side and plan renders are visually inspected. Geometry/transfer counts are not a device frame-rate benchmark.

The earlier DJM and BDARA Blender files and the application's current DJM asset remain separate. This new model is a local artifact prepared for later integration.
