"""UTC Johor / Galleria exterior study from seven user photographs.

The Pos UTC counter identity is metadata, not an inferred indoor position.
Front mall street is -Y, UTC street is -X, Z is up; approximate metres.
"""
import ast
import bpy
import math
import os
import json
import random
from collections import defaultdict, Counter
from mathutils import Vector, Matrix

OUT=os.path.dirname(os.path.abspath(__file__))
NAME='UTC_Johor_Exterior_Study'
engine=bpy.context.scene.render.engine
old=bpy.data.scenes.get(NAME)
if old:assert old.get('utc_generated'),'Existing scene is not owned by this generator.'
scene=bpy.data.scenes.new(NAME+'_Build' if old else NAME)
bpy.context.window.scene=scene
if old:
    for ob in list(old.objects):bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.scenes.remove(old);scene.name=NAME
scene['utc_generated']=True
scene['building_name']='Kaunter UTC Pejabat Setiausaha Kerajaan Johor'
scene['description']='Interpretive exterior of the UTC Johor / Galleria corner complex, from seven supplied images.'
categories=['Structure','Roofscape','Glazing','Shading','Entrance','Signage','Site','Landscape','StreetFurniture','Presentation']
cols={}
for category in categories:
    col=bpy.data.collections.get('UTC_'+category) or bpy.data.collections.new('UTC_'+category)
    scene.collection.children.link(col);cols[category]=col
root=bpy.data.objects.new('UTC_Exterior',None);cols['Structure'].objects.link(root)
root['building_id']='UTC_JOHOR'
root['building']=scene['building_name'];root['post_name']='Pos UTC'
root['reference_accuracy']='Approximate exterior from photographs; counter floor and operational position unconfirmed.'
groups={}
for category in categories:
    if category=='Presentation':continue
    ob=bpy.data.objects.new('UTC_Group_'+category,None);cols[category].objects.link(ob)
    ob.parent=root;groups[category]=ob
batches=defaultdict(lambda:[[],[]])
def mesh(name,category,mat,vertices,faces):
    name=name.replace('BDARA_','UTC_')
    vs,fs=batches[(name,category,mat)];offset=len(vs)
    vs.extend(tuple(v) for v in vertices);fs.extend(tuple(offset+i for i in f) for f in faces)
with open(os.path.join(OUT,'..','bdara','build_bdara.py'),encoding='utf-8') as handle:source=ast.parse(handle.read())
helpers={'enum','box','extrude','cylinder','beam','strip','ellipsoid','car'}
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in helpers],type_ignores=[]),'UTC_geometry_helpers','exec'))
with open(os.path.join(OUT,'..','rumah_ss_vip','build_residence.py'),encoding='utf-8') as handle:source=ast.parse(handle.read())
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in {'face','face_panel'}],type_ignores=[]),'UTC_facade_helpers','exec'))
enum(scene.unit_settings,'system','METRIC');scene.render.engine=engine
mats={}
def material(name,color,roughness=.8,metal=0):
    mat=bpy.data.materials.get('UTC_'+name) or bpy.data.materials.new('UTC_'+name)
    mat.use_nodes=True
    node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value=(*color,1)
    node.inputs['Roughness'].default_value=roughness;node.inputs['Metallic'].default_value=metal
    mat.diffuse_color=(*color,1);mats[name]=mat
