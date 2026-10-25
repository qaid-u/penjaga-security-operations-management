"""Bangunan Sultan Ismail, Kota Iskandar: photograph-derived exterior.

Owned, separate Blender scene. Front faces -Y, Z up; approximate metres.
No internal plans, room allocations or operational positions are inferred.
"""
import ast
import bpy
import math
import os
import json
import random
from collections import defaultdict, Counter
from mathutils import Vector

OUT=os.path.dirname(os.path.abspath(__file__))
NAME='BSI_KotaIskandar_Exterior_Study'
engine=bpy.context.scene.render.engine
old=bpy.data.scenes.get(NAME)
if old:assert old.get('bsi_generated'), 'A user-owned scene already uses this name.'
scene=bpy.data.scenes.new(NAME+'_Build' if old else NAME)
bpy.context.window.scene=scene
if old:
    for ob in list(old.objects):bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.scenes.remove(old)
    scene.name=NAME
scene['bsi_generated']=True
scene['building_name']='Bangunan Sultan Ismail (BSI), Kota Iskandar'
scene['reference_accuracy']='Photograph-derived exterior; dimensions and concealed connections are interpretive, not surveyed.'
scene['orientation']='Front -Y; Z up; approximate metres. No internal security coordinates.'
scene.render.engine=engine
categories=['Structure','Roofscape','Glazing','Ornament','Entrance','Site','Landscape','StreetFurniture','Presentation']
cols={}
for category in categories:
    name='BSI_'+category
    col=bpy.data.collections.get(name) or bpy.data.collections.new(name)
    scene.collection.children.link(col)
    cols[category]=col
root=bpy.data.objects.new('BSI_Exterior',None)
cols['Structure'].objects.link(root)
root['building']=scene['building_name']
root['building_id']='BSI_KOTA_ISKANDAR'
root['accuracy']=scene['reference_accuracy']
groups={}
for category in categories:
    if category=='Presentation':continue
    ob=bpy.data.objects.new('BSI_Group_'+category,None)
    cols[category].objects.link(ob)
    ob.parent=root
    groups[category]=ob

batches=defaultdict(lambda:[[],[]])
def mesh(name,category,mat,vertices,faces):
    name=name.replace('BDARA_','BSI_').replace('SUK_','BSI_')
    category={'Roofs':'Roofscape','Shading':'Ornament'}.get(category,category)
    vs,fs=batches[(name,category,mat)]
    offset=len(vs)
    vs.extend(tuple(v) for v in vertices)
    fs.extend(tuple(offset+i for i in face) for face in faces)

with open(os.path.join(OUT,'..','bdara','build_bdara.py'),encoding='utf-8') as handle:
    source=ast.parse(handle.read())
helpers={'enum','box','extrude','cylinder','beam','strip','ellipsoid','palm','bench','car'}
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in helpers],type_ignores=[]),'BSI_geometry_helpers','exec'))
with open(os.path.join(OUT,'..','suk','build_suk.py'),encoding='utf-8') as handle:
    source=ast.parse(handle.read())
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name=='hip'],type_ignores=[]),'BSI_hip_helper','exec'))
enum(scene.unit_settings,'system','METRIC')
mats={}
def material(name,color,roughness=.8,metal=0):
    mat=bpy.data.materials.get('BSI_'+name) or bpy.data.materials.new('BSI_'+name)
    mat.use_nodes=True
    shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Metallic'].default_value=metal
    mat.diffuse_color=(*color,1)
    mats[name]=mat

for name,color,roughness,metal in [
    ('Sand',(.54,.42,.27),.9,0),('Cream',(.73,.64,.45),.85,0),
    ('Trim',(.91,.84,.65),.8,0),('PaleTrim',(.91,.84,.65),.8,0),
    ('Stone',(.38,.34,.27),.95,0),('Peach',(.62,.45,.30),.9,0),
    ('Terracotta',(.40,.16,.075),.9,0),('RoofEdge',(.56,.29,.14),.9,0),
    ('RoofPale',(.65,.64,.54),.65,.2),('RoofSeam',(.77,.76,.66),.65,.25),
    ('RoofDark',(.15,.18,.17),.75,.2),('Glass',(.065,.13,.14),.25,.35),
    ('DomeGlass',(.12,.22,.24),.24,.45),('DomeFrame',(.49,.51,.43),.45,.55),
    ('Recess',(.055,.045,.028),.95,0),('Jali',(.69,.58,.38),.9,0),
    ('Gold',(.62,.39,.065),.34,.7),('Wood',(.20,.13,.065),.9,0),
    ('Shade',(.13,.15,.11),.75,.25),('Paving',(.47,.33,.24),.95,0),
    ('PalePaving',(.79,.75,.59),.95,0),('Pattern',(.12,.15,.12),.9,0),
    ('StarRed',(.55,.18,.12),.95,0),('Asphalt',(.13,.15,.15),1,0),
    ('Marking',(.86,.85,.74),.85,0),('Lawn',(.20,.32,.10),1,0),
    ('Hedge',(.065,.18,.035),1,0),('YellowPlant',(.58,.61,.055),1,0),
    ('Flower',(.44,.095,.12),1,0),('Leaf',(.055,.16,.04),1,0),
    ('LeafLight',(.20,.32,.065),1,0),('Trunk',(.32,.23,.13),1,0),
    ('Water',(.09,.24,.23),.24,.3),('Steel',(.40,.45,.42),.3,.8),
    ('Iron',(.055,.065,.055),.7,.45),('CarWhite',(.80,.82,.77),.35,.3),
    ('CarSilver',(.32,.38,.39),.3,.55),('CarBlue',(.035,.13,.23),.35,.4),
    ('CarRed',(.33,.05,.035),.35,.3),('Rubber',(.03,.035,.03),.95,0),
]:material(name,color,roughness,metal)

