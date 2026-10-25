import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';

const manifest=JSON.parse(await readFile(new URL('./model_manifest.json',import.meta.url),'utf8'));
const bytes=await readFile(new URL('./Bangunan_Dato_Mohamad_Salleh_Perang.glb',import.meta.url));
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(4),2);
assert.equal(bytes.readUInt32LE(8),bytes.length);
assert.equal(bytes.length,manifest.glb_bytes);
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const { scene }=gltf;
for(const name of ['BDMSP_Exterior','BDMSP_West_Wing','BDMSP_East_Wing','BDMSP_CentralHub',
  'BDMSP_Entrance_AFrames','BDMSP_EntryTiledRoof','BDMSP_PavedArrivalCourt','BDMSP_EndAccessAprons']) assert.ok(scene.getObjectByName(name),name);
for(const side of ['West','East']) for(let i=1;i<=3;i++) assert.ok(scene.getObjectByName(`BDMSP_${side}_Wing_RoofScreen${i}_Louvres`)?.isMesh);
assert.ok(scene.getObjectByName('BDMSP_CentralCrown_Louvres')?.isMesh);
let meshes=0,triangles=0;
scene.traverse(object=>{
  assert.ok(!/^(SUK_|BDARA_|HOTSPOT_|POST_)/.test(object.name),object.name);
  if(!object.isMesh)return;
  meshes++;
  assert.ok(object.material);
  assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite),object.name);
  triangles+=(object.geometry.index?.count ?? object.geometry.attributes.position.count)/3;
});
assert.equal(meshes,manifest.mesh_objects);
assert.equal(triangles,manifest.glb_triangles);
assert.ok(meshes<220 && triangles<200000 && bytes.length<12*1024*1024);
assert.equal(gltf.animations.length,0);
assert.equal(gltf.cameras.length,0);
const size=new Box3().setFromObject(scene).getSize(new Vector3());
assert.ok(size.toArray().every(Number.isFinite));
assert.ok(Math.abs(size.x-228)<.01 && Math.abs(size.z-214)<.01);
console.log(JSON.stringify({status:'passed',meshes,triangles,bytes:bytes.length,dimensions_gltf:size.toArray(),checks:'Two wings, seven separate roof-screen groups, A-frame entrance, paved approaches, finite geometry and isolated building identity verified.'},null,2));