for name,color,rough,metal in [
    ('White',(.77,.78,.73),.9,0),('Trim',(.91,.90,.82),.8,0),
    ('TowerSpandrel',(.58,.60,.55),.9,0),('Concrete',(.38,.40,.37),.95,0),
    ('PorticoStone',(.38,.35,.31),.9,0),('PorticoTrim',(.57,.55,.49),.9,0),
    ('Blue',(.018,.065,.23),.55,.25),('BlueLight',(.035,.13,.33),.55,.25),
    ('Red',(.52,.12,.10),.75,.15),('RedDark',(.30,.065,.065),.8,.15),
    ('Silver',(.61,.65,.63),.6,.45),('SilverLight',(.75,.76,.70),.6,.35),
    ('PanelJoint',(.35,.39,.37),.7,.4),('Louvre',(.65,.68,.62),.65,.45),
    ('Glass',(.045,.085,.09),.23,.3),('GlassLight',(.10,.19,.19),.25,.3),
    ('Frame',(.20,.23,.21),.55,.6),('BrownFrame',(.16,.13,.10),.7,.25),
    ('Recess',(.035,.045,.04),.95,0),('Steel',(.08,.105,.10),.65,.55),
    ('Stainless',(.44,.48,.45),.35,.8),('Roof',(.42,.44,.39),.9,.1),
    ('RoofPale',(.63,.62,.50),.85,.2),('Paving',(.51,.38,.25),.95,0),
    ('PalePaving',(.70,.66,.53),.95,0),('Asphalt',(.105,.13,.13),1,0),
    ('BlueLane',(.025,.23,.40),.9,0),('Marking',(.88,.87,.76),.9,0),
    ('Yellow',(.73,.51,.08),.85,0),('Gold',(.57,.36,.055),.4,.65),
    ('Lawn',(.19,.29,.09),1,0),('Hedge',(.065,.17,.035),1,0),
    ('Leaf',(.065,.18,.045),1,0),('LeafLight',(.17,.29,.07),1,0),
    ('Trunk',(.29,.22,.14),1,0),('CarWhite',(.76,.79,.75),.35,.3),
    ('CarSilver',(.31,.37,.38),.3,.5),('CarBlue',(.025,.10,.22),.35,.4),
    ('CarRed',(.33,.04,.025),.35,.3),('Rubber',(.025,.03,.025),.95,0),
]:material(name,color,rough,metal)

def ribbon(name,f,center,base,span,height,bays=8,mat='Glass',frame='Frame',project=.18):
    face_panel(name+'_Glass','Glazing',mat,f,center,base+height/2,span,height,.10,project)
    for i in range(bays+1):
        u=center-span/2+span*i/bays
        beam(name+'_Mullions','Glazing',frame,f(u,project+.11,base),f(u,project+.11,base+height),.075,.08)
    for z in [base,base+height]:beam(name+'_Transoms','Glazing',frame,f(center-span/2,project+.11,z),f(center+span/2,project+.11,z),.09,.10)

def louvres(name,f,center,base,span,height,pitch=.18):
    face_panel(name+'_Shadow','Shading','Recess',f,center,base+height/2,span,height,.06,.10)
    for j in range(int(height/pitch)+1):
        z=base+j*pitch
        beam(name+'_Slats','Shading','Louvre',f(center-span/2,.28,z),f(center+span/2,.28,z),.22,.065)
    for i in range(int(span/3)+1):
        u=center-span/2+i*span/max(1,int(span/3))
        beam(name+'_Uprights','Shading','SilverLight',f(u,.42,base),f(u,.42,base+height),.12,.12)

def panel_grid(name,f,span,base,height,step=3,mat='PanelJoint'):
    for j in range(int(height/step)+1):
        z=base+j*step
        beam(name,'Shading',mat,f(-span/2,.035,z),f(span/2,.035,z),.035,.045)
    for i in range(int(span/step)+1):
        u=-span/2+i*span/max(1,int(span/step))
        beam(name,'Shading',mat,f(u,.04,base),f(u,.04,base+height),.035,.045)

# Tower at the inner junction, stepped wings and dark ribbon-window bays.
box('UTC_Tower_MainShaft','Structure','White',(-45,24,33.8),(14,29,57))
box('UTC_Tower_WestWing','Structure','White',(-56,24,27.1),(8,24,43.6))
box('UTC_Tower_EastWing','Structure','White',(-34,24,31.5),(8,27,52.4))
for x,w,top,depth in [(-45,14,62.3,29),(-56,8,48.9,24),(-34,8,57.7,27)]:
    box('UTC_Tower_Parapets','Structure','Trim',(x,24,top+.25),(w+.25,depth+.25,.60))
    box('UTC_Tower_FlatRoofs','Roofscape','Roof',(x,24,top+.18),(w-.7,depth-.7,.10))
for row in range(14):
    z=6.6+row*3.82
    ribbon('UTC_Tower_CentralBayWindows',face(-45,9.38),0,z,10.7,2.12,7,'Glass','BrownFrame',.40)
    box('UTC_Tower_BaySills','Structure','TowerSpandrel',(-45,9.00,z-.15),(11.0,.95,.25))
    if row<11:ribbon('UTC_Tower_WestWindows',face(-56,11.88),0,z,5.7,2.08,4,'Glass','BrownFrame',.16)
    if row<13:ribbon('UTC_Tower_EastWindows',face(-34,10.38),0,z,5.8,2.08,4,'Glass','BrownFrame',.16)
    ribbon('UTC_Tower_RearWindows',face(-45,38.56,'back'),0,z,10.8,2.1,7,'Glass','BrownFrame')
    if row<11:ribbon('UTC_Tower_WestSideWindows',face(-60.07,24,'left'),0,z,19.2,2.1,12,'Glass','BrownFrame')
    if row<13:ribbon('UTC_Tower_EastSideWindows',face(-29.92,24,'right'),0,z,21.5,2.1,12,'Glass','BrownFrame')