def facade(x,y,orientation='front'):
    # u runs across a face, depth is outward from that face.
    if orientation=='front':return lambda u,d,z:(x+u,y-d,z)
    if orientation=='back':return lambda u,d,z:(x-u,y+d,z)
    if orientation=='left':return lambda u,d,z:(x-d,y-u,z)
    return lambda u,d,z:(x+d,y+u,z)

def vertical_poly(name,category,mat,points,face,depth=.12,offset=0):
    n=len(points)
    vs=[face(u,d,z) for d in [offset-depth/2,offset+depth/2] for u,z in points]
    fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    fs.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    mesh(name,category,mat,vs,fs)

def profile(kind,width,height,base=0,cx=0):
    if kind=='ogee':
        # Bell/cusped portal: straight lower jambs, narrow shoulders and an ogee head.
        half=[(-.5,0),(-.5,.46),(-.45,.47),(-.39,.50),(-.34,.57),(-.30,.69),(-.27,.81),(-.22,.91),(-.14,.975),(0,1)]
        pts=half+[(-x,z) for x,z in reversed(half[:-1])]
        return [(cx+x*width,base+z*height) for x,z in pts]
    radius=width/2
    if kind=='pointed':
        pts=[(-.5,0),(-.5,.54),(-.47,.65),(-.37,.77),(-.21,.90),(0,1),(.21,.90),(.37,.77),(.47,.65),(.5,.54),(.5,0)]
        return [(cx+x*width,base+z*height) for x,z in pts]
    if kind=='horseshoe':
        spring=base+height-radius
        pts=[(cx-width*.36,base)]
        pts.extend((cx+radius*math.cos(math.radians(220-i*260/28)),spring+radius*math.sin(math.radians(220-i*260/28))) for i in range(29))
        pts.append((cx+width*.36,base))
        return pts
    spring=base+height-radius
    steps=12 if width<2 else 24
    return [(cx-radius,base)]+[(cx+radius*math.cos(math.pi-i*math.pi/steps),spring+radius*math.sin(math.pi-i*math.pi/steps)) for i in range(steps+1)]+[(cx+radius,base)]

def outline_band(name,points,face,mat='Trim',width=.20,offset=.15,closed=False):
    pairs=list(zip(points,points[1:]))
    if closed:pairs.append((points[-1],points[0]))
    for a,b in pairs:
        beam(name,'Ornament',mat,face(a[0],offset,a[1]),face(b[0],offset,b[1]),width,.24)

def window_arch(name,face,cx,base,width,height,kind='horseshoe',grid=False):
    pts=profile(kind,width,height,base,cx)
    vertical_poly(name+'_Recess','Glazing','Recess',pts,face,.10,.025)
    outline_band(name+'_Trim',pts,face,width=.22,offset=.17,closed=True)
    if grid:
        for u in [cx-width*.24,cx,cx+width*.24]:
            beam(name+'_Mullions','Glazing','DomeFrame',face(u,.11,base+.15),face(u,.11,base+height-width*.50),.06)
        for j in range(1,int((height-width*.5)/1.0)):
            z=base+j
            beam(name+'_Mullions','Glazing','DomeFrame',face(cx-width*.34,.11,z),face(cx+width*.34,.11,z),.055)

def column(name,face,u,base,height,r=.19):
    p=face(u,.35,base)
    cylinder(name+'_Shaft','Ornament','Trim',p[0],p[1],base,r,height,10)
    for z,size,h,mat in [(base+.14,r*3.6,.28,'Stone'),(base+.45,r*3.1,.22,'Cream'),(base+height-.15,r*3.3,.30,'Cream')]:
        box(name+'_Capitals','Ornament',mat,(p[0],p[1],z),(size,size,h))

