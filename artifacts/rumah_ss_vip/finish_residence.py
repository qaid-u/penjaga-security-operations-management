"""Export, render and open one shared editable residence exterior."""
import bpy
import os
import json
import math
import struct
import io
import contextlib
from mathutils import Vector

OUT=os.path.dirname(os.path.abspath(__file__))
scene=bpy.context.scene
assert scene.name=='Rumah_SS_VIP_Shared_Exterior_Study' and scene.get('residence_generated')
root=scene.objects['RUMAH_Shared_Exterior']
meshes=[o for o in scene.objects if o.type=='MESH']
triangles=0
for ob in meshes:
    ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles)
    assert ob.name.startswith('RUMAH_')
    assert all(math.isfinite(v) for vertex in ob.data.vertices for v in vertex.co),ob.name
assert 0<len(meshes)<350 and triangles<200000
for ob in scene.objects:ob.select_set(ob.type in {'MESH','EMPTY'})
bpy.context.view_layer.objects.active=root
glb=os.path.join(OUT,'Rumah_SS_VIP_Shared_Exterior.glb')
export_staging=os.path.join(OUT,'Residence_export_staging.glb')
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.export_scene.gltf(filepath=export_staging,use_selection=True,use_active_scene=True,export_extras=True,
                              export_cameras=False,export_lights=False,export_yup=True)
os.replace(export_staging,glb)
with open(glb,'rb') as handle:
    magic,version,length=struct.unpack('<4sII',handle.read(12))
    json_length,json_type=struct.unpack('<II',handle.read(8));doc=json.loads(handle.read(json_length))
assert magic==b'glTF' and version==2 and json_type==0x4E4F534A
assert length==os.path.getsize(glb) and length<12*1024*1024
names={n.get('name','') for n in doc['nodes']}
assert all(n.startswith('RUMAH_') for n in names)
assert not doc.get('cameras') and not doc.get('animations') and not doc.get('images') and not doc.get('textures')
for name in ['RUMAH_MainHouse_StoneLower','RUMAH_MainHouse_WhiteUpper','RUMAH_MainHouse_HipRoof',
             'RUMAH_EntrancePavilion_BalconySlab','RUMAH_PorchGroundDoors_Glass','RUMAH_PorchUpperDoors_Glass',
             'RUMAH_EastAnnex','RUMAH_RearWestLodge','RUMAH_RearEastLodge','RUMAH_RearNorthLodge',
             'RUMAH_WhiteLandscapeStair_Treads','RUMAH_PatternedCourt_Tiles']:
    assert name in names,name
gltf_triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
corners=[o.matrix_world@Vector(corner) for o in meshes for corner in o.bound_box]
bounds={'min':[min(p[i] for p in corners) for i in range(3)],'max':[max(p[i] for p in corners) for i in range(3)]}

cam=scene.camera
saved=(cam.location.copy(),cam.rotation_euler.copy(),cam.data.type,cam.data.ortho_scale,cam.data.lens,
       scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)
def render(filename,position,target,mode,lens=45,scale=None,size=(1700,1100)):
    assert mode in {i.identifier for i in cam.data.bl_rna.properties['type'].enum_items}
    cam.data.type=mode;cam.location=position;cam.data.lens=lens
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    if scale:cam.data.ortho_scale=scale
    scene.render.resolution_x,scene.render.resolution_y=size
    scene.render.filepath=os.path.join(OUT,'staging_'+filename)
    bpy.ops.render.render(write_still=True)
    os.replace(scene.render.filepath,os.path.join(OUT,filename))
try:
    render('Rumah_SS_VIP_exterior_preview.png',(172,-208,190),(0,25,4),'ORTHO',scale=299,size=(1700,1500))
    render('Rumah_SS_VIP_house_preview.png',(42,-94,23),(7,0,9),'PERSP',lens=48,size=(1800,1100))
    render('Rumah_SS_VIP_porch_preview.png',(9,-47,13),(9,-5,10),'PERSP',lens=48,size=(1400,1100))
    render('Rumah_SS_VIP_annex_preview.png',(80,-32,52),(40,8,7),'ORTHO',scale=65,size=(1600,1100))
    render('Rumah_SS_VIP_approach_preview.png',(65,-130,14),(15,-15,9),'PERSP',lens=42,size=(1800,1100))
    render('Rumah_SS_VIP_plan_preview.png',(0,25,350),(0,25,0),'ORTHO',scale=252,size=(1300,1800))
finally:
    (cam.location,cam.rotation_euler,cam.data.type,cam.data.ortho_scale,cam.data.lens,
     scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)=saved
for ob in scene.objects:ob.select_set(ob==root)
bpy.context.view_layer.objects.active=root
blend=os.path.join(OUT,'Rumah_SS_VIP_Shared_Exterior.blend')
staging=os.path.join(OUT,'Residence_isolated_staging.blend')
bpy.data.libraries.write(staging,{scene},fake_user=True,compress=True)
with bpy.data.libraries.load(staging) as (source,destination):
    saved_scenes=list(source.scenes);saved_objects=list(source.objects)
