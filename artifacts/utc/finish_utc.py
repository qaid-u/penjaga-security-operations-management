"""Export only UTC Johor, render six views, save and open its editable scene."""
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
assert scene.name=='UTC_Johor_Exterior_Study' and scene.get('utc_generated')
root=scene.objects['UTC_Exterior'];meshes=[o for o in scene.objects if o.type=='MESH']
triangles=0
for ob in meshes:
    ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles)
    assert ob.name.startswith('UTC_')
    assert all(math.isfinite(v) for vertex in ob.data.vertices for v in vertex.co),ob.name
assert 0<len(meshes)<250 and triangles<180000
for ob in scene.objects:ob.select_set(ob.type in {'MESH','EMPTY'})
bpy.context.view_layer.objects.active=root
glb=os.path.join(OUT,'UTC_Johor_Exterior.glb');staging_glb=os.path.join(OUT,'UTC_export_staging.glb')
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.export_scene.gltf(filepath=staging_glb,use_selection=True,use_active_scene=True,export_extras=True,
                              export_cameras=False,export_lights=False,export_yup=True)
os.replace(staging_glb,glb)
with open(glb,'rb') as handle:
    magic,version,length=struct.unpack('<4sII',handle.read(12));json_length,json_type=struct.unpack('<II',handle.read(8))
    doc=json.loads(handle.read(json_length))
assert magic==b'glTF' and version==2 and json_type==0x4E4F534A
assert length==os.path.getsize(glb) and length<10*1024*1024
names={node.get('name','') for node in doc['nodes']}
assert all(n.startswith('UTC_') for n in names)
assert not doc.get('cameras') and not doc.get('animations') and not doc.get('images') and not doc.get('textures')
required=['UTC_Exterior','UTC_Tower_MainShaft','UTC_Podium','UTC_BlueRoof','UTC_SignPanelBacking',
          'UTC_Galleria_MainHall','UTC_Galleria_MainCanopyRoof','UTC_RooftopServiceDrum','UTC_Logo_U','UTC_Logo_T','UTC_Logo_C']
