const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/db');
const { logAudit } = require('../utils/audit');

async function seedExpoData() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Expo Demo Data Seeder...');
    await client.query('BEGIN');

    // Get active guards and posts
    const guardsRes = await client.query("SELECT id_pengguna, nama_penuh FROM tbl_pengguna LIMIT 10");
    const postsRes = await client.query("SELECT id_pos, nama_pos FROM tbl_pos_kawalan LIMIT 10");

    // Inspect table columns
    const colsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='tbl_laporan_harian'");
    console.log('📋 Columns in tbl_laporan_harian:', colsRes.rows.map(r => r.column_name));

    const nlpColsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='tbl_hasil_nlp'");
    console.log('📋 Columns in tbl_hasil_nlp:', nlpColsRes.rows.map(r => r.column_name));

    const actColsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='tbl_tindakan_susulan'");
    console.log('📋 Columns in tbl_tindakan_susulan:', actColsRes.rows.map(r => r.column_name));

    const guards = guardsRes.rows;
    const posts = postsRes.rows;

    if (!guards.length || !posts.length) {
      console.log('⚠️ Missing guards or posts in database. Skipping seeder.');
      await client.query('ROLLBACK');
      return;
    }

    const sampleIncidents = [
      {
        tajuk: 'Pencerobohan Kawasan Pagar Utara',
        syif: 'Malam',
        perincian: 'Dikesan objek mencurigakan dan seorang lelaki tidak dikenali cuba memanjat pagar perimeter pos utara jam 02:30. Amaran keselamatan telah dibunyikan dan peronda bergegas ke lokasi.',
        category: 'Pencerobohan',
        riskLevel: 'Critical',
        riskScore: 92,
        keywords: ['penceroboh', 'pagar', 'perimeter', 'mencurigakan', 'amaran'],
        status: 'Diluluskan',
        requiresFollowUp: true,
        actionStatus: 'Dalam Proses',
        actionDetail: 'Pagar diketatkan dan rondaan ditingkatkan setiap 30 minit.'
      },
      {
        tajuk: 'Lampu Limpah Pos Barat Rosak',
        syif: 'Malam',
        perincian: 'Lampu limpah utama terpadam secara tiba-tiba akibat kerosakan fius utama. Kawasan gelap berisiko pencerobohan.',
        category: 'Peralatan Rosak',
        riskLevel: 'High',
        riskScore: 78,
        keywords: ['rosak', 'gelap', 'terpadam', 'fius', 'kerosakan'],
        status: 'Diluluskan',
        requiresFollowUp: true,
        actionStatus: 'Selesai',
        actionDetail: 'Juruteknik telah menggantikan fius baharu pada jam 08:00 pagi.'
      },
      {
        tajuk: 'Rondaan Rutin Bangunan Pentadbiran',
        syif: 'Pagi',
        perincian: 'Rondaan sekitar jam 09:00 pagi berjalan lancar. Semua pintu utama berkuasa magnetik dalam keadaan terkunci.',
        category: 'Peronda',
        riskLevel: 'Low',
        riskScore: 15,
        keywords: ['lancar', 'terkunci', 'rondaan', 'selamat'],
        status: 'Diluluskan',
        requiresFollowUp: false
      },
      {
        tajuk: 'Pintu Masuk Utama Terbuka Tanpa Pengawasan',
        syif: 'Petang',
        perincian: 'Pintu pagar automatik mengalami masalah perisian dan terbuka secara sendiri tanpa pengesahan kad akses visitor.',
        category: 'Peralatan Rosak',
        riskLevel: 'High',
        riskScore: 82,
        keywords: ['pintu', 'terbuka', 'masalah', 'akses', 'tanpa pengawasan'],
        status: 'Diluluskan',
        requiresFollowUp: true,
        actionStatus: 'Baru',
        actionDetail: 'Pasukan IT diminta semak logs kawalan akses gate.'
      },
      {
        tajuk: 'Kesan Bau Asap di Stor Peralatan',
        syif: 'Malam',
        perincian: 'Pengawal bertugas mengesan bau asap tebal berhampiran stor bateri UPS. Pemerhatian awal mendapati soket pengecas panas berlebihan.',
        category: 'Kebakaran',
        riskLevel: 'Critical',
        riskScore: 89,
        keywords: ['asap', 'kebakaran', 'panas', 'bau', 'bateri'],
        status: 'Dihantar',
        requiresFollowUp: false
      },
      {
        tajuk: 'Penemuan Kunci Master Di Kawasan Lobi',
        syif: 'Pagi',
        perincian: 'Satu gugus kunci master ditemui jatuh di bawah bangku lobi utama oleh pelawat. Kunci telah disimpan di peti simpanan pos keselamatan.',
        category: 'Kunci Hilang',
        riskLevel: 'Medium',
        riskScore: 55,
        keywords: ['kunci', 'ditemui', 'lobi', 'master'],
        status: 'Diluluskan',
        requiresFollowUp: false
      },
      {
        tajuk: 'Pemeriksaan Kenderaan Kontraktor',
        syif: 'Petang',
        perincian: 'Pemeriksaan fizikal dan log masuk kenderaan berat kontraktor pembinaan dijalankan mengikut SOP standard.',
        category: 'Peronda',
        riskLevel: 'Low',
        riskScore: 20,
        keywords: ['pemeriksaan', 'kontraktor', 'SOP', 'log'],
        status: 'Diluluskan',
        requiresFollowUp: false
      }
    ];

    const now = new Date();
    let insertedCount = 0;

    for (let i = 0; i < 35; i++) {
      const template = sampleIncidents[i % sampleIncidents.length];
      const guard = guards[i % guards.length];
      const post = posts[i % posts.length];

      // Random date within last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const reportDate = new Date(now.valueOf() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const hours = String(8 + (i % 12)).padStart(2, '0');
      const reportTime = `${hours}:30:00`;

      const reportRes = await client.query(
        `INSERT INTO tbl_laporan_harian (id_pengguna, id_pos, tajuk_laporan, syif, tarikh_laporan, masa_laporan, kandungan_laporan, status_laporan, tahap_risiko, perlu_tindakan_susulan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id_laporan`,
        [
          guard.id_pengguna,
          post.id_pos,
          `[EKSPO DEMO] ${template.tajuk}`,
          template.syif,
          reportDate,
          reportTime,
          template.perincian,
          template.status,
          template.riskLevel,
          Boolean(template.requiresFollowUp)
        ]
      );

      const reportId = reportRes.rows[0].id_laporan;

      // Insert NLP results
      await client.query(
        `INSERT INTO tbl_hasil_nlp (id_laporan, teks_diproses, kata_kunci_dikesan, kategori_dikesan, skor_risiko, tahap_risiko, ringkasan_automatik, tahap_keyakinan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          reportId,
          template.perincian,
          template.keywords,
          template.category,
          template.riskScore,
          template.riskLevel,
          `Analisis automatik NLP mengesan ${template.keywords.length} kata kunci risiko (${template.riskLevel}).`,
          0.92
        ]
      );

      // Insert follow up action if applicable
      if (template.requiresFollowUp) {
        await client.query(
          `INSERT INTO tbl_tindakan_susulan (id_laporan, pegawai_bertanggungjawab, tindakan_diambil, status_tindakan, tahap_keutamaan)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            reportId,
            guard.nama_penuh,
            template.actionDetail || 'Tindakan dalam pemerhatian.',
            template.actionStatus || 'Baru',
            template.riskLevel
          ]
        );
      }

      // Log audit
      await logAudit(client, guard.id_pengguna, 'DEMO_SEED_REPORT', `Laporan #${reportId}`, 'Jana data demo untuk pameran ekspo');

      insertedCount++;
    }

    await client.query('COMMIT');
    console.log(`✅ Demo Seeder finished successfully! Inserted ${insertedCount} demo reports with NLP analysis and actions.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeder error:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedExpoData();
