"""Refine the open SUK exterior using the supplied aerial and two street views.

Run inside Blender with the original SUK scene open. Dimensions are interpretive.
Original masses are archived, anchors retained, new geometry batched for the web.
"""
import ast
import bpy
import math
import os
import json
import random
from collections import defaultdict, Counter
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
scene = bpy.context.scene
root = scene.objects.get('SUK_Exterior')
assert root is not None, 'Open the SUK exterior scene first.'
original_anchors = {ob.name: list(ob.matrix_world.translation) for ob in scene.objects if ob.name.startswith('HOTSPOT_')}
assert len(original_anchors) == 7, 'Expected the seven original exterior anchors.'
if not scene.get('refinement_original_anchors'):
    scene['refinement_original_anchors'] = json.dumps(original_anchors)
rng = random.Random(25102026)

# Reuse only the original mesh-building functions, never its scene creation code.
functions = {'mesh', 'box', 'cylinder', 'poly', 'archpts', 'band', 'arch', 'hip', 'mass', 'ellipse'}
source = ast.parse(open(os.path.join(OUT, 'build_suk.py'), encoding='utf-8').read())
batches = defaultdict(lambda: [[], []])
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n, ast.FunctionDef) and n.name in functions], type_ignores=[]), 'SUK_geometry_helpers', 'exec'))

for ob in list(scene.objects):
    if ob.get('suk_refinement_generated'):
        bpy.data.objects.remove(ob, do_unlink=True)

archive = bpy.data.collections.get('SUK_Archived_Reference_Masses')
if archive is None:
    archive = bpy.data.collections.new('SUK_Archived_Reference_Masses')
    scene.collection.children.link(archive)
archive.hide_viewport = True
archive.hide_render = True

def archive_object(ob):
    if ob.get('suk_refinement_archived'):
        return
    world = ob.matrix_world.copy()
    for collection in list(ob.users_collection):
        collection.objects.unlink(ob)
    archive.objects.link(ob)
    ob.parent = None
    ob.matrix_world = world
    ob['suk_refinement_archived'] = True

archive_prefixes = ('SUK_Rear_Hall', 'SUK_Rear_Belvedere', 'RearHall_Arches',
                    'SUK_Left_Connector', 'SUK_Right_Connector',
                    'Left_RearArcade', 'Right_RearArcade', 'Left_RearElevation', 'Right_RearElevation',
                    'SUK_Courtyard', 'SUK_PalmTrunks', 'SUK_PalmFronds')
for ob in list(scene.objects):
    if ob.name.startswith(archive_prefixes):
        archive_object(ob)

for side, sign in [('Left', -1), ('Right', 1)]:
    for ob in list(scene.objects):
        if ob.get('suk_refinement_archived') or ob.get('suk_reference_repositioned'):
            continue
        if ob.name.startswith('SUK_' + side + '_RearWing'):
            ob.location.y += 20
            ob.scale.y *= 28 / 24
            ob['suk_reference_repositioned'] = True
        elif ob.name.startswith('SUK_' + side + '_CourtyardGallery'):
            ob.location.x = sign * 29
            ob.location.y = 19
            ob.scale.x *= 8 / 12
            ob.scale.y *= 36 / 28
            ob['suk_reference_repositioned'] = True

for side, sign in [('Left', -1), ('Right', 1)]:
    for ob in scene.objects:
        if ob.name.startswith('SUK_' + side + '_RearWing') and not ob.get('suk_refinement_archived'):
            ob.location.x = sign * 56

scene.objects['SUK_Ground'].dimensions = (190, 192, 1)
scene.objects['SUK_Ground'].location.y = 16
scene.objects['SUK_Site_Plinth'].dimensions = (192, 194, .6)
scene.objects['SUK_Site_Plinth'].location.y = 16

mats = {m.name.removeprefix('SUK_'): m for m in bpy.data.materials if m.name.startswith('SUK_')}
def mat(name, color, roughness=.8, metal=0):
    material = bpy.data.materials.get('SUK_' + name) or bpy.data.materials.new('SUK_' + name)
    material.use_nodes = True
    shader = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    material.diffuse_color = (*color, 1)
    mats[name] = material

