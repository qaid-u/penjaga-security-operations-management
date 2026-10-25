"""Photograph-derived BDARA exterior. Run in Blender; front = -Y, Z up.

Creates only an owned, separate scene. Existing scenes and files are not edited.
Dimensions, concealed roof junctions and the side canopy placement are inferred.
"""
import bpy
import math
import os
import json
import random
from collections import defaultdict, Counter
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
NAME = 'BDARA_Exterior_Study'
previous_engine = bpy.context.scene.render.engine
old = bpy.data.scenes.get(NAME)
if old:
    assert old.get('bdara_generated'), 'A user-owned scene already uses this name.'
scene = bpy.data.scenes.new(NAME+'_Build' if old else NAME)
bpy.context.window.scene = scene
if old:
    for ob in list(old.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.scenes.remove(old)
    scene.name = NAME
scene['bdara_generated'] = True
scene['building_name'] = 'Bangunan Dato’ Abdul Rahman Andak, Kota Iskandar'
scene['reference_accuracy'] = 'Approximate exterior from four user-supplied photographs, not a measured survey.'
scene['orientation'] = 'Front = Blender -Y; Z up; approximate metres. No indoor or security-post coordinates.'

def enum(obj, name, value):
    choices = {item.identifier for item in obj.bl_rna.properties[name].enum_items}
    assert value in choices, (name, choices)
    setattr(obj, name, value)

enum(scene.unit_settings, 'system', 'METRIC')
scene.render.engine = previous_engine
CATEGORIES = ['Structure', 'Roofscape', 'Glazing', 'Shading', 'Entrance', 'Site', 'Landscape', 'StreetFurniture', 'Presentation']
cols = {}
for category in CATEGORIES:
    name = 'BDARA_' + category
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    scene.collection.children.link(col)
    cols[category] = col
root = bpy.data.objects.new('BDARA_Exterior', None)
cols['Structure'].objects.link(root)
root['building'] = scene['building_name']
root['accuracy'] = scene['reference_accuracy']
groups = {}
for category in CATEGORIES:
    if category == 'Presentation':
        continue
    ob = bpy.data.objects.new('BDARA_Group_' + category, None)
    cols[category].objects.link(ob)
    ob.parent = root
    groups[category] = ob

mats = {}
def material(name, color, roughness=.75, metal=0):
    m = bpy.data.materials.get('BDARA_' + name) or bpy.data.materials.new('BDARA_' + name)
    m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*color, 1)
    mats[name] = m

for name, color, roughness, metal in [
    ('Cream', (.71,.67,.53), .8, 0), ('PaleTrim', (.86,.82,.68), .7, 0),
    ('Stone', (.40,.40,.32), .9, 0), ('Roof', (.70,.69,.54), .55, .22),
    ('RoofSeam', (.80,.79,.65), .5, .3), ('Soffit', (.30,.26,.18), .9, 0),
    ('Glass', (.075,.19,.18), .25, .35), ('GlassLight', (.13,.27,.25), .3, .25),
    ('Frame', (.32,.36,.31), .5, .45), ('Shade', (.13,.18,.15), .6, .4),
    ('Recess', (.065,.075,.065), .9, 0), ('Paving', (.52,.43,.33), .95, 0),
    ('WalkInlay', (.71,.63,.46), .9, 0), ('Asphalt', (.12,.14,.14), .95, 0),
    ('Marking', (.87,.86,.77), .8, 0), ('BlueBay', (.07,.28,.44), .85, 0),
    ('Lawn', (.24,.34,.12), 1, 0), ('Leaf', (.085,.20,.055), .95, 0),
    ('LeafLight', (.24,.37,.08), .95, 0), ('Trunk', (.34,.25,.14), 1, 0),
    ('Wood', (.26,.17,.09), .9, 0), ('Steel', (.42,.48,.46), .3, .8),
    ('Water', (.10,.27,.25), .2, .3), ('CarWhite', (.78,.81,.78), .35, .3),
    ('CarSilver', (.32,.38,.39), .3, .55), ('CarRed', (.33,.055,.04), .3, .4),
    ('CarBlue', (.035,.13,.22), .3, .4), ('Rubber', (.035,.04,.035), .95, 0),
]:
    material(name, color, roughness, metal)

