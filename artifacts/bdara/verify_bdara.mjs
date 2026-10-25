import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';

const manifest = JSON.parse(await readFile(new URL('./model_manifest.json',import.meta.url),'utf8'));
const bytes = await readFile(new URL('./Bangunan_Dato_Abdul_Rahman_Andak.glb',import.meta.url));
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(4),2);
assert.equal(bytes.readUInt32LE(8),bytes.length);
assert.equal(bytes.length,manifest.glb_bytes);
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const { scene } = gltf;
for(const name of ['BDARA_Exterior','BDARA_CentralSpine','BDARA_West_FacetedPavilion','BDARA_CoveredDrive_Piers','BDARA_MainEntrancePortico_Roof','BDARA_MainPedestrianAxis']) assert.ok(scene.getObjectByName(name),name);
for(const row of ['Front','Rear']) for(const side of ['West','East']) {
  const name=`BDARA_${row}_${side}_Wing`;
  assert.ok(scene.getObjectByName(name)?.isMesh,name);
  assert.ok(scene.getObjectByName(`${name}_FoldedRoof`)?.isMesh);
}
let meshes=0,triangles=0;
scene.traverse(object=>{
  assert.ok(!/^(SUK_|HOTSPOT_|POST_)/.test(object.name),object.name);
  if(!object.isMesh)return;
  meshes++;
  assert.ok(object.material);
  const positions=object.geometry.attributes.position;
  assert.ok([...positions.array].every(Number.isFinite),object.name);
  triangles+=(object.geometry.index?.count ?? positions.count)/3;
});
assert.equal(meshes,manifest.mesh_objects);
assert.equal(triangles,manifest.glb_triangles);
assert.ok(meshes<250 && triangles<275000 && bytes.length<16*1024*1024);
assert.equal(gltf.animations.length,0);
assert.equal(gltf.cameras.length,0);
const size=new Box3().setFromObject(scene).getSize(new Vector3());
assert.ok(size.toArray().every(Number.isFinite));
assert.ok(Math.abs(size.x-236)<.01 && Math.abs(size.z-222)<.01);
console.log(JSON.stringify({status:'passed',meshes,triangles,bytes:bytes.length,dimensions_gltf:size.toArray(),checks:'Four wings, central spine, pavilion, canopy, GLB loading, finite geometry and isolated building identity verified.'},null,2));
