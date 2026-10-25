import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { PerspectiveCamera, Vector3 } from 'three';
import { createMarkerLayoutCache, spreadMarkerPoints, updateMarkerLeader } from '../src/components/building/markerLayout.js';

const viewport = { width:375, height:360 };
const posts = () => Array.from({ length:7 }, (_, index) => ({ id:`POST_${index}`, position:null, estimatedPosition:[index*2-6, index*1.5, 20] }));
function camera() {
  const result = new PerspectiveCamera(40, viewport.width/viewport.height, .5, 3000);
  result.position.set(90, 80, 150);
  result.lookAt(0, 0, 0);
  result.updateMatrixWorld(true);
  return result;
}
function projectMarkers(view, size, locations) {
  return locations.filter((post) => post.position || post.estimatedPosition).map((post) => {
    const point = new Vector3(...(post.position || post.estimatedPosition)).project(view);
    return { id:post.id, x:(point.x+1)*size.width/2, y:(1-point.y)*size.height/2 };
  });
}

test('callouts share one unchanged layout and preserve exact projected anchors and source coordinates', () => {
  let computations = 0;
  const cached = createMarkerLayoutCache((...args) => { computations++; return spreadMarkerPoints(...args); });
  const view = camera(), locations = posts(), snapshot = JSON.stringify(locations);
  const result = cached(view, viewport, locations);
  for (let frame=0; frame<8; frame++) for (const post of locations) {
    assert.equal(cached(view, viewport, [...locations]), result);
    assert.ok(result.has(post.id));
  }
  assert.equal(computations, 1);
  const anchors = projectMarkers(view, viewport, locations);
  const expected = spreadMarkerPoints(anchors, viewport.width, viewport.height);
  for (const [index, post] of locations.entries()) {
    assert.deepEqual(result.get(post.id).anchor, anchors[index]);
    assert.deepEqual(result.get(post.id).position, expected[index]);
  }
  assert.equal(JSON.stringify(locations), snapshot);
});

test('camera movement, lens, viewport, marker coordinates and identities invalidate the shared layout', () => {
  let computations = 0;
  const cached = createMarkerLayoutCache((...args) => { computations++; return spreadMarkerPoints(...args); });
  const view = camera(), locations = posts();
  let last = cached(view, viewport, locations);
  const changed = (size = viewport, list = locations, activeCamera = view) => {
    const next = cached(activeCamera, size, list);
    assert.notEqual(next, last);
    last = next;
  };
  view.position.x += 5; view.updateMatrixWorld(true); changed();
  view.fov = 50; view.updateProjectionMatrix(); changed();
  changed({ width:600, height:400 });
  locations[0].estimatedPosition[1] += 2; changed();
  locations[0].position = [0, 5, 22]; changed();
  locations[0].id = 'OTHER_BUILDING_POST'; changed();
  changed(viewport, [...locations].reverse());
  changed(viewport, locations.slice(1));
  changed(viewport, locations, camera());
  assert.equal(computations, 10);
});

test('leader endpoints skip unchanged DOM writes and continue pointing to the original projection', () => {
  const writes = [];
  const line = { setAttribute:(name, value) => writes.push([name, value]) };
  updateMarkerLeader(null, {x:100,y:120}, {x:140,y:150});
  updateMarkerLeader(line, {x:100,y:120}, {x:140,y:150});
  assert.deepEqual(writes, [['x2',-40],['y2',-30]]);
  for (let frame=0; frame<10; frame++) updateMarkerLeader(line, {x:100,y:120}, {x:140,y:150});
  assert.equal(writes.length, 2);
  updateMarkerLeader(line, {x:105,y:120}, {x:140,y:150});
  assert.deepEqual(writes.at(-1), ['x2',-35]);
  assert.equal(writes.length, 3);
  updateMarkerLeader(line, {x:115,y:130}, {x:150,y:160});
  assert.equal(writes.length, 3, 'Translating both endpoints equally must not rewrite the same relative line');
});

test('seven callouts perform one layout per moving-camera frame rather than seven', (context) => {
  const frames = 60, locations = posts();
  let oldComputations = 0, sharedComputations = 0;
  const oldCamera = camera();
  const oldStart = performance.now();
  for (let frame=0; frame<frames; frame++) {
    oldCamera.position.x += .01; oldCamera.updateMatrixWorld(true);
    for (const post of locations) {
      const points = projectMarkers(oldCamera, viewport, locations);
      assert.ok(spreadMarkerPoints(points, viewport.width, viewport.height).find((point) => point.id === post.id));
      oldComputations++;
    }
  }
  const oldMs = performance.now()-oldStart;
  const cached = createMarkerLayoutCache((...args) => { sharedComputations++; return spreadMarkerPoints(...args); });
  const newCamera = camera(), sharedStart = performance.now();
  for (let frame=0; frame<frames; frame++) {
    newCamera.position.x += .01; newCamera.updateMatrixWorld(true);
    for (const post of locations) assert.ok(cached(newCamera, viewport, locations).get(post.id));
  }
  const sharedMs = performance.now()-sharedStart;
  assert.equal(oldComputations, frames*locations.length);
  assert.equal(sharedComputations, frames);
  context.diagnostic(`${frames} moving-camera frames / 7 callouts: ${oldComputations} -> ${sharedComputations} layouts; ${oldMs.toFixed(1)}ms -> ${sharedMs.toFixed(1)}ms (timing informational).`);
});