for x in [-51.6,-38.4]:box('UTC_Tower_StrongVerticalPiers','Structure','Trim',(x,9.0,33.6),(.72,.55,56.6))
box('UTC_Tower_GroundCore','Structure','Recess',(-46,25,3.1),(16,20,6.2))
box('UTC_Tower_PodiumFloor','Entrance','PalePaving',(-47,21,.40),(35,34,.60))
box('UTC_Tower_PorticoCornice','Entrance','PorticoStone',(-47,21,6.4),(36,35,1.05))
box('UTC_Tower_PorticoCoping','Entrance','PorticoTrim',(-47,21,7.03),(37,36,.25))

def portico_arc(name,f,u,base,width,height,top):
    r=width/2;spring=base+height-r
    arc=[(u+r*math.cos(math.pi-j*math.pi/24),spring+r*math.sin(math.pi-j*math.pi/24)) for j in range(25)]
    outline=[(u-width/2,top),(u+width/2,top)]+list(reversed(arc));n=len(outline)
    vs=[f(x,d,z) for d in [-.32,.32] for x,z in outline]
    mesh(name+'_Spandrels','Entrance','PorticoStone',vs,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
    for a,b in zip(arc,arc[1:]):beam(name+'_ArchTrim','Entrance','PorticoTrim',f(a[0],.40,a[1]),f(b[0],.40,b[1]),.23,.20)
for u in [-11,0,11]:portico_arc('UTC_Tower_FrontPortico',face(-47,3.45),u,.65,9.4,5.6,6.25)
for x in [-63.4,-52.5,-41.5,-30.6]:
    box('UTC_Portico_Piers','Entrance','PorticoStone',(x,3.6,2.4),(1.25,1.2,3.5))
    for z,w,h in [(.85,1.7,.45),(3.7,1.8,.30),(4.0,1.45,.35)]:box('UTC_Portico_Capitals','Entrance','PorticoTrim',(x,3.6,z),(w,1.55,h))
for u in [-7,7]:portico_arc('UTC_Tower_WestPortico',face(-64.5,21,'left'),u,.65,11.5,5.6,6.25)
for y in [6.8,21,35.2]:box('UTC_Portico_WestPiers','Entrance','PorticoStone',(-64.5,y,2.5),(1.2,1.2,3.7))

# Narrow UTC wing faces the -X street, with its return facing -Y.
box('UTC_Podium','Structure','White',(-43,-20,9.4),(46,39,17.6))
box('UTC_Podium_RoofDeck','Roofscape','Roof',(-43,-20,18.55),(46,39,.22))
box('UTC_InnerJunctionLink','Structure','White',(-18.5,11.5,9.5),(15,26,18.4))
box('UTC_InnerLinkRoof','Roofscape','Roof',(-18.5,11.5,18.85),(15,26,.25))
for f,span in [(face(-66.08,-20,'left'),39),(face(-43,-39.58),46)]:
    face_panel('UTC_CoralCladding','Structure','Red',f,0,7.8,span,4.7,.20,.12)
    panel_grid('UTC_CoralPanelJoints',f,span,5.45,4.7,2.8,'RedDark')
    ribbon('UTC_PodiumGroundShops',f,0,.95,span-1,4.2,int(span/3),'GlassLight')
    louvres('UTC_HorizontalLouvreBand',f,0,9.9,span,2.55,.16)
    ribbon('UTC_UpperRibbonGlazing',f,0,12.6,span-1,4.75,int(span/1.25),'GlassLight')
    for i in range(int(span/.8)+1):
        u=-span/2+i*span/int(span/.8)
        beam('UTC_UpperVerticalFins','Shading','SilverLight',f(u,.72,12.45),f(u,.72,17.65),.10,.28)
    face_panel('UTC_BlueTopFascia','Structure','Blue',f,0,18.5,span+1,2.0,.35,.5)
    for u in range(-int(span/2),int(span/2),3):beam('UTC_BlueFasciaJoints','Shading','BlueLight',f(u,.71,17.5),f(u,.71,19.5),.04,.04)
# Blue shallow standing-seam roof, distinct from the broad pale mall roof.
mesh('UTC_BlueRoof','Roofscape','Blue',[(-66,-39.8,19.45),(-20,-39.8,19.45),(-20,-15,20.7),(-66,-15,20.7)],[(0,1,2,3)])
for x in range(-65,-19,1):beam('UTC_BlueRoof_StandingSeams','Roofscape','BlueLight',(x,-39.8,19.48),(x,-15,20.73),.035,.045)
for x in [-62,-56,-50,-44,-38,-32,-26]:
    box('UTC_RoofParkingMarkings','Roofscape','Marking',(x,-3,18.70),(.10,5.2,.025))
box('UTC_RoofDeck_Parapet','Roofscape','White',(-43,-.5,19),(47,.45,1.2))
# Large full-height silver sign louvre on the UTC street elevation.
SIGN=face(-67.3,-6.9,'left')
face_panel('UTC_SignPanelBacking','Signage','Recess',SIGN,0,14.6,14.3,22.4,.38,0)
louvres('UTC_SignPanelLouvres',SIGN,0,3.5,14.2,22.1,.16)
for u in [-7.2,7.2]:beam('UTC_SignPanelBorder','Signage','Trim',SIGN(u,.52,3.3),SIGN(u,.52,25.9),.22,.20)
# Counter entrance steps and access ramp remain external architectural features.
box('UTC_StreetEntranceCanopy','Entrance','Red',(-68.2,-11,5.55),(5.8,28,.65))
for yy in [-24,-11,2]:box('UTC_StreetEntranceColumns','Entrance','Red',(-70,yy,2.75),(.60,.60,5.5))
for i in range(5):box('UTC_EntranceSteps','Entrance','Concrete',(-69.4-i*.40,-11,.7-i*.12),(1.0,24,.20))
beam('UTC_EntranceAccessRamp','Entrance','PalePaving',(-70,-32,.85),(-72,-4,.30),2.1,.20)
for yy in [-31,-24,-17,-10,-4]:beam('UTC_RampRailPosts','Entrance','Stainless',(-73,yy,.3),(-73,yy,1.8),.055)
beam('UTC_RampHandrail','Entrance','Stainless',(-73,-32,1.9),(-73,-4,1.3),.065)

# Broad mall body occupies the adjoining street frontage.
box('UTC_Galleria_MainHall','Structure','White',(28,4,14.3),(78,86,27))
box('UTC_Galleria_Base','Structure','Concrete',(28,4,.50),(79,87,1.0))
for z in [6.0,11.25]:box('UTC_Galleria_HorizontalSlabs','Structure','Trim',(28,-39.2,z),(79,1.6,.45))
ribbon('UTC_Galleria_GroundRetail',face(28,-39.12),0,.8,76,4.8,19,'GlassLight')
ribbon('UTC_Galleria_MezzanineRetail',face(28,-39.15),0,6.45,76,4.1,28,'GlassLight')
for x in range(-9,67,8):
    box('UTC_Galleria_RetailPiers','Structure','White',(x,-39.45,3.1),(.48,.7,5.5))
for x in [3,18,35,51]:box('UTC_RetailSignBands','Signage','Red',(x,-39.5,4.95),(11,.15,.55))

# Billowing silver facade: separate ruled panels, dark ribs and panel seams.
START=3.0;BAY=9.0;BAYS=7
def panel_top(i,t):return 27.0+min(i,3)*.7+1.35*math.sin(math.pi*t)
def panel_point(i,t,v):
    top=panel_top(i,t)
    return (START+(i+t)*BAY,-39.7-1.2*math.sin(v*math.pi)-.18*math.sin(t*math.pi),11.8+v*(top-11.8))
for i in range(BAYS):
    vs=[panel_point(i,j/6,k/14) for k in range(15) for j in range(7)]
    fs=[(k*7+j,k*7+j+1,(k+1)*7+j+1,(k+1)*7+j) for k in range(14) for j in range(6)]
    mesh('UTC_Galleria_SilverPanel'+str(i+1),'Structure','Silver',vs,fs)
    for j in [0,6]:
        for k in range(14):beam('UTC_Galleria_DarkVerticalRibs','Shading','Steel',panel_point(i,j/6,k/14),panel_point(i,j/6,(k+1)/14),.30,.30)
    for j in range(6):beam('UTC_Galleria_WavyTopCaps','Roofscape','Steel',panel_point(i,j/6,1),panel_point(i,(j+1)/6,1),.22,.30)
    for v in [.14,.28,.42,.56,.70,.84]:
        for j in range(6):
            a,b=Vector(panel_point(i,j/6,v)),Vector(panel_point(i,(j+1)/6,v));a.y-=.02;b.y-=.02
            beam('UTC_Galleria_CladdingSeams','Shading','PanelJoint',a,b,.022,.025)
    for t in [.25,.5,.75]:
        for k in range(14):
            a,b=Vector(panel_point(i,t,k/14)),Vector(panel_point(i,t,(k+1)/14));a.y-=.025;b.y-=.025
            beam('UTC_Galleria_CladdingSeams','Shading','PanelJoint',a,b,.018,.025)
    # Pale folded roof strips extend towards the rear, as seen in the aerial.
    front=[panel_point(i,t,1) for t in [0,.5,1]]
    rear=[(x,47,z-1.4) for x,y,z in front]
    mesh('UTC_Galleria_FoldedRoof'+str(i+1),'Roofscape','RoofPale',front+rear,[(0,1,4,3),(1,2,5,4)])
    for t in [j/8 for j in range(9)]:
        p=panel_point(i,t,1)
        beam('UTC_Galleria_RoofSeams','Roofscape','SilverLight',p,(p[0],47,p[2]-1.4),.035,.045)
box('UTC_Galleria_WestRoofLink','Roofscape','RoofPale',(-4.5,4,27.85),(15,86,.25))
for f,span in [(face(67.05,4,'right'),86),(face(28,47.06,'back'),78)]:
    panel_grid('UTC_Galleria_RearCladdingJoints',f,span,11.8,15.2,3)
    ribbon('UTC_Galleria_ReturnRetail',f,0,1,span-3,4.3,int(span/4),'GlassLight')
    ribbon('UTC_Galleria_ReturnMezzanine',f,0,6.6,span-3,3.6,int(span/3),'GlassLight')

# Coral feature portal and shallow arched inset at the west end of the mall face.
box('UTC_Galleria_CoralFeatureUpright','Structure','Red',(-8.4,-39.7,17.6),(5.1,1.4,22.8))
topline=[(-11+25*j/24,31.1+2.4*math.sin(j*math.pi/24)) for j in range(25)]
outline=[(-11,25.8),(14,25.8)]+list(reversed(topline))
n=len(outline);vs=[(x,y,z) for y in [-40.5,-39.1] for x,z in outline]
mesh('UTC_Galleria_CoralArchedHeader','Structure','Red',vs,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
for x in [-10,-7,-4]:beam('UTC_CoralFeaturePanelJoints','Shading','RedDark',(x,-40.43,6.2),(x,-40.43,30.5),.035,.04)
for z in [8,11,14,17,20,23,26,29]:beam('UTC_CoralFeaturePanelJoints','Shading','RedDark',(-10.8,-40.44,z),(-6,-40.44,z),.035,.04)
arch=[(1+4.2*math.cos(math.pi-j*math.pi/24),20.4+4.2*math.sin(math.pi-j*math.pi/24)) for j in range(25)]
for a,b in zip(arch,arch[1:]):beam('UTC_Galleria_WhiteArchMoulding','Structure','Trim',(a[0],-39.3,a[1]),(b[0],-39.3,b[1]),.20,.20)
for x in [-3.2,5.2]:box('UTC_Galleria_ArchMouldingImposts','Structure','Trim',(x,-39.35,20.3),(.85,.45,.5))
# A separate red rectangular frame wraps the adjoining mall return elevation.
for yy in [-34,-19]:box('UTC_Galleria_ReturnGateway_Piers','Structure','Red',(68.8,yy,12.4),(2,2,24.8))
box('UTC_Galleria_ReturnGateway_Header','Structure','Red',(68.8,-26.5,23.8),(2.2,17,2.2))
for z in range(2,25,3):
    for yy in [-34,-19]:box('UTC_RedGatewayPanelJoints','Shading','RedDark',(69.84,yy,z),(.04,1.9,.035))

# Deep steel entrance canopy with visible triangular trusses.
box('UTC_Galleria_MainCanopyRoof','Entrance','Steel',(36,-44.6,9.35),(54,10.4,.28))
for x in [10,20.5,31,41.5,52,62.5]:
    box('UTC_Galleria_MainCanopyColumns','Entrance','Steel',(x,-48.5,4.75),(.30,.30,9.1))
    box('UTC_CanopyColumnBases','Entrance','PorticoStone',(x,-48.5,.95),(.9,.9,1.6))
    for yy in [-48.8,-39.6]:beam('UTC_CanopyCrossTrusses','Entrance','Steel',(x-4.7,yy,8.05),(x+4.7,yy,8.05),.17)
    for a,b in [((x,-48.5,6.3),(x,-42.5,9.25)),((x,-39.5,8.1),(x,-44,9.25))]:beam('UTC_CanopyKneeBraces','Entrance','Steel',a,b,.18)
for yy in [-49.2,-46.7,-44.2,-41.7,-39.7]:beam('UTC_CanopyLongitudinalBeams','Entrance','Steel',(9.1,yy,9.06),(63,yy,9.06),.17,.25)
for x in range(11,64,4):
    beam('UTC_CanopyTriangularWebs','Entrance','Steel',(x,-49,8.05),(x+2,-49,9.0),.12)
    beam('UTC_CanopyTriangularWebs','Entrance','Steel',(x+2,-49,9.0),(x+4,-49,8.05),.12)
# Lighter open slatted pedestrian canopy on the east return.
for yy in range(-32,32,8):
    for xx in [69.5,74]:beam('UTC_ReturnWalkwayPosts','Entrance','Stainless',(xx,yy,.6),(xx,yy,5.8),.12)
    beam('UTC_ReturnWalkwayBeams','Entrance','Stainless',(69,yy,5.8),(74.5,yy,5.8),.14)
for yy in range(-35,35):beam('UTC_ReturnWalkwaySlats','Entrance','Stainless',(69,yy,5.95),(74.5,yy,5.95),.08,.12)

# Short cylindrical service drum and schematic rooftop plant, not an access plan.
cylinder('UTC_RooftopServiceDrum','Roofscape','White',-28,-8,18.6,5.4,6.1,40)
cylinder('UTC_ServiceDrum_Cap','Roofscape','Concrete',-28,-8,24.65,5.65,.25,40)
for i in range(24):
    a=i*math.tau/24;x=-28+5.5*math.cos(a);y=-8+5.5*math.sin(a)
    beam('UTC_ServiceDrum_RailingPosts','Roofscape','Stainless',(x,y,24.9),(x,y,25.8),.05)
for x,y in [(-31,-9),(-26,-7),(-24,-10)]:
    beam('UTC_ServiceAerialMasts','Roofscape','Steel',(x,y,24.9),(x,y,29.4),.11)
    box('UTC_ServiceAerialPanels','Roofscape','White',(x+.2,y,28.0),(.30,.18,1.6))
for i in range(8):
    x=-22+(i%2)*6;y=5+(i//2)*6
    box('UTC_RooftopPlant','Roofscape','Silver',(x,y,20.0),(3.8,3.0,2.7))
    for j in range(5):box('UTC_RooftopPlant_Grilles','Roofscape','Frame',(x,y-1.54,19.2+j*.3),(3,.04,.055))
for x,y in [(13,39),(27,39),(41,39)]:box('UTC_MallRearPlant','Roofscape','Silver',(x,y,29.2),(7,4,2.0))

# Urban corner site and two adjoining streets.
box('UTC_SitePlinth','Site','Concrete',(0,6,-.65),(172,166,1.3))
box('UTC_Forecourt','Site','Paving',(5,-46,.30),(151,15,.50))
box('UTC_WestPavement','Site','Paving',(-73,-2,.22),(12,112,.40))
box('UTC_FrontStreet','Site','Asphalt',(0,-61,.06),(170,14,.10))
box('UTC_WestStreet','Site','Asphalt',(-81,8,.06),(9,151,.10))
box('UTC_BlueStreetParkingStrip','Site','BlueLane',(1,-55.4,.13),(155,2.7,.035))
for xx in range(-76,81,7):
    box('UTC_ParkingStrip_Bays','Site','Marking',(xx,-55.4,.16),(.10,2.5,.025))
for xx in range(-79,80,9):box('UTC_RoadCentreMarkings','Site','Marking',(xx,-64.5,.13),(4,.10,.025))
for xx in range(-68,72,4):box('UTC_ForecourtPavingJoints','Site','PalePaving',(xx,-46,.57),(.045,14,.025))
for yy in [-51,-47,-43]:box('UTC_ForecourtPavingJoints','Site','PalePaving',(4,yy,.57),(149,.045,.025))
for yy in range(-46,46,6):box('UTC_WestPavementJoints','Site','PalePaving',(-73,yy,.44),(11,.04,.025))
box('UTC_RearServiceDrive','Site','Asphalt',(0,59,.1),(153,9,.15))
box('UTC_EastServiceDrive','Site','Asphalt',(77,13,.1),(6,93,.15))
for xx in [-64,-50,-36,-22,5,20,35,50,65]:box('UTC_RearParkingBayMarkings','Site','Marking',(xx,68,.13),(.10,5.0,.025))
box('UTC_RearParkingApron','Site','Asphalt',(0,68,.07),(151,12,.10))
# Small planted urban islands and mature roadside trees.
rng=random.Random(2510265)
for x,y in [(-73,44),(-73,28),(-73,-42),(72,-46),(77,52),(-67,73),(54,73)]:
    cylinder('UTC_RoundPlanterRims','Landscape','Concrete',x,y,.20,2.9,.55,24)
    cylinder('UTC_PlanterSoil','Landscape','Lawn',x,y,.76,2.65,.10,24)
    cylinder('UTC_TreeTrunks','Landscape','Trunk',x,y,.8,.22,6,10)
    for dx,dy,dz,rr in [(-1.4,0,7.1,2.6),(1.5,.3,7.7,2.9),(0,-.4,9.0,3)]:
        ellipsoid('UTC_ShadeTreeCrowns','Landscape','Leaf' if dx<0 else 'LeafLight',(x+dx,y+dy,dz),(rr,rr*.85,rr*.7),12,7)
for x,y in [(-71,-1),(-70,8),(5,-50),(66,-46),(76,7),(76,26)]:
    box('UTC_RaisedPlantingBeds','Landscape','Concrete',(x,y,.55),(3.0,4.0,.55))
    for dx in [-.65,.65]:ellipsoid('UTC_ClippedHedges','Landscape','Hedge',(x+dx,y,1.25),(1.0,1.6,.65),10,6)
for x,y in [(-76,-27),(-76,15),(-76,53),(-49,-51),(-12,-51),(27,-51),(65,-51)]:
    cylinder('UTC_OrnamentalLampPosts','StreetFurniture','Steel',x,y,.5,.11,6.0,10)
    for z in [1.3,3.8,5.7]:cylinder('UTC_LampGoldCollars','StreetFurniture','Gold',x,y,z,.18,.12,10)
    beam('UTC_LampSweptArms','StreetFurniture','Steel',(x,y,5.1),(x+1.0,y,6.9),.10)
    beam('UTC_LampSweptArms','StreetFurniture','Steel',(x+1.0,y,6.9),(x+2.3,y,7.1),.10)
    box('UTC_LampHeads','StreetFurniture','Silver',(x+2.25,y,7.0),(1.1,.35,.20))
for x,y,heading,color in [(-58,-49,90,'CarWhite'),(-42,-49,90,'CarSilver'),(-28,-49,90,'CarWhite'),(1,-48,0,'CarBlue'),(17,-48,0,'CarSilver'),(-80,-18,0,'CarWhite'),(-80,12,0,'CarBlue'),(58,68,0,'CarWhite'),(-34,68,0,'CarSilver')]:car(x,y,heading,color)
# Roof parking cars are raised only; no vehicle routes or access geometry inferred.
for x in [-61,-55]:
    start={key:len(value[0]) for key,value in batches.items()};car(x,-3,0,'CarSilver')
    for key,(vs,fs) in batches.items():
        for j in range(start.get(key,0),len(vs)):vs[j]=(vs[j][0],vs[j][1],vs[j][2]+18.7)

counts=Counter(key[0] for key in batches)
for (name,category,mat),(vs,fs) in batches.items():
    center=Vector(tuple((min(v[i] for v in vs)+max(v[i] for v in vs))/2 for i in range(3)))
    data=bpy.data.meshes.new(name+'_'+mat+'_Mesh');data.from_pydata([tuple(Vector(v)-center) for v in vs],[],fs)
    data.materials.append(mats[mat]);data.update();assert not data.validate(),name
    ob=bpy.data.objects.new(name+'_'+mat if counts[name]>1 else name,data)
    cols[category].objects.link(ob);ob.location=center;ob.parent=groups[category]
    ob['component']=category;ob['reference_model']='utc-johor-photo-study-20261025'
    if category=='Landscape' and 'Crowns' in name:
        for p in data.polygons:p.use_smooth=True

def text_mesh(name,body,f,u,z,width,mat):
    data=bpy.data.curves.new(name+'_Type','FONT');data.body=body;data.align_x='CENTER';data.size=1
    data.extrude=.012;data.bevel_depth=.003;data.bevel_resolution=0;data.resolution_u=4
    ob=bpy.data.objects.new(name+'_Typeset',data);cols['Signage'].objects.link(ob)
    origin=Vector(f(u,.90,z));ux=Vector(f(u+1,.90,z))-origin;up=Vector((0,0,1));normal=ux.cross(up)
    ob.rotation_euler=Matrix((ux,up,normal)).transposed().to_euler();ob.location=origin
    bpy.context.view_layer.update()
    # Local glyph bounds avoid world-axis width changes between the two streets.
    xs=[v[0] for v in ob.bound_box];glyph_width=max(xs)-min(xs)
    ob.scale=(width/max(glyph_width,.01),)*3;bpy.context.view_layer.update()
    data.materials.append(mats[mat])
    converted=bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    result=bpy.data.objects.new(name,converted);cols['Signage'].objects.link(result)
    result.matrix_world=ob.matrix_world.copy();result.parent=groups['Signage'];result['component']='Signage'
    bpy.data.objects.remove(ob,do_unlink=True);bpy.data.curves.remove(data)
for letter,u,w,mat in [('U',-3.6,3.4,'Blue'),('T',0,3.3,'Red'),('C',3.7,3.7,'Blue')]:text_mesh('UTC_Logo_'+letter,letter,SIGN,u,21.3,w,mat)
text_mesh('UTC_JohorLettering','JOHOR',SIGN,0,17.2,10.5,'Blue')
text_mesh('UTC_SignSubtitle','PUSAT TRANSFORMASI BANDAR',SIGN,0,19.8,11.4,'Frame')
text_mesh('UTC_GalleriaLettering','Galleria',face(0,-40.7),1.0,28.5,17.8,'Trim')
text_mesh('UTC_GalleriaSubtitle','@ Kotaraya',face(0,-40.7),3,26.8,8.3,'Trim')
text_mesh('UTC_GroundUTCLabel','UTC',face(-66.1,-1,'left'),0,4.45,3.2,'Blue')

world=bpy.data.worlds.get('UTC_Daylight') or bpy.data.worlds.new('UTC_Daylight');world.use_nodes=True
node=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
node.inputs['Color'].default_value=(.64,.72,.81,1);node.inputs['Strength'].default_value=.62;scene.world=world
assert 'SUN' in {i.identifier for i in bpy.types.Light.bl_rna.properties['type'].enum_items}
light=bpy.data.lights.new('UTC_Sun','SUN');light.energy=2.25;light.angle=.14
sun=bpy.data.objects.new('UTC_Sun',light);cols['Presentation'].objects.link(sun)
sun.rotation_euler=(math.radians(28),math.radians(-24),math.radians(-32))
camera=bpy.data.cameras.new('UTC_PresentationCamera');cam=bpy.data.objects.new('UTC_PresentationCamera',camera)
cols['Presentation'].objects.link(cam);cam.location=(-182,-199,157)
cam.rotation_euler=(Vector((-2,6,22))-cam.location).to_track_quat('-Z','Y').to_euler()
enum(camera,'type','ORTHO');camera.ortho_scale=250;camera.clip_end=1500;scene.camera=cam
scene.render.resolution_x=1800;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
enum(scene.render.image_settings,'file_format','PNG');scene.render.filepath=os.path.join(OUT,'UTC_exterior_preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(-2,6,20);area.spaces.active.region_3d.view_distance=220
        area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
        enum(area.spaces.active.shading,'color_type','MATERIAL');area.spaces.active.overlay.show_overlays=False
for ob in scene.objects:ob.select_set(ob==root)
bpy.context.view_layer.objects.active=root
print(json.dumps({'scene':scene.name,'meshes':sum(o.type=='MESH' for o in scene.objects),'building_id':'UTC_JOHOR','post':'Pos UTC','counter_coordinates':None}))