mat('Asphalt', (.105, .12, .13))
mat('Markings', (.86, .85, .74))
mat('LeafLight', (.18, .30, .075))
mat('LeafDark', (.045, .13, .055))
mat('Burgundy', (.19, .075, .075))
mat('CarWhite', (.80, .82, .79), .35, .18)
mat('CarSilver', (.34, .40, .43), .3, .45)
mat('CarBlue', (.025, .17, .32), .3, .3)
mat('CarRed', (.37, .045, .025), .35, .22)
mat('Rubber', (.023, .027, .028))
mat('BarrierOrange', (.94, .31, .045), .45)
mat('Plaque', (.07, .085, .075), .42, .25)
mat('Bronze', (.48, .35, .14), .45, .65)
mat('Water', (.10, .26, .27), .22, .18)

def orient_arch(label, cx, cy, z, w, h, facing='front', grid=True):
    arch(cx if facing in ('front', 'back') else 0, cy if facing == 'front' else 0, z, w, h, label, grid)
    for key in list(batches):
        if not key[0].startswith(label):
            continue
        vertices = batches[key][0]
        if facing == 'back':
            batches[key][0] = [(x, cy - y, zz) for x, y, zz in vertices]
        elif facing == 'right':
            batches[key][0] = [(cx - y, cy + x, zz) for x, y, zz in vertices]
        elif facing == 'left':
            batches[key][0] = [(cx + y, cy - x, zz) for x, y, zz in vertices]

def colonnade(prefix, center_x, wall_y, width, count, height, facing='front'):
    outward = -1 if facing == 'front' else 1
    spacing = width / count
    for i in range(count):
        x = center_x + (i - (count - 1) / 2) * spacing
        orient_arch(prefix + '_Bay' + str(i), x, wall_y, 4.1, spacing * .69, height - 4.8, facing)
        orient_arch(prefix + '_Lower' + str(i), x, wall_y + outward * .02, 1.05, spacing * .42, 2.6, facing, False)
        box(prefix + '_RecessPanels', 'Facade_Arches', 'Limestone', (x, wall_y + outward * .12, height - .75), (spacing * .84, .20, .18))
    for i in range(count + 1):
        x = center_x + (i - count / 2) * spacing
        for dx in (-.25, .25):
            cylinder(prefix + '_Columns', 'Facade_Arches', 'Trim', x + dx, wall_y + outward * .5, 3.5, .17, height - 7.1, 10)
        box(prefix + '_ColumnBases', 'Facade_Arches', 'Limestone', (x, wall_y + outward * .42, 2), (.92, .8, 3.1))
        box(prefix + '_Capitals', 'Facade_Arches', 'Trim', (x, wall_y + outward * .5, height - 3.3), (1.12, .9, .42))
        box(prefix + '_Pilasters', 'Facade_Arches', 'Ivory', (x, wall_y + outward * .22, height - 1.6), (.78, .55, 2.8))

# Aerial-derived four rear roof volumes, with a legible open central axis.
for side, sign in [('Left', -1), ('Right', 1)]:
    x = sign * 19.5
    mass('SUK_' + side + '_InnerPavilion', 'Building_' + side + 'Wing', x, 51, 25, 29, 15.5, 4.0)
    colonnade('SUK_' + side + '_InnerFront', x, 36.35, 24, 5, 15.5)
    colonnade('SUK_' + side + '_InnerRear', x, 65.65, 24, 5, 15.5, 'back')
    colonnade('SUK_' + side + '_RearFront', sign * 56, 38.85, 42, 7, 17.4)
    colonnade('SUK_' + side + '_RearBack', sign * 56, 67.15, 42, 7, 17.4, 'back')
    colonnade('SUK_' + side + '_FrontWingRear', sign * 54, 4.15, 42, 7, 17.4, 'back')
    for i, y in enumerate([42, 48, 54, 60]):
        orient_arch('SUK_' + side + '_InnerCourt' + str(i), sign * 6.9, y, 4, 3.4, 10.3, 'right' if sign < 0 else 'left')
        orient_arch('SUK_' + side + '_RearOuter' + str(i), sign * 78.15, y, 4, 3.6, 12.6, 'left' if sign < 0 else 'right')
    mass('SUK_' + side + '_RearCornerTower', 'Towers', sign * 72, 64, 8, 8, 23, 2.2)
    for y in [61.3, 64, 66.7]:
        orient_arch('SUK_' + side + '_CornerCrown' + str(y), sign * 76.13, y, 19.9, 1.25, 2.1, 'left' if sign < 0 else 'right', False)
    for y in [-21, -15, -9, -3, 3]:
        # Strong exterior vertical articulation visible in the street photographs.
        box('SUK_' + side + '_SidePilasterDetails', 'Facade_Arches', 'Trim', (sign * 76.45, y, 11.9), (.28, .7, 10.4))
        orient_arch('SUK_' + side + '_SideGroundWindow' + str(y), sign * 76.2, y + 2.9, 1.0, 2.2, 2.7, 'left' if sign < 0 else 'right', False)
    for i, y in enumerate([6, 13, 20, 27, 33]):
        orient_arch('SUK_' + side + '_GalleryCourt' + str(i), sign * 33.15, y, 3.1, 3.4, 9.4, 'left' if sign < 0 else 'right')

