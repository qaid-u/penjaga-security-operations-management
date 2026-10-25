"""Shared Rumah SS / Rumah VIP exterior from eight supplied photographs.

Approximate metres, front -Y, Z up. Separate owned scene; no internal plan.
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
NAME = 'Rumah_SS_VIP_Shared_Exterior_Study'
engine = bpy.context.scene.render.engine
old = bpy.data.scenes.get(NAME)
if old: assert old.get('residence_generated'), 'Existing scene is not owned by this generator.'
scene = bpy.data.scenes.new(NAME + '_Build' if old else NAME)
bpy.context.window.scene = scene
if old:
    for ob in list(old.objects): bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.scenes.remove(old)
    scene.name = NAME
scene['residence_generated'] = True
scene['description'] = 'One shared exterior for Rumah SS and Rumah VIP, as requested by the user.'
scene['reference_accuracy'] = 'Photograph-derived approximate exterior; no measured dimensions or internal positions.'
categories = ['Structure', 'Roofscape', 'Glazing', 'Ornament', 'Entrance', 'Site', 'Landscape', 'StreetFurniture', 'Presentation']
cols = {}
for category in categories:
    col = bpy.data.collections.get('RUMAH_' + category) or bpy.data.collections.new('RUMAH_' + category)
    scene.collection.children.link(col)
    cols[category] = col
root = bpy.data.objects.new('RUMAH_Shared_Exterior', None)
cols['Structure'].objects.link(root)
root['shared_model_id'] = 'JOHOR_SS_VIP_RESIDENCE'
root['building_names_json'] = json.dumps(['Kediaman Rasmi Setiausaha Kerajaan Johor', 'Rumah VIP Setiausaha Kerajaan Johor'])
root['post_names_json'] = json.dumps(['Pos Rumah SS', 'Pos Rumah VIP'])
root['accuracy'] = scene['reference_accuracy']
groups = {}
for category in categories:
    if category == 'Presentation': continue
    ob = bpy.data.objects.new('RUMAH_Group_' + category, None)
    cols[category].objects.link(ob)
    ob.parent = root
    groups[category] = ob
batches = defaultdict(lambda: [[], []])

def mesh(name, category, mat, vertices, faces):
    name = name.replace('BDARA_', 'RUMAH_')
    category = {'Shading': 'Ornament'}.get(category, category)
    vs, fs = batches[(name, category, mat)]
    offset = len(vs)
    vs.extend(tuple(v) for v in vertices)
    fs.extend(tuple(offset + i for i in face) for face in faces)

with open(os.path.join(OUT, '..', 'bdara', 'build_bdara.py'), encoding='utf-8') as handle:
    source = ast.parse(handle.read())
helpers = {'enum', 'box', 'extrude', 'cylinder', 'beam', 'strip', 'ellipsoid', 'palm', 'bench', 'car'}
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n, ast.FunctionDef) and n.name in helpers], type_ignores=[]), 'Residence_geometry_helpers', 'exec'))
enum(scene.unit_settings, 'system', 'METRIC')
scene.render.engine = engine
mats = {}
def material(name, color, roughness=.85, metal=0):
    mat = bpy.data.materials.get('RUMAH_' + name) or bpy.data.materials.new('RUMAH_' + name)
    mat.use_nodes = True
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metal
    mat.diffuse_color = (*color, 1)
    mats[name] = mat
for name, color, rough, metal in [
    ('White', (.82,.81,.73), .9,0), ('Trim', (.94,.91,.81), .8,0),
    ('Stone', (.31,.33,.31), .95,0), ('StoneLight', (.43,.45,.40), .95,0),
    ('Mortar', (.52,.52,.46), 1,0), ('RedBase', (.40,.13,.10), .95,0),
    ('Roof', (.34,.12,.065), .9,0), ('TileLight', (.45,.21,.115), .9,0),
    ('TileDark', (.25,.085,.045), .95,0), ('CanopyRed', (.42,.13,.09), .8,.05),
    ('Soffit', (.10,.11,.09), .9,0), ('Wood', (.19,.12,.07), .9,0),
    ('Glass', (.055,.10,.10), .25,.3), ('Frame', (.80,.80,.71), .6,.15),
    ('Recess', (.045,.055,.045), .95,0), ('Shutter', (.48,.50,.43), .85,0),
    ('Asphalt', (.12,.14,.13),1,0), ('Paving', (.44,.19,.14),1,0),
    ('PalePaving', (.61,.59,.49),1,0), ('DarkPaving', (.23,.27,.24),1,0),
    ('Lawn', (.22,.33,.11),1,0), ('Hedge', (.06,.17,.035),1,0),
    ('Leaf', (.055,.16,.035),1,0), ('LeafLight', (.17,.29,.06),1,0),
    ('Conifer', (.035,.105,.055),1,0), ('Trunk', (.25,.19,.12),1,0),
    ('Flower', (.52,.08,.23),.9,0), ('Marking', (.86,.85,.75),.9,0),
    ('Iron', (.035,.05,.045),.65,.45), ('Steel', (.42,.45,.43),.35,.8),
    ('Shade', (.07,.095,.08),.8,.2), ('LampGlass', (.58,.62,.45),.35,.2),
    ('CarWhite', (.75,.77,.71),.35,.3), ('CarSilver', (.33,.37,.36),.3,.5),
    ('CarBlue', (.025,.08,.17),.35,.4), ('CarRed', (.35,.04,.025),.35,.3),
    ('Rubber', (.025,.03,.025),.95,0),
]: material(name, color, rough, metal)

def face(x, y, side='front'):
    if side == 'front': return lambda u,d,z: (x+u,y-d,z)
    if side == 'back': return lambda u,d,z: (x-u,y+d,z)
    if side == 'left': return lambda u,d,z: (x-d,y-u,z)
    return lambda u,d,z: (x+d,y+u,z)

def face_panel(name, category, mat, f, cx, cz, width, height, depth=.10, offset=.05):
    vs = [f(cx+u, offset+d, cz+z) for d in [-depth/2,depth/2] for u,z in [(-width/2,-height/2),(width/2,-height/2),(width/2,height/2),(-width/2,height/2)]]
    mesh(name,category,mat,vs,[(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])

def window(name, f, u, bottom, width=2.0, height=2.0, panes=3, door=False, shutter=False):
    face_panel(name+'_Recess','Glazing','Recess',f,u,bottom+height/2,width+.24,height+.24,.10,.06)
    face_panel(name+'_Glass','Glazing','Glass',f,u,bottom+height/2,width,height,.05,.13)
    for du in [-width/2,width/2]:
        beam(name+'_Frames','Glazing','Frame',f(u+du,.20,bottom-.08),f(u+du,.20,bottom+height+.08),.13,.10)
    for z in [bottom,bottom+height]:
        beam(name+'_Frames','Glazing','Frame',f(u-width/2-.05,.20,z),f(u+width/2+.05,.20,z),.13,.10)
    for i in range(1,panes):
        beam(name+'_Mullions','Glazing','Frame',f(u-width/2+i*width/panes,.21,bottom),f(u-width/2+i*width/panes,.21,bottom+height),.055,.065)
    for j in ([.45,.73] if door else [.5]):
        beam(name+'_Mullions','Glazing','Frame',f(u-width/2,.21,bottom+j*height),f(u+width/2,.21,bottom+j*height),.055,.065)
    face_panel(name+'_Sill','Ornament','Trim',f,u,bottom-.12,width+.36,.14,.28,.15)
    if shutter:
        for du in [-width*.68,width*.68]:
            face_panel(name+'_Shutters','Ornament','Shutter',f,u+du,bottom+height/2,width*.25,height,.07,.20)
            for j in range(int(height/.16)):
                beam(name+'_ShutterLouvres','Ornament','Trim',f(u+du-width*.10,.25,bottom+.08+j*.16),f(u+du+width*.10,.25,bottom+.08+j*.16),.045,.055)

def tile_roof(name, x,y,w,d,z,rise, roofmat='Roof'):
    a,b = w/2,d/2
    ridge = max(0,a-b)
    if w>=d:
        vs=[(x-a,y-b,z),(x+a,y-b,z),(x+a,y+b,z),(x-a,y+b,z),(x-ridge,y,z+rise),(x+ridge,y,z+rise)]
        fs=[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)]
        ridgepoints=[(x-ridge,y,z+rise+.06),(x+ridge,y,z+rise+.06)]
    else:
        ridge=b-a
        vs=[(x-a,y-b,z),(x+a,y-b,z),(x+a,y+b,z),(x-a,y+b,z),(x,y-ridge,z+rise),(x,y+ridge,z+rise)]
        fs=[(0,1,4),(1,2,5,4),(2,3,5),(3,0,4,5)]
        ridgepoints=[(x,y-ridge,z+rise+.06),(x,y+ridge,z+rise+.06)]
    mesh(name,'Roofscape',roofmat,vs,fs)
    box(name+'_Fascia','Roofscape','Soffit',(x,y,z-.13),(w+.10,d+.10,.26))
    # Raised tile courses follow every hip face rather than a flat roof texture.
    inset=min(a,b)
    steps=max(5,int(math.hypot(inset,rise)/.38))
    for j in range(steps):
        t=j/steps
        aa,bb=a-inset*t,b-inset*t
        pts=[(x-aa,y-bb,z+rise*t+.035),(x+aa,y-bb,z+rise*t+.035),(x+aa,y+bb,z+rise*t+.035),(x-aa,y+bb,z+rise*t+.035)]
        for p,q in zip(pts,pts[1:]+pts[:1]):
            beam(name+'_TileCourses','Roofscape','TileLight' if j%4 else 'TileDark',p,q,.055,.065)
    for p,q in [(vs[0],vs[4]),(vs[1],vs[5] if w>=d else vs[4]),(vs[2],vs[5]),(vs[3],vs[4] if w>=d else vs[5]),tuple(ridgepoints)]:
        beam(name+'_RidgeCaps','Roofscape','TileLight',p,q,.18,.16)
    # Subtle tile joints on the two long slopes.
    if w>=d:
        for xx in range(int(-a)+1,int(a)):
            xx=xx*.76
            if abs(xx)>a-.3:continue
            tmax=min(1,(a-abs(xx))/b)
            for sign in [-1,1]:
                beam(name+'_TileJoints','Roofscape','TileDark',(x+xx,y+sign*b,z+.02),(x+xx,y+sign*b*(1-tmax),z+rise*tmax+.02),.023,.025)

def awning(name, x,y,width,base,depth=1.4):
    vs=[(x-width/2,y,base+.65),(x+width/2,y,base+.65),(x+width/2,y-depth,base),(x-width/2,y-depth,base)]
    mesh(name,'Roofscape','Roof',vs,[(0,1,2,3)])
    for j in range(5):
        t=j/4
        beam(name+'_Tiles','Roofscape','TileLight',(x-width/2,y-depth*t,base+.65*(1-t)+.025),(x+width/2,y-depth*t,base+.65*(1-t)+.025),.06,.06)
    for xx in [x-width/2+.16,x+width/2-.16]:
        beam(name+'_Brackets','Ornament','Wood',(xx,y,base-.65),(xx,y-depth*.85,base),.10,.12)

def balcony_rail(name, a,b,z,height=.93):
    a,b=Vector(a),Vector(b)
    count=max(2,int((b-a).length/.32))
    for j in range(count+1):
        p=a.lerp(b,j/count)
        cylinder(name+'_Balusters','Ornament','Trim',p.x,p.y,z,.037,height,6)
    for h,ww in [(0,.10),(.20,.065),(height,.12)]:
        beam(name+'_Rails','Ornament','Trim',(a.x,a.y,z+h),(b.x,b.y,z+h),ww,.10)
    for p in [a,b]:box(name+'_Posts','Ornament','Trim',(p.x,p.y,z+height/2),(.18,.18,height+.14))

def stone_courses(name, f, span, base,height):
    for j in range(int(height/.42)+1):
        zz=base+j*.42
        beam(name+'_BedJoints','Ornament','Mortar',f(-span/2,.04,zz),f(span/2,.04,zz),.022,.025)
        spacing=1.12
        for k in range(int(span/spacing)):
            u=-span/2+(k+.5+(j%2)*.5)*spacing
            if u>span/2:continue
            beam(name+'_VerticalJoints','Ornament','Mortar',f(u,.045,zz),f(u,.045,min(zz+.42,base+height)),.018,.024)

# Long stone-and-plaster main house, facing the paved court.
BASE=4.4
box('RUMAH_MainHouse_StoneLower','Structure','Stone',(0,5,6.65),(48,17,4.5))
box('RUMAH_MainHouse_WhiteUpper','Structure','White',(0,5,11.15),(48,17,4.5))
box('RUMAH_MainHouse_Platform','Structure','StoneLight',(0,5,4.25),(49,18,.40))
for z in [8.92,13.35]:box('RUMAH_MainHouse_Stringcourse','Ornament','Trim',(0,5,z),(48.3,17.3,.22))
tile_roof('RUMAH_MainHouse_HipRoof',0,5,51,20,13.70,4.3)
for f,span in [(face(0,-3.53),48),(face(-24.03,5,'left'),17),(face(24.03,5,'right'),17),(face(0,13.53,'back'),48)]:
    stone_courses('RUMAH_MainHouse_Ashlar',f,span,4.45,4.35)
# Large ground-floor French doors beneath red tiled canopies.
for x in [-16,-4.5,20]:
    window('RUMAH_FrontFrenchDoors',face(0,-3.56),x,4.65,5.4 if x<0 else 3.5,3.25,panes=4 if x<0 else 3,door=True)
    awning('RUMAH_FrenchDoorCanopies',x,-3.8,6.0 if x<0 else 4.3,8.1)
    for i in range(3):box('RUMAH_RedDoorSteps','Entrance','RedBase',(x,-4.2-i*.32,4.15+(.45-i*.12)/2),(5.8 if x<0 else 4.1,.4,.45-i*.12))
for x in [-22,-10,1,22.6]:window('RUMAH_LowerNarrowWindows',face(0,-3.56),x,5.5,.95,1.75,panes=1)
for x in [-16,-4.5,20]:
    ww=4.5 if x<0 else 3.0
    window('RUMAH_UpperBalconyDoors',face(0,-3.56),x,9.55,ww,2.6,panes=3,door=True)
    box('RUMAH_SmallBalconySlabs','Entrance','White',(x,-4.05,9.45),(ww+.5,1.1,.18))
    balcony_rail('RUMAH_SmallBalconies',(x-ww/2-.15,-4.57),(x+ww/2+.15,-4.57),9.55,.85)
    for dx in [-ww/2-.15,ww/2+.15]:balcony_rail('RUMAH_SmallBalconies',(x+dx,-3.65),(x+dx,-4.57),9.55,.85)
for x in [-22,-10,1]:window('RUMAH_UpperNarrowWindows',face(0,-3.56),x,10.1,.95,1.8,panes=1)
for side,xx in [('left',-24.04),('right',24.04)]:
    for yy in [-4,1.5,6]:
        for zz in [5.45,10.1]:window('RUMAH_SideWindows',face(xx,5,side),yy,zz,1.65,1.9,panes=2)
for u in [-20,-13,-6,1,8,15,21]:
    for z in [5.5,10.1]:window('RUMAH_RearWindows',face(0,13.56,'back'),u,z,2.1,1.9,panes=2)
for x in [-23.7,23.7]:
    for y in [-3.55,13.55]:
        for j in range(9):box('RUMAH_StoneQuoins','Ornament','StoneLight',(x,y,4.7+j*.47),(.70,.22,.33))
# Small external AC boxes visible in the reference, purely visual props.
for x,z in [(-20,10.1),(-11,10.1),(0,10.1),(17.5,8.6)]:
    box('RUMAH_ACUnits','Ornament','White',(x,-3.97,z),(1.0,.55,.62))
    for j in range(5):box('RUMAH_ACGrilles','Ornament','Shutter',(x,-4.26,z-.22+j*.10),(.78,.035,.025))

def arch_portal(name,f,u,base,width,height,top):
    r=width/2; spring=base+height-r
    arc=[(u+r*math.cos(math.pi-i*math.pi/24),spring+r*math.sin(math.pi-i*math.pi/24)) for i in range(25)]
    outline=[(u-width/2,top),(u+width/2,top)]+list(reversed(arc))
    n=len(outline)
    vs=[f(x,d,z) for d in [-.16,.16] for x,z in outline]
    mesh(name+'_Spandrels','Entrance','White',vs,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
    points=[(u-width/2,base)]+arc+[(u+width/2,base)]
    for a,b in zip(points,points[1:]):beam(name+'_ArchTrim','Ornament','Trim',f(a[0],.22,a[1]),f(b[0],.22,b[1]),.20,.18)

# Projecting entrance pavilion: open lower arches, upper recessed balcony.
PX=9.0
box('RUMAH_EntrancePavilion_Floor','Entrance','PalePaving',(PX,-7.35,4.49),(11.0,7.7,.18))
for x in [3.8,9,14.2]:
    box('RUMAH_EntrancePavilion_Piers','Entrance','StoneLight',(x,-11,6.6),(.50,.60,4.3))
    for z in [4.7,8.65]:box('RUMAH_EntrancePavilion_PierCaps','Ornament','Trim',(x,-11,z),(.73,.78,.25))
for u in [-2.6,2.6]:arch_portal('RUMAH_PorchFront',face(PX,-11.05),u,4.55,4.5,4.0,9.12)
for sign in [-1,1]:
    box('RUMAH_PorchRearPiers','Entrance','StoneLight',(PX+sign*5.2,-4.0,6.6),(.55,.60,4.3))
    arch_portal('RUMAH_PorchSide',face(PX+sign*5.22,-7.5,'right' if sign>0 else 'left'),0,4.55,5.8,4.0,9.12)
box('RUMAH_EntrancePavilion_BalconySlab','Entrance','White',(PX,-7.3,9.2),(11.1,7.9,.30))
for sign in [-1,1]:
    box('RUMAH_EntranceUpperSideWalls','Structure','White',(PX+sign*5.1,-6.3,11.5),(.36,5.1,4.2))
    window('RUMAH_EntranceUpperSideWindows',face(PX+sign*5.3,-6.3,'right' if sign>0 else 'left'),0,10.0,2.1,2.1,panes=2)
for x in [3.9,14.1]:
    box('RUMAH_EntranceBalconyColumns','Structure','White',(x,-11.0,11.5),(.26,.26,4.2))
balcony_rail('RUMAH_EntranceBalcony',(3.8,-11.15),(14.2,-11.15),9.4,1.0)
for x in [3.8,14.2]:balcony_rail('RUMAH_EntranceBalcony',(x,-11.15),(x,-9.0),9.4,1.0)
window('RUMAH_PorchUpperDoors',face(PX,-3.7),0,9.55,4.2,3.0,panes=3,door=True)
window('RUMAH_PorchGroundDoors',face(PX,-3.7),0,4.65,4.2,3.25,panes=3,door=True)
tile_roof('RUMAH_EntrancePavilion_HipRoof',PX,-7.2,12.5,10,13.75,3.2)
for i in range(3):box('RUMAH_PorchArrivalSteps','Entrance','StoneLight',(PX,-11.45-i*.36,4.0+(.4-i*.12)/2),(11.2,.42,.4-i*.12))

# Immediate two-storey white annex and small linking gallery to the east.
box('RUMAH_EastAnnex','Structure','White',(37,5,8.1),(16,12,8.2))
for z in [4.25,8.1,12.2]:box('RUMAH_EastAnnex_Slabs','Ornament','Trim',(37,5,z),(16.4,12.4,.20))
tile_roof('RUMAH_EastAnnex_HipRoof',37,5,18,14,12.65,3.25)
for u in [-5.5,-1.9,1.9,5.5]:
    window('RUMAH_AnnexUpperWindows',face(37,-1.04),u,9.0,1.6,2.0,panes=3)
    window('RUMAH_AnnexLowerWindows',face(37,-1.04),u,4.6,1.55,2.45,panes=2,door=True)
for side,xx in [('right',45.04),('left',28.96)]:
    for yy in [-3.6,0,3.6]:window('RUMAH_AnnexSideWindows',face(xx,5,side),yy,9.0,1.5,2.0,panes=2)
box('RUMAH_LinkingGallery','Structure','White',(26.4,9,5.85),(5.6,6.4,3.7))
box('RUMAH_LinkingGallery_Parapet','Roofscape','Trim',(26.4,9,7.85),(6.0,6.8,.4))
for u in [-1.8,0,1.8]:window('RUMAH_GalleryWindows',face(26.4,5.76),u,4.7,1.35,2.1,panes=1)

def ground_z(x,y):
    if y < -76:return .05
    if y < -53:return .05+3.95*(y+76)/23
    if y <= 30:return 4.0
    return 4.0-2.2*min(1,(y-30)/108)

def lodge(name,x,y,w,d,height=3.4,red=True,canopy=False):
    base=ground_z(x,y)+.12
    box(name,'Structure','White',(x,y,base+height/2),(w,d,height))
    box(name+'_Foundation','Structure','StoneLight',(x,y,base-.10),(w+.24,d+.24,.60))
    box(name+'_Base','Structure','RedBase' if red else 'StoneLight',(x,y,base+.45),(w+.08,d+.08,.9))
    tile_roof(name+'_HipRoof',x,y,w+2,d+2,base+height+.2,min(d*.35,2.7))
    for side,yy in [('front',y-d/2-.04),('back',y+d/2+.04)]:
        for u in range(-int(w/2)+2,int(w/2),4):window(name+'_Windows',face(x,yy,side),u,base+1.0,1.7,1.55,panes=2,shutter=True)
    window(name+'_Door',face(x,y-d/2-.06),0,base+.12,1.3,2.35,panes=1,door=True)
    if canopy:
        xx=x+w/2+3.4
        for yy in [y-d/2-.2,y+d/2+.2]:
            for px in [x+w/2+.2,xx+3.2]:box(name+'_CarportPosts','Structure','Iron',(px,yy,base+1.7),(.12,.12,3.4))
        awning(name+'_CarportRoof',xx,y+d/2+1,7.2,base+3.1,d+2)
    return base

# Detached service buildings are interpreted from the aerial and side views.
lodge('RUMAH_RearWestLodge',-25,45,29,11,3.7,False,True)
lodge('RUMAH_RearEastLodge',24,75,32,11,3.8,True,True)
lodge('RUMAH_RearNorthLodge',-14,109,33,11,3.6,True,False)
lodge('RUMAH_SmallUtilityPavilion',55,16,7.5,7.5,3.3,False,False)
for xx in [52,55,58]:
    box('RUMAH_UtilityScreenPosts','Structure','Trim',(xx,10.8,5.4),(.12,.12,2.8))
for zz in [4.5+i*.24 for i in range(9)]:box('RUMAH_UtilityLouvreFence','Ornament','Shutter',(55,10.8,zz),(8,.12,.10))

# An open-sided pavilion borders the patterned court.
for yy in [-50,-43,-36,-29,-22]:
    for xx in [-51.5,-44.5]:
        box('RUMAH_CourtPavilion_Posts','Structure','White',(xx,yy,6.0),(.25,.25,4.0))
box('RUMAH_CourtPavilion_Platform','Site','PalePaving',(-48,-36,4.09),(9,30,.18))
box('RUMAH_CourtPavilion_LowWall','Structure','RedBase',(-51.5,-36,4.6),(.24,29,1.1))
tile_roof('RUMAH_CourtPavilion_HipRoof',-48,-36,10.6,32,8.25,2.45)
for xx in [18,24,30,36]:
    for yy in [-15,-20]:box('RUMAH_LowCoveredWalk_Posts','Structure','Wood',(xx,yy,5.5),(.15,.15,3))
tile_roof('RUMAH_LowCoveredWalk_Roof',27,-17.5,20,7,7.2,1.0,'TileDark')

# Contoured ground, retaining walls, paved forecourt and loop drive.
box('RUMAH_SitePlinth','Site','Stone',(0,25,-.65),(148,234,1.3))
xs=[-73,-55,-35,0,35,55,73]
ys=[-91,-76,-65,-53,-30,0,30,55,85,115,141]
vs=[(x,y,ground_z(x,y)) for y in ys for x in xs]
fs=[(j*len(xs)+i,j*len(xs)+i+1,(j+1)*len(xs)+i+1,(j+1)*len(xs)+i) for j in range(len(ys)-1) for i in range(len(xs)-1)]
mesh('RUMAH_SlopingGround','Site','Lawn',vs,fs)
box('RUMAH_PatternedCourt_Base','Site','DarkPaving',(-15,-38.5,4.06),(57,28,.12))
for row in range(7):
    for col in range(14):
        x=-41+col*4;y=-50.4+row*4
        box('RUMAH_PatternedCourt_Tiles','Site','Paving',(x,y,4.15),(3.84,3.84,.06))
for xx in [-43+i*4 for i in range(15)]:box('RUMAH_CourtFineGrid','Site','PalePaving',(xx,-38.5,4.19),(.14,28,.035))
for yy in [-52.4+i*4 for i in range(8)]:box('RUMAH_CourtFineGrid','Site','PalePaving',(-15,yy,4.19),(57,.14,.035))
for xx in [-43.2,-14.8,13.2]:box('RUMAH_CourtPaleBands','Site','PalePaving',(xx,-38.5,4.2),(.50,28,.045))
for yy in [-52.4,-38.5,-24.6]:box('RUMAH_CourtPaleBands','Site','PalePaving',(-15,yy,4.2),(57,.50,.045))
box('RUMAH_ArrivalDrive','Site','Asphalt',(1,-17.1,4.06),(72,13,.12))
# Raised planted island in the arrival loop, with a dark stone curb.
for label,mat,rx,ry,z,h in [('Curb','StoneLight',12.5,4.4,4.1,.27),('Lawn','Lawn',12.2,4.1,4.35,.10)]:
    extrude('RUMAH_ArrivalIsland_'+label,'Site',mat,[(-5+rx*math.cos(i*math.tau/48),-20+ry*math.sin(i*math.tau/48)) for i in range(48)],z,h)
def road(name,points,width):
    # Sample both road edges on the grade so the uphill lane cannot disappear
    # into the terrain where its slope changes.
    samples=[]
    for a,b in zip(points,points[1:]):
        count=max(1,int(math.dist(a,b)/1.5))
        samples.extend((a[0]+(b[0]-a[0])*i/count,a[1]+(b[1]-a[1])*i/count) for i in range(count))
    samples.append(points[-1])
    vertices=[]
    lanes=10
    for i,p in enumerate(samples):
        before=Vector(samples[max(0,i-1)]);after=Vector(samples[min(len(samples)-1,i+1)])
        tangent=(after-before).normalized();normal=Vector((-tangent.y,tangent.x))
        for j in range(lanes+1):
            offset=(j/lanes-.5)*width
            x=p[0]+normal.x*offset;y=p[1]+normal.y*offset
            vertices.append((x,y,ground_z(x,y)+.12))
    stride=lanes+1
    mesh(name,'Site','Asphalt',vertices,[(i*stride+j,(i+1)*stride+j,(i+1)*stride+j+1,i*stride+j+1) for i in range(len(samples)-1) for j in range(lanes)])
frontroad=[(-72,-81),(-48,-81),(-20,-80),(10,-78),(37,-74),(53,-66),(54,-55),(44,-44),(34,-25),(35,-10)]
road('RUMAH_CurvedArrivalRoad',frontroad,7.5)
rearroad=[(35,-10),(49,0),(49,30),(44,47),(46,68),(44,91),(34,126),(1,131),(-42,125),(-52,95),(-48,67),(-42,39),(-37,15),(-35,-13)]
road('RUMAH_RearLoopDrive',rearroad,5.4)
box('RUMAH_FrontParkingApron','Site','Asphalt',(31,-42,4.07),(14,27,.14))
for yy in [-53,-48.5,-44,-39.5,-35,-30.5]:box('RUMAH_ParkingBayLines','Site','Marking',(31,yy,4.16),(6.2,.10,.025))
for name,x,y,w,d in [('West',-4,43,10,13),('East',46,75,12,17),('North',6,109,10,14),('Annex',43,-4,15,7)]:
    box('RUMAH_'+name+'ServiceApron','Site','Asphalt',(x,y,ground_z(x,y)+.08),(w,d,.12))
# Retaining wall and iron boundary fence along the hill front and west edge.
for a,b in [((-65,-56),(-27,-56)),((-24,-56),(13,-56)),((25,-56),(44,-56))]:
    beam('RUMAH_FrontRetainingWall','Site','Stone',(*a,2.5),(*b,2.5),.8,3.05)
    beam('RUMAH_RetainingWallCaps','Site','Trim',(*a,4.08),(*b,4.08),1,.16)
    count=int(math.dist(a,b)/.40)
    for i in range(count+1):
        t=i/max(1,count);x=a[0]+(b[0]-a[0])*t;y=a[1]
        beam('RUMAH_IronFencePickets','Site','Iron',(x,y,4.15),(x,y,5.65),.045)
    for z in [4.5,5.45]:beam('RUMAH_IronFenceRails','Site','Iron',(*a,z),(*b,z),.06)
# White balustraded landscape stair, descending from the raised lawn.
for i in range(19):
    yy=-72+i*.84;top=.12+(i+1)*3.92/19
    box('RUMAH_WhiteLandscapeStair_Treads','Entrance','PalePaving',(20,yy,top/2),(5.4,.90,top))
for side in [-1,1]:
    for i in range(0,20,3):
        yy=-72+i*.84;zz=.12+(i+1)*3.92/19
        box('RUMAH_LandscapeStair_Newels','Entrance','Trim',(20+side*2.7,yy,zz+.6),(.32,.32,1.2))
        box('RUMAH_LandscapeStair_NewelCaps','Entrance','Trim',(20+side*2.7,yy,zz+1.22),(.45,.45,.12))
    for i in range(38):
        yy=-72+i*.42;zz=.12+(i/2+1)*3.92/19
        cylinder('RUMAH_LandscapeStair_Balusters','Entrance','Trim',20+side*2.7,yy,zz+.05,.055,.95,7)
    beam('RUMAH_LandscapeStair_Handrails','Entrance','Trim',(20+side*2.7,-72,1.22),(20+side*2.7,-56,5.15),.18,.15)
box('RUMAH_StairTopPath','Site','PalePaving',(20,-54.7,4.08),(5.8,3.7,.16))
# Exterior entrance walls and pale inset sign panels, without invented lettering.
for xx,yy in [(45,-72),(60,-63)]:
    z=ground_z(xx,yy)
    box('RUMAH_ApproachWallPiers','Entrance','Stone',(xx,yy,z+1.8),(1.3,1.3,3.6))
    box('RUMAH_ApproachPierCaps','Entrance','Trim',(xx,yy,z+3.62),(1.6,1.6,.22))
    box('RUMAH_EntranceWallPanels','Entrance','Stone',(xx-3.8,yy,z+1.4),(6.8,.7,2.8))
    box('RUMAH_PaleInsetPanels','Entrance','White',(xx-3.8,yy-.40,z+1.5),(5.8,.12,2.1))

rng=random.Random(2510264)
def tree(x,y,height=14,conifer=False):
    z=ground_z(x,y)
    cylinder('RUMAH_TreeTrunks','Landscape','Trunk',x,y,z,.25 if conifer else .45,height*.62,10)
    if conifer:
        for dx,dy,zz,r in [(0,0,.61,.22),(-.13,.04,.72,.18),(.13,-.03,.76,.17),(0,0,.87,.14)]:
            ellipsoid('RUMAH_UprightConifers','Landscape','Conifer',(x+dx*height,y+dy*height,z+zz*height),(r*height,r*height*.75,height*.30),12,9)
    else:
        for dx,dy,zz,r in [(-.20,0,.72,.29),(.20,.06,.78,.30),(0,-.06,.91,.34)]:
            ellipsoid('RUMAH_MatureShadeCrowns','Landscape','Leaf' if dx<0 else 'LeafLight',(x+dx*height,y+dy*height,z+zz*height),(r*height,r*height*.9,height*.20),14,8)
def hedge(x,y,rx=1.5,ry=1.2,height=1.1,flower=False):
    z=ground_z(x,y)
    ellipsoid('RUMAH_ClippedShrubs','Landscape','Hedge',(x,y,z+height*.65),(rx,ry,height*.65),12,7)
    if flower:
        for i in range(12):
            a=i*math.tau/12
            ellipsoid('RUMAH_FlowerBeds','Landscape','Flower',(x+rx*.9*math.cos(a),y+ry*.9*math.sin(a),z+.45),(.25,.24,.20),6,4)
for x,y,h in [(-55,-13,18),(-47,2,21),(-54,21,20),(-40,-54,18),(-24,-58,19),(-8,-57,17),(-60,48,17),(-57,76,18),(-49,114,21),(58,120,19),(61,90,19),(61,48,18),(59,4,19),(55,-29,17)]:
    tree(x,y,h,conifer=x<0 and y<25)
for x,y in [(-66,-61),(-66,-30),(-62,7),(-65,35),(-66,66),(-63,99),(-47,136),(-20,139),(10,138),(39,137),(67,118),(68,72),(66,21)]:
    tree(x,y,16+rng.random()*4)
for x,y in [(20,24),(3,48),(-7,81),(14,94),(-32,77),(-3,124),(34,30)]:tree(x,y,12+rng.random()*3)
for x,y,h in [(-21,-10,9),(-28,-7,10),(18,-8,9),(40,-20,11),(46,-21,12),(41,-16,10),(-33,-34,8)]:
    start={key:len(value[0]) for key,value in batches.items()}
    palm(x,y,h)
    z=ground_z(x,y)
    for key,(vs,fs) in batches.items():
        for j in range(start.get(key,0),len(vs)):vs[j]=(vs[j][0],vs[j][1],vs[j][2]+z)
for x,y in [(-11,-20),(1,-20),(37,-18),(41,-24),(-34,-18),(17,-7),(50,13),(-37,33),(28,64),(-20,97)]:hedge(x,y,2.0,1.55,1.45,flower=True)
for x in range(-42,11,4):hedge(x,-54,1.9,.7,.65)
for x,y in [(-54,-20),(-54,-48),(15,-48),(15,-31)]:hedge(x,y,1.5,1.3,1.2)
for x,y in [(-13,-10),(-2,-10),(21,-4),(2,-11)]:
    z=ground_z(x,y)
    cylinder('RUMAH_PlanterPots','Landscape','StoneLight',x,y,z,.55,.75,12)
    ellipsoid('RUMAH_PotPlants','Landscape','Leaf',(x,y,z+1.0),(.8,.8,.7),10,6)

def elevated_car(x,y,heading=0,color='CarSilver'):
    start={key:len(value[0]) for key,value in batches.items()}
    car(x,y,heading,color)
    for key,(vs,fs) in batches.items():
        for j in range(start.get(key,0),len(vs)):vs[j]=(vs[j][0],vs[j][1],vs[j][2]+ground_z(x,y))
for i,yy in enumerate([-51,-42,-33]):elevated_car(31,yy,90,['CarWhite','CarSilver','CarBlue'][i])
for x,y,heading in [(46,76,90),(47,81,90),(-4,44,0),(1,111,0),(42,-4,90)]:elevated_car(x,y,heading)
for x,y in [(-31,-17),(25,-25),(37,-51),(-39,-67),(7,-68),(49,35),(45,91)]:
    z=ground_z(x,y)
    cylinder('RUMAH_TraditionalLampPosts','StreetFurniture','Iron',x,y,z,.075,4.5,10)
    for sign in [-1,1]:
        beam('RUMAH_LampArms','StreetFurniture','Iron',(x,y,z+4.1),(x+sign*.7,y,z+4.7),.07)
        box('RUMAH_LampLanterns','StreetFurniture','LampGlass',(x+sign*.7,y,z+4.7),(.35,.35,.55))
        box('RUMAH_LampCaps','StreetFurniture','Iron',(x+sign*.7,y,z+5.01),(.50,.50,.12))
for x,y in [(-12,-19),(6,-19)]:
    start={key:len(value[0]) for key,value in batches.items()};bench(x,y)
    for key,(vs,fs) in batches.items():
        for j in range(start.get(key,0),len(vs)):vs[j]=(vs[j][0],vs[j][1],vs[j][2]+4.0)

# Build component/material batches, leaving editable semantic parts.
counts=Counter(key[0] for key in batches)
for (name,category,mat),(vs,fs) in batches.items():
    center=Vector(tuple((min(v[i] for v in vs)+max(v[i] for v in vs))/2 for i in range(3)))
    data=bpy.data.meshes.new(name+'_'+mat+'_Mesh')
    data.from_pydata([tuple(Vector(v)-center) for v in vs],[],fs)
    data.materials.append(mats[mat]);data.update()
    assert not data.validate(),name
    ob=bpy.data.objects.new(name+'_'+mat if counts[name]>1 else name,data)
    cols[category].objects.link(ob);ob.location=center;ob.parent=groups[category]
    ob['component']=category
    ob['reference_model']='rumah-ss-vip-photo-study-20261025'
    if category=='Landscape' and any(s in name for s in ['Crowns','Trunks','Conifers','Shrubs']):
        for polygon in data.polygons:polygon.use_smooth=True
world=bpy.data.worlds.get('RUMAH_Daylight') or bpy.data.worlds.new('RUMAH_Daylight')
world.use_nodes=True
node=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
node.inputs['Color'].default_value=(.65,.72,.79,1);node.inputs['Strength'].default_value=.65
scene.world=world
assert 'SUN' in {i.identifier for i in bpy.types.Light.bl_rna.properties['type'].enum_items}
light=bpy.data.lights.new('RUMAH_Sun','SUN');light.energy=2.2;light.angle=.15
sun=bpy.data.objects.new('RUMAH_Sun',light);cols['Presentation'].objects.link(sun)
sun.rotation_euler=(math.radians(32),math.radians(-22),math.radians(-25))
camera=bpy.data.cameras.new('RUMAH_PresentationCamera')
cam=bpy.data.objects.new('RUMAH_PresentationCamera',camera);cols['Presentation'].objects.link(cam)
cam.location=(172,-208,190)
cam.rotation_euler=(Vector((0,25,4))-cam.location).to_track_quat('-Z','Y').to_euler()
enum(camera,'type','ORTHO');camera.ortho_scale=299;camera.clip_end=1500
scene.camera=cam
scene.render.resolution_x=1700;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
enum(scene.render.image_settings,'file_format','PNG')
scene.render.filepath=os.path.join(OUT,'Rumah_SS_VIP_exterior_preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,25,4)
        area.spaces.active.region_3d.view_distance=235
        area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
        enum(area.spaces.active.shading,'color_type','MATERIAL')
        area.spaces.active.overlay.show_overlays=False
for ob in scene.objects:ob.select_set(ob==root)
bpy.context.view_layer.objects.active=root
scene['estimated_dimensions']='Approximate site plinth 148 x 234 m; main house 48 x 17 m. Not surveyed.'
print(json.dumps({'scene':scene.name,'meshes':sum(o.type=='MESH' for o in scene.objects),'shared_model_id':root['shared_model_id'],'operational_coordinates':None}))