def facade_row(name,face,span,count,base=4.2,height=8.5,kind='horseshoe',width=None):
    spacing=span/count
    opening=width or spacing*.60
    for i in range(count):
        u=(i-(count-1)/2)*spacing
        window_arch(name,face,u,base,opening,height,kind,True)
    for i in range(count+1):
        u=(i-count/2)*spacing
        for du in [-.19,.19]:column(name,face,u+du,base-.25,height*.58,.15)

def finial(x,y,z,height=3.0,label='BSI_Finials'):
    cylinder(label,'Ornament','Gold',x,y,z,.16,height*.65,10)
    for t,r in [(.1,.35),(.26,.26),(.43,.20),(.60,.13)]:
        ellipsoid(label,'Ornament','Gold',(x,y,z+height*t),(r,r,r*.65),10,5)
    beam(label,'Ornament','Gold',(x,y,z+height*.55),(x,y,z+height),.065)

def cupola(x,y,z,size=5.5):
    box('BSI_Cupolas_Body','Structure','Cream',(x,y,z+1.2),(size,size,2.4))
    for orientation,dx,dy in [('front',0,-size/2-.02),('back',0,size/2+.02),('left',-size/2-.02,0),('right',size/2+.02,0)]:
        face=facade(x+dx,y+dy,orientation)
        for u in [-size*.24,0,size*.24]:window_arch('BSI_CupolaArcades',face,u,z+.30,size*.20,1.55,'round')
    box('BSI_Cupolas_Cornices','Ornament','Trim',(x,y,z+2.55),(size+1.25,size+1.25,.35))
    hip('BSI_Cupolas_Roof',x,y,size+1.4,size+1.4,z+2.8,1.25)
    finial(x,y,z+4.05,2.0)

def mass(name,x,y,width,depth,base,height,rise):
    box(name,'Structure','Cream',(x,y,base+height/2),(width,depth,height))
    box(name+'_Plinth','Structure','Sand',(x,y,base),(width+.5,depth+.5,1.4))
    for z,extra in [(base+2.0,.35),(base+height-.25,.8),(base+height+.35,1.4)]:
        box(name+'_Cornices','Ornament','Trim',(x,y,z),(width+extra,depth+extra,.30))
    hip(name+'_Roof',x,y,width+1.1,depth+1.1,base+height+.5,rise)

# Four outer blocks, galleries and the open side gardens seen in the aerial.
for side,sign in [('West',-1),('East',1)]:
    for row,cy,w,d,h in [('Rear',60,34,46,14.5),('Front',-13,29,54,13.5)]:
        cx=sign*83
        name='BSI_'+side+'_'+row+'Wing'
        mass(name,cx,cy,w,d,3.0,h,4.2)
        facade_row(name+'_OuterArcade',facade(cx+sign*(w/2+.10),cy,'right' if sign>0 else 'left'),d-2,7,4.0,8.0)
        facade_row(name+'_InnerArcade',facade(cx-sign*(w/2+.10),cy,'left' if sign>0 else 'right'),d-2,7,4.0,8.0)
        facade_row(name+'_EndArcade',facade(cx,cy-d/2-.10),w-2,4,4.0,8.0)
        cupola(cx,cy-d/2+3,3.0+h,5.3)
        cupola(cx,cy+d/2-3,3.0+h,5.3)
    mass('BSI_'+side+'_RearGallery',sign*50,43,36,10,3.0,9.5,2.5)
    mass('BSI_'+side+'_FrontGallery',sign*48,-11,45,10,3.0,9.5,2.5)
    mass('BSI_'+side+'_SideGallery',sign*64,20,9,36,3.0,9.3,2.2)
    facade_row('BSI_'+side+'_GalleryArcades',facade(sign*48,-16.15),43,7,3.5,6.7)
    facade_row('BSI_'+side+'_GalleryArcades',facade(sign*50,37.85),34,6,3.5,6.7)
    box('BSI_SideCourtyardPaving','Site','PalePaving',(sign*49,19,2.48),(24,34,.16))
    box('BSI_SideCourtyardLawns','Site','Lawn',(sign*49,19,2.58),(18,27,.12))

# Large square hall and the shallow oval lattice skylight.
box('BSI_MainHall_Podium','Structure','Sand',(0,29,3.1),(78,76,2.2))
box('BSI_MainHall','Structure','Cream',(0,29,12.5),(68,64,17.0))
for zz in [5.0,18.6,21.2]:box('BSI_MainHall_Cornices','Ornament','Trim',(0,29,zz),(70,66,.45))
for sign in [-1,1]:
    facade_row('BSI_MainHall_SideArcades',facade(sign*34.12,29,'right' if sign>0 else 'left'),60,8,5.0,11.5)
