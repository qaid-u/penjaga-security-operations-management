import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
assert.ok(doc.nodes.every(node => node.name.startsWith('UTC_')));
assert.ok(!(doc.images?.length || doc.textures?.length));
assert.ok(doc.buffers.every(buffer => !buffer.uri));
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
);
const { scene } = gltf;
for (const name of [
  'UTC_Exterior', 'UTC_Tower_MainShaft', 'UTC_Tower_WestWing', 'UTC_Tower_EastWing',
  'UTC_Podium', 'UTC_BlueRoof', 'UTC_SignPanelBacking', 'UTC_Logo_U', 'UTC_Logo_T', 'UTC_Logo_C',
  'UTC_JohorLettering', 'UTC_GalleriaLettering', 'UTC_Galleria_MainHall',
  'UTC_Galleria_MainCanopyRoof', 'UTC_Galleria_ReturnGateway_Header', 'UTC_RooftopServiceDrum',
]) assert.ok(scene.getObjectByName(name), name);
for (let i = 1; i <= 7; i++) {
  assert.ok(scene.getObjectByName(`UTC_Galleria_SilverPanel${i}`)?.isMesh);
  assert.ok(scene.getObjectByName(`UTC_Galleria_FoldedRoof${i}`)?.isMesh);
}
const root = scene.getObjectByName('UTC_Exterior');
assert.equal(root.userData.building_id, 'UTC_JOHOR');
assert.equal(root.userData.post_name, 'Pos UTC');
assert.equal(manifest.counter_position, null);
let meshes = 0;
let triangles = 0;
scene.traverse(object => {
  assert.ok(!/^(SUK_|BDARA_|BDMSP_|BSI_|RUMAH_|POST_|HOTSPOT_)/.test(object.name), object.name);
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
assert.ok(meshes < 250 && triangles < 180000 && bytes.length < 10 * 1024 * 1024);
assert.equal(gltf.animations.length, 0);
assert.equal(gltf.cameras.length, 0);
scene.updateMatrixWorld(true);
const bounds = new Box3().setFromObject(scene);
const size = bounds.getSize(new Vector3());
const source = manifest.bounds_blender;
const expectedMin = [source.min[0], source.min[2], -source.max[1]];
const expectedMax = [source.max[0], source.max[2], -source.min[1]];
for (let i = 0; i < 3; i++) {
  assert.ok(Math.abs(bounds.min.getComponent(i) - expectedMin[i]) < .01);
  assert.ok(Math.abs(bounds.max.getComponent(i) - expectedMax[i]) < .01);
}
assert.ok(Math.abs(size.x - 172) < .01 && Math.abs(size.z - 166) < .01);
// The UTC street and mall street must remain adjoining elevations.
const utcSign = new Box3().setFromObject(scene.getObjectByName('UTC_SignPanelBacking'));
const mallFront = new Box3().setFromObject(scene.getObjectByName('UTC_Galleria_SilverPanel1'));
assert.ok(utcSign.getSize(new Vector3()).z > 10 && utcSign.getSize(new Vector3()).x < 1);
assert.ok(mallFront.getSize(new Vector3()).x > 8 && mallFront.getSize(new Vector3()).z < 3);
console.log(JSON.stringify({
  status: 'passed', meshes, triangles, materials: doc.materials.length, bytes: bytes.length,
  dimensions_gltf: size.toArray(),
  checks: 'UTC identity, tower/podium, seven facade and roof groups, signage, canopy, adjoining street elevations, finite geometry and self-contained GLB verified.',
}, null, 2));
