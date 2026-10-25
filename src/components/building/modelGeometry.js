import { Box3, Vector3 } from 'three';
import { buildingHotspots, exteriorLandmarks } from './buildingHotspots.js';
import { inspectZones } from './buildingZones.js';
import { getBuilding } from './buildingModels.js';
import { resolvePostPlacements } from './postPlacements.js';

export function inspectBuilding(scene, building = getBuilding()) {
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  if (bounds.isEmpty() || !size.toArray().every(Number.isFinite) || size.length() === 0) throw new Error('Model tidak mempunyai geometri yang sah.');
  const landmarks = (building.id === 'DJM' ? exteriorLandmarks : []).map((location) => {
    const anchor = scene.getObjectByName(location.id);
    return { ...location, position: anchor?.getWorldPosition(new Vector3()).toArray() ?? null };
  });
  // Floor labels are known; no surveyed indoor coordinates or floor meshes exist.
  const hotspots = resolvePostPlacements(scene, { ...building, hotspots:building.hotspots || buildingHotspots });
  let hasGround = false;
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (/(?:_Ground$|_SiteBase$|_SitePlinth$)/u.test(object.name)) hasGround = true;
  });
  const zones = inspectZones(scene, landmarks);
  const occluders = [];
  scene.traverse((o) => { if (o.isMesh && (o.userData.component === 'Structure' || /^SUK_(Main_Body|Central_AxialGallery|Rear_EntryPavilion|(Left|Right)_(Wing|Tower|RearWing|InnerPavilion|CourtyardGallery|RearCornerTower))$/.test(o.name))) occluders.push({ current: o }); });
  return { scene, bounds, size, hotspots, landmarks, hasGround, zones, occluders, buildingId: building.id, viewDirection: building.viewDirection };
}

export function overviewPose(bounds, aspect = 1, direction = [.75, .65, 1]) {
  const target = bounds.getCenter(new Vector3());
  // The estate's visual weight is near the ground, below the box's empty upper corners.
  target.y = bounds.min.y + (bounds.max.y - bounds.min.y) * .22;
  const vFov = 40 * Math.PI / 180;
  const vertical = Math.tan(vFov / 2);
  const horizontal = vertical * aspect;
  const eye = new Vector3(...direction).normalize();
  const right = new Vector3(0,1,0).cross(eye).normalize();
  const up = eye.clone().cross(right).normalize();
  let distance = 1;
  for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
    const corner = new Vector3(x,y,z).sub(target);
    distance = Math.max(distance, corner.dot(eye) + Math.abs(corner.dot(right))/horizontal*1.12,
      corner.dot(eye) + Math.abs(corner.dot(up))/vertical*1.12);
  }
  return { target, position: target.clone().add(eye.multiplyScalar(distance)) };
}

export function focusPose(position, bounds, aspect = 1, direction) {
  const target = new Vector3(...position);
  const span = bounds.getSize(new Vector3()).x;
  // Estimates use their building's viewing side, including the rear DJM post.
  // Older front-only anchors retain their existing outside-site approach.
  const camera = direction ? target.clone().add(new Vector3(...direction).normalize().multiplyScalar(span*.9)) : new Vector3(target.x, Math.max(target.y + span * .18, bounds.max.y + 8), bounds.max.z + span * .22);
  if (aspect < 1) camera.sub(target).multiplyScalar(Math.min(1.8, 1 / aspect)).add(target);
  return { target, position: camera };
}

export function presetPose(bounds, aspect, preset, overviewDirection) {
  const direction = { front: [0,.2,1], left: [-1,.4,.3], right: [1,.4,.3], top: [0,1,.01] }[preset];
  return overviewPose(bounds, aspect, direction || overviewDirection);
}

export function disposeModel(scene) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  scene.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const material of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      materials.add(material);
      Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => { t.dispose(); t.source?.data?.close?.(); });
}