assert saved_scenes==['Rumah_SS_VIP_Shared_Exterior_Study'] and all(n.startswith('RUMAH_') for n in saved_objects)
os.replace(staging,blend)
identities=[{'building_id':'RUMAH_SS','building':'Kediaman Rasmi Setiausaha Kerajaan Johor','post':'Pos Rumah SS'},
            {'building_id':'RUMAH_VIP','building':'Rumah VIP Setiausaha Kerajaan Johor','post':'Pos Rumah VIP'}]
shared={'shared_model_id':'JOHOR_SS_VIP_RESIDENCE','confirmed_on':'2026-10-25',
        'geometry_source':os.path.basename(glb),'editable_source':os.path.basename(blend),
        'source_manifest':'model_manifest.json','identities':identities,
        'scope':'One user-requested shared exterior geometry asset; separate building/post identities. No operational positions inferred.'}
with open(os.path.join(OUT,'shared_model_reference.json'),'w',encoding='utf-8',newline='\n') as handle:
    json.dump(shared,handle,indent=2,ensure_ascii=False);handle.write('\n')
manifest={
    'model':'Rumah SS / Rumah VIP shared residence exterior','shared_model_id':'JOHOR_SS_VIP_RESIDENCE',
    'revision':'20261025-photo-study-v1','identities':identities,'scene':scene.name,
    'blend_file':os.path.basename(blend),'glb_file':os.path.basename(glb),
    'mesh_objects':len(meshes),'source_triangles':triangles,'glb_triangles':gltf_triangles,
    'materials':len(doc.get('materials',[])),'glb_nodes':len(doc['nodes']),'glb_bytes':length,
    'bounds_blender':bounds,'standalone_scenes':saved_scenes,
    'references':['codex-clipboard-15a653b0-c373-48b2-a735-82c59d96a40b.png',
                  'codex-clipboard-d67b3a0d-ec33-42b3-ab54-459f95848d3f.png',
                  'codex-clipboard-d06a609f-b8eb-4098-a4ca-ecb325c7acff.png',
                  'codex-clipboard-29a8720c-4371-4406-a53d-e51322081fbf.png',
                  'codex-clipboard-16a27f0e-f428-4783-be90-b2659fa22222.png',
                  'codex-clipboard-9f139fc3-33f4-4cab-b24e-f3bb959929c2.png',
                  'codex-clipboard-7138cffb-b7fb-4943-b9a2-8540f44390fc.png',
                  'codex-clipboard-d1522b2a-945f-482e-8af3-48201845b04c.png'],
    'features':['Stone lower walls and white upper main house','Intersecting terracotta hip roofs with tile courses',
                'Open arched porch, upper balcony and French doors','Small railed balconies and tiled door canopies',
                'Two-storey white annex and low linking gallery','Three detached lodges, utility pavilion and covered court pavilion',
                'Red patterned court, arrival island, looping drive and schematic parking',
                'Sloping lawn, retaining walls, white balustraded landscape stair, mature trees and palms'],
    'checks':['Single shared residence scene','RUMAH-prefixed nodes only','Valid glTF 2 header and length',
              'Finite vertices and bounds','Presentation camera and sunlight excluded','No external textures',
              'Distinct building/post identities recorded without operational coordinates'],
    'limitations':['Scale, grades, rear elevations and hidden building connections interpreted, not surveyed',
                   'Window and door recesses use layered facade geometry; porch arches are open',
                   'Tile courses, stone joints, vegetation, furniture and service props simplified',
                   'Court use not inferred; sign panels have no invented lettering or heraldry',
                   'No interiors, floor labels, room allocations or security-post coordinates'],
    'preview_files':['Rumah_SS_VIP_exterior_preview.png','Rumah_SS_VIP_house_preview.png','Rumah_SS_VIP_porch_preview.png',
                     'Rumah_SS_VIP_annex_preview.png','Rumah_SS_VIP_approach_preview.png','Rumah_SS_VIP_plan_preview.png'],
    'previous_session_backup':'backups/Before_Residence_Creation_20261025.blend'
}
with open(os.path.join(OUT,'model_manifest.json'),'w',encoding='utf-8',newline='\n') as handle:
    json.dump(manifest,handle,indent=2,ensure_ascii=False);handle.write('\n')
bpy.ops.wm.open_mainfile(filepath=blend,load_ui=False)
window=bpy.context.window or next(iter(bpy.context.window_manager.windows),None)
if window:
    window.scene=bpy.data.scenes['Rumah_SS_VIP_Shared_Exterior_Study']
    with bpy.context.temp_override(window=window):bpy.ops.wm.save_as_mainfile(filepath=blend,compress=True)
print(json.dumps(manifest,indent=2,ensure_ascii=False))
