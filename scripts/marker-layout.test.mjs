import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spreadMarkerPoints } from '../src/components/building/markerLayout.js';

test('seven clustered callouts retain separate hit areas on mobile and desktop', () => {
  for (const [width,height] of [[311,360],[375,420],[900,600]]) {
    const points = Array.from({length:7}, (_,id) => ({id,x:width/2+id*2,y:height/2+id*2}));
    const snapshot = JSON.stringify(points);
    const layout = spreadMarkerPoints(points,width,height);
    assert.equal(JSON.stringify(points),snapshot,'Screen layout must not modify source projections');
    for (const [index, point] of layout.entries()) {
      assert.ok(point.x>=31 && point.x<=width-31 && point.y>=82 && point.y<=height-88);
      for (const other of layout.slice(index+1)) assert.ok(Math.abs(point.x-other.x)>=59 || Math.abs(point.y-other.y)>=67,'Callout buttons/tags must not overlap');
    }
  }
});

test('offscreen projections remain offscreen rather than implying an on-model location', () => {
  const points = [{id:1,x:-100,y:100},{id:2,x:450,y:100}];
  assert.deepEqual(spreadMarkerPoints(points,375,420),points);
});
