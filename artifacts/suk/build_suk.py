"""Reference-based exterior study. Run in Blender; metres, front = -Y."""
import bpy, math, os, json
from mathutils import Vector
from collections import defaultdict

OUT = os.path.dirname(os.path.abspath(__file__))
scene = bpy.data.scenes.new('SUK_Exterior_Study')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene['description'] = 'Bangunan SUK exterior study from four supplied photographs; inferred dimensions, not an architectural survey.'
scene['orientation'] = 'Front faces -Y; Z up; model units metres.'
COLS = ['Building_Main','Building_LeftWing','Building_RightWing','Building_CentralBlock','Roofs','Towers','Facade_Arches','Windows','Entrance','Ground','Hotspot_Anchors','Presentation']
cols = {}
for name in COLS:
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    cols[name] = c
root = bpy.data.objects.new('SUK_Exterior', None)
cols['Building_Main'].objects.link(root)
root['reference_accuracy'] = 'Interpretive exterior model, approximate dimensions and hidden areas.'
mats = {}
def material(name, color, roughness=0.8, metal=0):
    m = bpy.data.materials.new('SUK_' + name)
    m.diffuse_color = (*color,1)
    m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value = (*color,1)
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metal
    mats[name] = m
material('Limestone',(.64,.55,.40))
material('Ivory',(.86,.79,.63))
material('Trim',(.95,.88,.72))
material('Terracotta',(.43,.115,.055))
material('RoofEdge',(.57,.20,.10))
material('Glass',(.045,.075,.075),.28,.25)
material('Mullion',(.32,.32,.26),.55,.25)
material('Recess',(.055,.045,.032))
material('Paving',(.57,.53,.44))
material('PaleStone',(.76,.70,.58))
material('Road',(.15,.17,.17))
material('Lawn',(.20,.30,.11))
material('Hedge',(.075,.19,.065))
material('Water',(.12,.29,.29),.23,.15)
material('Trunk',(.32,.23,.13))

# Batch disconnected architectural pieces by semantic part and material.
batches = defaultdict(lambda: [[],[]])
def mesh(name, coll, mat, verts, faces):
    v,f = batches[(name,coll,mat)]
    n=len(v); v.extend(verts); f.extend(tuple(n+i for i in face) for face in faces)
