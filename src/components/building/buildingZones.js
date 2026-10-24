// Names verified against the approved exterior GLB. No interior floor groups exist.
const rules = {
  HOTSPOT_MAIN_ENTRANCE: /^(Entrance_|SUK_Central_Entrance)/,
  HOTSPOT_CENTRAL_BLOCK: /^(Central_|SUK_Main_Body)/,
  HOTSPOT_LEFT_WING: /^(SUK_Left_(?!Tower)|Left_(?!Tower|Oculus))/,
  HOTSPOT_RIGHT_WING: /^(SUK_Right_(?!Tower)|Right_(?!Tower|Oculus))/,
  HOTSPOT_FRONT_PLAZA: /^SUK_(Plaza|Axial_Walk|Curved_Drive|Drive_Curb)/,
  HOTSPOT_LEFT_TOWER: /^(SUK_Left_Tower|Left_Tower|Left_Oculus)/,
  HOTSPOT_RIGHT_TOWER: /^(SUK_Right_Tower|Right_Tower|Right_Oculus)/,
};
export function inspectZones(scene, hotspots) {
  const meshes = [];
  scene.traverse((object) => { if (object.isMesh) meshes.push(object); });
  return hotspots.filter((h) => h.position).map((h) => ({ id: h.id, name: h.name, meshes: meshes.filter((m) => rules[h.id]?.test(m.name)) })).filter((z) => z.meshes.length);
}
export const cameraPresets = { overview: 'Keseluruhan', front: 'Hadapan', left: 'Kiri', right: 'Kanan', top: 'Atas', selected: 'Lokasi dipilih' };
