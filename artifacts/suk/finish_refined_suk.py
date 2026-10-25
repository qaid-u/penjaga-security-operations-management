"""Save/export the refined current scene; exclude archived masses and presentation objects."""
import bpy
import os
import json
import struct
import math
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
scene = bpy.context.scene
root = scene.objects.get('SUK_Exterior')
assert root is not None and scene.get('reference_refinement_version')
anchors = {ob.name: list(ob.matrix_world.translation) for ob in scene.objects if ob.name.startswith('HOTSPOT_')}
expected = json.loads(scene['refinement_original_anchors'])
assert len(anchors) == 7 and set(anchors) == set(expected)
for name, before in expected.items():
    assert all(abs(a - b) < .0001 for a, b in zip(anchors[name], before)), name

export_objects = []
for ob in scene.objects:
    ancestor = ob
    belongs = False
    while ancestor is not None:
        if ancestor == root:
            belongs = True
            break
        ancestor = ancestor.parent
    selected = belongs and not ob.get('suk_refinement_archived') and ob.type in {'MESH', 'EMPTY'}
    ob.select_set(selected)
    if selected:
        export_objects.append(ob)
bpy.context.view_layer.objects.active = root
glb = os.path.join(OUT, 'Bangunan_SUK_Exterior.glb')
bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, use_active_scene=True,
                          export_extras=True, export_cameras=False, export_lights=False, export_yup=True)
with open(glb, 'rb') as handle:
    magic, version, length = struct.unpack('<4sII', handle.read(12))
    chunk_length, chunk_type = struct.unpack('<II', handle.read(8))
    document = json.loads(handle.read(chunk_length))
assert magic == b'glTF' and version == 2 and length == os.path.getsize(glb)
names = {node.get('name') for node in document['nodes']}
assert set(anchors).issubset(names)
assert 'SUK_Rear_Hall' not in names and 'SUK_Rear_Belvedere' not in names
assert not any(name in names for name in ['Cube', 'Light', 'Camera', 'SUK_Presentation_Camera', 'SUK_Sun'])
meshes = [ob for ob in export_objects if ob.type == 'MESH']
triangles = 0
for ob in meshes:
    ob.data.calc_loop_triangles()
    triangles += len(ob.data.loop_triangles)
corners = [ob.matrix_world @ Vector(corner) for ob in meshes for corner in ob.bound_box]
low = [min(v[i] for v in corners) for i in range(3)]
high = [max(v[i] for v in corners) for i in range(3)]
assert all(math.isfinite(value) for value in low + high)
manifest = {
    'revision': scene['reference_refinement_version'], 'scene': scene.name,
    'mesh_objects': len(meshes), 'triangles': triangles,
    'materials': len(document.get('materials', [])), 'glb_nodes': len(document['nodes']),
    'glb_bytes': length, 'hotspots': sorted(anchors), 'anchor_positions_blender': anchors,
    'bounds_blender': {'min': low, 'max': high},
    'blend_file': 'Bangunan_SUK_Exterior.blend', 'glb_file': 'Bangunan_SUK_Exterior.glb',
    'changes': ['Four rear roof volumes replacing the speculative single hall',
                'Central courtyard, axial gallery and rear entry pavilion',
                'Street-facing and courtyard colonnades with lower windows',
                'Side drives, parking bays and schematic vehicles',
                'Palms, cypresses, clipped hedges, shade trees and entrance props'],
    'checks': ['Seven hotspot names and positions retained', 'Archived original masses excluded from GLB',
               'Presentation camera and lighting excluded from GLB', 'Valid binary glTF 2 header', 'Finite site bounds'],
    'limitations': ['Photograph-derived approximate dimensions, not a survey',
                    'Hidden connections, roof junctions and site extents interpreted',
                    'Schematic vegetation, parking and entrance props; not operational placements',
                    'No interiors, room plans or new database mappings'],
    'backup': 'backups/Bangunan_SUK_Exterior_before_refinement_20261025.blend'
}
with open(os.path.join(OUT, 'model_manifest.json'), 'w', encoding='utf-8', newline='\n') as handle:
    json.dump(manifest, handle, indent=2)
    handle.write('\n')
scene.render.filepath = os.path.join(OUT, 'SUK_refined_preview.png')
scene.render.resolution_x = 1600
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'Bangunan_SUK_Exterior.blend'), compress=True)
print(json.dumps(manifest, indent=2))
