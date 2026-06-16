require("dotenv").config({ path: ".env" });

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const uploadDir = path.join(__dirname, "..", "uploads");

const scenarioTemplates = [
  {
    title: "Rondaan pos selesai tanpa insiden",
    category: "Rondaan Biasa",
    risk: "Low",
    score: 18,
    sentiment: 0.2,
    confidence: 0.9,
    keywords: ["rondaan selesai", "keadaan terkawal", "tiada insiden"],
    observation: "rondaan selesai, keadaan terkawal dan tiada insiden dikesan sepanjang pemeriksaan pos",
    action: "buku laporan dikemas kini dan pos diserahkan kepada pengawal syif berikutnya",
    statusNote: "Selesai.",
    checklist: { 1: "Ya", 2: "Ya", 3: "Ya", 4: "Ya", 5: "Ya", 6: "Ya", 7: "Ya" },
  },
  {
    title: "CCTV kawasan tidak berfungsi",
    category: "Kerosakan Kemudahan",
    risk: "Medium",
    score: 46,
    sentiment: -0.1,
    confidence: 0.84,
    keywords: ["cctv rosak", "tidak berfungsi"],
    observation: "paparan cctv rosak dan kamera utama tidak berfungsi semasa semakan rutin",
    action: "pemantauan manual dibuat sementara dan aduan fasiliti direkodkan",
    statusNote: "Perlu tindakan fasiliti.",
    checklist: { 1: "Ya", 2: "Ya", 3: "Ya", 4: "Tidak", 5: "Ya", 6: "Ya", 7: "Ya" },
  },
  {
    title: "Pintu belakang tidak berkunci",
    category: "Keselamatan Fizikal",
    risk: "Medium",
    score: 54,
    sentiment: -0.1,
    confidence: 0.86,
    keywords: ["tidak berkunci", "pintu terbuka"],
    observation: "pintu belakang didapati tidak berkunci dan boleh dibuka tanpa kad akses",
    action: "pintu dikunci semula, catatan dibuat dan pegawai bertanggungjawab dimaklumkan",
    statusNote: "Pembetulan diperlukan.",
    checklist: { 1: "Ya", 2: "Tidak", 3: "Ya", 4: "Ya", 5: "Ya", 6: "Ya", 7: "Ya" },
  },
  {
    title: "Individu tanpa pas cuba masuk",
    category: "Pencerobohan",
    risk: "High",
    score: 82,
    sentiment: -0.6,
    confidence: 0.91,
    keywords: ["orang asing", "masuk tanpa izin", "ceroboh"],
    observation: "orang asing tanpa pas cuba masuk tanpa izin melalui laluan kawalan selepas ditegur",
    action: "akses ditolak, identiti direkodkan dan Ketua Pengawal dimaklumkan",
    statusNote: "Menunggu arahan Ketua.",
    checklist: { 1: "Ya", 2: "Ya", 3: "Ya", 4: "Ya", 5: "Tidak", 6: "Ya", 7: "Tidak" },
  },
  {
    title: "Asap dan bau hangit dikesan",
    category: "Kebakaran",
    risk: "Critical",
    score: 95,
    sentiment: -0.75,
    confidence: 0.94,
    keywords: ["asap", "api", "terbakar"],
    observation: "asap tebal dan bau hangit dikesan berhampiran bilik utiliti semasa rondaan",
    action: "kawasan dikosongkan, pemadam api disediakan dan unit kecemasan dimaklumkan",
    statusNote: "Kritikal.",
    checklist: { 1: "Ya", 2: "Ya", 3: "Tidak", 4: "Ya", 5: "Ya", 6: "Ya", 7: "Tidak" },
  },
  {
    title: "Kekecohan pelawat di kaunter",
    category: "Pergaduhan",
    risk: "High",
    score: 76,
    sentiment: -0.55,
    confidence: 0.88,
    keywords: ["kekecohan", "gaduh"],
    observation: "kekecohan berlaku apabila pelawat enggan mematuhi arahan keselamatan",
    action: "pihak terlibat dileraikan, keadaan dikawal dan butiran dicatat",
    statusNote: "Selesai dengan pemantauan.",
    checklist: { 1: "Ya", 2: "Ya", 3: "Ya", 4: "Ya", 5: "Tidak", 6: "Ya", 7: "Tidak" },
  },
  {
    title: "Aset keselamatan hilang",
    category: "Kehilangan Aset",
    risk: "High",
    score: 74,
    sentiment: -0.6,
    confidence: 0.87,
    keywords: ["hilang", "kehilangan", "aset"],
    observation: "radio komunikasi pengawal dilaporkan hilang selepas serahan syif",
    action: "stor diperiksa, rekod serahan syif disemak dan laporan awal dibuat",
    statusNote: "Perlu tindakan susulan.",
    checklist: { 1: "Ya", 2: "Ya", 3: "Ya", 4: "Ya", 5: "Ya", 6: "Tidak", 7: "Ya" },
  },
  {
    title: "Kerosakan harta benda di kawasan pos",
    category: "Vandalisme",
    risk: "Medium",
    score: 58,
    sentiment: -0.15,
    confidence: 0.82,
    keywords: ["vandalisme", "rosak", "conteng"],
    observation: "kerusi menunggu rosak dan terdapat kesan contengan pada papan notis",
    action: "gambar bukti diambil, kawasan ditanda dan unit fasiliti dimaklumkan",
    statusNote: "Perlu pembaikan.",
    checklist: { 1: "Ya", 2: "Ya", 3: "Ya", 4: "Ya", 5: "Ya", 6: "Ya", 7: "Ya" },
  },
];

