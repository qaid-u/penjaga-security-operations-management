import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';

const manifest = JSON.parse(await readFile(new URL('./model_manifest.json', import.meta.url), 'utf8'));
const bytes = await readFile(new URL(`./${manifest.glb_file}`, import.meta.url));
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert.equal(bytes.length, manifest.glb_bytes);
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
assert.equal(doc.nodes.length, manifest.glb_nodes);
assert.equal(doc.materials.length, manifest.materials);
assert.ok(doc.nodes.every(node => node.name.startsWith('BSI_')));
assert.ok(!(doc.images?.length || doc.textures?.length));
assert.ok(doc.buffers.every(buffer => !buffer.uri));

const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
);
const { scene } = gltf;
for (const name of [
  'BSI_Exterior', 'BSI_MainHall', 'BSI_OctagonalHall', 'BSI_EntryTower_Shaft',
  'BSI_MainOvalSkylight_Glass', 'BSI_OctagonalSkylight_Glass',
  'BSI_MainEntranceSteps', 'BSI_RedPavingStars', 'BSI_GalleryApproachSteps',
]) assert.ok(scene.getObjectByName(name), name);
for (const side of ['West', 'East']) {
  for (const row of ['Front', 'Rear']) {
    assert.ok(scene.getObjectByName(`BSI_${side}_${row}Wing`)?.isMesh);
    assert.ok(scene.getObjectByName(`BSI_${side}_${row}Wing_Roof`)?.isMesh);
  }
}
assert.equal(scene.getObjectByName('BSI_Exterior').userData.building_id, 'BSI_KOTA_ISKANDAR');
let meshes = 0;
let triangles = 0;
scene.traverse(object => {
  assert.ok(!/^(SUK_|BDARA_|BDMSP_|POST_|HOTSPOT_)/.test(object.name), object.name);
  assert.ok(object.matrix.elements.every(Number.isFinite), object.name);
  if (!object.isMesh) return;
  meshes++;
  assert.ok(object.material, object.name);
  assert.ok(object.geometry.attributes.position.array.every(Number.isFinite), object.name);
  triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
});
assert.equal(meshes, manifest.mesh_objects);
assert.equal(triangles, manifest.glb_triangles);
assert.equal(triangles, manifest.source_triangles);
assert.ok(meshes < 360 && triangles < 400000 && bytes.length < 22 * 1024 * 1024);
assert.equal(gltf.animations.length, 0);
assert.equal(gltf.cameras.length, 0);
const bounds = new Box3().setFromObject(scene);
const size = bounds.getSize(new Vector3());
const source = manifest.bounds_blender;
const expectedMin = [source.min[0], source.min[2], -source.max[1]];
const expectedMax = [source.max[0], source.max[2], -source.min[1]];
for (let i = 0; i < 3; i++) {
  assert.ok(Math.abs(bounds.min.getComponent(i) - expectedMin[i]) < .01);
  assert.ok(Math.abs(bounds.max.getComponent(i) - expectedMax[i]) < .01);
}
assert.ok(Math.abs(size.x - 248) < .01 && Math.abs(size.z - 256) < .01);

const reuseUrl = new URL('../bdmim/model_reference.json', import.meta.url);
const reuse = JSON.parse(await readFile(reuseUrl, 'utf8'));
for (const field of ['geometry_source', 'editable_source', 'source_manifest']) {
  await access(new URL(reuse[field], reuseUrl));
}
assert.match(reuse.geometry_source, /bdmsp\/Bangunan_Dato_Mohamad_Salleh_Perang\.glb$/);
console.log(JSON.stringify({
  status: 'passed', meshes, triangles, materials: doc.materials.length, bytes: bytes.length,
  dimensions_gltf: size.toArray(),
  checks: 'BSI identity, four wings, two skylights, tower, entrance steps, paving, finite geometry, self-contained GLB and BDMIM reuse sources verified.',
}, null, 2));