facade_row('BSI_MainHall_RearArcades',facade(0,61.12,'back'),63,9,5.0,11.5)
roof_bottom=[(-36,-5,21.5),(36,-5,21.5),(36,63,21.5),(-36,63,21.5)]
roof_top=[(-25,10,27.0),(25,10,27.0),(25,48,27.0),(-25,48,27.0)]
mesh('BSI_MainHall_PyramidalRoof','Roofscape','RoofPale',roof_bottom+roof_top,[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)])
for i in range(4):
    a,b=Vector(roof_bottom[i]),Vector(roof_bottom[(i+1)%4])
    c,d=Vector(roof_top[i]),Vector(roof_top[(i+1)%4])
    for j in range(23):
        t=j/22
        beam('BSI_MainRoof_Seams','Roofscape','RoofSeam',a.lerp(b,t),c.lerp(d,t),.045,.055)
for x in [-31,31]:
    for y in [0,58]:cupola(x,y,23.0,5.7)

def lattice_dome(name,cx,cy,rx,ry,base,rise,sectors=56,rings=8,octagonal=False):
    vs=[]
    for j in range(rings):
        rho=1-j/rings
        for i in range(sectors):
            a=math.tau*(i+(j%2)*.5)/sectors
            shape=math.cos(math.pi/8)/math.cos((a%(math.pi/4))-math.pi/8) if octagonal else 1
            vs.append((cx+rx*rho*shape*math.cos(a),cy+ry*rho*shape*math.sin(a),base+rise*(1-rho*rho)))
    top=len(vs);vs.append((cx,cy,base+rise))
    faces=[]
    for j in range(rings-1):
        for i in range(sectors):
            a=j*sectors+i;b=j*sectors+(i+1)%sectors
            c=(j+1)*sectors+i;d=(j+1)*sectors+(i+1)%sectors
            faces.extend([(a,b,d),(a,d,c)])
    faces.extend(((rings-1)*sectors+i,(rings-1)*sectors+(i+1)%sectors,top) for i in range(sectors))
    mesh(name+'_Glass','Glazing','DomeGlass',vs,faces)
    edges={tuple(sorted((f[i],f[(i+1)%3]))) for f in faces for i in range(3)}
    for a,b in edges:beam(name+'_Lattice','Roofscape','DomeFrame',vs[a],vs[b],.065,.075)
    perimeter=vs[:sectors]+vs[:1]
    for a,b in zip(perimeter,perimeter[1:]):beam(name+'_Rim','Roofscape','Trim',a,b,.22,.25)
lattice_dome('BSI_MainOvalSkylight',0,29,23.5,16,27.15,5.6)

# Smaller octagonal front volume, with a separate polygonal glazed cap.
OCT_Y=-24
outline=[(27*math.cos(math.pi/8+i*math.tau/8),OCT_Y+27*math.sin(math.pi/8+i*math.tau/8)) for i in range(8)]
extrude('BSI_OctagonalHall_Podium','Structure','Sand',[(x*1.07,OCT_Y+(y-OCT_Y)*1.07) for x,y in outline],2.4,2.0)
extrude('BSI_OctagonalHall','Structure','Cream',outline,4.0,13.8)
outer=[(x*1.04,OCT_Y+(y-OCT_Y)*1.04,18.0) for x,y in outline]
inner=[(x*16/27,OCT_Y+(y-OCT_Y)*16/27,21.5) for x,y in outline]
mesh('BSI_OctagonalHall_Roof','Roofscape','RoofDark',outer+inner,[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)])
for a,b in zip(outline,outline[1:]+outline[:1]):
    a,b=Vector(a),Vector(b)
    mid=(a+b)/2;tangent=(b-a).normalized();normal=Vector((tangent.y,-tangent.x))
    face=lambda u,d,z,mid=mid,tangent=tangent,normal=normal:(mid.x+tangent.x*u+normal.x*d,mid.y+tangent.y*u+normal.y*d,z)
    if normal.y<-.9:
        for u in [-7.0,7.0]:window_arch('BSI_OctagonalFrontArcades',face,u,4.8,3.5,9.8,'horseshoe',True)
        window_arch('BSI_OctagonalEntranceRecess',face,0,4.1,8.0,9.5,'pointed',False)
    else:
        facade_row('BSI_OctagonalArcades',face,(b-a).length-1,3,4.8,9.8,width=4.5)
lattice_dome('BSI_OctagonalSkylight',0,OCT_Y,15.4,15.4,21.6,4.0,48,7,True)
for sign in [-1,1]:
    for yy in [-42,-6]:cupola(sign*21.5,yy,17.8,5.3)