def box(name,coll,mat,center,size):
    x,y,z=center; a,b,c=[s/2 for s in size]
    vs=[(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),(x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
    mesh(name,coll,mat,vs,[(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])
def cylinder(name,coll,mat,x,y,z,r,h,n=12):
    vs=[(x+r*math.cos(i*math.tau/n),y+r*math.sin(i*math.tau/n),z+k*h) for k in [0,1] for i in range(n)]
    fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh(name,coll,mat,vs,fs)
def poly(name,coll,mat,pts,depth,y):
    n=len(pts)
    vs=[(x,y+d,z) for d in [-depth/2,depth/2] for x,z in pts]
    fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh(name,coll,mat,vs,fs)
def archpts(x,z,w,h):
    r=w/2; spring=z+h-r
    return [(x+r*.766,z)]+[(x+r*math.cos(math.radians(-40+i*260/24)),spring+r*math.sin(math.radians(-40+i*260/24))) for i in range(25)]+[(x-r*.766,z)]
def band(name,coll,mat,points,width,depth,y,closed=False):
    pairs=list(zip(points,points[1:]+points[:1] if closed else points[1:]))
    for (x1,z1),(x2,z2) in pairs:
        dx=x2-x1; dz=z2-z1; l=math.hypot(dx,dz)
        if l<1e-6: continue
        a=-dz/l*width/2; b=dx/l*width/2
        poly(name,coll,mat,[(x1+a,z1+b),(x2+a,z2+b),(x2-a,z2-b),(x1-a,z1-b)],depth,y)
def arch(x,y,z,w,h,label='Arcade',grid=False):
    pts=archpts(x,z,w,h)
    poly(label+'_Glazing','Windows','Glass',pts,.12,y)
    band(label+'_Archivolts','Facade_Arches','Trim',pts,.24,.3,y-.15,True)
    if grid:
        # Rectilinear glazing with horizontal bars stopping below the curved crown.
        rr=w*.38
        for i in range(-2,3):
            box(label+'_Mullions','Windows','Mullion',(x+i*rr/2.5,y-.10,z+h*.43),(.055,.065,h*.86))
        for j in range(1,int(h/.9)):
            zz=z+j*.9
            if zz<z+h-w*.48:
                box(label+'_Mullions','Windows','Mullion',(x,y-.11,zz),(rr*2,.07,.055))
def hip(name,x,y,w,d,z,rise):
    a=w/2; b=d/2
    ridge=max(0,a-b)
    if w>=d:
        vs=[(x-a,y-b,z),(x+a,y-b,z),(x+a,y+b,z),(x-a,y+b,z),(x-ridge,y,z+rise),(x+ridge,y,z+rise)]
        fs=[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)]
    else:
        ridge=b-a
        vs=[(x-a,y-b,z),(x+a,y-b,z),(x+a,y+b,z),(x-a,y+b,z),(x,y-ridge,z+rise),(x,y+ridge,z+rise)]
        fs=[(0,1,4),(1,2,5,4),(2,3,5),(3,0,4,5)]
    mesh(name,'Roofs','Terracotta',vs,fs)
    box(name+'_Eaves','Roofs','RoofEdge',(x,y,z-.11),(w+.25,d+.25,.22))
def mass(name,coll,x,y,w,d,h,roofrise=4):
    box(name,coll,'Ivory',(x,y,h/2+.55),(w,d,h))
    box(name+'_Plinth',coll,'Limestone',(x,y,.7),(w+.32,d+.32,1.4))
    for zz,th,extra in [(h-.35,.3,.45),(h+.25,.35,.85),(2,.18,.22)]:
        box(name+'_Cornice',coll,'Trim',(x,y,zz),(w+extra,d+extra,th))
    hip(name+'_Roof',x,y,w+.6,d+.6,h+.5,roofrise)

# Four connected wings around shallow courtyards, with central axial hall.
mass('SUK_Main_Body','Building_CentralBlock',0,-12,58,26,19,4.4)
for side,sign in [('Left',-1),('Right',1)]:
    x=54*sign; coll='Building_'+side+'Wing'
    mass('SUK_'+side+'_Wing',coll,x,-11,44,30,17.4,5.6)
    mass('SUK_'+side+'_RearWing',coll,x,33,44,24,17.4,4.6)
    mass('SUK_'+side+'_Connector',coll,sign*68,12,16,23,15.8,3)
    mass('SUK_'+side+'_CourtyardGallery',coll,sign*31,15,12,28,14.8,2.7)
    # Front arcade bays: six glazed horseshoe openings with paired columns.
    for i in range(6):
        xx=x+(i-2.5)*6.6
        arch(xx,-26.13,3.0,4.3,12.4,side+'_GrandArcade',True)
        box(side+'_BayFrames','Facade_Arches','Limestone',(xx,-26.17,16.3),(5.5,.28,.24))
    for i in range(7):
        xx=x+(i-3)*6.6
        box(side+'_Pilasters','Facade_Arches','Ivory',(xx,-26.31,12.95),(.9,.65,6.2))
        for dx in [-.30,.30]:
            cylinder(side+'_Columns','Facade_Arches','Trim',xx+dx,-26.62,2.2,.20,7.8)
        for z,w,h in [(1.5,1.1,1.5),(2.35,1.2,.3),(9.8,1.35,.45),(10.25,1.05,.35)]:
            box(side+'_ColumnCapitals','Facade_Arches','Limestone' if z<2 else 'Trim',(xx,-26.5,z),(w,.9,h))
    # Side facade repetition, rotated from local front-facing pieces below.
    for i in range(5):
        yy=-21+i*6
        # dedicated side units transformed after batching
        before=set(batches)
        label=side+'_SideArcade_'+str(i)
        arch(0,0,3,4.0,12.4,label,True)
        for key in list(batches):
            if key[0].startswith(label):
                vv,ff=batches[key]
                batches[key][0]=[(sign*(76.12-vy),yy+vx,vz) for vx,vy,vz in vv]
    for i in range(6):
        arch(x+(i-2.5)*6.5,20.85,7.3,3.4,7.0,side+'_RearArcade',True)
    # Low corner pavilions visible at outer ends.
    mass('SUK_'+side+'_CornerPavilion',coll,sign*73,-9,7,10,20,2)

# Three-storey facade on central block, flanking the projecting entrance.
for sign in [-1,1]:
    for xx in [12,17,31]:
        x=sign*xx
        for z,h,w in [(2.2,3.3,1.65),(7,4.6,2.7),(13.3,3.7,1.6)]:
            for dx in ([-.95,.95] if z==13.3 else [0]):
                arch(x+dx,-25.15,z,w,h,'Central_Arcades')
        box('Central_Stringcourses','Building_CentralBlock','Trim',(x,-25.3,12.3),(4.5,.4,.32))

# Tall flanking towers with iconic circular-headed vertical glazing.
for side,sign in [('Left',-1),('Right',1)]:
    x=sign*23
    mass('SUK_'+side+'_Tower','Towers',x,-23.7,9,10,28.5,3.2)
    for dx in [-3.6,3.6]:
        box(side+'_TowerPilasters','Towers','Limestone',(x+dx,-29,14.2),(.65,.65,27))
        box(side+'_TowerPilasterTrim','Towers','Trim',(x+dx,-29.35,14.2),(.19,.1,27))
    # Keyhole window: long narrow stem and circular crown.
    box(side+'_TowerWindow','Windows','Glass',(x,-28.84,12.1),(2.45,.12,19))
    pts=[(x+1.62*math.cos(i*math.tau/40),21.8+1.62*math.sin(i*math.tau/40)) for i in range(40)]
    poly(side+'_TowerOculus','Windows','Glass',pts,.1,-28.85)
    band(side+'_OculusSurround','Facade_Arches','Trim',pts,.28,.22,-28.99,True)
    for dx in [-1.35,1.35]:
        box(side+'_TowerWindowFrame','Facade_Arches','Trim',(x+dx,-29,11.7),(.22,.25,18.5))
    for dx in [-.8,0,.8]:
        box(side+'_TowerMullions','Windows','Mullion',(x+dx,-29.01,12.5),(.055,.06,20))
    for z in range(3,24):
        box(side+'_TowerMullions','Windows','Mullion',(x,-29.02,z),(2.35,.06,.05))
    box(side+'_TowerCrownBand','Towers','Trim',(x,-23.7,26.3),(9.6,10.6,.4))
    for dx in [-3,-1.5,0,1.5,3]:
        arch(x+dx,-28.85,26.7,.8,1.25,'Tower_Crown')

# Rear axial hall and modest rear belvedere supported by oblique reference.
mass('SUK_Rear_Hall','Building_Main',0,32,43,29,21,5)
mass('SUK_Rear_Belvedere','Towers',0,43,10,10,31,3.4)
for i in range(7):
    arch((i-3)*5.4,17.35,10,3.3,8.4,'RearHall_Arches')

# Central entry facade, projecting open porte-cochere and stairs.
box('SUK_Central_Entrance','Entrance','Ivory',(0,-26,10),(17,4,20))
for z in [1,10.8,19.6,20.2]:
    box('Entrance_Cornices','Entrance','Trim',(0,-26.4,z),(18,4.9,.38))
for x in [-5,0,5]:
    arch(x,-28.15,12.1,2.4,5.8,'Entrance_Upper')
    # Pointed decorative enclosing frame.
    band('Entrance_PointedFrames','Facade_Arches','Limestone',[(x-1.7,12),(x-1.7,16.6),(x,18.6),(x+1.7,16.6),(x+1.7,12)],.3,.38,-28.45)
    arch(x,-28.17,1.2,3.2,7.5,'Entrance_Doors')
box('Entrance_Platform','Entrance','PaleStone',(0,-35,.7),(18,19,1.4))
box('Entrance_Canopy','Entrance','Ivory',(0,-35.2,9.5),(17.7,18.5,1.5))
box('Entrance_CanopyCoping','Entrance','Trim',(0,-35.2,10.4),(18.2,19,.3))
for x in [-7.7,-2.6,2.6,7.7]:
    for yy in [-43.3,-37.7,-31.8]:
        cylinder('Entrance_PorchColumns','Entrance','Trim',x,yy,1.4,.32,6.3)
        box('Entrance_PorchBases','Entrance','Limestone',(x,yy,2),(.95,.95,1.2))
        box('Entrance_PorchCapitals','Entrance','Trim',(x,yy,7.6),(1.15,1.15,.4))
for x in [-5.15,0,5.15]:
    # Open arcade: arch band only, with no opaque glazing.
    pts=archpts(x,4.7,4.2,4.2)
    band('Entrance_OpenArches','Entrance','Trim',pts[1:-1],.42,.75,-43.35)
for i in range(7):
    box('Entrance_Stairs','Entrance','PaleStone',(0,-44.2-i*.55,.1+(6-i)*.1),(16,.65,.2+(6-i)*.2))
for x in [-8.5,8.5]:
    box('Entrance_StairCheeks','Entrance','Limestone',(x,-45.7,.8),(.6,4.2,1.6))

# Presentation site: elliptical forecourt, curved approach, restrained formal beds.
box('SUK_Ground','Ground','Lawn',(0,0,-.5),(190,154,1))
box('SUK_Site_Plinth','Ground','Limestone',(0,0,-1.2),(192,156,.6))
def ellipse(name,mat,cx,cy,rx,ry,z,width=None,n=96):
    if width is None:
        vs=[(cx,cy,z)]+[(cx+rx*math.cos(i*math.tau/n),cy+ry*math.sin(i*math.tau/n),z) for i in range(n)]
        fs=[(0,i+1,(i+1)%n+1) for i in range(n)]
    else:
        vs=[(cx+(rx-k*width)*math.cos(i*math.tau/n),cy+(ry-k*width)*math.sin(i*math.tau/n),z) for k in [0,1] for i in range(n)]
        fs=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh(name,'Ground',mat,vs,fs)
ellipse('SUK_Curved_Drive','Road',0,-44,88,26,.04,6)
ellipse('SUK_Drive_Curb','PaleStone',0,-44,88.2,26.2,.07,.3)
ellipse('SUK_Plaza','Paving',0,-47,26,15,.1)
ellipse('SUK_Plaza_Inlay','PaleStone',0,-47,24.8,13.8,.12,.45)
box('SUK_Axial_Walk','Ground','PaleStone',(0,-61,.12),(8,24,.12))
for sign in [-1,1]:
    for i in range(4):
        x=sign*(33+i*12)
        box('SUK_Formal_Walks','Ground','PaleStone',(x,-39,.06),(1.3,17,.12))
        box('SUK_Formal_Hedges','Ground','Hedge',(x+sign*2,-39,.30),(.65,14,.6))
    box('SUK_SideWalk','Ground','Paving',(sign*80,13,.04),(3,76,.08))
    box('SUK_Courtyard','Ground','Paving',(sign*48,12,.06),(19,16,.12))
    box('SUK_Courtyard_Lawn','Ground','Lawn',(sign*48,12,.08),(15,12,.12))
# Thin, low-detail palms indicate reference facade scale without obscuring the model.
for x in [-69,-57,-45,-33,33,45,57,69]:
    y=-30.6
    cylinder('SUK_PalmTrunks','Ground','Trunk',x,y,0,.17,7.3,8)
    for i in range(7):
        a=i*math.tau/7
        dx,dy=math.cos(a),math.sin(a)
        vs=[(x,y,7.6),(x+1.5*dx-.42*dy,y+1.5*dy+.42*dx,7.9),(x+3*dx,y+3*dy,6.8),(x+1.5*dx+.42*dy,y+1.5*dy-.42*dx,7.9)]
        mesh('SUK_PalmFronds','Ground','Hedge',vs,[(0,1,2),(0,2,3),(2,1,0),(3,2,0)])

# Real Blender meshes, semantic grouping and local origins at bounding-box centres.
for (name,coll,mat),(vs,fs) in batches.items():
    data=bpy.data.meshes.new(name+'_Mesh')
    center=Vector(tuple((min(v[i] for v in vs)+max(v[i] for v in vs))/2 for i in range(3)))
    data.from_pydata([tuple(Vector(v)-center) for v in vs],[],fs)
    data.materials.append(mats[mat]); data.update()
    obj=bpy.data.objects.new(name,data); cols[coll].objects.link(obj)
    obj.location=center; obj.parent=root
    obj['component']=coll
anchors={
 'HOTSPOT_MAIN_ENTRANCE':(0,-44,7),
 'HOTSPOT_CENTRAL_BLOCK':(0,-25,21),
 'HOTSPOT_LEFT_WING':(-54,-27,13),
 'HOTSPOT_RIGHT_WING':(54,-27,13),
 'HOTSPOT_FRONT_PLAZA':(0,-54,1),
 'HOTSPOT_LEFT_TOWER':(-23,-29.5,25),
 'HOTSPOT_RIGHT_TOWER':(23,-29.5,25)}
for name,pos in anchors.items():
    ob=bpy.data.objects.new(name,None); cols['Hotspot_Anchors'].objects.link(ob)
    ob.location=pos; ob.empty_display_size=1; ob.parent=root
    ob['purpose']='Public exterior UI focus point; not a security device.'

world=bpy.data.worlds.new('SUK_Daylight'); world.use_nodes=True; scene.world=world
world.node_tree.nodes.get('Background').inputs[0].default_value=(.62,.72,.85,1)
world.node_tree.nodes.get('Background').inputs[1].default_value=.65
sun=bpy.data.lights.new('SUK_Sun','SUN'); sun.energy=2.5; sun.angle=.18
ob=bpy.data.objects.new('SUK_Sun',sun); cols['Presentation'].objects.link(ob)
ob.rotation_euler=(math.radians(28),math.radians(-25),math.radians(-35))
camera=bpy.data.cameras.new('SUK_Presentation_Camera')
cam=bpy.data.objects.new('SUK_Presentation_Camera',camera); cols['Presentation'].objects.link(cam)
cam.location=(138,-198,132)
cam.rotation_euler=(Vector((0,0,8))-cam.location).to_track_quat('-Z','Y').to_euler()
camera.type='ORTHO'; camera.ortho_scale=230; camera.clip_end=1000
scene.camera=cam
scene.render.resolution_x=1600; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.join(OUT,'SUK_exterior_preview.png')
# Use the installed default engine; Blender 5 reports its Eevee identifier.
scene.render.engine=bpy.data.scenes[0].render.engine
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=210
        area.spaces.active.region_3d.view_location=(0,0,7)
        area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
        area.spaces.active.shading.color_type='MATERIAL'
scene['estimated_building_size_m']='152 wide x 76 deep; front towers about 32 high'
print(json.dumps({'scene':scene.name,'objects':len(scene.objects),'meshes':sum(o.type=='MESH' for o in scene.objects),'polygons':sum(len(o.data.polygons) for o in scene.objects if o.type=='MESH'),'anchors':list(anchors)},indent=2))
