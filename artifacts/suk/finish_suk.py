import bpy, math, os, json, struct
from mathutils import Vector
OUT=os.path.dirname(os.path.abspath(__file__))
s=bpy.context.scene
root=s.objects['SUK_Exterior']
# Carry the visible colonnade rhythm around the outer wing sides.
for side,sign in [('Left',-1),('Right',1)]:
    for suffix in ['Columns','ColumnCapitals','Pilasters']:
        src=s.objects[side+'_'+suffix]
        ob=src.copy(); ob.data=src.data
        ob.name=side+'_Side_'+suffix
        src.users_collection[0].objects.link(ob)
        ob.location.x=sign*76.4; ob.location.y=-11
        ob.rotation_euler.z=sign*math.pi/2
        ob.scale.x=.72
    for suffix in ['Glazing','Archivolts','Mullions']:
        src=s.objects.get(side+'_RearArcade_'+suffix)
        if src:
            ob=src.copy(); ob.data=src.data; ob.name=side+'_RearElevation_'+suffix
            src.users_collection[0].objects.link(ob)
            ob.location.y=66-src.location.y; ob.scale.y=-1
# Collection grouping is also represented by named empty nodes for GLB consumers.
for col in s.collection.children:
    if col.name=='Presentation': continue
    group=bpy.data.objects.new('SUK_Group_'+col.name,None)
    col.objects.link(group); group.parent=root
    for ob in list(col.objects):
        if ob not in [root,group]: ob.parent=group
    group['category']=col.name
for ob in s.objects:
    ob.select_set(ob==root or ob.parent is not None)
# Report actual triangulated complexity and structural validation.
meshes=[o for o in s.objects if o.type=='MESH']
triangles=0
for ob in meshes:
    ob.data.calc_loop_triangles(); triangles+=len(ob.data.loop_triangles)
anchors=sorted(o.name for o in s.objects if o.name.startswith('HOTSPOT_'))
assert len(anchors)==7
assert abs(s.objects['SUK_Left_Wing'].location.x+s.objects['SUK_Right_Wing'].location.x)<1e-5
assert abs(s.objects['SUK_Left_Tower'].location.x+s.objects['SUK_Right_Tower'].location.x)<1e-5
assert all(all(math.isfinite(v) for v in o.location) for o in s.objects)
blend=os.path.join(OUT,'Bangunan_SUK_Exterior.blend')
glb=os.path.join(OUT,'Bangunan_SUK_Exterior.glb')
export_args=dict(filepath=glb,use_selection=True,use_active_scene=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
# The dynamic format enum is empty through RNA on this installed version;
# its operator default is the binary GLB format, verified from the file header below.
bpy.ops.export_scene.gltf(**export_args)
with open(glb,'rb') as f:
    magic,version,length=struct.unpack('<4sII',f.read(12))
    assert magic==b'glTF' and version==2
    chunk_len,chunk_type=struct.unpack('<II',f.read(8))
    doc=json.loads(f.read(chunk_len))
names={n.get('name') for n in doc['nodes']}
assert set(anchors).issubset(names)
assert not any(n in names for n in ['Cube','Light','Camera'])
assert length==os.path.getsize(glb)
report={'scene':s.name,'mesh_objects':len(meshes),'triangles':triangles,'materials':len(doc.get('materials',[])),'glb_nodes':len(doc['nodes']),'hotspots':anchors,'glb_bytes':length,'blend_file':blend,'glb_file':glb,'checks':['Seven anchors preserved in GLB','Left/right wing and tower positions balanced','Finite object locations','Valid GLB 2.0 header and declared file length','Starter scene objects excluded from GLB'],'limitations':['Approximate dimensions from photographs, not surveyed','Rear elevations, courtyard depths and roof junctions inferred','Window recesses represented by layered facade geometry','Simplified ornaments, landscaping and site plan','No interiors or security equipment']}
with open(os.path.join(OUT,'model_manifest.json'),'w',encoding='utf-8') as f: json.dump(report,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=blend)
print(json.dumps(report,indent=2))
