import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { modeledBuildings, getBuilding } from '../src/components/building/buildingModels.js';
import { resolvePostPlacements, markerPosition } from '../src/components/building/postPlacements.js';
import { disposeModel } from '../src/components/building/modelGeometry.js';

const publication = JSON.parse(await readFile(new URL('../public/models/library/manifest.json', import.meta.url), 'utf8'));

test('catalogue keeps fifteen official post identities and the supplied floor labels unverified', () => {
  const posts = modeledBuildings.flatMap((building) => building.hotspots);
  assert.equal(posts.length, 15);
  assert.equal(new Set(posts.map((post) => post.id)).size, 15);
  assert.ok(posts.every((post) => post.position === null && post.positionStatus === 'unconfirmed'));
  assert.deepEqual(getBuilding('DJM').hotspots.map((post) => post.floor), [null, null, 'Tingkat 3', 'Tingkat 4', 'Tingkat 4', 'LG', 'LG']);
  assert.notEqual(getBuilding('RUMAH_SS').hotspots[0].id, getBuilding('RUMAH_VIP').hotspots[0].id);
  assert.notEqual(getBuilding('BDMSP').hotspots[0].id, getBuilding('BDMIM').hotspots[0].id);
});

for (const model of publication) {
  test(`${model.model_id} resolves finite illustrative placements without changing verified positions or model geometry`, async () => {
    const bytes = await readFile(new URL(`../${model.public_file}`, import.meta.url));
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    try {
      scene.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(scene);
      const span = bounds.getSize(new Vector3());
      const nearSite = bounds.clone().expandByScalar(Math.max(span.x, span.z) * .15);
      const identities = modeledBuildings.filter((building) => building.modelId === model.model_id);
      const originalCount = countObjects(scene);
      const snapshots = identities.map((building) => JSON.stringify(building.hotspots));
      for (const [index, building] of identities.entries()) {
        const placements = resolvePostPlacements(scene, building, bounds);
        assert.equal(placements.length, building.postCount, building.id);
        assert.deepEqual(placements.map((post) => post.id), building.hotspots.map((post) => post.id));
        for (const post of placements) {
          const official = building.hotspots.find((item) => item.id === post.id);
          assert.equal(post.position, null, `${post.id} must not gain a verified coordinate`);
          assert.equal(post.floor, official.floor, `${post.id} must not acquire an invented floor`);
          assert.ok(Array.isArray(post.estimatedPosition) && post.estimatedPosition.length === 3, post.id);
          assert.ok(post.estimatedPosition.every(Number.isFinite), post.id);
          assert.ok(nearSite.containsPoint(new Vector3(...post.estimatedPosition)), `${post.id} estimate is detached from the model site`);
          assert.ok(post.estimatedPosition[1] >= Math.max(0, bounds.min.y) && post.estimatedPosition[1] <= bounds.max.y, `${post.id} estimate is below the display ground or above the model`);
          assert.equal(post.placement?.status, 'estimated', post.id);
          assert.equal(post.placement?.confidence, 'low', post.id);
          assert.ok(typeof post.placement?.basis === 'string' && post.placement.basis.trim().length > 12, `${post.id} needs a stated visual basis`);
          assert.equal(post.placement.buildingId, building.id);
          assert.equal(post.placement.modelId, building.modelId);
          assert.equal(post.placement.knownFloor, official.floor || null);
          assert.equal(post.placement.anchorFound, true, `${post.id} must resolve its stated feature in the shipped model`);
          assert.ok(scene.getObjectByName(post.placement.anchorNode), `${post.id} references a missing feature`);
          assert.ok(typeof post.placement.method === 'string' && post.placement.method.length > 0);
          if (post.id === 'POST_DJM_MAIN_LOBBY') {
            assert.equal(post.placement.anchorNode, 'Entrance_Platform');
            assert.ok(post.estimatedPosition[1] < 5, 'Lobby approach estimate must remain near entrance level rather than the roof');
          }
        }
        assert.equal(JSON.stringify(building.hotspots), snapshots[index], 'Resolving estimates must not mutate official catalogue data');
      }
      assert.equal(countObjects(scene), originalCount, 'Resolving estimates must not add or remove Blender-exported geometry');
      // A named mesh/empty is not evidence that an official post was surveyed.
      const building = identities[0];
      const impostor = new Group();
      impostor.name = building.hotspots[0].id;
      impostor.position.copy(bounds.getCenter(new Vector3()));
      scene.add(impostor);
      const resolved = resolvePostPlacements(scene, building, bounds);
      assert.equal(resolved[0].position, null);
      assert.equal(resolved[0].placement.status, 'estimated');
      scene.remove(impostor);
      // A changed asset must degrade to an unavailable estimate, not a site-centre guess.
      const names = [];
      scene.traverse((object) => names.push([object, object.name]));
      let unavailable;
      try {
        for (const [object, name] of names) object.name = `RENAMED_${name}`;
        for (const identity of identities) {
          const missing = resolvePostPlacements(scene, identity, bounds);
          if (identity.id === building.id) unavailable = missing;
          for (const post of missing) {
            assert.equal(post.position, null);
            assert.equal(post.estimatedPosition, null);
            assert.equal(markerPosition(post), null, `${post.id} must not render a guessed marker when all reference features disappear`);
            assert.equal(post.placement.status, 'unavailable');
            assert.equal(post.placement.reason, 'reference-feature-missing');
            assert.equal(post.placement.anchorFound, false);
          }
        }
      } finally {
        for (const [object, name] of names) object.name = name;
      }
      const secondaryCase = unavailable.find((post) => post.placement.anchorCandidates.filter((name) => scene.getObjectByName(name)).length > 1);
      if (secondaryCase) {
        const original = resolvePostPlacements(scene, building, bounds).find((post) => post.id === secondaryCase.id);
        const primary = scene.getObjectByName(original.placement.anchorNode);
        const primaryName = primary.name;
        try {
          primary.name = `MISSING_PRIMARY_${primaryName}`;
          const alternative = resolvePostPlacements(scene, building, bounds).find((post) => post.id === secondaryCase.id);
          assert.equal(alternative.position, null);
          assert.equal(alternative.placement.status, 'estimated');
          assert.equal(alternative.placement.anchorFound, true);
          assert.notEqual(alternative.placement.anchorNode, primaryName);
          assert.ok(secondaryCase.placement.anchorCandidates.includes(alternative.placement.anchorNode));
          assert.ok(alternative.estimatedPosition.every(Number.isFinite));
          assert.ok(alternative.estimatedPosition[1] >= Math.max(0, bounds.min.y) && alternative.estimatedPosition[1] <= bounds.max.y, `${alternative.id} secondary reference must not put its estimate underground or above the model`);
          if (alternative.id === 'POST_DJM_MAIN_LOBBY') assert.ok(alternative.estimatedPosition[1] < 5, 'Secondary lobby reference must remain near the entrance approach');
        } finally {
          primary.name = primaryName;
        }
      }
    } finally {
      disposeModel(scene);
    }
  });
}

function countObjects(scene) {
  let count = 0;
  scene.traverse(() => count++);
  return count;
}