for name in required:assert name in names,name
for i in range(1,8):assert 'UTC_Galleria_SilverPanel'+str(i) in names
gltf_triangles=sum(doc['accessors'][p['indices']]['count']//3 for mesh in doc['meshes'] for p in mesh['primitives'])
corners=[o.matrix_world@Vector(corner) for o in meshes for corner in o.bound_box]
bounds={'min':[min(p[i] for p in corners) for i in range(3)],'max':[max(p[i] for p in corners) for i in range(3)]}
cam=scene.camera
saved=(cam.location.copy(),cam.rotation_euler.copy(),cam.data.type,cam.data.ortho_scale,cam.data.lens,
       scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)
def render(filename,position,target,mode,lens=40,scale=None,size=(1800,1250)):
    assert mode in {i.identifier for i in cam.data.bl_rna.properties['type'].enum_items}
    cam.data.type=mode;cam.location=position;cam.data.lens=lens
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    if scale:cam.data.ortho_scale=scale
    scene.render.resolution_x,scene.render.resolution_y=size
    scene.render.filepath=os.path.join(OUT,'staging_'+filename)
    bpy.ops.render.render(write_still=True);os.replace(scene.render.filepath,os.path.join(OUT,filename))
try:
    render('UTC_exterior_preview.png',(-182,-199,157),(-2,6,22),'ORTHO',scale=250,size=(1800,1500))
    render('UTC_street_preview.png',(-148,-23,20),(-50,-7,16),'PERSP',lens=40,size=(1700,1250))
    render('UTC_tower_preview.png',(-129,-2,18),(-47,22,28),'PERSP',lens=36,size=(1400,1500))
    render('UTC_mall_preview.png',(28,-140,16),(28,-36,17),'PERSP',lens=40,size=(1800,1050))
    render('UTC_corner_preview.png',(131,-127,28),(31,-15,16),'PERSP',lens=45,size=(1800,1250))
    render('UTC_plan_preview.png',(0,6,350),(0,6,0),'ORTHO',scale=184,size=(1500,1500))
finally:
    (cam.location,cam.rotation_euler,cam.data.type,cam.data.ortho_scale,cam.data.lens,
     scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)=saved
for ob in scene.objects:ob.select_set(ob==root)
bpy.context.view_layer.objects.active=root
blend=os.path.join(OUT,'UTC_Johor_Exterior.blend');staging_blend=os.path.join(OUT,'UTC_isolated_staging.blend')
bpy.data.libraries.write(staging_blend,{scene},fake_user=True,compress=True)
with bpy.data.libraries.load(staging_blend) as (source,destination):saved_scenes=list(source.scenes);saved_objects=list(source.objects)
assert saved_scenes==['UTC_Johor_Exterior_Study'] and all(n.startswith('UTC_') for n in saved_objects)
os.replace(staging_blend,blend)
manifest={
    'building':'Kaunter UTC Pejabat Setiausaha Kerajaan Johor','building_id':'UTC_JOHOR','post':'Pos UTC',
    'exterior_context':'UTC Johor / Galleria @ Kotaraya corner complex','counter_position':None,
    'revision':'20261025-photo-study-v1','scene':scene.name,'blend_file':os.path.basename(blend),'glb_file':os.path.basename(glb),
    'mesh_objects':len(meshes),'source_triangles':triangles,'glb_triangles':gltf_triangles,
    'materials':len(doc.get('materials',[])),'glb_nodes':len(doc['nodes']),'glb_bytes':length,
    'bounds_blender':bounds,'standalone_scenes':saved_scenes,
    'references':['codex-clipboard-668d7e60-029b-4e63-baca-a49d5b2cbbaf.png',
                  'codex-clipboard-867dbd19-2396-4df4-9644-d494162c7145.png',
                  'codex-clipboard-0e8dbe37-b19f-490f-bf1e-43ac823ae3d4.png',
                  'codex-clipboard-b7254b9f-d98a-4a94-ae1a-afb8b15bd1e0.png',
                  'codex-clipboard-9cd4ab94-4b01-403a-81f1-30ae9254075a.png',
                  'codex-clipboard-73c4f990-528f-4dd9-b066-826ac8e1b8d5.png',
                  'codex-clipboard-5d05962a-c23f-4428-b9ba-1cf835e392b0.png'],
    'features':['Stepped white tower with ribbon windows and arched stone portico',
                'Blue/red UTC podium, upper fins, horizontal louvres and sign panel near the tower',
                'Extruded UTC JOHOR and Galleria lettering','Seven silver billowing facade panels and pale folded roof strips',
                'Coral feature portal and red return gateway','Retail glazing and mezzanine bands',
                'Deep steel entrance canopy with triangular trusses and a lighter slatted walkway',
                'Short rooftop service drum, schematic plant, two streets, paving, parking and planting'],
    'checks':['One isolated UTC scene','UTC-prefixed nodes only','Finite vertices and bounds','Valid glTF 2 header and length',
              'Presentation camera/sun excluded','No external textures','No counter interior or post coordinates inferred'],
    'limitations':['Scale, window bands, roof junctions, rear elevations and site extents interpreted, not surveyed',
                   'Window bands are visual facade divisions, not confirmed floor numbers',
                   'Most glazing uses layered facade geometry; portico arch openings are open',
                   'Logo lettering is simplified using converted local font geometry; retail artwork is omitted',
                   'Planting, rooftop plant, parking and ramps are schematic exterior features',
                   'No interior counter plan, operational routes, room allocation or security-post coordinates'],
    'preview_files':['UTC_exterior_preview.png','UTC_street_preview.png','UTC_tower_preview.png','UTC_mall_preview.png','UTC_corner_preview.png','UTC_plan_preview.png'],
    'previous_session_backup':'backups/Before_UTC_Creation_20261025.blend'
}
with open(os.path.join(OUT,'model_manifest.json'),'w',encoding='utf-8',newline='\n') as handle:
    json.dump(manifest,handle,indent=2,ensure_ascii=False);handle.write('\n')
bpy.ops.wm.open_mainfile(filepath=blend,load_ui=False)
window=bpy.context.window or next(iter(bpy.context.window_manager.windows),None)
if window:
    window.scene=bpy.data.scenes['UTC_Johor_Exterior_Study']
    with bpy.context.temp_override(window=window):bpy.ops.wm.save_as_mainfile(filepath=blend,compress=True)
print(json.dumps(manifest,indent=2,ensure_ascii=False))
