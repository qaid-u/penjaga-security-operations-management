import securityCatalogue from './securityBuildings.json' with { type: 'json' };

const base = import.meta.env?.BASE_URL || '/';
const asset = (name) => `${base}models/library/${name}`;
const models = {
  DJM: { modelId: 'DJM', modelUrl: import.meta.env?.VITE_BUILDING_MODEL_URL || `${base}models/Bangunan_SUK.glb`, previewUrl: asset('previews/djm.webp'), triangles: 185786, meshes: 287, viewDirection: [.75,.65,1], features: 'Menara berkembar · Arked · Sayap dan halaman' },
  BDARA: { modelId: 'BDARA', modelUrl: asset('bdara.glb'), previewUrl: asset('previews/bdara.webp'), triangles: 206786, meshes: 182, viewDirection: [-.75,.65,1], features: 'Bumbung berlapis · Sayap melengkung · Anjung' },
  BDMSP: { modelId: 'BDMSP', modelUrl: asset('bdmsp.glb'), previewUrl: asset('previews/bdmsp.webp'), triangles: 109216, meshes: 167, viewDirection: [.75,.65,1], features: 'Skrin bumbung · Rangka A · Halaman ketibaan' },
  BSI_KOTA_ISKANDAR: { modelId: 'BSI_KOTA_ISKANDAR', modelUrl: asset('bsi-kota-iskandar.glb'), previewUrl: asset('previews/bsi-kota-iskandar.webp'), triangles: 317140, meshes: 283, viewDirection: [.75,.65,1], features: 'Menara gerbang · Kubah kekisi · Taman formal' },
  RUMAH_SS_VIP: { modelId: 'RUMAH_SS_VIP', modelUrl: asset('rumah-ss-vip.glb'), previewUrl: asset('previews/rumah-ss-vip.webp'), triangles: 122560, meshes: 284, viewDirection: [.75,.65,1], features: 'Rumah kolonial · Anjung berarked · Landskap' },
  UTC_JOHOR: { modelId: 'UTC_JOHOR', modelUrl: asset('utc-johor.glb'), previewUrl: asset('previews/utc-johor.webp'), triangles: 58930, meshes: 170, viewDirection: [-.9,.7,1], features: 'Menara pejabat · Fasad UTC · Galleria' },
};
const choices = [
  ['DJM','DJM','Dato’ Jaafar Muhammad','Kota Iskandar','#b58a44'],
  ['BDARA','BDARA','Abdul Rahman Andak','Kota Iskandar','#648b79'],
  ['BDMSP','BDMSP','Mohamad Salleh Perang','Kota Iskandar','#ac7654'],
  ['BDMIM','BDMSP','Muhamad Ibrahim Munsyi','Kota Iskandar','#7a8771','BDMSP'],
  ['BSI_KOTA_ISKANDAR','BSI_KOTA_ISKANDAR','Sultan Ismail','Kota Iskandar','#b99559'],
  ['RUMAH_SS','RUMAH_SS_VIP','Kediaman Rasmi SS','Johor','#708868','RUMAH_VIP'],
  ['RUMAH_VIP','RUMAH_SS_VIP','Rumah VIP','Johor','#8b8069','RUMAH_SS'],
  ['UTC_JOHOR','UTC_JOHOR','UTC Johor','Johor Bahru','#477fa1'],
];
export const modeledBuildings = choices.map(([id, modelId, shortName, region, accent, sharedWith]) => {
  const identity = securityCatalogue.buildings.find((building) => building.id === id);
  if (!identity) throw new Error(`Unknown building catalogue entry: ${id}`);
  return { ...identity, ...models[modelId], id, shortName, region, accent, sharedWith,
    name: identity.name || identity.building,
    postCount: identity.posts.length,
    hotspots: identity.posts.map((post, index) => ({ ...post, number: index+1,
      area: post.floor || 'Aras belum disahkan', description: `${post.section}. Kedudukan 3D belum disahkan.`,
      position: null, positionStatus: 'unconfirmed' })),
  };
});
export function getBuilding(id = 'DJM') {
  return modeledBuildings.find((building) => building.id === id) || modeledBuildings[0];
}
export function matchingBuildingPost(record, hotspotId, building = getBuilding()) {
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/gu, ' ');
  const key = (value) => normalize(value).replace(/[^a-z0-9]/gu, '');
  const post = building.posts.find((item) => item.id === hotspotId);
  const aliases = [building.name, building.building, ...(building.aliases || [])].filter(Boolean).map(key);
  return Boolean(post && normalize(record.nama_pos) === normalize(post.name) && aliases.includes(key(record.nama_bangunan)));
}
