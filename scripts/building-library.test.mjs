import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PerspectiveCamera, Vector3 } from 'three';
import { modeledBuildings, getBuilding, matchingBuildingPost } from '../src/components/building/buildingModels.js';
import { inspectBuilding, overviewPose, disposeModel } from '../src/components/building/modelGeometry.js';

const root = new URL('../', import.meta.url);
const publication = JSON.parse(await readFile(new URL('public/models/library/manifest.json', root), 'utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const publicPath = (url) => {
  const path = decodeURIComponent(new URL(url, 'https://model.test').pathname);
  assert.ok(path.startsWith('/models/') && !path.includes('..'), path);
  return new URL(`public${path}`, root);
};

test('eight building identities use six assets and preserve distinct official posts', async () => {
  assert.deepEqual(modeledBuildings.map((building) => building.id), [
    'DJM', 'BDARA', 'BDMSP', 'BDMIM', 'BSI_KOTA_ISKANDAR', 'RUMAH_SS', 'RUMAH_VIP', 'UTC_JOHOR',
  ]);
  assert.equal(new Set(modeledBuildings.map((building) => building.modelId)).size, 6);
  assert.equal(new Set(modeledBuildings.map((building) => building.modelUrl)).size, 6);
  assert.equal(modeledBuildings.reduce((total, building) => total + building.postCount, 0), 15);
  const postIds = modeledBuildings.flatMap((building) => building.hotspots.map((post) => post.id));
  assert.equal(new Set(postIds).size, postIds.length);
  for (const building of modeledBuildings) {
    assert.equal(building.postCount, building.hotspots.length);
    assert.ok(building.hotspots.every((post) => post.position === null && post.positionStatus === 'unconfirmed'));
    assert.ok(building.name && building.shortName && building.region);
    const image = await readFile(publicPath(building.previewUrl));
    assert.equal(image.subarray(0, 4).toString(), 'RIFF');
    assert.equal(image.subarray(8, 12).toString(), 'WEBP');
    assert.ok(image.length > 1000 && image.length < 1024 * 1024, building.id);
  }
  assert.equal(getBuilding('BDMIM').modelUrl, getBuilding('BDMSP').modelUrl);
  assert.equal(getBuilding('RUMAH_SS').modelUrl, getBuilding('RUMAH_VIP').modelUrl);
  assert.notDeepEqual(getBuilding('RUMAH_SS').hotspots, getBuilding('RUMAH_VIP').hotspots);
  for (const invalid of [undefined, '', 'BSI_JOHOR_BAHRU', '__proto__', 'constructor']) assert.equal(getBuilding(invalid).id, 'DJM');
});

test('public and backend building/post catalogues agree without inventing indoor positions', async () => {
  const frontend = JSON.parse(await readFile(new URL('src/components/building/securityBuildings.json', root), 'utf8'));
  const backend = JSON.parse(await readFile(new URL('backend/config/securityBuildings.json', root), 'utf8'));
  assert.deepEqual(frontend, backend);
  for (const building of modeledBuildings) {
    for (const post of building.hotspots) {
      const record = { nama_pos: post.name, nama_bangunan: building.name };
      assert.equal(matchingBuildingPost(record, post.id, building), true, post.id);
      assert.equal(matchingBuildingPost({ ...record, nama_bangunan: 'Bangunan lain' }, post.id, building), false);
      const another = modeledBuildings.find((candidate) => candidate.id !== building.id);
      assert.equal(matchingBuildingPost(record, another.hotspots[0].id, another), false);
    }
  }
  const bsi = getBuilding('BSI_KOTA_ISKANDAR');
  assert.equal(matchingBuildingPost({ nama_pos: bsi.hotspots[0].name, nama_bangunan: 'Bangunan Sultan Ibrahim (BSI), Johor Bahru' }, bsi.hotspots[0].id, bsi), false);
});

for (const published of publication) {
  test(`${published.model_id} public GLB matches its source and loads with isolated building identity`, async () => {
    const building = modeledBuildings.find((entry) => entry.modelId === published.model_id);
    assert.ok(building, published.model_id);
    const [bytes, sourceBytes, manifestText] = await Promise.all([
      readFile(publicPath(building.modelUrl)),
      readFile(new URL(published.source, root)),
      readFile(new URL('model_manifest.json', new URL(published.source, root)), 'utf8'),
    ]);
    const manifest = JSON.parse(manifestText);
    assert.equal(bytes.length, published.bytes);
    assert.equal(digest(bytes), published.sha256);
    assert.equal(digest(bytes), digest(sourceBytes));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
    assert.ok(!json.images?.length && !json.textures?.length);
    assert.ok(json.buffers.every((buffer) => !buffer.uri));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    try {
      const data = inspectBuilding(gltf.scene, building);
      let meshes = 0;
      let triangles = 0;
      gltf.scene.traverse((object) => {
        if (!object.isMesh) return;
        meshes++;
        assert.ok(object.material, object.name);
        assert.ok(object.geometry.attributes.position.array.every(Number.isFinite), object.name);
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      });
      assert.equal(meshes, manifest.mesh_objects);
      assert.equal(triangles, manifest.glb_triangles ?? manifest.triangles);
      assert.equal(gltf.cameras.length, 0);
      assert.equal(gltf.animations.length, 0);
      assert.equal(data.hasGround, true);
      assert.ok(data.size.toArray().every((value) => Number.isFinite(value) && value > 0));
      assert.equal(data.buildingId, building.id);
      assert.deepEqual(data.hotspots.map((post) => post.id), building.hotspots.map((post) => post.id));
      assert.ok(data.hotspots.every((post) => post.position === null));
      if (building.id !== 'DJM') assert.deepEqual(data.landmarks, []);
      for (const identity of modeledBuildings.filter((entry) => entry.modelId === building.modelId)) {
        const inspected = inspectBuilding(gltf.scene, identity);
        assert.equal(inspected.buildingId, identity.id);
        assert.deepEqual(inspected.hotspots.map((post) => post.id), identity.hotspots.map((post) => post.id));
        assert.ok(inspected.hotspots.every((post) => !gltf.scene.getObjectByName(post.id)));
      }
      for (const aspect of [.45, 1, 1.7]) {
        const pose = overviewPose(data.bounds, aspect, building.viewDirection);
        assert.ok(!data.bounds.containsPoint(pose.position));
        assert.ok(pose.position.toArray().every(Number.isFinite));
        const camera = new PerspectiveCamera(40, aspect, .5, 3000);
        camera.position.copy(pose.position);
        camera.lookAt(pose.target);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        for (const x of [data.bounds.min.x, data.bounds.max.x]) {
          for (const y of [data.bounds.min.y, data.bounds.max.y]) {
            for (const z of [data.bounds.min.z, data.bounds.max.z]) {
              const projected = new Vector3(x, y, z).project(camera);
              const label = `${building.id}, aspect ${aspect}, corner ${x}/${y}/${z}`;
              assert.ok(projected.toArray().every(Number.isFinite), label);
              assert.ok(Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1, `Overview clips an estate corner: ${label}`);
              assert.ok(projected.z >= -1 && projected.z <= 1, `Estate corner is outside camera depth: ${label}`);
            }
          }
        }
      }
    } finally {
      disposeModel(gltf.scene);
    }
  });
}
