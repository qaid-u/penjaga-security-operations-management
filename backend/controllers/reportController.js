const fs = require('fs/promises');
const pool = require('../config/db');
const roles = require('../config/roles');
const { processNLP } = require('../ml/nlpService');
const { logAudit } = require('../utils/audit');

const reportSelect = `
  select l.*, p.nama_penuh, pos.nama_pos,
         nlp.kategori_dikesan, case when nlp.tahap_risiko in ('Low','Medium','High','Critical') then nlp.tahap_risiko else 'Unknown' end as tahap_risiko, nlp.skor_risiko,
         nlp.kata_kunci_dikesan, nlp.ringkasan_automatik, nlp.tahap_keyakinan,
         exists (select 1 from tbl_tindakan_susulan a where a.id_laporan = l.id_laporan) as ada_tindakan_susulan
  from tbl_laporan_harian l
  join tbl_pengguna p on p.id_pengguna = l.id_pengguna
  left join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
  left join lateral (select * from tbl_hasil_nlp where id_laporan=l.id_laporan order by tarikh_analisis desc,id_nlp desc limit 1) nlp on true
`;

const getReports = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  let client;
  try {
    client = await pool.connect();
    const params = [];
    const whereClause = req.user.nama_peranan === roles.guard
      ? (params.push(req.user.id_pengguna), ' where l.id_pengguna = $1')
      : '';
    const countResult = await client.query(
      `select count(*)::int as total from tbl_laporan_harian l${whereClause}`,
      params
    );
    const result = await client.query(
      `${reportSelect}${whereClause}
       order by l.tarikh_laporan desc, l.masa_laporan desc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset]
    );
    const total = countResult.rows[0].total;
    res.json({ data: result.rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get reports error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan laporan' });
  } finally {
    client?.release();
  }
};

const getReport = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `${reportSelect} where l.id_laporan = $1`,
      [req.params.id]
    );
    const report = result.rows[0];
    if (!report) return res.status(404).json({ message: 'Laporan tidak ditemui' });
    if (req.user.nama_peranan === roles.guard && report.id_pengguna !== req.user.id_pengguna) {
      return res.status(403).json({ message: 'Anda tidak dibenarkan melihat laporan ini' });
    }

    const [reviews, checklist, actions] = [
      await client.query(
        `select r.*, u.nama_penuh
         from tbl_pengesahan_laporan r
         join tbl_pengguna u on u.id_pengguna = r.id_pengguna_pengesah
         where r.id_laporan = $1 order by r.tarikh_pengesahan desc`,
        [req.params.id]
      ),
      await client.query(
        `select a.id_jawapan, c.nama_checklist, a.jawapan, a.catatan
         from tbl_jawapan_checklist a
         join tbl_checklist c on c.id_checklist = a.id_checklist
         where a.id_laporan = $1 order by a.id_jawapan`,
        [req.params.id]
      ),
      await client.query('select * from tbl_tindakan_susulan where id_laporan = $1 order by id_tindakan', [req.params.id]),
    ];
    res.json({ report, reviews: reviews.rows, checklist: checklist.rows, actions: actions.rows });
  } catch (error) {
    console.error('Get report detail error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal memuatkan butiran laporan' });
  } finally {
    client?.release();
  }
};

const createReport = async (req, res) => {
  const {
    id_pos,
    id_kategori_insiden,
    tajuk_laporan,
    kandungan_laporan,
    syif,
    tarikh_laporan,
    masa_laporan,
    checklist: checklistInput,
  } = req.body;
  const uploads = req.files || [];
  if (!id_pos || typeof tajuk_laporan !== 'string' || typeof kandungan_laporan !== 'string' || !tajuk_laporan.trim() || !kandungan_laporan.trim() || !syif || !tarikh_laporan || !masa_laporan) {
    return res.status(400).json({ message: 'Sila lengkapkan pos, syif, tarikh, masa, tajuk dan kandungan laporan' });
  }

  let checklist;
  try {
    checklist = typeof checklistInput === 'string' ? JSON.parse(checklistInput) : checklistInput;
    if (!Array.isArray(checklist)) throw new Error('Checklist format must be an array');
    if (checklist.some((item) => !item.id_checklist || !['Ya', 'Tidak', 'Tidak Berkaitan'].includes(item.jawapan))) {
      return res.status(400).json({ message: 'Jawapan checklist tidak sah' });
    }
  } catch {
    return res.status(400).json({ message: 'Format checklist tidak sah' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    const nlp = await processNLP(kandungan_laporan);
    await client.query('begin');
    transactionStarted = true;
    const reportResult = await client.query(
      `insert into tbl_laporan_harian
         (id_pengguna, id_pos, id_kategori_insiden, tajuk_laporan, syif, tarikh_laporan,
          masa_laporan, kandungan_laporan, status_laporan, tahap_risiko, lampiran_fail)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'Dihantar', $9, $10)
       returning id_laporan`,
      [
        req.user.id_pengguna,
        id_pos,
        id_kategori_insiden || null,
        tajuk_laporan.trim(),
        syif,
        tarikh_laporan,
        masa_laporan,
        kandungan_laporan.trim(),
        nlp.riskLevel,
        JSON.stringify(uploads.map((file) => `/uploads/${file.filename}`)),
      ]
    );
    const reportId = reportResult.rows[0].id_laporan;
    await client.query(
      `insert into tbl_hasil_nlp
         (id_laporan, teks_diproses, kata_kunci_dikesan, kategori_dikesan, skor_risiko,
          tahap_risiko, ringkasan_automatik, tahap_keyakinan)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        reportId,
        nlp.cleanText,
        nlp.matchedKeywords,
        nlp.topCategory,
        nlp.riskScore,
        nlp.riskLevel,
        `Kategori ${nlp.topCategory}; ${nlp.matchedKeywords.length} kata kunci sepadan.`,
        nlp.confidence,
      ]
    );
    for (const item of checklist) {
      await client.query(
        `insert into tbl_jawapan_checklist (id_laporan, id_checklist, jawapan, catatan)
         values ($1, $2, $3, $4)`,
        [reportId, item.id_checklist, item.jawapan, item.catatan || null]
      );
    }
    await logAudit(client, req.user.id_pengguna, 'SUBMIT_REPORT', `Laporan #${reportId}`, 'Hantar laporan harian');

    if (['High', 'Critical'].includes(nlp.riskLevel)) {
      const chiefs = await client.query(
        `select p.id_pengguna from tbl_pengguna p
         join tbl_peranan r on r.id_peranan = p.id_peranan
         where r.nama_peranan = $1 and p.status_akaun = 'Aktif'`,
        [roles.chief]
      );
      for (const chief of chiefs.rows) {
        await client.query(
          `insert into tbl_notifikasi
             (id_pengguna, id_laporan, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
           values ($1, $2, $3, $4, $5, $6)`,
          [chief.id_pengguna, reportId, `Insiden ${nlp.riskLevel}`, `Laporan #${reportId} memerlukan perhatian segera (${nlp.topCategory}).`, 'Risiko Tinggi', nlp.riskLevel]
        );
      }
    }
    await client.query('commit');
    transactionStarted = false;
    const savedReport = await client.query(`${reportSelect} where l.id_laporan = $1`, [reportId]);
    res.status(201).json({
      message: 'Laporan dihantar',
      id_laporan: reportId,
      report: savedReport.rows[0],
      nlp: {
        kategori_dikesan: nlp.topCategory,
        tahap_risiko: nlp.riskLevel,
        skor_risiko: nlp.riskScore,
        kata_kunci_dikesan: nlp.matchedKeywords,
        tahap_keyakinan: nlp.confidence,
      },
    });
  } catch (error) {
    if (transactionStarted) if (client) await client.query('rollback');
    await Promise.all(uploads.map((file) => fs.unlink(file.path).catch((unlinkError) => {
      console.error(`Failed to remove uncommitted upload ${file.filename}:`, unlinkError);
    })));
    console.error('Create report error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal menyimpan laporan' });
  } finally {
    client?.release();
  }
};

