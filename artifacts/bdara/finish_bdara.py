"""Export only BDARA, save a standalone blend, and render its presentation views."""
import bpy
import os
import math
import struct
import json
from mathutils import Vector

OUT=os.path.dirname(os.path.abspath(__file__))
scene=bpy.context.scene
assert scene.name=='BDARA_Exterior_Study' and scene.get('bdara_generated')
root=scene.objects['BDARA_Exterior']
meshes=[ob for ob in scene.objects if ob.type=='MESH']
assert 0<len(meshes)<250
triangles=0
for ob in meshes:
    ob.data.calc_loop_triangles()
    triangles+=len(ob.data.loop_triangles)
    assert all(math.isfinite(v) for vertex in ob.data.vertices for v in vertex.co),ob.name
    assert ob.name.startswith('BDARA_')
assert triangles<275000

for ob in scene.objects:
    ob.select_set(ob.type in {'MESH','EMPTY'})
bpy.context.view_layer.objects.active=root
glb=os.path.join(OUT,'Bangunan_Dato_Abdul_Rahman_Andak.glb')
bpy.ops.export_scene.gltf(filepath=glb,use_selection=True,use_active_scene=True,
                          export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
with open(glb,'rb') as handle:
    magic,version,length=struct.unpack('<4sII',handle.read(12))
    json_length,json_type=struct.unpack('<II',handle.read(8))
    doc=json.loads(handle.read(json_length))
assert magic==b'glTF' and version==2 and length==os.path.getsize(glb)
assert json_type==0x4E4F534A
assert length<16*1024*1024
names={node.get('name','') for node in doc['nodes']}
assert all(name.startswith('BDARA_') for name in names)
assert 'BDARA_Exterior' in names
assert not any(name.startswith(('HOTSPOT_','POST_','SUK_')) for name in names)
assert not doc.get('cameras') and not doc.get('animations')
assert not doc.get('images') and not doc.get('textures')
gltf_triangles=sum(doc['accessors'][primitive['indices']]['count']//3 for m in doc['meshes'] for primitive in m['primitives'])
corners=[ob.matrix_world@Vector(corner) for ob in meshes for corner in ob.bound_box]
bounds={'min':[min(p[i] for p in corners) for i in range(3)],'max':[max(p[i] for p in corners) for i in range(3)]}
assert all(math.isfinite(v) for values in bounds.values() for v in values)

# Always restore the presentation camera after creating the other reference views.
cam=scene.camera
saved=(cam.location.copy(),cam.rotation_euler.copy(),cam.data.type,cam.data.ortho_scale,cam.data.lens,
       scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)
def camera_mode(mode):
    assert mode in {item.identifier for item in cam.data.bl_rna.properties['type'].enum_items}
    cam.data.type=mode
def render(name,position,target,mode,scale=None,lens=30,resolution=(1500,1000)):
    cam.location=position
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    camera_mode(mode)
    if scale:
        cam.data.ortho_scale=scale
    cam.data.lens=lens
    scene.render.resolution_x,scene.render.resolution_y=resolution
    scene.render.filepath=os.path.join(OUT,name)
    bpy.ops.render.render(write_still=True)
try:
    bpy.ops.render.render(write_still=True)
    render('BDARA_front_preview.png',(0,-205,13),(0,-3,12),'PERSP',lens=30,resolution=(1800,800))
    render('BDARA_side_preview.png',(-136,-72,21),(-64,5,11),'PERSP',lens=38,resolution=(1500,1000))
    render('BDARA_plan_preview.png',(0,-18,300),(0,-18,0),'ORTHO',scale=259,resolution=(1400,1400))
finally:
    (cam.location,cam.rotation_euler,cam.data.type,cam.data.ortho_scale,cam.data.lens,
     scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)=saved

for ob in scene.objects:
    ob.select_set(ob==root)
bpy.context.view_layer.objects.active=root
blend=os.path.join(OUT,'Bangunan_Dato_Abdul_Rahman_Andak.blend')
# A library write includes only this scene and its dependencies, not the other model.
bpy.data.libraries.write(blend,{scene},fake_user=True,compress=True)
with bpy.data.libraries.load(blend) as (source,destination):
    saved_scenes=list(source.scenes)
    saved_objects=list(source.objects)
assert saved_scenes==['BDARA_Exterior_Study']
assert all(name.startswith('BDARA_') for name in saved_objects)
report={
    'building':'Bangunan Dato’ Abdul Rahman Andak, Kota Iskandar',
    'scene':scene.name,'revision':'20261025-photo-study-v1',
    'blend_file':os.path.basename(blend),'glb_file':os.path.basename(glb),
    'mesh_objects':len(meshes),'source_triangles':triangles,'glb_triangles':gltf_triangles,
    'glb_nodes':len(doc['nodes']),'materials':len(doc.get('materials',[])),'glb_bytes':length,
    'bounds_blender':bounds,'standalone_scenes':saved_scenes,
    'references':['Screenshot 2026-10-25 120700.png','Screenshot 2026-10-25 120754.png',
                  'Screenshot 2026-10-25 120833.png','Screenshot 2026-10-25 120900.png'],
    'features':['Four bowed wings in two rows with faceted ends','Central spine and layered cream standing-seam roofs',
                'Stacked entrance gables and front portico','Ribbon glazing, cream spandrels and external sunshades',
                'Taller faceted end pavilion','Interpreted covered side driveway',
                'Palm-lined patterned axis, water features, benches and bins','Curved parking courts and schematic vehicles'],
    'checks':['One owned scene in standalone Blender file','Only BDARA nodes in GLB','Finite vertices and bounds',
              'Valid glTF 2 binary header','No external textures','Presentation camera and sun excluded from GLB',
              'No indoor or security-post coordinates'],
    'limitations':['Dimensions and storey elevations inferred from photographs, not surveyed',
                   'Faceted pavilion treated as a photograph-derived volume, not confirmed floor numbering',
                   'Side-canopy location, hidden connections and site boundaries interpreted',
                   'Landscaping, public-art-like forms, cars and furniture are schematic',
                   'No interiors or agency-specific layouts'],
    'preview_files':['BDARA_exterior_preview.png','BDARA_front_preview.png','BDARA_side_preview.png','BDARA_plan_preview.png'],
    'previous_session_backup':'backups/Before_BDARA_Creation_20261025.blend'
}
with open(os.path.join(OUT,'model_manifest.json'),'w',encoding='utf-8',newline='\n') as handle:
    json.dump(report,handle,indent=2,ensure_ascii=False)
    handle.write('\n')
print(json.dumps(report,indent=2,ensure_ascii=False))
# Convert the isolated library into a normal editable main file with an active scene.
# This also makes the new model the file shown in the user's Blender window.
bpy.ops.wm.open_mainfile(filepath=blend,load_ui=False)
bpy.context.window.scene=bpy.data.scenes['BDARA_Exterior_Study']
assert len(bpy.data.scenes)==1
bpy.ops.wm.save_as_mainfile(filepath=blend,compress=True)
