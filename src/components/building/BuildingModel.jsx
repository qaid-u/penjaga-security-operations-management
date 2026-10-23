export function BuildingModel({ data }) {
  return <>
    <primitive object={data.scene} dispose={null} />
    {!data.hasGround && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, data.bounds.min.y - .05, 0]} receiveShadow><planeGeometry args={[data.size.x * 1.2, data.size.z * 1.2]} /><meshStandardMaterial color="#c6cdbd" /></mesh>}
  </>;
}
