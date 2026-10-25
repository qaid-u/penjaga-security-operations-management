"""Export BDMSP only, render reference views and open a standalone editable file."""
import bpy
import os
import math
import struct
import json
import contextlib
import io
from mathutils import Vector

OUT=os.path.dirname(os.path.abspath(__file__))
scene=bpy.context.scene
assert scene.name=='BDMSP_Exterior_Study' and scene.get('bdmsp_generated')
root=scene.objects['BDMSP_Exterior']
meshes=[ob for ob in scene.objects if ob.type=='MESH']
triangles=0
for ob in meshes:
    ob.data.calc_loop_triangles()
    triangles+=len(ob.data.loop_triangles)
    assert ob.name.startswith('BDMSP_')
    assert all(math.isfinite(v) for vertex in ob.data.vertices for v in vertex.co),ob.name
assert 0<len(meshes)<220 and triangles<200000
for ob in scene.objects:
    ob.select_set(ob.type in {'MESH','EMPTY'})
bpy.context.view_layer.objects.active=root
glb=os.path.join(OUT,'Bangunan_Dato_Mohamad_Salleh_Perang.glb')
# Keep routine per-primitive exporter logging out of the MCP response.
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.export_scene.gltf(filepath=glb,use_selection=True,use_active_scene=True,
                              export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
with open(glb,'rb') as handle:
    magic,version,length=struct.unpack('<4sII',handle.read(12))
    json_length,json_type=struct.unpack('<II',handle.read(8))
    doc=json.loads(handle.read(json_length))
assert magic==b'glTF' and version==2 and json_type==0x4E4F534A
assert length==os.path.getsize(glb) and length<12*1024*1024
names={node.get('name','') for node in doc['nodes']}
assert all(name.startswith('BDMSP_') for name in names)
assert not doc.get('cameras') and not doc.get('animations')
assert not doc.get('images') and not doc.get('textures')
for name in ['BDMSP_West_Wing','BDMSP_East_Wing','BDMSP_CentralHub','BDMSP_Entrance_AFrames','BDMSP_CentralCrown_Louvres']:
    assert name in names,name
gltf_triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
corners=[ob.matrix_world@Vector(corner) for ob in meshes for corner in ob.bound_box]
bounds={'min':[min(p[i] for p in corners) for i in range(3)],'max':[max(p[i] for p in corners) for i in range(3)]}
assert all(math.isfinite(v) for values in bounds.values() for v in values)

cam=scene.camera
saved=(cam.location.copy(),cam.rotation_euler.copy(),cam.data.type,cam.data.ortho_scale,cam.data.lens,
       scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)
def render(filename,position,target,mode,lens=30,scale=None,size=(1500,1000)):
    assert mode in {i.identifier for i in cam.data.bl_rna.properties['type'].enum_items}
    cam.data.type=mode
    cam.location=position
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.lens=lens
    if scale:
        cam.data.ortho_scale=scale
    scene.render.resolution_x,scene.render.resolution_y=size
    scene.render.filepath=os.path.join(OUT,filename)
    bpy.ops.render.render(write_still=True)
try:
    bpy.ops.render.render(write_still=True)
    render('BDMSP_entrance_preview.png',(0,-94,8),(0,-10,14),'PERSP',lens=27,size=(1700,1100))
    render('BDMSP_front_preview.png',(0,-198,12),(0,-10,13),'PERSP',lens=28,size=(1800,850))
    render('BDMSP_side_preview.png',(102,-63,16),(73,-9,12),'PERSP',lens=28)
    render('BDMSP_plan_preview.png',(0,-22,300),(0,-22,0),'ORTHO',scale=249,size=(1400,1400))
finally:
    (cam.location,cam.rotation_euler,cam.data.type,cam.data.ortho_scale,cam.data.lens,
     scene.render.filepath,scene.render.resolution_x,scene.render.resolution_y)=saved

for ob in scene.objects:
    ob.select_set(ob==root)
bpy.context.view_layer.objects.active=root
blend=os.path.join(OUT,'Bangunan_Dato_Mohamad_Salleh_Perang.blend')
bpy.data.libraries.write(blend,{scene},fake_user=True,compress=True)
with bpy.data.libraries.load(blend) as (source,destination):
    saved_scenes=list(source.scenes)
    saved_objects=list(source.objects)
assert saved_scenes==['BDMSP_Exterior_Study']
assert all(name.startswith('BDMSP_') for name in saved_objects)
manifest={
    'building':"Bangunan Dato' Mohamad Salleh Perang, Kota Iskandar",
    'revision':'20261025-photo-study-v1','scene':scene.name,
    'blend_file':os.path.basename(blend),'glb_file':os.path.basename(glb),
    'mesh_objects':len(meshes),'source_triangles':triangles,'glb_triangles':gltf_triangles,
    'materials':len(doc.get('materials',[])),'glb_nodes':len(doc['nodes']),'glb_bytes':length,
    'bounds_blender':bounds,'standalone_scenes':saved_scenes,
    'references':['Screenshot 2026-10-25 125701.png','Screenshot 2026-10-25 125734.png',
                  'Screenshot 2026-10-25 125810.png','Screenshot 2026-10-25 125828.png',
                  'codex-clipboard-05fb423d-87f7-4748-859b-240a7331764e.png',
                  'codex-clipboard-a86d804f-e922-472c-9d30-c578682aa473.png'],
    'reference_note':'Images 4 and 6 duplicate the same side view.',
    'features':['Two shallow V-plan wings with taller central hub','Seven separate inclined open louvre screens',
                'Exposed raking masts, rafters, purlins and knee braces','Three principal wing window bands above open parking pilotis',
                'Pale concrete frames, green glazing and grey cladding','Repeated nested timber A-frame portico with tiled roof',
                'Raised entry platform and central/flanking stair flights','Patterned garden axis, palms, water features, furniture and parking'],
    'checks':['One standalone owned BDMSP scene','No DJM or BDARA objects in export','Finite vertices and bounds',
              'Valid binary glTF 2 header and length','Presentation camera/sun excluded from GLB','No external textures',
              'No internal security-post coordinates or agency layouts'],
    'limitations':['Footprint angles, dimensions, storey heights and hidden connections inferred, not surveyed',
                   'Window bands and taller hub do not establish official floor numbering',
                   'Roof-screen pitches, structural sizes and rear elevations interpreted',
                   'Landscape, water-feature art, parking, cars and barrier props are schematic'],
    'preview_files':['BDMSP_exterior_preview.png','BDMSP_entrance_preview.png','BDMSP_front_preview.png','BDMSP_side_preview.png','BDMSP_plan_preview.png'],
    'previous_session_backup':'backups/Before_BDMSP_Creation_20261025.blend'
}
with open(os.path.join(OUT,'model_manifest.json'),'w',encoding='utf-8',newline='\n') as handle:
    json.dump(manifest,handle,indent=2,ensure_ascii=False)
    handle.write('\n')
# Open the isolated library and save it as a normal editable main file.
bpy.ops.wm.open_mainfile(filepath=blend,load_ui=False)
window=bpy.context.window or next(iter(bpy.context.window_manager.windows),None)
assert window is not None, 'No Blender window is available for main-file activation.'
window.scene=bpy.data.scenes['BDMSP_Exterior_Study']
assert len(bpy.data.scenes)==1
with bpy.context.temp_override(window=window):
    bpy.ops.wm.save_as_mainfile(filepath=blend,compress=True)
print(json.dumps(manifest,indent=2,ensure_ascii=False))
