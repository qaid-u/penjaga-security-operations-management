export const buildingHotspots = [
  { id: 'HOTSPOT_MAIN_ENTRANCE', name: 'Pintu Masuk Utama', section: 'Pintu masuk', description: 'Anjung ketibaan dan tangga pada paksi hadapan bangunan.' },
  { id: 'HOTSPOT_CENTRAL_BLOCK', name: 'Blok Tengah', section: 'Blok utama', description: 'Komposisi fasad pusat yang menghubungkan kedua-dua menara.' },
  { id: 'HOTSPOT_LEFT_WING', name: 'Sayap Kiri', section: 'Sayap kiri', description: 'Deretan bukaan berlengkung di sebelah kiri pandangan hadapan.' },
  { id: 'HOTSPOT_RIGHT_WING', name: 'Sayap Kanan', section: 'Sayap kanan', description: 'Deretan bukaan berlengkung di sebelah kanan pandangan hadapan.' },
  { id: 'HOTSPOT_FRONT_PLAZA', name: 'Plaza Hadapan', section: 'Kawasan luar', description: 'Ruang legar dan laluan ketibaan di hadapan anjung.' },
  { id: 'HOTSPOT_LEFT_TOWER', name: 'Menara Kiri', section: 'Menara fasad', description: 'Menara kiri dengan jalur kaca menegak dan bukaan bulat.' },
  { id: 'HOTSPOT_RIGHT_TOWER', name: 'Menara Kanan', section: 'Menara fasad', description: 'Menara kanan dengan jalur kaca menegak dan bukaan bulat.' },
].map((location, index) => ({ ...location, number: index + 1, area: 'Eksterior — aras dalaman tidak disahkan', demo: { status: 'Demo — Bertugas', guard: `Pengawal Demo ${String(index + 1).padStart(2, '0')}`, shift: '07:00–16:00 (demo)', incidents: 0 } }));