mass('SUK_Central_AxialGallery', 'Building_CentralBlock', 0, 17, 9, 32, 11.3, 2.5)
colonnade('SUK_Central_Rear', 0, 1.15, 55, 9, 18.5, 'back')
for i, y in enumerate([6, 12, 18, 24, 30]):
    orient_arch('SUK_Central_AxialSideL' + str(i), -4.65, y, 2.1, 3.0, 7.7, 'left')
    orient_arch('SUK_Central_AxialSideR' + str(i), 4.65, y, 2.1, 3.0, 7.7, 'right')
mass('SUK_Rear_EntryPavilion', 'Entrance', 0, 75, 13, 9, 9.8, 2.6)
for x in [-4.2, 0, 4.2]:
    orient_arch('SUK_RearEntry_Arch' + str(x), x, 79.62, 1.1, 2.6, 6.6, 'back')
box('SUK_RearEntry_Platform', 'Entrance', 'PaleStone', (0, 81, .45), (15, 7, .9))
for i in range(4):
    box('SUK_RearEntry_Steps', 'Entrance', 'PaleStone', (0, 84.3 + i * .55, .4 - i * .10), (13, .65, .8 - i * .2))

# Paired side drives and parking courts between the front and rear blocks.
for sign in [-1, 1]:
    x = sign * 54
    box('SUK_SideAccess_Roads', 'Ground', 'Asphalt', (x, 21.5, .055), (64, 20, .08))
    box('SUK_SideAccess_FrontWalk', 'Ground', 'Paving', (x, 6.2, .10), (44, 3.8, .16))
    box('SUK_SideAccess_RearWalk', 'Ground', 'Paving', (x, 36.2, .10), (44, 3.6, .16))
    box('SUK_SideAccess_MedianCurb', 'Ground', 'PaleStone', (sign * 53, 21.5, .22), (36, 4.4, .38))
    box('SUK_SideAccess_MedianLawn', 'Ground', 'Lawn', (sign * 53, 21.5, .44), (35.3, 3.7, .16))
    box('SUK_Perimeter_Roads', 'Ground', 'Asphalt', (sign * 87, 19, .035), (7, 103, .06))
    for edge in [-1, 1]:
        box('SUK_Perimeter_Curbs', 'Ground', 'PaleStone', (sign * 87 + edge * 3.6, 19, .12), (.24, 103, .22))
    for i in range(13):
        xx = sign * (34 + i * 3.25)
        for yy in [10, 33]:
            box('SUK_Parking_Stripes', 'Ground', 'Markings', (xx, yy, .115), (.095, 5.1, .028))
    for yy in [14.8, 28.2]:
        for xx in range(30, 81, 6):
            box('SUK_Drive_Markings', 'Ground', 'Markings', (sign * xx, yy, .112), (2.6, .12, .024))
    # Street-view entrance island, contrasting low hedges and barrier housings.
    for y in [12.8, 30.2]:
        box('SUK_Entry_BarrierBases', 'Ground', 'Limestone', (sign * 82, y, .25), (.85, .85, .5))
        box('SUK_Entry_BarrierPosts', 'Ground', 'BarrierOrange', (sign * 82, y, 1.05), (.48, .48, 1.65))
        arm_y = y + 2.35 if y < 20 else y - 2.35
        box('SUK_Entry_BarrierArms', 'Ground', 'Trim', (sign * 82, arm_y, 1.8), (.12, 4.7, .13))
    for y in [14, 29]:
        cylinder('SUK_Entry_Bollards', 'Ground', 'BarrierOrange', sign * 76, y, .12, .13, .95, 10)

