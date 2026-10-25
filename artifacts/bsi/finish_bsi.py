"""Export only BSI Kota Iskandar, render previews and open its standalone file."""
import bpy
import os
import math
import json
import struct
import io
import contextlib
from mathutils import Vector

OUT=os.path.dirname(os.path.abspath(__file__))
scene=bpy.context.scene
assert scene.name=='BSI_KotaIskandar_Exterior_Study' and scene.get('bsi_generated')
root=scene.objects['BSI_Exterior']
meshes=[ob for ob in scene.objects if ob.type=='MESH']
triangles=0
for ob in meshes:
    ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles)
    assert ob.name.startswith('BSI_')
    assert all(math.isfinite(v) for vertex in ob.data.vertices for v in vertex.co),ob.name
assert 0<len(meshes)<360 and triangles<400000
for ob in scene.objects:ob.select_set(ob.type in {'MESH','EMPTY'})
bpy.context.view_layer.objects.active=root
glb=os.path.join(OUT,'Bangunan_Sultan_Ismail_Kota_Iskandar.glb')
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.export_scene.gltf(filepath=glb,use_selection=True,use_active_scene=True,
                              export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
with open(glb,'rb') as handle:
    magic,version,length=struct.unpack('<4sII',handle.read(12))
    json_length,json_type=struct.unpack('<II',handle.read(8))
    doc=json.loads(handle.read(json_length))
assert magic==b'glTF' and version==2 and json_type==0x4E4F534A
assert length==os.path.getsize(glb) and length<22*1024*1024
names={node.get('name','') for node in doc['nodes']}
assert all(name.startswith('BSI_') for name in names)
assert not doc.get('cameras') and not doc.get('animations') and not doc.get('textures') and not doc.get('images')
for name in ['BSI_MainHall','BSI_OctagonalHall','BSI_EntryTower_Shaft','BSI_MainOvalSkylight_Glass','BSI_OctagonalSkylight_Glass']:
    assert name in names,name
gltf_triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
corners=[ob.matrix_world@Vector(corner) for ob in meshes for corner in ob.bound_box]
bounds={'min':[min(p[i] for p in corners) for i in range(3)],'max':[max(p[i] for p in corners) for i in range(3)]}
assert all(math.isfinite(v) for values in bounds.values() for v in values)

cam=scene.camera
saved=(cam.location.copy(),cam.rotation_euler.copy(),cam.data.type,cam.data.ortho_scale,cam.data.lens,
       scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)
def render(filename,position,target,mode,lens=35,scale=None,size=(1600,1200)):
    assert mode in {i.identifier for i in cam.data.bl_rna.properties['type'].enum_items}
    cam.data.type=mode;cam.location=position;cam.data.lens=lens
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    if scale:cam.data.ortho_scale=scale
    scene.render.resolution_x,scene.render.resolution_y=size
    scene.render.filepath=os.path.join(OUT,filename)
    bpy.ops.render.render(write_still=True)
try:
    bpy.ops.render.render(write_still=True)
    render('BSI_tower_preview.png',(0,-170,8),(0,-76,24),'PERSP',lens=38,size=(1550,1250))
    render('BSI_front_preview.png',(0,-270,9),(0,-15,19),'PERSP',lens=39,size=(1800,900))
    render('BSI_screened_arch_preview.png',(62,-130,14),(0,-75,26),'PERSP',lens=36,size=(1500,1300))
    render('BSI_plan_preview.png',(0,-2,350),(0,-2,0),'ORTHO',scale=274,size=(1500,1500))
finally:
    (cam.location,cam.rotation_euler,cam.data.type,cam.data.ortho_scale,cam.data.lens,
     scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)=saved
for ob in scene.objects:ob.select_set(ob==root)
bpy.context.view_layer.objects.active=root
blend=os.path.join(OUT,'Bangunan_Sultan_Ismail_Kota_Iskandar.blend')
bpy.data.libraries.write(blend,{scene},fake_user=True,compress=True)
with bpy.data.libraries.load(blend) as (source,destination):
    saved_scenes=list(source.scenes);saved_objects=list(source.objects)
assert saved_scenes==['BSI_KotaIskandar_Exterior_Study'] and all(name.startswith('BSI_') for name in saved_objects)
manifest={
    'building':'Bangunan Sultan Ismail (BSI), Kota Iskandar','building_id':'BSI_KOTA_ISKANDAR',
    'revision':'20261025-photo-study-v1','scene':scene.name,
    'blend_file':os.path.basename(blend),'glb_file':os.path.basename(glb),
    'mesh_objects':len(meshes),'source_triangles':triangles,'glb_triangles':gltf_triangles,
    'materials':len(doc.get('materials',[])),'glb_nodes':len(doc['nodes']),'glb_bytes':length,
    'bounds_blender':bounds,'standalone_scenes':saved_scenes,
    'references':['codex-clipboard-e68d0b08-aca1-4073-ae6f-00bc4d7b1116.png','codex-clipboard-2cad101e-ffc3-4690-8b18-69c748e8cc44.png',
                  'codex-clipboard-5e543616-5bc9-4ed3-8f9b-00781e156ac7.png','codex-clipboard-c4d52a30-a5d4-485a-bd05-118b4a02184e.png',
                  'codex-clipboard-37d00d2a-2e54-47a1-9e3b-7731169ddf90.png'],
    'features':['Tall tiered entrance tower with open ground portal, upper loggias and finial',
                'Screened horseshoe side recesses and cusped arch trim','Square main hall with low oval lattice skylight',
                'Octagonal front hall and polygonal glazed cap','Four terracotta-hipped outer blocks and connecting galleries',
                'Small arched roof pavilions and gold finials','Raised garden parterres, scroll hedges and star paving',
                'Entrance steps, curved drive, reflecting pool, palms, shade trees and schematic parking'],
    'checks':['One standalone BSI scene','BSI nodes only in GLB','Finite vertices and bounds','Valid glTF 2 header and length',
              'Presentation camera and sunlight excluded','No external textures','No operational/internal coordinates'],
    'limitations':['Dimensions, roof rises, tower proportions, grades and hidden links interpreted, not surveyed',
                   'Most facade windows/screens use layered recess geometry; the gate passage is open',
                   'Geometric screens, paving, landscaping and ceremonial ornaments simplified',
                   'Gold rosette is abstract decoration, not a reproduction of official heraldry',
                   'No interiors, room allocations, floor numbering or security-post coordinates'],
    'preview_files':['BSI_exterior_preview.png','BSI_tower_preview.png','BSI_front_preview.png','BSI_screened_arch_preview.png','BSI_plan_preview.png'],
    'previous_session_backup':'backups/Before_BSI_Creation_20261025.blend'
}
with open(os.path.join(OUT,'model_manifest.json'),'w',encoding='utf-8',newline='\n') as handle:
    json.dump(manifest,handle,indent=2,ensure_ascii=False);handle.write('\n')
bpy.ops.wm.open_mainfile(filepath=blend,load_ui=False)
window=bpy.context.window or next(iter(bpy.context.window_manager.windows),None)
if window:
    window.scene=bpy.data.scenes['BSI_KotaIskandar_Exterior_Study']
    assert len(bpy.data.scenes)==1
    with bpy.context.temp_override(window=window):bpy.ops.wm.save_as_mainfile(filepath=blend,compress=True)
print(json.dumps(manifest,indent=2,ensure_ascii=False))
