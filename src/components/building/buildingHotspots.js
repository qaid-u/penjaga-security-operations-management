// Public catalogue mirrored in backend/config; model tests enforce equality.
// Keep the backend directory private to the Vite development server.
import catalogue from './djmSecurityPosts.json' with { type: 'json' };

// Existing GLB anchors describe exterior architecture, never internal security posts.
export const exteriorLandmarks = [
  { id: 'HOTSPOT_MAIN_ENTRANCE', name: 'Pintu Masuk Utama', section: 'Pintu masuk', description: 'Anjung ketibaan dan tangga pada paksi hadapan bangunan.' },
  { id: 'HOTSPOT_CENTRAL_BLOCK', name: 'Blok Tengah', section: 'Blok utama', description: 'Komposisi fasad pusat yang menghubungkan kedua-dua menara.' },
  { id: 'HOTSPOT_LEFT_WING', name: 'Sayap Kiri', section: 'Sayap kiri', description: 'Deretan bukaan berlengkung di sebelah kiri pandangan hadapan.' },
  { id: 'HOTSPOT_RIGHT_WING', name: 'Sayap Kanan', section: 'Sayap kanan', description: 'Deretan bukaan berlengkung di sebelah kanan pandangan hadapan.' },
  { id: 'HOTSPOT_FRONT_PLAZA', name: 'Plaza Hadapan', section: 'Kawasan luar', description: 'Ruang legar dan laluan ketibaan di hadapan anjung.' },
  { id: 'HOTSPOT_LEFT_TOWER', name: 'Menara Kiri', section: 'Menara fasad', description: 'Menara kiri dengan jalur kaca menegak dan bukaan bulat.' },
  { id: 'HOTSPOT_RIGHT_TOWER', name: 'Menara Kanan', section: 'Menara fasad', description: 'Menara kanan dengan jalur kaca menegak dan bukaan bulat.' },
].map((location, index) => ({ ...location, number: index + 1, area: 'Eksterior — aras dalaman tidak disahkan' }));

export const buildingIdentity = catalogue;
export const buildingHotspots = catalogue.posts.map((post, index) => ({
  ...post, number: index + 1, area: post.floor || 'Aras belum disahkan',
  description: `${post.section}. Kedudukan 3D belum disahkan.`,
  position: null, positionStatus: 'unconfirmed',
}));

export function matchingOfficialPost(record, hotspotId) {
  const official = catalogue.posts.find((post) => post.id === hotspotId);
  const building = String(record.nama_bangunan || '').toLowerCase().replace(/[^a-z0-9]/gu, '');
  const name = String(record.nama_pos || '').trim().toLowerCase().replace(/\s+/gu, ' ');
  return Boolean(official && name === official.name.toLowerCase() && ['bangunandatojaafarmuhammad', 'bangunandatojaafarmuhammadkotaiskandar'].includes(building));
}
