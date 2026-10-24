import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Group, Vector3, Raycaster } from 'three';
import { inspectBuilding, focusPose, overviewPose, presetPose, disposeModel } from '../src/components/building/modelGeometry.js';
import { klDay, dateRange } from '../src/components/building/operationalFilters.js';
import { indicator } from '../src/components/building/operationalIndicators.js';

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
test('Phase 4 zones resolve actual mesh subsets, with no invented floors', () => {
  assert.equal(data.zones.length,7);
  for (const z of data.zones) { assert.ok(z.meshes.length>0); assert.ok(z.meshes.every((m) => m.isMesh)); }
  assert.ok(data.zones.find((z) => z.id === 'HOTSPOT_LEFT_TOWER').meshes.some((m) => m.name === 'SUK_Left_Tower'));
  assert.ok(data.occluders.length >= 5);
  assert.ok(!data.zones.some((z) => /floor|level/i.test(z.name)));
});

test('Phase 4 camera presets fit bounds and stay outside the exterior for desktop/tablet/mobile', () => {
  for (const aspect of [.5,1,1.7]) for (const preset of ['overview','front','left','right','top']) {
    const pose = presetPose(data.bounds,aspect,preset);
    assert.ok(!data.bounds.containsPoint(pose.position));
    assert.ok(pose.position.toArray().every(Number.isFinite));
    assert.ok(pose.position.distanceTo(pose.target) >= data.size.length());
  }
  assert.ok(focusPose(data.hotspots[0].position,data.bounds,.5).position.distanceTo(new Vector3(...data.hotspots[0].position)) > focusPose(data.hotspots[0].position,data.bounds,1).position.distanceTo(new Vector3(...data.hotspots[0].position)));
});

test('coarse occlusion geometry blocks a rear-to-front ray without blocking the entrance front view', () => {
  const anchor = new Vector3(...data.hotspots[0].position);
  const occluded = (origin) => {
    const ray = new Raycaster(origin,anchor.clone().sub(origin).normalize(),0,origin.distanceTo(anchor));
    return ray.intersectObjects(data.occluders.map((r) => r.current),false).length>0;
  };
  assert.equal(occluded(new Vector3(0,7,-200)),true);
  assert.equal(occluded(new Vector3(0,7,200)),false);
});

test('Kuala Lumpur quick ranges use inclusive calendar dates across year and leap-day boundaries', () => {
  assert.equal(klDay(new Date('2026-10-23T17:00:00Z')),'2026-10-24');
  assert.deepEqual(dateRange('2026-01-03',7),{from:'2025-12-28',to:'2026-01-03'});
  assert.deepEqual(dateRange('2024-03-01',2),{from:'2024-02-29',to:'2024-03-01'});
});

test('unknown, filtered, completed and unavailable indicators remain distinct', () => {
  const location={status_aktif:true,id_pos:1,metrics:{incidents:{total:1,Unknown:1},follow_up:{open:0,in_progress:0,completed:1}}};
  assert.match(indicator(location,'incidents').text,/Klasifikasi tidak tersedia/);
  assert.match(indicator(location,'followup').text,/1 selesai/);
  assert.equal(indicator({...location,in_scope:false},'incidents').text,'Di luar penapis');
  assert.equal(indicator(location,'incidents',true).text,'Data tidak tersedia');
});

test('anchor resolution includes parent rotation, translation and scale', () => {
  const parent = new Group(); parent.position.set(10, 20, 30); parent.scale.setScalar(2); parent.rotation.y = .5;
  parent.add(scene); parent.updateMatrixWorld(true);
  const transformed = inspectBuilding(scene).hotspots[0].position;
  const expected = new Vector3(0, 7, 44).applyMatrix4(parent.matrixWorld);
  assert.ok(new Vector3(...transformed).distanceTo(expected) < .001);
  parent.remove(scene); disposeModel(scene);
});
