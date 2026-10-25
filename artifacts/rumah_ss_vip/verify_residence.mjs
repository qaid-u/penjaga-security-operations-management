import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3, Raycaster } from 'three';

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
assert.ok(doc.nodes.every(node => node.name.startsWith('RUMAH_')));
assert.ok(!(doc.images?.length || doc.textures?.length));
assert.ok(doc.buffers.every(buffer => !buffer.uri));
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
);
const { scene } = gltf;
for (const name of [
  'RUMAH_Shared_Exterior', 'RUMAH_MainHouse_StoneLower', 'RUMAH_MainHouse_WhiteUpper',
  'RUMAH_MainHouse_HipRoof', 'RUMAH_EntrancePavilion_BalconySlab',
  'RUMAH_PorchGroundDoors_Glass', 'RUMAH_PorchUpperDoors_Glass',
  'RUMAH_EastAnnex', 'RUMAH_RearWestLodge', 'RUMAH_RearEastLodge', 'RUMAH_RearNorthLodge',
  'RUMAH_WhiteLandscapeStair_Treads', 'RUMAH_PatternedCourt_Tiles',
]) assert.ok(scene.getObjectByName(name), name);
const root = scene.getObjectByName('RUMAH_Shared_Exterior');
assert.equal(root.userData.shared_model_id, 'JOHOR_SS_VIP_RESIDENCE');
assert.deepEqual(JSON.parse(root.userData.post_names_json), ['Pos Rumah SS', 'Pos Rumah VIP']);
assert.equal(JSON.parse(root.userData.building_names_json).length, 2);
let meshes = 0;
let triangles = 0;
scene.traverse(object => {
  assert.ok(!/^(BSI_|BDMSP_|BDARA_|SUK_|POST_|HOTSPOT_)/.test(object.name), object.name);
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
assert.ok(meshes < 350 && triangles < 200000 && bytes.length < 12 * 1024 * 1024);
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
// These rays check actual exported surfaces at the uphill road's grade changes.
const road = scene.getObjectByName('RUMAH_CurvedArrivalRoad');
const ground = scene.getObjectByName('RUMAH_SlopingGround');
for (const [x, y] of [[53.5, -60], [52.2, -53], [47, -47.3], [37, -74]]) {
  const hits = new Raycaster(new Vector3(x, 60, -y), new Vector3(0, -1, 0)).intersectObjects([road, ground]);
  assert.equal(hits[0]?.object, road, `Road should remain visible over terrain at ${x}, ${y}`);
}
// At person height, each front porch arch must be open before the recessed door.
const portals = [];
scene.traverse(object => {
  if (object.isMesh && /^RUMAH_PorchFront_(Spandrels|ArchTrim)/.test(object.name)) portals.push(object);
});
assert.ok(portals.length);
for (const x of [6.4, 11.6]) {
  const ray = new Raycaster(new Vector3(x, 6, 13), new Vector3(0, 0, -1), 0, 4);
  assert.equal(ray.intersectObjects(portals).length, 0, 'Porch arch passage is blocked');
}
const reuseUrl = new URL('./shared_model_reference.json', import.meta.url);
const reuse = JSON.parse(await readFile(reuseUrl, 'utf8'));
assert.equal(reuse.shared_model_id, root.userData.shared_model_id);
assert.deepEqual(reuse.identities.map(item => [item.building_id, item.post]), [
  ['RUMAH_SS', 'Pos Rumah SS'], ['RUMAH_VIP', 'Pos Rumah VIP'],
]);
for (const field of ['geometry_source', 'editable_source', 'source_manifest']) await access(new URL(reuse[field], reuseUrl));
assert.equal(reuse.geometry_source, manifest.glb_file);
console.log(JSON.stringify({
  status: 'passed', meshes, triangles, materials: doc.materials.length, bytes: bytes.length,
  dimensions_gltf: size.toArray(),
  checks: 'Shared identities, house/annex/lodges, doors, open porch, road visibility at grade changes, finite geometry, bounds and self-contained GLB verified.',
}, null, 2));