# Axial gallery: real open passage rather than a solid block behind the gate.
box('BSI_AxialEntryGallery','Structure','Cream',(0,-59,12.75),(13,25,.50))
box('BSI_EntryGalleryFloor','Entrance','Stone',(0,-59,2.47),(13,25,.16))
for sign in [-1,1]:
    box('BSI_EntryGallerySideWalls','Structure','Cream',(sign*6.2,-59,7.45),(.65,25,10.1))
    box('BSI_GalleryInnerShadowWalls','Entrance','Wood',(sign*5.84,-59,7.4),(.08,24,9.6))
box('BSI_GalleryShadowCeiling','Entrance','Recess',(0,-59,12.4),(12,24,.12))
box('BSI_GalleryRecessedDoorway','Entrance','Recess',(0,-47.2,7.4),(12,.16,10.0))
hip('BSI_AxialEntryGallery_Roof',0,-59,14.1,26.1,13.1,2.6)
for i in range(8):
    top=2.4+(i+1)*.2
    box('BSI_GalleryApproachSteps','Entrance','Stone',(0,-56.5+i*.85,(top+2.4)/2),(9,.90,top-2.4))
box('BSI_GalleryRaisedLanding','Entrance','Stone',(0,-49.2,3.2),(10,2.0,1.6))
for sign in [-1,1]:
    facade_row('BSI_EntryGalleryArcades',facade(sign*6.65,-59,'right' if sign>0 else 'left'),22,4,3.0,7.5)

TY=-76
BASE=2.4
# True open ground passage: piers and arch spandrels, with no filled gate plane.
for x in [-6.1,6.1]:
    for y in [TY-5.8,TY+5.8]:
        box('BSI_EntryTower_GroundPiers','Entrance','Sand',(x,y,8.1),(1.35,1.35,11.4))
box('BSI_EntryTower_UpperLintel','Structure','Sand',(0,TY,14.2),(13.6,13.6,1.6))
box('BSI_EntryTower_Shaft','Structure','Sand',(0,TY,27.0),(13.6,13.6,25.0))
for sign in [-1,1]:
    for yy in [TY-6.95,TY+6.95]:
        box('BSI_TowerPilasters','Ornament','Cream',(sign*6.1,yy,28.2),(1.1,.55,20.6))

def portal(name,face,cx,width,height,top=14.7):
    pts=profile('ogee',width,height,BASE,cx)
    outline_band(name+'_Trim',pts,face,width=.32,offset=.25)
    # Infill only above the curved head, keeping the actual passage open below.
    upper=pts[1:-1]
    for a,b in zip(upper,upper[1:]):
        if b[0]-a[0]<.0001:continue
        vertical_poly(name+'_Spandrels','Entrance','Cream',[a,b,(b[0],top),(a[0],top)],face,.65,0)
for orientation,dy in [('front',-6.95),('back',6.95)]:
    face=facade(0,TY+dy,orientation)
    for cx,w,h in [(-4.3,2.5,7.4),(0,4.1,9.8),(4.3,2.5,7.4)]:portal('BSI_EntryPortal',face,cx,w,h)
    for u in [-6.1,-2.55,2.55,6.1]:
        for du in [-.19,.19]:column('BSI_EntryPortalColumns',face,u+du,BASE,4.8,.18)
for sign in [-1,1]:
    face=facade(sign*6.95,TY,'right' if sign>0 else 'left')
    portal('BSI_SidePortal',face,0,9.6,10.0)

def cornice(name,z,width,depth,height=.45):
    box(name,'Ornament','Trim',(0,TY,z),(width,depth,height))
cornice('BSI_Tower_MidCanopy',16.3,21,21,.65)
cornice('BSI_Tower_MidCornice',16.9,19,19,.26)
for orientation,dx,dy in [('front',0,-6.8),('back',0,6.8),('left',-6.8,0),('right',6.8,0)]:
    face=facade(dx,TY+dy,orientation)
    for u in [-5.8,-3.8,-1.8,1.8,3.8,5.8]:
        vertical_poly('BSI_TowerCanopyBrackets','Ornament','Cream',[(u-.10,14.1),(u+.10,14.1),(u+.10,16.0),(u-.10,16.0)],face,2.7,1.35)
    for u in [-3.1,0,3.1]:window_arch('BSI_TowerUpperLoggia',face,u,34.0,2.55,4.1,'round')
    for u in [-4.6,-1.55,1.55,4.6]:column('BSI_TowerUpperColumns',face,u,34,2.5,.15)
    if orientation in ['front','back']:
        for u in [-3.3,0,3.3]:window_arch('BSI_TowerMiddleLoggia',face,u,24.0,2.5,4.4,'pointed')
        box('BSI_TowerBalconySlab','Ornament','Trim',(0,TY+(-7.8 if orientation=='front' else 7.8),23.8),(10.8,3.1,.38))
        hip('BSI_TowerMiniBalconyRoof',0,TY+(-8 if orientation=='front' else 8),4.4,3.3,26.2,1.4)

