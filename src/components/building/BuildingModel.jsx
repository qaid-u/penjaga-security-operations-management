import { memo, useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';

export const BuildingModel = memo(function BuildingModel({ data, zone }) {
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const selected = data.zones.find((z) => z.id === zone);
    if (!selected) return;
    const affected = [];
    const selectedMeshes = new Set(selected.meshes);
    data.scene.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const original = mesh.material;
      const materials = (Array.isArray(original) ? original : [original]).map((m) => {
        const copy = m.clone();
        if (selectedMeshes.has(mesh)) { copy.emissive?.set('#be8a12'); copy.emissiveIntensity = .28; }
        else copy.color?.multiplyScalar(.55);
        return copy;
      });
      mesh.material = Array.isArray(original) ? materials : materials[0];
      affected.push({ mesh, original, materials });
    });
    invalidate();
    return () => { affected.forEach(({ mesh, original, materials }) => { mesh.material = original; materials.forEach((m) => m.dispose()); }); invalidate(); };
  }, [data, zone, invalidate]);
  return <>
    <primitive object={data.scene} dispose={null} />
    {!data.hasGround && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, data.bounds.min.y - .05, 0]} receiveShadow><planeGeometry args={[data.size.x * 1.2, data.size.z * 1.2]} /><meshStandardMaterial color="#c6cdbd" /></mesh>}
  </>;
});