const shiftTimes = {
  Pagi: ["07:40", "08:15", "09:30", "10:25"],
  Petang: ["14:55", "16:20", "17:45", "19:05"],
  Malam: ["21:35", "22:20", "23:10", "00:25"],
  "Office Hour": ["08:30", "10:10", "12:40", "15:20"],
};

function normalise(text) {
  return text.toLowerCase().replace(/[^\w\s|:.-]/g, "").replace(/\s+/g, " ").trim();
}

function pickEvidence(index) {
  if (!fs.existsSync(uploadDir)) return null;
  const files = fs.readdirSync(uploadDir).filter((file) => /\.(jpe?g|png|webp|pdf)$/i.test(file));
  if (!files.length || index % 3 === 1) return null;
  const first = `/uploads/${files[index % files.length]}`;
  if (index % 5 === 0 && files.length > 1) {
    return JSON.stringify([first, `/uploads/${files[(index + 1) % files.length]}`]);
  }
  return first;
}

function reportDate(index) {
  const date = new Date();
  date.setDate(date.getDate() - (index % 56));
  return date.toISOString().slice(0, 10);
}

async function main() {
  const pool = new Pool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE tbl_notifikasi, tbl_laporan_harian RESTART IDENTITY CASCADE");

    const { rows: guards } = await client.query(`select p.id_pengguna, p.nama_penuh from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan where r.nama_peranan = 'Pengawal Keselamatan' and p.status_akaun = 'Aktif' order by p.id_pengguna`);
    const { rows: posts } = await client.query("select id_pos, nama_pos from tbl_pos_kawalan where status_pos = 'Aktif' order by id_pos");
    const { rows: categories } = await client.query("select id_kategori_insiden, nama_kategori from tbl_kategori_insiden");
    const { rows: checklists } = await client.query("select id_checklist from tbl_checklist where status_aktif = true order by id_checklist");

    const categoryByName = new Map(categories.map((category) => [category.nama_kategori, category.id_kategori_insiden]));
    const chief = (await client.query(`select p.id_pengguna from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan where r.nama_peranan = 'Ketua Pengawal' limit 1`)).rows[0];
    const admin = (await client.query(`select p.id_pengguna from tbl_pengguna p join tbl_peranan r on r.id_peranan = p.id_peranan where r.nama_peranan = 'Pentadbir Sistem' limit 1`)).rows[0];

    if (!guards.length || !posts.length || !checklists.length || !chief || !admin) {
      throw new Error("Demo reports require active guards, posts, checklist items, one Ketua and one Admin");
    }

    const reports = [];
    for (let index = 0; index < 64; index += 1) {
      const template = scenarioTemplates[index % scenarioTemplates.length];
      const guard = guards[index % guards.length];
      const post = posts[(index * 3) % posts.length];
      const shifts = Object.keys(shiftTimes);
      const syif = shifts[index % shifts.length];
      const masa = shiftTimes[syif][index % shiftTimes[syif].length];
      const date = reportDate(index);
      const statusCycle = template.risk === "Low"
        ? ["Diluluskan", "Dihantar", "Diluluskan", "Dihantar"]
        : template.risk === "Medium"
          ? ["Dihantar", "Diluluskan", "Ditolak", "Dihantar"]
          : ["Dihantar", "Diluluskan", "Diluluskan", "Dihantar"];
      const status = statusCycle[index % statusCycle.length];
      const needsFollowUp = status === "Diluluskan" && ["High", "Critical"].includes(template.risk);
      const title = `${template.title} - ${post.nama_pos}`;
      const content = `FORMAT LAPORAN HARIAN
Tarikh: ${date}
Masa: ${masa}
Pos: ${post.nama_pos}
Syif: ${syif}
Pengawal Bertugas: ${guard.nama_penuh}
Pemerhatian: ${template.observation}.
Tindakan Awal: ${template.action}.
Keperluan Tindakan Susulan: ${needsFollowUp ? "Ya, perlu perhatian Admin selepas kelulusan Ketua." : "Tidak, rekod untuk pemantauan operasi."}
Status Semasa: ${template.statusNote}`;

      const reportResult = await client.query(
        `insert into tbl_laporan_harian
         (id_pengguna, id_pos, id_kategori_insiden, tajuk_laporan, syif, tarikh_laporan, masa_laporan, kandungan_laporan, status_laporan, tahap_risiko, perlu_tindakan_susulan, lampiran_fail)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id_laporan`,
        [
          guard.id_pengguna,
          post.id_pos,
          categoryByName.get(template.category) || null,
          title,
          syif,
          date,
          masa,
          content,
          status,
          template.risk,
          needsFollowUp,
          pickEvidence(index),
        ],
      );
      const idLaporan = reportResult.rows[0].id_laporan;
      reports.push({ idLaporan, title, template, status, needsFollowUp, guard, post, date });

      await client.query(
        `insert into tbl_hasil_nlp
         (id_laporan, teks_diproses, kata_kunci_dikesan, kategori_dikesan, skor_sentimen, skor_risiko, tahap_risiko, ringkasan_automatik, tahap_keyakinan)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          idLaporan,
          normalise(content),
          template.keywords,
          template.category,
          template.sentiment,
          template.score,
          template.risk,
          `${template.category}: ${template.observation}`,
          template.confidence,
        ],
      );

      for (const checklist of checklists) {
        const answer = template.checklist[checklist.id_checklist] || "Ya";
        const note = answer === "Tidak" ? "Perkara ini memerlukan perhatian lanjut berdasarkan pemerhatian laporan." : null;
        await client.query(
          "insert into tbl_jawapan_checklist (id_laporan, id_checklist, jawapan, catatan) values ($1,$2,$3,$4)",
          [idLaporan, checklist.id_checklist, answer, note],
        );
      }

      if (["Diluluskan", "Ditolak"].includes(status)) {
        await client.query(
          "insert into tbl_pengesahan_laporan (id_laporan, id_pengguna_pengesah, status_pengesahan, catatan_pengesahan) values ($1,$2,$3,$4)",
          [
            idLaporan,
            chief.id_pengguna,
            status,
            status === "Diluluskan"
              ? needsFollowUp ? "Diluluskan. Ketua menetapkan laporan ini memerlukan tindakan susulan Admin." : "Diluluskan. Laporan lengkap dan tindakan awal sesuai."
              : "Ditolak. Pengawal perlu melengkapkan bukti atau catatan tindakan sebelum dihantar semula.",
          ],
        );
      }
    }

    const followUpReports = reports.filter((report) => report.needsFollowUp).slice(0, 14);
    for (const [index, report] of followUpReports.entries()) {
      const status = index % 4 === 0 ? "Selesai" : index % 3 === 0 ? "Baru" : "Dalam Tindakan";
      const actionResult = await client.query(
        `insert into tbl_tindakan_susulan
         (id_laporan, pegawai_bertanggungjawab, tindakan_diambil, status_tindakan, tahap_keutamaan, tarikh_mula, tarikh_selesai, catatan_tindakan)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id_tindakan`,
        [
          report.idLaporan,
          "Pentadbir Sistem",
          `Semak laporan ${report.template.category.toLowerCase()} di ${report.post.nama_pos}, sahkan bukti, dan rekod tindakan pembetulan rasmi.`,
          status,
          report.template.risk,
          report.date,
          status === "Selesai" ? new Date().toISOString().slice(0, 10) : null,
          "Tindakan diwujudkan berdasarkan keputusan Ketua semasa semakan laporan.",
        ],
      );
      const idTindakan = actionResult.rows[0].id_tindakan;

      await client.query(
        `insert into tbl_progress_tindakan (id_tindakan, id_pengguna, catatan_progress, jenis_progress, perlu_respon_ketua, lampiran_fail, dilihat_admin)
         values ($1,$2,$3,'Permintaan Admin',true,$4,true)`,
        [
          idTindakan,
          admin.id_pengguna,
          "Admin meminta Ketua mengemaskini keadaan semasa di lokasi dan melampirkan bukti tambahan jika ada.",
          pickEvidence(index + 20),
        ],
      );
      if (index % 2 === 0) {
        await client.query(
          `insert into tbl_progress_tindakan (id_tindakan, id_pengguna, catatan_progress, jenis_progress, perlu_respon_ketua, lampiran_fail, dilihat_admin)
           values ($1,$2,$3,'Kemaskini Ketua',false,$4,$5)`,
          [
            idTindakan,
            chief.id_pengguna,
            "Ketua telah membuat semakan lapangan. Keadaan terkini direkodkan dan bukti telah disemak.",
            pickEvidence(index + 30),
            index % 3 === 0,
          ],
        );
      }
    }

    await client.query(
      `insert into tbl_notifikasi (id_pengguna, id_laporan, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
       select $1, id_laporan, 'Laporan baharu untuk semakan', tajuk_laporan || ' menunggu semakan Ketua.', 'Semakan Laporan', tahap_risiko
       from tbl_laporan_harian where status_laporan = 'Dihantar' and tahap_risiko in ('High','Critical') limit 12`,
      [chief.id_pengguna],
    );
    await client.query(
      `insert into tbl_notifikasi (id_pengguna, id_laporan, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
       select $1, id_laporan, 'Tindakan susulan diperlukan', tajuk_laporan || ' telah diluluskan dan memerlukan tindakan Admin.', 'Tindakan Susulan', tahap_risiko
       from tbl_laporan_harian where perlu_tindakan_susulan = true limit 12`,
      [admin.id_pengguna],
    );

    await client.query("COMMIT");
    console.log(JSON.stringify({
      reportsInserted: reports.length,
      followUpActionsInserted: followUpReports.length,
      submittedReports: reports.filter((report) => report.status === "Dihantar").length,
      approvedReports: reports.filter((report) => report.status === "Diluluskan").length,
      rejectedReports: reports.filter((report) => report.status === "Ditolak").length,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
