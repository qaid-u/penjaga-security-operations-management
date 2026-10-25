"""BDMSP exterior from the supplied street views and aerial. Front = -Y, Z up.

Creates a separate, owned scene. Footprint, dimensions and concealed details are
interpretive; no internal floor numbering or operational coordinates are inferred.
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
NAME='BDMSP_Exterior_Study'
engine=bpy.context.scene.render.engine
old=bpy.data.scenes.get(NAME)
if old:
    assert old.get('bdmsp_generated'), 'A user-owned scene already uses this name.'
scene=bpy.data.scenes.new(NAME+'_Build' if old else NAME)
bpy.context.window.scene=scene
if old:
    for ob in list(old.objects):
        bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.scenes.remove(old)
    scene.name=NAME
scene['bdmsp_generated']=True
scene['building_name']="Bangunan Dato' Mohamad Salleh Perang, Kota Iskandar"
scene['reference_accuracy']='Approximate exterior study from user images, not a survey.'
scene['orientation']='Front -Y; Z up; approximate metre units; no internal security positions.'
scene.render.engine=engine
CATEGORIES=['Structure','Roofscape','Glazing','Shading','Entrance','Site','Landscape','StreetFurniture','Presentation']
cols={}
for category in CATEGORIES:
    name='BDMSP_'+category
    col=bpy.data.collections.get(name) or bpy.data.collections.new(name)
    scene.collection.children.link(col)
    cols[category]=col
root=bpy.data.objects.new('BDMSP_Exterior',None)
cols['Structure'].objects.link(root)
root['building']=scene['building_name']
root['reference_accuracy']=scene['reference_accuracy']
groups={}
for category in CATEGORIES:
    if category=='Presentation':
        continue
    ob=bpy.data.objects.new('BDMSP_Group_'+category,None)
    cols[category].objects.link(ob)
    ob.parent=root
    groups[category]=ob

batches=defaultdict(lambda:[[],[]])
def mesh(name,category,mat,vertices,faces):
    name=name.replace('BDARA_','BDMSP_')
    vs,fs=batches[(name,category,mat)]
    offset=len(vs)
    vs.extend(tuple(v) for v in vertices)
    fs.extend(tuple(offset+i for i in face) for face in faces)

# Reuse audited geometry functions only; never execute the other model's setup.
helper_path=os.path.join(OUT,'..','bdara','build_bdara.py')
with open(helper_path,encoding='utf-8') as handle:
    helper_tree=ast.parse(handle.read())
helpers={'enum','box','extrude','cylinder','beam','strip','ellipsoid','palm','bench','car'}
exec(compile(ast.Module(body=[n for n in helper_tree.body if isinstance(n,ast.FunctionDef) and n.name in helpers],type_ignores=[]),'BDMSP_geometry_helpers','exec'))
enum(scene.unit_settings,'system','METRIC')
mats={}
def material(name,color,roughness=.8,metal=0):
    mat=bpy.data.materials.get('BDMSP_'+name) or bpy.data.materials.new('BDMSP_'+name)
    mat.use_nodes=True
    node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value=(*color,1)
    node.inputs['Roughness'].default_value=roughness
    node.inputs['Metallic'].default_value=metal
    mat.diffuse_color=(*color,1)
    mats[name]=mat

for name,color,roughness,metal in [
    ('Cream',(.73,.74,.65),.85,0),('PaleTrim',(.88,.87,.76),.75,0),
    ('Stone',(.36,.34,.27),.95,0),('Cladding',(.43,.47,.45),.65,.2),
    ('CladdingJoint',(.28,.31,.29),.8,.15),('Glass',(.045,.16,.135),.27,.4),
    ('GlassLight',(.10,.24,.21),.3,.3),('Frame',(.19,.25,.21),.6,.4),
    ('Roof',(.28,.25,.17),.8,.15),('Louvre',(.36,.31,.20),.8,.1),
    ('RoofDark',(.12,.13,.10),.9,0),('Wood',(.16,.085,.04),.85,0),
    ('WoodLight',(.25,.14,.07),.85,0),('Tile',(.20,.16,.11),.9,0),
    ('Shade',(.15,.19,.15),.75,.2),('Asphalt',(.12,.14,.14),1,0),
    ('Paving',(.48,.28,.20),.95,0),('Salmon',(.62,.32,.22),1,0),
    ('WalkInlay',(.78,.71,.51),.95,0),('Pattern',(.25,.30,.28),.9,0),
    ('Marking',(.86,.86,.76),.85,0),('AccessibleGold',(.85,.61,.13),.8,0),
    ('BarrierOrange',(.76,.30,.035),.75,.1),('BarrierBlue',(.035,.15,.30),.65,.1),
    ('Lawn',(.22,.34,.12),1,0),('Leaf',(.06,.18,.045),1,0),
    ('LeafLight',(.20,.34,.075),1,0),('Hedge',(.055,.15,.045),1,0),
    ('Trunk',(.33,.24,.14),1,0),('Steel',(.42,.47,.44),.3,.8),
    ('Water',(.09,.24,.22),.25,.25),('CarWhite',(.78,.80,.76),.35,.3),
    ('CarSilver',(.33,.38,.39),.3,.55),('CarRed',(.33,.045,.03),.35,.3),
    ('CarBlue',(.03,.12,.22),.35,.4),('Rubber',(.03,.035,.03),.95,0),
]:
    material(name,color,roughness,metal)

ANGLE=math.radians(16)
CO,SI=math.cos(ANGLE),math.sin(ANGLE)
def wing(sign,u,v,z=0):
    return (sign*(12+u*CO+v*SI),-u*SI+v*CO,z)
def wing_box(name,category,mat,sign,u,v,z,du,dv,dz):
    outline=[wing(sign,u+a,v+b)[:2] for a,b in [(-du/2,-dv/2),(du/2,-dv/2),(du/2,dv/2),(-du/2,dv/2)]]
    extrude(name,category,mat,outline,z-dz/2,dz)
def face_quad(name,mat,points,category='Glazing'):
    mesh(name,category,mat,points,[(0,1,2,3)])
def sloped_screen(name,point,u0,u1,v0,v1,z0,z1,spacing=.36,slat=.24):
    # Individual horizontal louvres leave visible air gaps above the weather roof.
    n=math.ceil((v1-v0)/spacing)
    for i in range(n+1):
        v=v0+(v1-v0)*i/n
        z=z0+(z1-z0)*i/n
        beam(name+'_Louvres','Roofscape','Louvre',point(u0,v,z),point(u1,v,z),slat,.10)
    for u in [u0,u1]:
        beam(name+'_EdgeFrames','Roofscape','Wood',point(u,v0,z0-.12),point(u,v1,z1-.12),.24,.32)
    for u in [u0+(u1-u0)*i/5 for i in range(1,5)]:
        beam(name+'_Rafters','Roofscape','Wood',point(u,v0,z0-.24),point(u,v1,z1-.24),.15,.22)
    for t in [0,.33,.66,1]:
        v=v0+(v1-v0)*t
        z=z0+(z1-z0)*t-.25
        beam(name+'_Purlins','Roofscape','WoodLight',point(u0,v,z),point(u1,v,z),.17,.23)

# Two splayed wings, with three principal window bands over an open parking level.
for side,sign in [('West',-1),('East',1)]:
    name='BDMSP_'+side+'_Wing'
    wing_box(name,'Structure','Cream',sign,34,0,9.4,68,22,11.2)
    for z in [3.45,7.4,11.4,15.3]:
        wing_box(name+'_FloorPlates','Structure','PaleTrim',sign,34,0,z,69.7,24.2,.35)
    wing_box(name+'_WeatherRoof','Roofscape','RoofDark',sign,34,0,15.58,68.7,22.6,.12)
    for u in range(0,69,8):
        for v in [-9.8,9.8]:
            wing_box(name+'_Pilotis','Structure','Cladding',sign,u,v,1.7,.64,.64,3.4)
            wing_box(name+'_ColumnFootings','Structure','Stone',sign,u,v,.18,1.0,1.0,.36)
    for facing,v in [('Front',-11.08),('Rear',11.08)]:
        for i in range(9):
            u=3.2+i*7.7
            for level,(low,high) in enumerate([(4.15,6.75),(8.15,10.75),(12.15,14.55)]):
                half=2.15 if i%3 else 2.7
                face_quad(name+'_WindowBays','GlassLight' if level==1 else 'Glass',[
                    wing(sign,u-half,v,low),wing(sign,u+half,v,low),wing(sign,u+half,v,high),wing(sign,u-half,v,high)])
                for uu in [u-half,u,u+half]:
                    beam(name+'_WindowFrames','Glazing','Frame',wing(sign,uu,v,low),wing(sign,uu,v,high),.10)
                for zz in [low,high,(low+high)/2]:
                    beam(name+'_WindowFrames','Glazing','Frame',wing(sign,u-half,v,zz),wing(sign,u+half,v,zz),.075)
                if i%3==1:
                    vv=v+(-.52 if v<0 else .52)
                    for j in range(6):
                        zz=low+.18+j*.42
                        beam(name+'_FacadeSunshades','Shading','WoodLight',wing(sign,u-2.6,vv,zz),wing(sign,u+2.6,vv,zz),.13,.10)
        for u in [0,23,46,68]:
            wing_box(name+'_FacadePiers','Structure','PaleTrim',sign,u,v,9.4,.50,.52,11.8)
    # End elevations: opaque centre panels, flanking glazing and strong slab frames.
    for low,high in [(4.2,6.8),(8.2,10.8),(12.2,14.7)]:
        face_quad(name+'_EndCladding','Cladding',[
            wing(sign,68.13,-5,low),wing(sign,68.13,5,low),wing(sign,68.13,5,high),wing(sign,68.13,-5,high)])
        for v0,v1 in [(-10,-5.2),(5.2,10)]:
            face_quad(name+'_EndGlazing','Glass',[
                wing(sign,68.15,v0,low),wing(sign,68.15,v1,low),wing(sign,68.15,v1,high),wing(sign,68.15,v0,high)])
            for zz in [low,(low+high)/2,high]:
                beam(name+'_EndMullions','Glazing','Frame',wing(sign,68.23,v0,zz),wing(sign,68.23,v1,zz),.085)
        for zz in [low+.5,low+1.0,low+1.5,low+2]:
            beam(name+'_CladdingJoints','Structure','CladdingJoint',wing(sign,68.19,-5,zz),wing(sign,68.19,5,zz),.015)
    for v in [-10.8,10.8]:
        wing_box(name+'_EndFrame','Structure','PaleTrim',sign,68.1,v,9.4,.55,.65,11.8)
    # Stepped open roof sails. Each panel has independent pitch and exposed framing.
    point=lambda u,v,z,sign=sign:wing(sign,u,v,z)
    for i,(u0,u1,low,high) in enumerate([(-2,22,16.1,27.8),(24,47,16.6,29.1),(49,72,15.9,26.5)]):
        sloped_screen(name+'_RoofScreen'+str(i+1),point,u0,u1,-18.5,17,low,high)
    # Raking masts and knee braces stand outside the front wall.
    for u in [1,18,35,52,68]:
        beam(name+'_RakingMasts','Shading','Wood',wing(sign,u,-11.5,3.6),wing(sign,u,-18.8,16.3),.38,.44)
        beam(name+'_KneeBraces','Shading','Wood',wing(sign,u,-15.1,10.0),wing(sign,u,-11.7,7.6),.27,.32)
        beam(name+'_UpperBraces','Shading','Wood',wing(sign,u,-11.8,11.7),wing(sign,u,-18.5,16.2),.25,.30)
        rear_height=27.8 if u<=22 else 29.1 if u<=47 else 26.5
        beam(name+'_RearRoofSupports','Shading','Wood',wing(sign,u,10.6,11.7),wing(sign,u,16.5,rear_height-.2),.29,.34)
    # Small open terrace/pergola frames visible at the outer ends.
    for u in [61,69]:
        for v in [-10.8,3.0]:
            wing_box(name+'_TerracePosts','Structure','PaleTrim',sign,u,v,17.0,.5,.5,3.2)
    wing_box(name+'_TerraceSlab','Structure','PaleTrim',sign,65,-3.8,18.7,11,16,.35)
    for u in range(60,72):
        beam(name+'_TerracePergola','Shading','WoodLight',wing(sign,u,-12,19.2),wing(sign,u,5.5,19.2),.16,.20)
    for zz in [15.8,16.4,17.0]:
        beam(name+'_TerraceRails','Shading','WoodLight',wing(sign,59,-12.3,zz),wing(sign,72,-12.3,zz),.09)

# Taller central hub with pale metal-clad upper panels.
box('BDMSP_CentralHub','Structure','Cream',(0,0,13.5),(29,31,20.0))
for z in [3.45,7.4,11.4,15.3,19.3,23.5]:
    box('BDMSP_HubFloorBands','Structure','PaleTrim',(0,0,z),(30.4,32.4,.36))
for x in [-13.4,-4.6,4.6,13.4]:
    for y in [-12.5,0,12.5]:
        box('BDMSP_HubPilotis','Structure','Cladding',(x,y,1.7),(.8,.8,3.4))
for face,y in [('Front',-15.62),('Back',15.62)]:
    for x in [-10.1,-3.4,3.4,10.1]:
        for low,high in [(4.2,6.7),(8.2,10.7),(12.2,14.6),(16.2,18.7)]:
            box('BDMSP_HubWindowBays','Glazing','Glass',(x,y,(low+high)/2),(4.6,.12,high-low))
            for xx in [x-2.3,x-1.15,x,x+1.15,x+2.3]:
                beam('BDMSP_HubMullions','Glazing','Frame',(xx,y-.1,low),(xx,y-.1,high),.09)
            for zz in [low,low+.65,(low+high)/2,high-.65,high]:
                beam('BDMSP_HubMullions','Glazing','Frame',(x-2.3,y-.1,zz),(x+2.3,y-.1,zz),.08)
            if y<0 and low>7:
                for j in range(7):
                    zz=low+.10+j*(high-low-.2)/6
                    beam('BDMSP_HubHorizontalShades','Shading','Shade',(x-2.55,y-.55,zz),(x+2.55,y-.55,zz),.12,.085)
    for x in [-9,9]:
        box('BDMSP_HubUpperCladding','Structure','Cladding',(x,y,21.2),(7,.22,4.0))
        for zz in [19.5,20.3,21.1,21.9,22.7]:
            box('BDMSP_HubPanelJoints','Structure','CladdingJoint',(x,y-.14,zz),(7,.03,.02))
        for xx in [x-2.3,x,x+2.3]:
            box('BDMSP_HubPanelJoints','Structure','CladdingJoint',(xx,y-.14,21.2),(.025,.03,4.0))
    box('BDMSP_HubUpperGlazing','Glazing','Glass',(0,y-.1,21.3),(7.5,.12,3.2))
    for xx in [-3.75,-2.5,-1.25,0,1.25,2.5,3.75]:
        beam('BDMSP_HubUpperMullions','Glazing','Frame',(xx,y-.20,19.7),(xx,y-.20,22.9),.09)
    for zz in [19.7,20.35,21.0,21.65,22.3,22.9]:
        beam('BDMSP_HubUpperMullions','Glazing','Frame',(-3.75,y-.20,zz),(3.75,y-.20,zz),.09)
for sign in [-1,1]:
    for yy in [-8,5]:
        box('BDMSP_HubSideWindows','Glazing','Glass',(sign*14.6,yy,18.2),(.12,7.5,4.0))
    beam('BDMSP_HubRakingMasts','Shading','Wood',(sign*13,-15.9,4.0),(sign*19,-22,26.0),.43,.48)
    beam('BDMSP_HubKneeBraces','Shading','Wood',(sign*16,-19,15),(sign*13,-15.8,11.4),.30)
box('BDMSP_HubWeatherRoof','Roofscape','RoofDark',(0,0,23.8),(30,33,.18))
sloped_screen('BDMSP_CentralCrown',lambda x,y,z:(x,y,z),-20,20,-22,20,26.0,34.0,.35,.23)
for x in [-13,0,13]:
    for y in [-13,0,13]:
        height=26+(y+22)*8/42-.3
        beam('BDMSP_CrownStanchions','Roofscape','Wood',(x,y,23.7),(x,y,height),.17,.22)
for sign in [-1,1]:
    beam('BDMSP_HubRearMasts','Shading','Wood',(sign*13,15.9,8),(sign*20,20,33.7),.36,.42)

# The repeated timber A frames continue down to stone feet outside the raised entry.
for y in [-36,-32.2,-24.2,-20.4]:
    for sign in [-1,1]:
        box('BDMSP_AFrame_StoneFeet','Entrance','Stone',(sign*13.0,y,.45),(1.5,1.65,.9))
        beam('BDMSP_Entrance_AFrames','Entrance','Wood',(sign*13.0,y,.8),(0,y,15.6),.38,.44)
        beam('BDMSP_Entrance_NestedFrames','Entrance','WoodLight',(sign*11.6,y,1.6),(0,y,14.1),.25,.32)
        for offset in [-.40,.40]:
            beam('BDMSP_Entrance_BundledRafters','Entrance','Wood',(sign*12.6,y+offset,1.0),(0,y+offset,15.3),.16,.19)
    beam('BDMSP_Entrance_CrossTies','Entrance','Wood',(-5.8,y,9.0),(5.8,y,9.0),.28,.33)
for sign in [-1,1]:
    beam('BDMSP_Entrance_LongitudinalTies','Entrance','Wood',(sign*6.2,-36,8.8),(sign*6.2,-19,8.8),.29,.33)

def entrance_roof():
    half,front,back,peak,eave=15.0,-37.8,-17.5,16.4,6.9
    vs=[(x,y,z) for y in [front,back] for x,z in [(-half,eave),(0,peak),(half,eave)]]
    mesh('BDMSP_EntryTiledRoof','Roofscape','Tile',vs,[(0,3,4,1),(1,4,5,2)])
    for sign in [-1,1]:
        for j in range(35):
            x=sign*half*j/34
            z=peak-(peak-eave)*j/34+.04
            beam('BDMSP_EntryTileRows','Roofscape','WoodLight',(x,front,z),(x,back,z),.055,.06)
        for k in range(23):
            y=front+(back-front)*k/22
            beam('BDMSP_EntryTileSeams','Roofscape','Tile',(0,y,peak+.06),(sign*half,y,eave+.06),.045,.05)
            # Rounded rolls give the tile surface depth without external textures.
            vertices=[]
            for x,z in [(0,peak),(sign*half,eave)]:
                vertices.extend((x,y+.38*math.cos(j*math.pi/6),z+.04+.11*math.sin(j*math.pi/6)) for j in range(7))
            mesh('BDMSP_EntryRoundedTiles','Roofscape','Tile',vertices,[(j,j+7,j+8,j+1) for j in range(6)])
        for y in [front,back]:
            beam('BDMSP_EntryBargeboards','Entrance','Wood',(sign*half,y,eave),(0,y,peak),.30,.40)
    beam('BDMSP_EntryRidgeCap','Roofscape','WoodLight',(0,front,peak+.12),(0,back,peak+.12),.24,.22)
entrance_roof()
mesh('BDMSP_Entrance_TriangularGlazing','Glazing','Glass',[(-6.2,-32.6,9.0),(6.2,-32.6,9.0),(0,-32.6,14.3)],[(0,1,2)])
for x in [-4,-2,0,2,4]:
    beam('BDMSP_EntryGableMullions','Glazing','PaleTrim',(x,-32.68,9),(x,-32.68,14.1-abs(x)*.82),.08)
box('BDMSP_EntryPlatform','Entrance','PaleTrim',(0,-18.7,1.65),(28,8,3.3))
box('BDMSP_EntryDoorRecess','Entrance','RoofDark',(0,-15.7,5.4),(10,.18,4.3))
box('BDMSP_EntryDoors','Glazing','Glass',(0,-15.82,5.3),(8.5,.14,4))
for x in [-4.25,-2.1,0,2.1,4.25]:
    beam('BDMSP_EntryDoorFrames','Glazing','Frame',(x,-15.95,3.3),(x,-15.95,7.3),.12)
for i in range(17):
    z=(17-i)*3.3/17
    box('BDMSP_MainEntranceSteps','Entrance','Stone',(0,-22.7-i*.40,z/2),(8,.46,z))
    for sign in [-1,1]:
        box('BDMSP_FlankingStairFlights','Entrance','Stone',(sign*16.2,-19.3-i*.57,z/2),(7.5,.62,z))
for sign in [-1,1]:
    beam('BDMSP_StairHandrails','Entrance','Steel',(sign*4.1,-29.4,1.0),(sign*4.1,-22.7,4.25),.07)
    for y,z in [(-29.4,0),(-26.1,1.65),(-22.7,3.3)]:
        cylinder('BDMSP_HandrailPosts','Entrance','Steel',sign*4.1,y,z,.045,1.0,8)

# Curved campus drives and parking areas around the V-shaped footprint.
box('BDMSP_SiteBase','Site','Stone',(0,-22,-.66),(228,214,1.2))
box('BDMSP_Lawn','Site','Lawn',(0,-22,-.07),(226,212,.24))
def road_curve(sign,row,count=40):
    return [(sign*(15+91*i/count),row-.22*(15+91*i/count)) for i in range(count+1)]
for sign in [-1,1]:
    for label,row,width in [('Front',-29,7.5),('Rear',49,9)]:
        points=road_curve(sign,row)
        if label=='Rear':
            strip('BDMSP_RearParkingAprons','Site','Asphalt',points,.035,29,.06)
        strip('BDMSP_'+label+'CurvedDrive','Site','Asphalt',points,.075,width,.10)
        for edge in [-width/2,width/2]:
            strip('BDMSP_DriveCurbs','Site','PaleTrim',[(x,y+edge) for x,y in points],.18,.2,.24)
        for i in range(15):
            x=sign*(16+i*6)
            y=row-.22*abs(x)
            box('BDMSP_DriveDashes','Site','Marking',(x,y,.14),(2.4,.13,.025))
    box('BDMSP_SideDrive','Site','Asphalt',(sign*105,-13,.065),(8,98,.10))
    box('BDMSP_SideParkingApron','Site','Asphalt',(sign*98,-18,.04),(9,91,.06))
    for i in range(22):
        x=sign*(17+i*4.0)
        for row in [39,60]:
            y=row-.22*abs(x)
            box('BDMSP_ParkingStripes','Site','Marking',(x,y,.13),(.10,5.0,.025))
    for i in range(18):
        box('BDMSP_SideParkingStripes','Site','Marking',(sign*98,-56+i*5,.13),(5.0,.1,.025))
box('BDMSP_RearCrossDrive','Site','Asphalt',(0,46,.08),(30,9,.12))
box('BDMSP_EntryBrickDrive','Site','Paving',(0,-30,.14),(39,7.8,.15))
extrude('BDMSP_PavedArrivalCourt','Site','Paving',[(-37,-44),(-37,-30),(-18,-25),(18,-25),(37,-30),(37,-44)],.17,.16)
box('BDMSP_AxialApproach','Site','Salmon',(0,-78,.13),(16,82,.18))
for sign in [-1,1]:
    box('BDMSP_AxisCreamBorders','Site','WalkInlay',(sign*6.7,-78,.25),(1.6,82,.07))
    box('BDMSP_AxisGreyMargins','Site','Pattern',(sign*8.6,-78,.14),(2.1,82,.20))
for j in range(11):
    y=-40-j*7.2
    sign=-1 if j%2 else 1
    mesh('BDMSP_AxialZigzagInlay','Site','Pattern',[(-5.7,y,.25),(5.7,y-6,.25),(sign*5.7,y-3,.25)],[(0,1,2)])
    box('BDMSP_AxisTransverseBands','Site','WalkInlay',(0,y-.3,.26),(13.4,.17,.04))
for y in [-54,-82,-109]:
    box('BDMSP_AxisWaterFeatureRim','Site','Stone',(0,y,.34),(4.2,3.2,.60))
    box('BDMSP_AxisWaterFeatureWater','Site','Water',(0,y,.66),(3.6,2.6,.04))
    for side in [-1,1]:
        points=[(side*.40+.6*math.sin(t*math.tau),y+.5*math.cos(t*math.tau),.8+2.8*t) for t in [i/26 for i in range(27)]]
        for a,b in zip(points,points[1:]):
            beam('BDMSP_AbstractSculptures','StreetFurniture','Steel',a,b,.14)
    ellipsoid('BDMSP_AbstractSculptures','StreetFurniture','Steel',(0,y,3.5),(.35,.35,.35))

# Two schematic accessible spaces and stone beds beneath the entrance's outer legs.
for sign in [-1,1]:
    box('BDMSP_AFrameGravelBeds','Site','Cladding',(sign*11,-35.5,.14),(4.5,7.5,.16))
    for xoff in [-2.25,2.25]:
        box('BDMSP_GravelBedEdging','Site','PaleTrim',(sign*11+xoff,-35.5,.26),(.15,7.7,.22))
    x=sign*3.4
    points=[(x+.6*math.cos(i*math.tau/20),-40+.6*math.sin(i*math.tau/20)) for i in range(21)]
    strip('BDMSP_AccessibleSymbols','Site','AccessibleGold',points,.25,.10,.025)
    strip('BDMSP_AccessibleSymbols','Site','AccessibleGold',[(x,-38.8),(x,-40),(x+.9,-40),(x+1.3,-40.8)],.25,.12,.025)
    box('BDMSP_AccessibleSpaceLines','Site','AccessibleGold',(sign*6.5,-40,.25),(.10,5.5,.025))

rng=random.Random(251026)
for sign in [-1,1]:
    for y in [-45,-59,-73,-87,-101,-114]:
        palm(sign*12.4,y,10.0+rng.random()*1.8)
    for u in [8,27,48,66]:
        p=wing(sign,u,-21)
        palm(p[0],p[1],10.0+rng.random()*1.5)
    for y in [-108,-80,-50,-18,17,58]:
        x=sign*(101 if y<-50 else 107)
        cylinder('BDMSP_ShadeTreeTrunks','Landscape','Trunk',x,y,0,.36,6.5,10)
        for dx,dy,dz,size in [(-2.0,0,7.2,4.2),(2.0,.6,8.1,4.4),(0,-1,9.5,4.5)]:
            ellipsoid('BDMSP_ShadeTreeCrowns','Landscape','Leaf' if dx<0 else 'LeafLight',(x+dx,y+dy,dz),(size,size*.95,size*.66))
    for y in [-51,-67,-81,-96,-110]:
        box('BDMSP_AxisPlantingBeds','Site','Stone',(sign*12.4,y,.12),(5,3,.24))
        ellipsoid('BDMSP_ClippedShrubs','Landscape','Hedge',(sign*12.4,y,.72),(2.3,1.25,.7))
        bench(sign*10.6,y-5.4)
    for yy in [-96,-66,-43,-3,35]:
        xx=sign*105
        beam('BDMSP_LampPosts','StreetFurniture','Shade',(xx,yy,.1),(xx,yy,6.5),.13)
        box('BDMSP_LampHeads','StreetFurniture','Frame',(xx-sign*.7,yy,6.45),(1.55,.45,.16))
    for x,y in [(sign*29,-66),(sign*34,-105)]:
        cylinder('BDMSP_GardenShadeTrunks','Landscape','Trunk',x,y,0,.30,6.7,10)
        for dx,dy,dz,r in [(-2,0,7.4,3.6),(2,.5,8.2,3.8),(0,-.6,9.4,4.0)]:
            ellipsoid('BDMSP_GardenShadeCrowns','Landscape','Leaf' if dx<0 else 'LeafLight',(x+dx,y+dy,dz),(r,r*.9,r*.70))

colors=['CarWhite','CarSilver','CarBlue','CarWhite','CarRed','CarSilver']
for sign in [-1,1]:
    for i in range(21):
        if i%5==2:
            continue
        x=sign*(19+i*4)
        for row in [39.5,59.3]:
            car(x,row-.22*abs(x),0 if row<45 else 180,colors[i%6])
    for i in range(14):
        if i%4!=1:
            car(sign*98,-53+i*6,90,colors[(i+2)%6])
    for u in [8,25,43,60]:
        p=wing(sign,u,3)
        car(p[0],p[1],-sign*16,colors[int(u)%6])
    # Entry barrier props observed at an outer undercroft access, without operational mapping.
    wing_box('BDMSP_EndAccessAprons','Site','Asphalt',sign,74.5,0,.065,22,23,.10)
    for u in [70,77,84]:
        beam('BDMSP_EndAccessDashes','Site','Marking',wing(sign,u-1.2,0,.13),wing(sign,u+1.2,0,.13),.12,.025)
    for v in [-6,0,6]:
        p=wing(sign,73,v)
        box('BDMSP_UndercroftBarrierHousings','StreetFurniture','BarrierOrange',(p[0],p[1],.85),(.5,.65,1.7))
        box('BDMSP_UndercroftBarrierTops','StreetFurniture','BarrierBlue',(p[0],p[1],1.67),(.56,.69,.12))
        q=wing(sign,73,v+4)
        beam('BDMSP_UndercroftBarrierArms','StreetFurniture','Marking',(*p[:2],1.6),(*q[:2],1.6),.11,.13)

# Material/semantic batching keeps detailed slats and structural members manageable.
counts=Counter(name for name,category,mat in batches)
for (name,category,mat),(vs,fs) in batches.items():
    center=Vector(tuple((min(v[i] for v in vs)+max(v[i] for v in vs))/2 for i in range(3)))
    data=bpy.data.meshes.new(name+'_'+mat+'_Mesh')
    data.from_pydata([tuple(Vector(v)-center) for v in vs],[],fs)
    data.materials.append(mats[mat])
    data.update()
    assert not data.validate(),name
    ob=bpy.data.objects.new(name+'_'+mat if counts[name]>1 else name,data)
    cols[category].objects.link(ob)
    ob.parent=groups[category]
    ob.location=center
    ob['component']=category
    ob['reference_model']='BDMSP-photo-study-20261025'
    if category=='Landscape' and ('Trunks' in name or 'Crowns' in name or 'Shrubs' in name):
        for polygon in data.polygons:
            polygon.use_smooth=True

world=bpy.data.worlds.get('BDMSP_Daylight') or bpy.data.worlds.new('BDMSP_Daylight')
world.use_nodes=True
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs['Color'].default_value=(.63,.72,.80,1)
background.inputs['Strength'].default_value=.55
scene.world=world
assert 'SUN' in {i.identifier for i in bpy.types.Light.bl_rna.properties['type'].enum_items}
light=bpy.data.lights.new('BDMSP_Sun','SUN')
light.energy=2.1
light.angle=.14
sun=bpy.data.objects.new('BDMSP_Sun',light)
cols['Presentation'].objects.link(sun)
sun.rotation_euler=(math.radians(29),math.radians(-20),math.radians(-28))
camera=bpy.data.cameras.new('BDMSP_PresentationCamera')
cam=bpy.data.objects.new('BDMSP_PresentationCamera',camera)
cols['Presentation'].objects.link(cam)
cam.location=(165,-235,147)
cam.rotation_euler=(Vector((0,-17,8))-cam.location).to_track_quat('-Z','Y').to_euler()
enum(camera,'type','ORTHO')
camera.ortho_scale=330
camera.clip_end=1500
scene.camera=cam
scene.render.resolution_x=1800
scene.render.resolution_y=1300
scene.render.resolution_percentage=100
enum(scene.render.image_settings,'file_format','PNG')
scene.render.filepath=os.path.join(OUT,'BDMSP_exterior_preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(0,-17,8)
        area.spaces.active.region_3d.view_distance=260
        area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
        enum(area.spaces.active.shading,'color_type','MATERIAL')
        area.spaces.active.overlay.show_overlays=False
for ob in scene.objects:
    ob.select_set(ob==root)
bpy.context.view_layer.objects.active=root
scene['estimated_dimensions']='Approx. 170m-wide building; highest roof-screen edge 34m. Inferred, not surveyed.'
print(json.dumps({'scene':scene.name,'meshes':sum(ob.type=='MESH' for ob in scene.objects),'roof_screens':7,'security_coordinates':None}))