const reviewReport = async (req, res) => {
  const { id } = req.params;
  const { status, comment = '', requiresFollowUp = false } = req.body;
  const normalizedStatus = status === 'approved' || status === 'Disahkan'
    ? 'Diluluskan'
    : status === 'rejected' || status === 'Ditolak' ? 'Ditolak' : null;
  if (!normalizedStatus) return res.status(400).json({ message: 'Status semakan tidak sah' });
  if (typeof comment !== 'string' || typeof requiresFollowUp !== 'boolean') {
    return res.status(400).json({ message: 'Maklumat semakan tidak sah' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('begin');
    const result = await client.query(
      'select * from tbl_laporan_harian where id_laporan = $1 for update',
      [id]
    );
    const report = result.rows[0];
    if (!report) {
      if (client) await client.query('rollback');
      return res.status(404).json({ message: 'Laporan tidak ditemui' });
    }
    if (report.status_laporan !== 'Dihantar') {
      if (client) await client.query('rollback');
      return res.status(409).json({ message: 'Laporan ini telah disemak' });
    }
    await client.query(
      `insert into tbl_pengesahan_laporan
         (id_laporan, id_pengguna_pengesah, status_pengesahan, catatan_pengesahan)
       values ($1, $2, $3, $4)`,
      [id, req.user.id_pengguna, normalizedStatus, comment.trim() || null]
    );
    await client.query(
      `update tbl_laporan_harian
       set status_laporan = $1, perlu_tindakan_susulan = $2, tarikh_kemaskini = now()
       where id_laporan = $3`,
      [normalizedStatus, normalizedStatus === 'Diluluskan' && requiresFollowUp, id]
    );
    await client.query(
      `insert into tbl_notifikasi
         (id_pengguna, id_laporan, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        report.id_pengguna,
        id,
        `Semakan Laporan #${id}`,
        normalizedStatus === 'Diluluskan' ? `Laporan #${id} anda telah diluluskan.` : `Laporan #${id} ditolak. ${comment.trim()}`,
        'Semakan Laporan',
        'Low',
      ]
    );
    if (normalizedStatus === 'Diluluskan' && requiresFollowUp) {
      const existing = await client.query('select 1 from tbl_tindakan_susulan where id_laporan = $1', [id]);
      if (!existing.rowCount) {
        await client.query(
          `insert into tbl_tindakan_susulan
             (id_laporan, pegawai_bertanggungjawab, tindakan_diambil, tahap_keutamaan, tarikh_mula)
           values ($1, $2, $3, $4, current_date)`,
          [id, req.user.nama_penuh, 'Tindakan susulan diperlukan berdasarkan semakan laporan.', report.tahap_risiko || 'Medium']
        );
      }
    }
    await logAudit(client, req.user.id_pengguna, 'REVIEW_REPORT', `Laporan #${id}`, `Status: ${normalizedStatus}`);
    await client.query('commit');
    res.json({ message: `Laporan ${normalizedStatus}` });
  } catch (error) {
    if (client) await client.query('rollback');
    console.error('Review report error:', error.code || error.name);
    res.status(500).json({ message: 'Gagal menyemak laporan' });
  } finally {
    client?.release();
  }
};

module.exports = require('../utils/asyncHandlers')({ getReports, getReport, createReport, reviewReport });