def point_inside(x,z,polygon):
    hit=False
    for (ax,az),(bx,bz) in zip(polygon,polygon[1:]+polygon[:1]):
        if (az>z)!=(bz>z) and x<(bx-ax)*(z-az)/(bz-az)+ax:hit=not hit
    return hit
for sign in [-1,1]:
    face=facade(sign*6.95,TY,'right' if sign>0 else 'left')
    pts=profile('horseshoe',9.5,12,18)
    vertical_poly('BSI_TowerJali_Recess','Glazing','Recess',pts,face,.12,.02)
    outline_band('BSI_TowerJali_Arch',pts,face,width=.36,offset=.25,closed=True)
    for ix in range(-8,9):
        u=ix*.53
        for iz in range(23):
            z=18.3+iz*.52
            if all(point_inside(u+dx,z+dz,pts) for dx,dz in [(-.22,0),(.22,0),(0,-.22),(0,.22)]):
                diamond=[(u,z+.21),(u+.21,z),(u,z-.21),(u-.21,z)]
                outline_band('BSI_TowerJali_Lattice',diamond,face,'Jali',.045,.20,True)

for z,w in [(39.4,19.5),(40.5,18.3),(42.2,16.6)]:cornice('BSI_TowerCrownCornices',z,w,w,.5)
box('BSI_TowerCrownCore','Structure','Cream',(0,TY,39.9),(14,14,2.0))
for orientation,dx,dy in [('front',0,-6.7),('back',0,6.7),('left',-6.7,0),('right',6.7,0)]:
    face=facade(dx,TY+dy,orientation)
    for u in [-5,-2.5,0,2.5,5]:
        beam('BSI_TowerCrownBrackets','Ornament','Trim',face(u,.1,37.8),face(u,2.3,39.3),.18,.27)
box('BSI_TowerUpperLantern','Structure','Cream',(0,TY,42.1),(11.5,11.5,3.3))
hip('BSI_TowerTerracottaCap',0,TY,15.3,15.3,43.9,1.9)
finial(0,TY,45.8,5.2,'BSI_TowerGoldFinial')
# Abstract gilded rosette, not a reproduction of official heraldry or lettering.
ellipsoid('BSI_TowerDecorativeRosette','Ornament','Gold',(0,TY-7.02,31),(.4,.13,.4),12,6)
for i in range(8):
    a=i*math.tau/8
    ellipsoid('BSI_TowerDecorativeRosette','Ornament','Gold',(.65*math.cos(a),TY-7.02,31+.65*math.sin(a)),(.24,.12,.24),10,5)

# Stepped approach and a raised formal garden terrace.
box('BSI_EntryLanding','Entrance','PalePaving',(0,TY-7.6,1.2),(28,4.2,2.4))
for i in range(13):
    h=2.4*(13-i)/13
    box('BSI_MainEntranceSteps','Entrance','Stone',(0,-85.3-i*.72,h/2),(30,.78,h))
box('BSI_GatewayPassageFloor','Entrance','Stone',(0,TY,BASE+.02),(12.4,13.6,.16))
box('BSI_SiteBase','Site','Stone',(0,-2,-.65),(248,256,1.2))
# Flat forecourt and a cut-out for the steps; raised lawn remains behind it.
mesh('BSI_TerracedGround','Site','Lawn',
     [(-123,-128,0),(123,-128,0),(123,-89,0),(-123,-89,0),
      (-123,-83,2.4),(123,-83,2.4),(123,125,2.4),(-123,125,2.4),
      (-16,-89,0),(-16,-83,2.4),(16,-89,0),(16,-83,2.4),
      (-16,-83,0),(16,-83,0)],
     [(0,1,2,3),(4,5,6,7),(3,8,9,4),(10,2,5,11),(8,10,13,12)])
for sign in [-1,1]:
    box('BSI_ParterreTerrace','Site','Peach',(sign*49,-76,1.25),(68,27,2.5))
    box('BSI_ParterreLawns','Site','Lawn',(sign*49,-76,2.57),(67.5,26.5,.16))
    box('BSI_ParterreRetainingWalls','Site','Peach',(sign*49,-89.4,1.2),(68,.7,2.4))
    box('BSI_ParterreWallCaps','Site','Trim',(sign*49,-89.4,2.45),(69,.95,.28))
    for centre_x in [32,62]:
        points=[]
        for j in range(85):
            t=j/84
            angle=math.tau*1.45*t
            radius=7.8*(1-t)+.8
            points.append((sign*(centre_x+radius*math.cos(angle)),-76+radius*math.sin(angle)))
        strip('BSI_YellowScrollParterres','Landscape','YellowPlant',points,2.97,.65,.45)
    border=[(sign*x,y) for x,y in [(16,-88),(82,-88),(82,-64),(16,-64),(16,-88)]]
    strip('BSI_ParterreHedgeBorders','Landscape','Hedge',border,2.88,.65,.50)