batches = defaultdict(lambda: [[], []])
def mesh(name, category, mat, vertices, faces):
    vs, fs = batches[(name, category, mat)]
    offset = len(vs)
    vs.extend(tuple(v) for v in vertices)
    fs.extend(tuple(offset + i for i in face) for face in faces)

def box(name, category, mat, center, size):
    x,y,z = center
    a,b,c = [d/2 for d in size]
    vertices = [(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),
                (x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
    mesh(name,category,mat,vertices,[(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])

def extrude(name, category, mat, outline, base, height):
    n = len(outline)
    vertices = [(x,y,z) for z in [base,base+height] for x,y in outline]
    faces = [tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    mesh(name,category,mat,vertices,faces)

def cylinder(name, category, mat, x,y,z,radius,height,n=12):
    outline = [(x+radius*math.cos(i*math.tau/n),y+radius*math.sin(i*math.tau/n)) for i in range(n)]
    extrude(name,category,mat,outline,z,height)

def beam(name, category, mat, a, b, width, depth=None):
    a,b = Vector(a),Vector(b)
    direction = b-a
    if direction.length < 1e-6:
        return
    u = direction.cross(Vector((0,0,1)))
    if u.length < 1e-5:
        u = direction.cross(Vector((0,1,0)))
    u.normalize()
    v = direction.normalized().cross(u).normalized()
    u *= width/2
    v *= (depth or width)/2
    vs = [a-u-v,a+u-v,a+u+v,a-u+v,b-u-v,b+u-v,b+u+v,b-u+v]
    mesh(name,category,mat,vs,[(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])

def strip(name, category, mat, points, z, width, height):
    for a,b in zip(points,points[1:]):
        aa,bb = Vector((a[0],a[1],z)),Vector((b[0],b[1],z))
        beam(name,category,mat,aa,bb,width,height)

def ellipsoid(name, category, mat, center, radius, segments=12, rings=7):
    cx,cy,cz = center
    rx,ry,rz = radius
    vs = [(cx,cy,cz+rz)]
    for j in range(1,rings):
        a = math.pi*j/rings
        vs.extend((cx+rx*math.sin(a)*math.cos(i*math.tau/segments),cy+ry*math.sin(a)*math.sin(i*math.tau/segments),cz+rz*math.cos(a)) for i in range(segments))
    bottom = len(vs)
    vs.append((cx,cy,cz-rz))
    fs = [(0,1+i,1+(i+1)%segments) for i in range(segments)]
    for j in range(rings-2):
        for i in range(segments):
            a,b = 1+j*segments+i,1+j*segments+(i+1)%segments
            fs.append((a,a+segments,b+segments,b))
    fs.extend((bottom,1+(rings-2)*segments+(i+1)%segments,1+(rings-2)*segments+i) for i in range(segments))
    mesh(name,category,mat,vs,fs)

def bowed(x):
    return -16*(abs(x)/82)**1.9

def path_point(sign, row, t, offset=0):
    x = 11+71*t
    y = row+bowed(x)
    slope = -16*1.9*(x/82)**.9/82
    normal = Vector((-slope,1)).normalized()
    return (sign*(x+normal.x*offset),y+normal.y*offset)

def band_on_edge(name, edge, z0, z1, mat='Glass'):
    vs = [(x,y,z) for x,y in edge for z in [z0,z1]]
    mesh(name,'Glazing',mat,vs,[(2*i,2*i+2,2*i+3,2*i+1) for i in range(len(edge)-1)])

WINGS = []
for row_name,row in [('Front',-22),('Rear',22)]:
    for side,sign in [('West',-1),('East',1)]:
        name = 'BDARA_'+row_name+'_'+side+'_Wing'
        WINGS.append(name)
        front = [path_point(sign,row,i/24,-11) for i in range(25)]
        back = [path_point(sign,row,i/24,11) for i in range(25)]
        end = path_point(sign,row,1)
        # Short bevelled ends follow the aerial's faceted caps, not capsule shapes.
        tangent = Vector((sign,-16*1.9/82)).normalized()
        normal = Vector(path_point(sign,row,1,1))-Vector(end)
        cap = [tuple(Vector(end)+tangent*u+normal*v) for u,v in [(7,-8),(9,0),(7,8)]]
        outline = front+cap+list(reversed(back))
        extrude(name,'Structure','Cream',outline,.8,12.6)
        extrude(name+'_StoneBase','Structure','Stone',outline,.2,1.4)
        for z in [4.3,8.2,12.4]:
            extrude(name+'_Spandrels','Structure','PaleTrim',outline,z,.32)
        for face_name,offset in [('Front',-11.14),('Back',11.14)]:
            edge = [path_point(sign,row,i/48,offset) for i in range(49)]
            for floor,(lo,hi) in enumerate([(1.9,3.5),(5.5,7.4),(9.6,11.7)]):
                band_on_edge(name+'_RibbonWindows',edge,lo,hi,'GlassLight' if floor==1 else 'Glass')
                for zz in [lo,hi,(lo+hi)/2]:
                    strip(name+'_WindowFrames','Glazing','Frame',edge,zz,.07,.08)
            for i in range(29):
                p = path_point(sign,row,i/28,offset)
                for lo,hi in [(1.9,3.5),(5.5,7.4),(9.6,11.7)]:
                    beam(name+'_Mullions','Glazing','PaleTrim',(*p,lo),(*p,hi),.095)
                if i%2==0:
                    p = path_point(sign,row,i/28,offset+(-.65 if offset<0 else .65))
                    cylinder(name+'_ExternalPosts','Shading','PaleTrim',*p,.6,.12,13.4,8)
            shade_edge = [path_point(sign,row,i/36,offset+(-.62 if offset<0 else .62)) for i in range(37)]
            for z in [1.9,2.7,3.5,5.5,6.4,7.4,9.6,10.6,11.7]:
                strip(name+'_HorizontalShades','Shading','Shade',shade_edge,z,.19,.12)
        cap_edge = [front[-1]]+cap+[back[-1]]
        for lo,hi in [(1.9,3.5),(5.5,7.4),(9.6,11.7)]:
            # Move glazing slightly outward from the rounded terminal walls.
            e = [(end[0]+(x-end[0])*1.015,end[1]+(y-end[1])*1.015) for x,y in cap_edge]
            band_on_edge(name+'_EndGlazing',e,lo,hi)
            for z in [lo,hi,(lo+hi)/2]:
                strip(name+'_EndShades','Shading','Shade',e,z,.14,.12)
        # Folded, standing-seam roof follows the bowed plan and hips over the end cap.
        roof_rows = []
        for i in range(65):
            t = i/64
            if t<=.87:
                p = path_point(sign,row,t/.87)
                normal = (Vector(path_point(sign,row,t/.87,1))-Vector(p)).normalized()
                width,rise = 13.1,6.8
            else:
                q = (t-.87)/.13
                p = tuple(Vector(end)+tangent*(12.0*q))
                normal = Vector(path_point(sign,row,1,1))-Vector(end)
                width = 13.1*(1-.65*q)
                rise = 6.8*(1-q)
            roof_rows.append([(p[0]+normal.x*u*width,p[1]+normal.y*u*width,13.8+rise*h) for u,h in [(-1,0),(-.70,.40),(0,1),(.70,.40),(1,0)]])
        vs = [v for section in roof_rows for v in section]
        fs = [(i*5+j,(i+1)*5+j,(i+1)*5+j+1,i*5+j+1) for i in range(64) for j in range(4)]
        mesh(name+'_FoldedRoof','Roofscape','Roof',vs,fs)
        for section in roof_rows[::1]:
            for a,b in zip(section,section[1:]):
                beam(name+'_StandingSeams','Roofscape','RoofSeam',a,b,.035,.045)
        for edge_index in [0,4]:
            for a,b in zip(roof_rows,roof_rows[1:]):
                beam(name+'_DeepEaves','Roofscape','PaleTrim',a[edge_index],b[edge_index],.25,.40)
                aa,bb = Vector(a[edge_index]),Vector(b[edge_index])
                aa.z-=.25;bb.z-=.25
                beam(name+'_EaveShadow','Roofscape','Soffit',aa,bb,.60,.18)

def gable(name, x,y,width,depth,eave,rise,axis='Y',tier=False):
    def world(u,v,z):
        return (x+u,y+v,z) if axis=='Y' else (x+v,y+u,z)
    half = width/2
    vs = [world(u,v,z) for v in [-depth/2,depth/2] for u,z in [(-half,eave),(0,eave+rise),(half,eave)]]
    mesh(name+'_Roof','Roofscape','Roof',vs,[(0,3,4,1),(1,4,5,2)])
    for j in range(int(depth/.95)+1):
        v = -depth/2+j*depth/max(1,int(depth/.95))
        for u in [-half,half]:
            beam(name+'_Seams','Roofscape','RoofSeam',world(u,v,eave+.03),world(0,v,eave+rise+.03),.035,.045)
    for v in [-depth/2,depth/2]:
        for u in [-half,half]:
            beam(name+'_Bargeboards','Roofscape','PaleTrim',world(u,v,eave),world(0,v,eave+rise),.40,.55)
        if tier:
            mesh(name+'_GableGlazing','Glazing','Glass',[world(-half*.86,v,eave+.2),world(half*.86,v,eave+.2),world(0,v,eave+rise-.7)],[(0,1,2)])
            for u in [-half*.56,-half*.28,0,half*.28,half*.56]:
                ztop = eave+rise*(1-abs(u)/half)-.5
                beam(name+'_GableMullions','Glazing','PaleTrim',world(u,v,eave+.25),world(u,v,ztop),.12)
    for u in [-half,half]:
        beam(name+'_Eaves','Roofscape','PaleTrim',world(u,-depth/2,eave),world(u,depth/2,eave),.35,.55)
        beam(name+'_Soffits','Roofscape','Soffit',world(u*.94,-depth/2,eave-.25),world(u*.94,depth/2,eave-.25),1.3,.18)

# Central spine, taller cross-gables and the prominent front portico.
box('BDARA_CentralSpine','Structure','Cream',(0,1,9.1),(24,82,17.0))
box('BDARA_CentralSpine_StoneBase','Structure','Stone',(0,1,1.0),(24.4,82.4,1.5))
gable('BDARA_CentralSpine',0,0,30,86,17.7,8.4,tier=True)
box('BDARA_UpperRoofClerestory','Structure','Cream',(0,2,22),(22.5,70,6))
gable('BDARA_UpperCentralGable',0,2,23,72,24.0,5.1,tier=True)
for sign in [-1,1]:
    band_on_edge('BDARA_UpperClerestoryGlazing',[(sign*11.32,-32),(sign*11.32,36)],22.0,23.65)
for sign in [-1,1]:
    x = sign*12.14
    for lo,hi in [(1.8,3.8),(5.4,7.8),(9.3,11.9),(13.2,15.8)]:
        edge = [(x,-38+i*78/22) for i in range(23)]
        band_on_edge('BDARA_Spine_RibbonGlazing',edge,lo,hi)
        for z in [lo,(lo+hi)/2,hi]:
            strip('BDARA_Spine_Shading','Shading','Shade',[(x+sign*.55,y) for _,y in edge],z,.15,.11)
    for yy in range(-37,42,4):
        beam('BDARA_Spine_ExternalPosts','Shading','PaleTrim',(x+sign*.55,yy,1),(x+sign*.55,yy,17.6),.13)

for sign in [-1,1]:
    xx = sign*44
    yy = -22+bowed(xx)-6
    box('BDARA_DormerBase','Structure','Cream',(xx,yy,16),(11,10,3))
    gable('BDARA_Front_Dormer'+str(sign),xx,yy,13,13,17.4,4.6,tier=True)
box('BDARA_MainEntry_Recess','Entrance','Recess',(0,-40.1,4.3),(11,.2,6.3))
box('BDARA_MainEntry_GlassDoors','Entrance','Glass',(0,-40.3,3.1),(8,.16,4.4))
for x in [-4,-2,0,2,4]:
    beam('BDARA_MainEntry_DoorFrames','Entrance','PaleTrim',(x,-40.48,.9),(x,-40.48,5.3),.12)
gable('BDARA_MainEntrancePortico',0,-48,28,22,9.8,7.6)
for sign in [-1,1]:
    for yy in [-55,-41]:
        box('BDARA_Portico_Piers','Entrance','PaleTrim',(sign*10.5,yy,5.0),(1.15,1.15,9.6))
        box('BDARA_Portico_StoneBases','Entrance','Stone',(sign*10.5,yy,1.0),(1.65,1.65,2.0))
    beam('BDARA_Portico_GableFrame','Entrance','Soffit',(sign*11.7,-58.5,9.3),(0,-58.5,16.5),.60,.65)
box('BDARA_EntryPlatform','Entrance','WalkInlay',(0,-45,.5),(24,18,1))
for i in range(5):
    box('BDARA_EntranceSteps','Entrance','PaleTrim',(0,-54.2-i*.55,.45-i*.09),(18,.62,.90-i*.18))

# Taller faceted end pavilion visible in the oblique street photograph.
px,py = -83,22+bowed(82)
outline = [(px+10.8*math.cos(i*math.tau/10),py+10.8*math.sin(i*math.tau/10)) for i in range(10)]
extrude('BDARA_West_FacetedPavilion','Structure','Cream',outline,.8,16.5)
extrude('BDARA_West_PavilionBase','Structure','Stone',outline,.15,1.65)
extrude('BDARA_West_PavilionCrown','Structure','PaleTrim',outline,17.1,.7)
ring = [(px+10.94*math.cos(i*math.tau/10),py+10.94*math.sin(i*math.tau/10)) for i in range(11)]
for lo,hi in [(2.0,4.1),(5.8,7.9),(9.6,11.8),(13.4,15.5)]:
    band_on_edge('BDARA_West_PavilionGlazing',ring,lo,hi,'GlassLight')
    for z in [lo,(lo+hi)/2,hi]:
        outside=[(px+(x-px)*1.07,py+(y-py)*1.07) for x,y in ring]
        strip('BDARA_West_PavilionShading','Shading','Shade',outside,z,.15,.12)
for i in range(10):
    a = i*math.tau/10
    x,y = px+11.5*math.cos(a),py+11.5*math.sin(a)
    cylinder('BDARA_West_PavilionPosts','Shading','PaleTrim',x,y,.8,.12,17.3,8)
gable('BDARA_West_PavilionGable',px,py,26,28,18,7,'X',True)

# Smaller rear entrance and a separate, interpreted side court drive-through canopy.
box('BDARA_RearEntrance','Entrance','Cream',(0,49,5.5),(17,15,10.2))
gable('BDARA_RearEntrance',0,49,21,18,10.8,5)
box('BDARA_RearEntryGlazing','Glazing','Glass',(0,56.7,4.8),(10,.12,6))
gable('BDARA_East_CoveredDrive',74,-10,18,29,8.8,4.6)
for xx in [66.8,81.2]:
    for yy in [-22,2]:
        box('BDARA_CoveredDrive_Piers','Entrance','PaleTrim',(xx,yy,4.4),(.85,.85,8.8))
        box('BDARA_CoveredDrive_StoneBases','Entrance','Stone',(xx,yy,1.1),(1.25,1.25,2.2))

# Site and drives follow the curved bars. The central pedestrian axis stays legible.
box('BDARA_SiteBase','Site','Stone',(0,-18,-.65),(236,222,1.2))
box('BDARA_Lawn','Site','Lawn',(0,-18,-.08),(234,220,.22))
for label,row,width in [('Front',-48,8),('Rear',67,9),('Court',0,11)]:
    for sign in [-1,1]:
        points = [(sign*(14+i*90/40),row+bowed(14+i*90/40)) for i in range(41)]
        if label=='Rear':
            strip('BDARA_RearParkingAprons','Site','Asphalt',points,.035,32,.05)
        elif label=='Court':
            strip('BDARA_CourtParkingAprons','Site','Asphalt',points,.035,22,.05)
        strip('BDARA_'+label+'_CurvedDrive','Site','Asphalt',points,.065,width,.10)
        for delta in [-width/2,width/2]:
            edge=[(x,y+delta) for x,y in points]
            strip('BDARA_DriveCurbs','Site','PaleTrim',edge,.16,.18,.20)
        for i in range(14):
            x=sign*(18+i*6)
            y=row+bowed(x)
            box('BDARA_DriveDashes','Site','Marking',(x,y,.13),(2.4,.12,.025))
for sign in [-1,1]:
    box('BDARA_SidePerimeterDrive','Site','Asphalt',(sign*108,3,.06),(8,138,.10))
    box('BDARA_SideFootwalk','Site','Paving',(sign*101,-2,.10),(2.5,128,.14))
    for row in [76,55]:
        for i in range(23):
            x=sign*(17+i*3.7)
            y=row+bowed(x)
            box('BDARA_RearParkingStripes','Site','Marking',(x,y,.135),(.10,5.2,.025))
    strip('BDARA_FrontFootwalk','Site','Paving',[(sign*(15+i*79/40),-35+bowed(15+i*79/40)) for i in range(41)],.12,2.8,.16)
    box('BDARA_SideParkingAprons','Site','Asphalt',(sign*103,-68,.04),(8,42,.06))
box('BDARA_RearCrossDrive','Site','Asphalt',(0,62,.06),(26,8,.10))
box('BDARA_MainPedestrianAxis','Site','Paving',(0,-87,.12),(15,57,.18))
for sign in [-1,1]:
    box('BDARA_AxisEdge','Site','WalkInlay',(sign*7.25,-87,.24),(.4,57,.10))
for yy in [-64,-74,-84,-94,-104,-114]:
    box('BDARA_AxisPavingBands','Site','WalkInlay',(0,yy,.235),(14,.32,.06))
for y in [-71,-92,-109]:
    for sign in [-1,1]:
        points=[(sign*2+2.5*math.sin(i*math.tau/28),y+3.5*math.cos(i*math.tau/28)) for i in range(29)]
        strip('BDARA_AxisPattern','Site','WalkInlay',points,.25,.17,.035)
for yy in [-78,-101]:
    box('BDARA_AxisWaterFeature_Rim','Site','Stone',(0,yy,.35),(5.5,4.5,.65))
    box('BDARA_AxisWaterFeature_Water','Site','Water',(0,yy,.69),(4.8,3.8,.04))
    for offset in [-.55,.55]:
        points=[(offset+math.sin(t*math.tau)*.85,yy+.6*math.cos(t*math.tau),.8+3*t) for t in [i/28 for i in range(29)]]
        for a,b in zip(points,points[1:]):
            beam('BDARA_AbstractWaterSculpture','StreetFurniture','Steel',a,b,.17)
        ellipsoid('BDARA_AbstractWaterSculpture','StreetFurniture','Steel',(offset,yy,3.6),(.45,.45,.45))

rng=random.Random(25102026)
def palm(x,y,height=8):
    for j in range(5):
        cylinder('BDARA_PalmTrunks','Landscape','Trunk',x+.07*j,y,j*height/5,.20-j*.014,height/5+.03,10)
    x+=.28
    for k in range(14):
        angle=k*math.tau/14+rng.uniform(-.1,.1)
        length=rng.uniform(4.0,5.1)
        dx,dy=math.cos(angle),math.sin(angle)
        points=[]
        for j in range(11):
            t=j/10
            points.append((x+t*length*dx,y+t*length*dy,height+1.0*math.sin(t*math.pi)-2.0*t*t))
        for j,(a,b) in enumerate(zip(points,points[1:])):
            beam('BDARA_PalmRibs','Landscape','Leaf',a,b,.045)
            if j<2:
                continue
            t=j/10
            width=1.15*math.sin(t*math.pi)+.1
            for sign in [-1,1]:
                tip=(a[0]-sign*dy*width+dx*.35,a[1]+sign*dx*width+dy*.35,a[2]-.3)
                mesh('BDARA_PalmLeaflets','Landscape','LeafLight' if k%3==0 else 'Leaf',
                     [a,(b[0],b[1],b[2]+.05),tip],[(0,1,2)])
    ellipsoid('BDARA_PalmCrowns','Landscape','Leaf',(x,y,height),(.45,.45,.7))

for sign in [-1,1]:
    for yy in [-64,-77,-90,-105]:
        palm(sign*11,yy,9.0+rng.random()*1.8)
    for xx in [26,43,61,79]:
        palm(sign*xx,-43+bowed(xx),7.5+rng.random())
    for yy in [-95,-66,-25,13,49,82]:
        xx=sign*(102 if yy<-64 else 112)
        cylinder('BDARA_ShadeTreeTrunks','Landscape','Trunk',xx,yy,0,.28,5.2,10)
        for dx,dy,dz,r in [(-1.5,0,6.2,2.9),(1.7,.5,6.7,3.1),(0,-.5,8.1,3.3)]:
            ellipsoid('BDARA_ShadeTreeCrowns','Landscape','Leaf' if dx<0 else 'LeafLight',(xx+dx,yy+dy,dz),(r,r*.9,r*.7))

def bench(x,y):
    for xx in [-.85,.85]:
        box('BDARA_BenchLegs','StreetFurniture','Shade',(x+xx,y,.4),(.12,.65,.8))
    for j in range(5):
        box('BDARA_BenchSlats','StreetFurniture','Wood',(x,y-.25+j*.13,.8),(2.4,.105,.10))
        box('BDARA_BenchSlats','StreetFurniture','Wood',(x,y+.35,.98+j*.14),(2.4,.09,.11))
    for xx in [-.9,.9]:
        box('BDARA_BenchFrames','StreetFurniture','Shade',(x+xx,y+.34,1.05),(.07,.09,.85))

for sign in [-1,1]:
    for yy in [-70,-89,-108]:
        bench(sign*10,yy)
        cylinder('BDARA_LitterBins','StreetFurniture','Stone',sign*13,yy,.1,.48,.95,12)
        cylinder('BDARA_BinTops','StreetFurniture','Shade',sign*13,yy,1.05,.43,.08,12)
    for yy in [-42,-10,27,61]:
        xx=sign*102
        beam('BDARA_SiteLamps','StreetFurniture','Shade',(xx,yy,.1),(xx-.6*sign,yy,6.5),.16)
        beam('BDARA_SiteLamps','StreetFurniture','Shade',(xx-.6*sign,yy,6.5),(xx-2.2*sign,yy,7),.17)
        box('BDARA_LampHeads','StreetFurniture','Frame',(xx-2*sign,yy,6.8),(1.2,.42,.26))

def car(x,y,heading=0,color='CarSilver'):
    prefix='CAR_TEMP'
    keys=set(batches)
    box(prefix+'_Body','StreetFurniture',color,(0,0,.62),(1.8,4.2,.72))
    box(prefix+'_Cabin','StreetFurniture','Glass',(0,-.1,1.18),(1.52,2.1,.67))
    box(prefix+'_Roof','StreetFurniture',color,(0,-.1,1.55),(1.48,1.6,.12))
    for xx in [-.87,.87]:
        for yy in [-1.3,1.3]:
            box(prefix+'_Tyres','StreetFurniture','Rubber',(xx,yy,.37),(.22,.62,.62))
    angle=math.radians(heading)
    co,si=math.cos(angle),math.sin(angle)
    for key in set(batches)-keys:
        vs,fs=batches.pop(key)
        vs=[(x+co*vx-si*vy,y+si*vx+co*vy,vz) for vx,vy,vz in vs]
        mesh('BDARA_ParkedVehicles','StreetFurniture',key[2],vs,fs)

colors=['CarWhite','CarSilver','CarBlue','CarWhite','CarRed','CarSilver']
for sign in [-1,1]:
    for i in range(20):
        if i%5==2:
            continue
        x=sign*(20+i*4)
        for row in [55,76]:
            car(x,row+bowed(x),0 if row==55 else 180,colors[(i+int(sign))%len(colors)])
    for i in range(10):
        if i in [3,7]:
            continue
        x=sign*(27+i*6.8)
        car(x,bowed(x)+7,180,colors[i%6])
    for i in range(6):
        car(sign*103,-54-i*5.5,90,colors[(i+2)%6])

# The accessible parking bays visible in the street view are schematic site details.
for x in [89,93]:
    box('BDARA_AccessibleParkingBays','Site','BlueBay',(x,-49,.15),(3.5,5.3,.03))
    for dx in [-1.72,1.72]:
        box('BDARA_AccessibleBayMarking','Site','Marking',(x+dx,-49,.18),(.09,5.3,.025))
    circle=[(x+.5*math.cos(i*math.tau/20),-49.2+.5*math.sin(i*math.tau/20)) for i in range(21)]
    strip('BDARA_AccessibleBaySymbol','Site','Marking',circle,.20,.09,.025)
    strip('BDARA_AccessibleBaySymbol','Site','Marking',[(x,-48.3),(x,-49.2),(x+.8,-49.2),(x+1.1,-49.8)],.2,.10,.025)

# Semantic, material-batched meshes keep the GLB useful for later app integration.
counts=Counter(key[0] for key in batches)
for (name,category,mat),(vs,fs) in batches.items():
    assert vs and fs
    center=Vector(tuple((min(v[i] for v in vs)+max(v[i] for v in vs))/2 for i in range(3)))
    data=bpy.data.meshes.new(name+'_'+mat+'_Mesh')
    data.from_pydata([tuple(Vector(v)-center) for v in vs],[],fs)
    data.materials.append(mats[mat])
    data.update()
    assert not data.validate(), name
    ob=bpy.data.objects.new(name+'_'+mat if counts[name]>1 else name,data)
    cols[category].objects.link(ob)
    ob.location=center
    ob.parent=groups[category]
    ob['component']=category
    ob['reference_model']='BDARA-photo-study-20261025'
    if category=='Landscape' and ('Trunks' in name or 'Crowns' in name):
        for polygon in data.polygons:
            polygon.use_smooth=True

world=bpy.data.worlds.get('BDARA_Daylight') or bpy.data.worlds.new('BDARA_Daylight')
world.use_nodes=True
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs['Color'].default_value=(.60,.69,.78,1)
background.inputs['Strength'].default_value=.6
scene.world=world
light_types={item.identifier for item in bpy.types.Light.bl_rna.properties['type'].enum_items}
assert 'SUN' in light_types
light=bpy.data.lights.new('BDARA_DaylightSun','SUN')
light.energy=2.3
light.angle=.12
sun=bpy.data.objects.new('BDARA_DaylightSun',light)
cols['Presentation'].objects.link(sun)
sun.rotation_euler=(math.radians(27),math.radians(-22),math.radians(-28))
camera=bpy.data.cameras.new('BDARA_PresentationCamera')
cam=bpy.data.objects.new('BDARA_PresentationCamera',camera)
cols['Presentation'].objects.link(cam)
cam.location=(-172,-225,150)
cam.rotation_euler=(Vector((0,-12,7))-cam.location).to_track_quat('-Z','Y').to_euler()
enum(camera,'type','ORTHO')
camera.ortho_scale=342
camera.clip_end=1500
scene.camera=cam
scene.render.resolution_x=1800
scene.render.resolution_y=1300
scene.render.resolution_percentage=100
enum(scene.render.image_settings,'file_format','PNG')
scene.render.filepath=os.path.join(OUT,'BDARA_exterior_preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,-12,7)
        area.spaces.active.region_3d.view_distance=270
        area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
        enum(area.spaces.active.shading,'color_type','MATERIAL')
        area.spaces.active.overlay.show_overlays=False
for ob in scene.objects:
    ob.select_set(False)
root.select_set(True)
bpy.context.view_layer.objects.active=root
scene['estimated_dimensions']='Approximate 190m wide building; front gable around 29m. Not surveyed.'
print(json.dumps({'scene':scene.name,'meshes':sum(ob.type=='MESH' for ob in scene.objects),'wing_masses':WINGS,'references':4,'security_coordinates':None}))
