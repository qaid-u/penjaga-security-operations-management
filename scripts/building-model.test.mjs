import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Group, Vector3 } from 'three';
import { inspectBuilding, focusPose, overviewPose, disposeModel } from '../src/components/building/modelGeometry.js';

const bytes = await readFile(new URL('../public/models/Bangunan_SUK.glb', import.meta.url));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const { scene } = await new GLTFLoader().parseAsync(buffer, '');
const data = inspectBuilding(scene);

test('approved public asset exactly preserves the original export', async () => {
  const original = await readFile(new URL('../artifacts/suk/Bangunan_SUK_Exterior.glb', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(original).digest('hex'));
});
test('GLB contains real geometry, materials, ground and all seven world-space anchors', () => {
  let meshCount = 0;
  scene.traverse((object) => { if (object.isMesh) { meshCount++; assert.ok(object.material); } });
  assert.equal(meshCount, 192);
  assert.ok(data.hasGround);
  assert.equal(data.hotspots.filter((h) => h.position).length, 7);
  assert.ok(Math.abs(data.size.x - 192) < .01);
  const entrance = data.hotspots.find((h) => h.id === 'HOTSPOT_MAIN_ENTRANCE');
  entrance.position.forEach((value, i) => assert.ok(Math.abs(value - [0, 7, 44][i]) < .001));
});
test('focus poses stay outside site bounds for every location', () => {
  for (const hotspot of data.hotspots) {
    const pose = focusPose(hotspot.position, data.bounds);
    assert.equal(data.bounds.containsPoint(pose.position), false);
    assert.ok(pose.position.z > data.bounds.max.z);
    assert.ok(pose.target.distanceTo(new Vector3(...hotspot.position)) < .001);
  }
});
test('overview framing accounts for narrow mobile aspect ratios', () => {
  const desktop = overviewPose(data.bounds, 1.7);
  const mobile = overviewPose(data.bounds, .7);
  assert.ok(mobile.position.distanceTo(mobile.target) > desktop.position.distanceTo(desktop.target));
});
test('anchor resolution includes parent rotation, translation and scale', () => {
  const parent = new Group(); parent.position.set(10, 20, 30); parent.scale.setScalar(2); parent.rotation.y = .5;
  parent.add(scene); parent.updateMatrixWorld(true);
  const transformed = inspectBuilding(scene).hotspots[0].position;
  const expected = new Vector3(0, 7, 44).applyMatrix4(parent.matrixWorld);
  assert.ok(new Vector3(...transformed).distanceTo(expected) < .001);
  parent.remove(scene); disposeModel(scene);
});