# Geometric star paving beside the entrance steps.
box('BSI_StarPavingBase','Site','PalePaving',(0,-96,.13),(226,11,.20))
for i in range(-11,12):
    x=i*9.6
    points=[(x+(2.7 if j%2==0 else 1.35)*math.cos(j*math.pi/8),-96+(2.7 if j%2==0 else 1.35)*math.sin(j*math.pi/8)) for j in range(16)]
    extrude('BSI_RedPavingStars','Site','StarRed',points,.245,.025)
    strip('BSI_StarPavingOutlines','Site','Pattern',points+points[:1],.28,.075,.025)
    for sx,sy in [(-1,-1),(-1,1),(1,-1),(1,1)]:
        strip('BSI_StarPavingLines','Site','Pattern',[(x+sx*4.6,-96+sy*4.6),(x+sx*1.5,-96+sy*1.5)],.28,.07,.025)
    square=[(x-4.7,-100.7),(x+4.7,-100.7),(x+4.7,-91.3),(x-4.7,-91.3),(x-4.7,-100.7)]
    strip('BSI_PavingTileBorders','Site','Pattern',square,.28,.075,.025)

front_drive=[(-119+i*238/70,-108+.0008*(-119+i*238/70)**2) for i in range(71)]
strip('BSI_CurvedCeremonialDrive','Site','Paving',front_drive,.06,9,.10)
for offset in [-4.6,4.6]:strip('BSI_DriveCurbs','Site','Trim',[(x,y+offset) for x,y in front_drive],.17,.22,.24)
for sign in [-1,1]:
    beam('BSI_PerimeterApproachRamps','Site','Asphalt',(sign*111,-98.4,.07),(sign*111,-77,2.48),8,.12)
    box('BSI_PerimeterDrive','Site','Asphalt',(sign*111,14,2.48),(8,182,.13))
    box('BSI_PerimeterParkingAprons','Site','Asphalt',(sign*102,19,2.46),(10,170,.10))
    for yy in range(-60,100,5):box('BSI_ParkingBayLines','Site','Marking',(sign*102,yy,2.54),(5.6,.10,.025))
box('BSI_RearDrive','Site','Asphalt',(0,107,2.48),(221,9,.13))
box('BSI_RearParkingApron','Site','Asphalt',(0,116,2.46),(216,11,.10))
for xx in range(-100,104,4):box('BSI_RearParkingLines','Site','Marking',(xx,116,2.54),(.10,5.3,.025))
box('BSI_FrontReflectionPoolRim','Site','Stone',(0,-117,.24),(80,5.7,.46))
box('BSI_FrontReflectionPoolWater','Site','Water',(0,-117,.49),(78.8,4.6,.035))

rng=random.Random(2510261)
def terrace_palm(x,y,height):
    start={key:len(value[0]) for key,value in batches.items()}
    palm(x,y,height)
    for key,(vs,fs) in batches.items():
        for j in range(start.get(key,0),len(vs)):vs[j]=(vs[j][0],vs[j][1],vs[j][2]+2.4)
for sign in [-1,1]:
    for xx in [23,35,47,59,71,83,95,107]:
        terrace_palm(sign*xx,-62,9+rng.random()*1.3)
    for yy in [-43,-14,19,50,81,110]:
        x=sign*116
        cylinder('BSI_ShadeTreeTrunks','Landscape','Trunk',x,yy,2.4,.32,6.5,10)
        for dx,dy,dz,r in [(-1.5,0,9.2,3.1),(1.6,.4,9.8,3.5),(0,-.6,11,3.6)]:
            ellipsoid('BSI_ShadeTreeCrowns','Landscape','Leaf' if dx<0 else 'LeafLight',(x+dx,yy+dy,dz),(r,r*.85,r*.75))
    for xx,yy in [(39,-43),(53,-44),(67,-43),(40,-4),(49,27),(46,67)]:
        x=sign*xx
        cylinder('BSI_GardenTreeTrunks','Landscape','Trunk',x,yy,2.4,.30,6.8,10)
        for dx,dy,dz,r in [(-1.8,0,10.0,3.3),(1.8,.4,10.5,3.5),(0,-.6,11.8,3.8)]:
            ellipsoid('BSI_GardenTreeCrowns','Landscape','Leaf' if dx<0 else 'LeafLight',(x+dx,yy+dy,dz),(r,r*.9,r*.75))
    for yy in [-99,-70,-28,17,62]:
        xx=sign*116
        z=.1 if yy<-90 else 2.4
        beam('BSI_ExteriorLamps','StreetFurniture','Iron',(xx,yy,z),(xx,yy,z+5.7),.11)
        box('BSI_LampLanterns','StreetFurniture','Gold',(xx,yy,z+5.8),(.45,.45,.65))
    for yy in [-66,-30,31,74]:
        # Furniture sits on the raised exterior terrace.
        start={key:len(value[0]) for key,value in batches.items()}
        bench(sign*108,yy)
        for key,(vs,fs) in batches.items():
            for j in range(start.get(key,0),len(vs)):vs[j]=(vs[j][0],vs[j][1],vs[j][2]+2.4)

