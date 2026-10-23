import { Box3, Vector3 } from 'three';
import { buildingHotspots } from './buildingHotspots.js';

export function inspectBuilding(scene) {
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  if (bounds.isEmpty() || !size.toArray().every(Number.isFinite) || size.length() === 0) throw new Error('Model tidak mempunyai geometri yang sah.');
  const hotspots = buildingHotspots.map((location) => {
    const anchor = scene.getObjectByName(location.id);
    return { ...location, position: anchor?.getWorldPosition(new Vector3()).toArray() ?? null };
  });
  let hasGround = false;
  scene.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.name === 'SUK_Ground') hasGround = true;
  });
  return { scene, bounds, size, hotspots, hasGround };
}

export function overviewPose(bounds, aspect = 1) {
  const target = bounds.getCenter(new Vector3());
  const radius = bounds.getSize(new Vector3()).length() / 2;
  const vFov = 40 * Math.PI / 180;
  const halfAngle = Math.min(vFov / 2, Math.atan(Math.tan(vFov / 2) * aspect));
  const distance = radius / Math.sin(halfAngle) * 1.08;
  return { target, position: target.clone().add(new Vector3(.75, .65, 1).normalize().multiplyScalar(distance)) };
}

export function focusPose(position, bounds) {
  const target = new Vector3(...position);
  const span = bounds.getSize(new Vector3()).x;
  // Every current anchor is on the front exterior. Approach from +Z (glTF),
  // beyond the entire site's bounding box, rather than crossing a roof.
  return { target, position: new Vector3(target.x, Math.max(target.y + span * .18, bounds.max.y + 8), bounds.max.z + span * .22) };
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