box('SUK_Rear_Parking_Road', 'Ground', 'Asphalt', (0, 91, .035), (178, 8, .06))
for sign in [-1, 1]:
    box('SUK_Landscape_PerimeterHedges', 'Ground', 'Hedge', (sign * 94.5, 20, .7), (1.2, 110, 1.4))
    box('SUK_Rear_Parking_Apron', 'Ground', 'Paving', (sign * 52, 78, .04), (58, 14, .08))
    for i in range(18):
        box('SUK_Rear_Parking_Stripes', 'Ground', 'Markings', (sign * (24 + i * 3.2), 78, .11), (.095, 5.2, .025))
    box('SUK_Rear_Garden_Walks', 'Ground', 'PaleStone', (sign * 12, 93, .09), (1.5, 32, .13))
    box('SUK_Rear_Garden_Hedges', 'Ground', 'Hedge', (sign * 10, 98, .55), (.7, 21, 1.1))

# Formal central courtyard: paths, raised planting and a small reflective basin.
box('SUK_Central_Courtyard', 'Ground', 'Paving', (0, 52, .08), (13.2, 37, .14))
for sign in [-1, 1]:
    box('SUK_Central_Parterre', 'Ground', 'Lawn', (sign * 4.5, 52, .16), (3, 27, .12))
    for y in [40, 48, 56, 64]:
        box('SUK_Central_Parterre_Trim', 'Ground', 'PaleStone', (sign * 4.5, y, .22), (3.25, .22, .22))
ellipse('SUK_Courtyard_Basin_Rim', 'PaleStone', 0, 51, 3.2, 3.2, .5, .45, 48)
ellipse('SUK_Courtyard_Basin_Water', 'Water', 0, 51, 2.75, 2.75, .37, None, 48)
box('SUK_Rear_AxialWalk', 'Ground', 'PaleStone', (0, 97, .09), (5, 25, .15))
for y in [87, 91, 95, 99, 103]:
    box('SUK_Rear_AxialInlays', 'Ground', 'Limestone', (0, y, .18), (5, .2, .04))

def ellipsoid(name, material, center, radius, segments=12, rings=7):
    cx, cy, cz = center
    rx, ry, rz = radius
    vs = []
    for j in range(rings + 1):
        a = math.pi * j / rings
        for i in range(segments):
            b = math.tau * i / segments
            vs.append((cx + rx * math.sin(a) * math.cos(b), cy + ry * math.sin(a) * math.sin(b), cz + rz * math.cos(a)))
    faces = [(j * segments + i, j * segments + (i + 1) % segments, (j + 1) * segments + (i + 1) % segments, (j + 1) * segments + i) for j in range(rings) for i in range(segments)]
    mesh(name, 'Ground', material, vs, faces)

def palm(x, y, height=8):
    for j in range(5):
        cylinder('SUK_Landscape_PalmTrunks', 'Ground', 'Trunk', x + .10 * j, y, j * height / 5, .17 - .012 * j, height / 5 + .04, 10)
    x += .4
    for k in range(9):
        angle = k * math.tau / 9 + rng.uniform(-.12, .12)
        length = rng.uniform(3.0, 4.0)
        dx, dy = math.cos(angle), math.sin(angle)
        vs = []
        for j in range(10):
            t = j / 9
            z = height + .6 * math.sin(t * math.pi) - 1.9 * t * t
            width = .55 * math.sin(t * math.pi) + .015
            cx, cy = x + t * length * dx, y + t * length * dy
            vs.extend([(cx - dy * width, cy + dx * width, z), (cx, cy, z + .14), (cx + dy * width, cy - dx * width, z)])
        faces = []
        for j in range(9):
            a, b = j * 3, (j + 1) * 3
            faces.extend([(a, b, b + 1, a + 1), (a + 1, b + 1, b + 2, a + 2)])
        mesh('SUK_Landscape_PalmFronds', 'Ground', 'LeafLight' if k % 3 == 0 else 'LeafDark', vs, faces)
    ellipsoid('SUK_Landscape_PalmCrowns', 'LeafDark', (x, y, height), (.48, .48, .7), 10, 5)

def cypress(x, y, height=7):
    cylinder('SUK_Landscape_CypressTrunks', 'Ground', 'Trunk', x, y, 0, .16, 1.8, 8)
    ellipsoid('SUK_Landscape_Cypress', 'LeafDark', (x, y, height * .54), (1.2, 1.2, height * .52), 12, 9)