colors=['CarWhite','CarSilver','CarBlue','CarWhite','CarRed','CarSilver']
for sign in [-1,1]:
    for i in range(26):
        if i%4==1:continue
        start={key:len(value[0]) for key,value in batches.items()}
        car(sign*102,-57+i*6,90,colors[i%6])
        for key,(vs,fs) in batches.items():
            for j in range(start.get(key,0),len(vs)):vs[j]=(vs[j][0],vs[j][1],vs[j][2]+2.4)
for i in range(48):
    if i%5==2:continue
    start={key:len(value[0]) for key,value in batches.items()}
    car(-94+i*4,116,0,colors[i%6])
    for key,(vs,fs) in batches.items():
        for j in range(start.get(key,0),len(vs)):vs[j]=(vs[j][0],vs[j][1],vs[j][2]+2.4)

# Small schematic ceremonial cannon silhouettes beside the entrance steps.
for sign in [-1,1]:
    x,y=sign*18.0,-91.0
    for dx in [-.4,.4]:
        ellipsoid('BSI_CeremonialOrnaments_Wheels','StreetFurniture','Iron',(x+dx,y,.65),(.10,.55,.55),12,6)
    beam('BSI_CeremonialOrnaments_Carriages','StreetFurniture','Iron',(x,y-.9,.30),(x,y+.8,.7),.30,.30)
    beam('BSI_CeremonialOrnaments_Barrels','StreetFurniture','Iron',(x,y+.7,.85),(x+sign*.45,y-1.15,1.55),.24,.24)

counts=Counter(name for name,category,mat in batches)
for (name,category,mat),(vs,fs) in batches.items():
    assert name.startswith('BSI_'),name
    center=Vector(tuple((min(v[i] for v in vs)+max(v[i] for v in vs))/2 for i in range(3)))
    data=bpy.data.meshes.new(name+'_'+mat+'_Mesh')
    data.from_pydata([tuple(Vector(v)-center) for v in vs],[],fs)
    data.materials.append(mats[mat]);data.update()
    assert not data.validate(),name
    ob=bpy.data.objects.new(name+'_'+mat if counts[name]>1 else name,data)
    cols[category].objects.link(ob);ob.parent=groups[category];ob.location=center
    ob['component']=category;ob['reference_model']='BSI-KotaIskandar-photo-study-20261025'
    if category=='Landscape' and ('Trunks' in name or 'Crowns' in name):
        for polygon in data.polygons:polygon.use_smooth=True

world=bpy.data.worlds.get('BSI_Daylight') or bpy.data.worlds.new('BSI_Daylight')
world.use_nodes=True
node=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
node.inputs['Color'].default_value=(.62,.71,.82,1);node.inputs['Strength'].default_value=.58
scene.world=world
assert 'SUN' in {i.identifier for i in bpy.types.Light.bl_rna.properties['type'].enum_items}
light=bpy.data.lights.new('BSI_Sun','SUN');light.energy=2.1;light.angle=.13
sun=bpy.data.objects.new('BSI_Sun',light);cols['Presentation'].objects.link(sun)
sun.rotation_euler=(math.radians(28),math.radians(-24),math.radians(-28))
camera=bpy.data.cameras.new('BSI_PresentationCamera')
cam=bpy.data.objects.new('BSI_PresentationCamera',camera);cols['Presentation'].objects.link(cam)
cam.location=(197,-249,177)
cam.rotation_euler=(Vector((0,-2,12))-cam.location).to_track_quat('-Z','Y').to_euler()
enum(camera,'type','ORTHO');camera.ortho_scale=364;camera.clip_end=1800
scene.camera=cam
scene.render.resolution_x=1800;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
enum(scene.render.image_settings,'file_format','PNG')
scene.render.filepath=os.path.join(OUT,'BSI_exterior_preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,-2,12)
        area.spaces.active.region_3d.view_distance=292
        area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
        enum(area.spaces.active.shading,'color_type','MATERIAL')
        area.spaces.active.overlay.show_overlays=False
for ob in scene.objects:ob.select_set(ob==root)
bpy.context.view_layer.objects.active=root
scene['estimated_dimensions']='Approximate 200m-wide complex; entrance tower including finial around 51m. Not surveyed.'
print(json.dumps({'scene':scene.name,'meshes':sum(ob.type=='MESH' for ob in scene.objects),'outer_blocks':4,'skylights':2,'security_coordinates':None}))
