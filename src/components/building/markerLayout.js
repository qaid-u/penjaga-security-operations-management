import { Vector3 } from 'three';
import { markerPosition } from './postPlacements.js';

// Spread projected callouts while retaining a leader to the actual model point.
// This changes only screen positions, never the estimated world coordinates.
export function spreadMarkerPoints(points, width, height) {
  const padX = 31, top = 82, bottom = height - 88;
  const gapX = 60, gapY = 68;
  const placed = [];
  return points.map((point) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > width || point.y < 0 || point.y > height || bottom < top || width < padX * 2) return { ...point };
    const origin = { x: Math.max(padX, Math.min(width-padX, point.x)), y: Math.max(top, Math.min(bottom, point.y)) };
    let position = null, bestDistance = Infinity;
    const rings = Math.ceil(Math.max(width/gapX, height/gapY));
    for (let row=-rings; row<=rings; row++) for (let col=-rings; col<=rings; col++) {
      const x = Math.max(padX, Math.min(width-padX, origin.x + col*gapX));
      const y = Math.max(top, Math.min(bottom, origin.y + row*gapY));
      const distance = (x-point.x)**2 + (y-point.y)**2;
      if (distance < bestDistance && placed.every((other) => Math.abs(x-other.x) >= gapX-1 || Math.abs(y-other.y) >= gapY-1)) {
        position = { x, y }; bestDistance = distance;
      }
    }
    position ||= origin;
    placed.push(position);
    return { ...point, x:position.x, y:position.y };
  });
}
const sameMatrix = (snapshot, matrix) => snapshot.every((value, index) => value === matrix.elements[index]);
const samePosts = (snapshot, posts) => snapshot.length === posts.length && snapshot.every((saved, index) => {
  const post = posts[index], position = markerPosition(post);
  return saved.id === post.id && (saved.position === null ? position === null : position && saved.position.every((value, axis) => value === position[axis]));
});

// Html calls calculatePosition once per callout. A camera's unchanged projection,
// viewport and post coordinates share one layout, including across idle frames.
export function createMarkerLayoutCache(layoutPoints = spreadMarkerPoints) {
  const cameras = new WeakMap();
  return (camera, { width, height }, posts) => {
    const saved = cameras.get(camera);
    if (saved && saved.width === width && saved.height === height &&
      sameMatrix(saved.view, camera.matrixWorldInverse) && sameMatrix(saved.projection, camera.projectionMatrix) && samePosts(saved.posts, posts)) return saved.layout;
    const snapshots = posts.map((post) => ({ id:post.id, position:markerPosition(post)?.slice() || null }));
    const vector = new Vector3();
    const anchors = new Map();
    for (const post of snapshots) {
      if (!post.position) continue;
      vector.fromArray(post.position).project(camera);
      anchors.set(post.id, { id:post.id, x:(vector.x+1)*width/2, y:(1-vector.y)*height/2 });
    }
    const layout = new Map(layoutPoints([...anchors.values()], width, height).map((point) => [point.id, { anchor:anchors.get(point.id), position:point }]));
    cameras.set(camera, { width, height, view:camera.matrixWorldInverse.elements.slice(), projection:camera.projectionMatrix.elements.slice(), posts:snapshots, layout });
    return layout;
  };
}

export const projectedMarkerLayout = createMarkerLayoutCache();

const leaderEndpoints = new WeakMap();
export function updateMarkerLeader(line, anchor, position) {
  if (!line) return;
  const x = anchor.x-position.x, y = anchor.y-position.y;
  const previous = leaderEndpoints.get(line);
  if (!previous || previous.x !== x) line.setAttribute('x2', x);
  if (!previous || previous.y !== y) line.setAttribute('y2', y);
  leaderEndpoints.set(line, { x, y });
}