for x in [-69, -57, -45, -33, 33, 45, 57, 69]:
    palm(x, -31, 8.5 + rng.uniform(-.6, .6))
for sign in [-1, 1]:
    for xx in [36, 48, 60, 72]:
        palm(sign * xx, 21.5, 8 + rng.uniform(-.6, .6))
    for xx in [40, 52, 64]:
        cypress(sign * xx, 21.5, 6.8)
    box('SUK_Landscape_MedianHedges', 'Ground', 'Hedge', (sign * 53, 20.5, .95), (29, .65, 1.0))
    box('SUK_Landscape_MedianBurgundy', 'Ground', 'Burgundy', (sign * 53, 22.5, .8), (29, .6, .8))
    for y in [41, 61]:
        cypress(sign * 4.5, y, 5.3)
    for y in [-16, 9, 48, 75, 102]:
        x = sign * 91
        cylinder('SUK_Landscape_ShadeTrunks', 'Ground', 'Trunk', x, y, 0, .30, 5.6, 10)
        for dx, dy, dz, size in [(-1.5, 0, 6.7, 2.8), (1.7, .6, 7.3, 3.0), (0, -1, 8.2, 3.4)]:
            ellipsoid('SUK_Landscape_ShadeTrees', 'Hedge' if dx < 0 else 'LeafLight', (x + dx, y + dy, dz), (size, size * .8, size * .75), 12, 7)

def car(x, y, heading=0, color='CarSilver'):
    # Bodies, glazing and wheels are batched, with no personal number plates.
    a = math.radians(heading)
    co, si = math.cos(a), math.sin(a)
    prefix = 'SUK_Parking_Cars_' + str(len(batches))
    keys_before = set(batches)
    box(prefix + '_Body', 'Ground', color, (0, 0, .65), (1.8, 4.1, .75))
    box(prefix + '_Cabin', 'Ground', 'Glass', (0, -.05, 1.23), (1.52, 2.15, .68))
    box(prefix + '_Roof', 'Ground', color, (0, -.05, 1.61), (1.48, 1.55, .12))
    for xx in [-.87, .87]:
        for yy in [-1.27, 1.27]:
            # Wheel profile is extruded along the lateral X axis.
            vs = [(xx + d, yy + .32 * math.cos(i * math.tau / 10), .4 + .32 * math.sin(i * math.tau / 10)) for d in [-.09, .09] for i in range(10)]
            fs = [tuple(reversed(range(10))), tuple(range(10, 20))] + [(i, (i + 1) % 10, (i + 1) % 10 + 10, i + 10) for i in range(10)]
            mesh(prefix + '_Wheels', 'Ground', 'Rubber', vs, fs)
    for xx in [-.62, .62]:
        box(prefix + '_Lights', 'Ground', 'Markings', (xx, -2.07, .77), (.37, .035, .22))
    for key in list(set(batches) - keys_before):
        vs, faces = batches.pop(key)
        vs = [(x + co * xx - si * yy, y + si * xx + co * yy, zz) for xx, yy, zz in vs]
        mesh('SUK_Parking_Vehicles', 'Ground', key[2], vs, faces)

colors = ['CarWhite', 'CarSilver', 'CarBlue', 'CarRed', 'CarSilver', 'CarWhite']
for sign in [-1, 1]:
    for i in range(11):
        if i in [3, 8]:
            continue
        for row, yy in enumerate([10, 33]):
            car(sign * (36 + i * 3.25), yy, 180 if row else 0, colors[(i + row) % len(colors)])
    for i in range(11):
        if i % 4 != 1:
            car(sign * (27 + i * 4.6), 78, 0, colors[(i + 2) % len(colors)])

for sign in [-1, 1]:
    for y in [-4, 32, 72]:
        x = sign * 82
        cylinder('SUK_Site_LampPosts', 'Ground', 'Plaque', x, y, .1, .10, 4.8, 8)
        box('SUK_Site_LampLanterns', 'Ground', 'Bronze', (x, y, 5), (.48, .48, .55))
        box('SUK_Site_LampGlass', 'Ground', 'Trim', (x, y, 5), (.33, .33, .38))

# Freestanding stone-framed plaque, as a generic exterior landmark.
box('SUK_Entry_SignPlinth', 'Ground', 'PaleStone', (92, -7, .3), (3.8, 1.2, .6))
box('SUK_Entry_SignStone', 'Ground', 'Trim', (92, -7, 1.8), (3.1, .65, 2.5))
box('SUK_Entry_SignPlaque', 'Ground', 'Plaque', (92, -7.35, 1.8), (2.6, .08, 1.95))

# Consolidate facade repetitions to keep the export economical.
consolidated = defaultdict(lambda: [[], []])
for (name, collection, material), (vs, faces) in batches.items():
    if any(part in name for part in ['_Bay', '_Lower', '_InnerCourt', '_RearOuter', '_CornerCrown', '_SideGroundWindow', '_GalleryCourt', '_AxialSide']):
        if name.startswith('SUK_Left_'):
            name = 'SUK_Left_RefinedFacades'
        elif name.startswith('SUK_Right_'):
            name = 'SUK_Right_RefinedFacades'
        elif name.startswith('SUK_RearEntry_'):
            name = 'SUK_RearEntry_RefinedFacades'
        elif name.startswith('SUK_Central_'):
            name = 'SUK_Central_RefinedFacades'
    dest_v, dest_f = consolidated[(name, collection, material)]
    offset = len(dest_v)
    dest_v.extend(vs)
    dest_f.extend(tuple(offset + v for v in face) for face in faces)

name_counts = Counter(name for name, collection, material in consolidated)
for (name, collection, material), (vs, faces) in consolidated.items():
    data = bpy.data.meshes.new(name + '_' + material + '_Mesh')
    center = Vector(tuple((min(v[i] for v in vs) + max(v[i] for v in vs)) / 2 for i in range(3)))
    data.from_pydata([tuple(Vector(v) - center) for v in vs], [], faces)
    data.materials.append(mats[material])
    data.update()
    ob = bpy.data.objects.new(name + '_' + material if name_counts[name] > 1 else name, data)
    target = bpy.data.collections.get(collection)
    target.objects.link(ob)
    ob.parent = scene.objects.get('SUK_Group_' + collection) or root
    ob.location = center
    ob['component'] = collection
    ob['suk_refinement_generated'] = True
    if 'Landscape_' in name or 'Trunks' in name:
        for face in data.polygons:
            face.use_smooth = True

# Merge the original five separate side-arch units per material without changing landmarks.
for side in ['Left', 'Right']:
    for suffix in ['Glazing', 'Archivolts', 'Mullions']:
        objects = [ob for ob in scene.objects if ob.type == 'MESH' and ob.name.startswith(side + '_SideArcade_') and ob.name.endswith('_' + suffix)]
        if len(objects) > 1:
            for ob in scene.objects:
                ob.select_set(False)
            for ob in objects:
                ob.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            bpy.ops.object.join()
            objects[0].name = side + '_SideArcade_' + suffix

root['reference_refinement'] = 'Aerial-informed four rear volumes, open axis, street-view colonnades and landscape; approximate exterior only.'
scene['reference_refinement_version'] = '20261025-v1'
scene['estimated_building_size_m'] = 'Approximate 152m building width; enlarged interpretive site, not a survey.'
camera = scene.camera
camera.location = (153, -203, 151)
camera.rotation_euler = (Vector((0, 16, 5)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.ortho_scale = 250
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_location = (0, 15, 6)
        area.spaces.active.region_3d.view_distance = 240
        area.spaces.active.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
        shading = area.spaces.active.shading
        color_modes = {item.identifier for item in shading.bl_rna.properties['color_type'].enum_items}
        if 'MATERIAL' in color_modes:
            shading.color_type = 'MATERIAL'
        area.spaces.active.overlay.show_overlays = False

anchors = {ob.name: list(ob.matrix_world.translation) for ob in scene.objects if ob.name.startswith('HOTSPOT_')}
before = json.loads(scene.get('refinement_original_anchors', '{}'))
assert all(all(abs(a - b) < .0001 for a, b in zip(anchors[name], position)) for name, position in before.items())
visible_meshes = [ob for ob in scene.objects if ob.type == 'MESH' and not ob.get('suk_refinement_archived')]
triangles = 0
for ob in visible_meshes:
    ob.data.calc_loop_triangles()
    triangles += len(ob.data.loop_triangles)
print(json.dumps({'revision': scene['reference_refinement_version'], 'visible_meshes': len(visible_meshes), 'triangles': triangles, 'archived_objects': len(archive.objects), 'anchors_preserved': len(anchors)}, indent=2))
