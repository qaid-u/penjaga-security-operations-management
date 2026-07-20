const pool = require('../config/db');
const { roles } = require('../config/roles');
const { processNLP } = require('../ml/nlpService');
const { logAudit } = require('../utils/audit');

const getReports = async (req, res) => {
  const client = await pool.connect();
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let baseQuery = `
      from tbl_laporan_harian l
      join tbl_pengguna p on p.id_pengguna = l.dilapor_oleh
      left join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
      left join tbl_hasil_nlp nlp on nlp.id_laporan = l.id_laporan
    `;
    const params = [];
    let whereClause = '';

    if (req.user.nama_peranan === roles.guard) {
      whereClause = ' where l.dilapor_oleh = $1';
      params.push(req.user.id_pengguna);
    }

    const countQuery = `select count(*) as total ${baseQuery} ${whereClause}`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const dataQuery = `
      select l.*, p.nama_penuh as nama_pelapor, pos.nama_pos, nlp.kategori_insiden, nlp.tahap_risiko, nlp.skor_risiko, nlp.ringkasan
      ${baseQuery}
      ${whereClause}
      order by l.tarikh_laporan desc, l.masa_laporan desc
      limit $${params.length + 1} offset $${params.length + 2}
    `;
    const dataResult = await client.query(dataQuery, [...params, limit, offset]);

    res.json({
      data: dataResult.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ message: 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

const createReport = async (req, res) => {
  const { id_pos, perincian, syif, butiran_insiden, tarikh, masa } = req.body;
  if (!id_pos || !perincian || !syif) return res.status(400).json({ message: 'Maklumat tidak lengkap' });
  let attachments = [];
  if (req.files && req.files.length > 0) {
    attachments = req.files.map(f => '/uploads/' + f.filename);
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    let t = tarikh || new Date().toISOString().slice(0, 10);
    let m = masa || new Date().toTimeString().slice(0, 8);
    const reportRes = await client.query(
      `insert into tbl_laporan_harian (dilapor_oleh, id_pos, tarikh_laporan, masa_laporan, syif, perincian, lampiran_bukti)
       values ($1, $2, $3, $4, $5, $6, $7) returning id_laporan`,
      [req.user.id_pengguna, id_pos, t, m, syif, perincian, JSON.stringify(attachments)]
    );
    const reportId = reportRes.rows[0].id_laporan;

    let fullText = perincian;
    if (butiran_insiden) fullText += ' ' + butiran_insiden;
    const nlpRes = await processNLP(fullText);

    await client.query(
      `insert into tbl_hasil_nlp (id_laporan, kategori_insiden, tahap_risiko, skor_risiko, kata_kunci_ditemui, ringkasan)
       values ($1, $2, $3, $4, $5, $6)`,
      [reportId, nlpRes.topCategory, nlpRes.riskLevel, nlpRes.riskScore, JSON.stringify(nlpRes.matchedKeywords), \`Berasaskan \${nlpRes.matchedKeywords.length} kata kunci\`]
    );

    await logAudit(client, req.user.id_pengguna, 'SUBMIT_REPORT', \`Laporan #\${reportId}\`, 'Hantar laporan harian');

    if (nlpRes.riskLevel === 'High' || nlpRes.riskLevel === 'Critical') {
      const chiefRes = await client.query("select id_pengguna from tbl_pengguna where nama_peranan = 'Ketua Pengawal' and status_akaun = 'Aktif'");
      for (const chief of chiefRes.rows) {
        await client.query(
          \`insert into tbl_notifikasi (id_pengguna, tajuk, mesej, jenis, pautan)
           values ($1, $2, $3, $4, $5)\`,
          [chief.id_pengguna, \`Insiden \${nlpRes.riskLevel}\`, \`Laporan #\${reportId} memerlukan perhatian segera (Kategori: \${nlpRes.topCategory}).\`, 'Amaran', \`/semakan?id=\${reportId}\`]
        );
      }
    }
    await client.query('commit');
    res.status(201).json({ message: 'Laporan dihantar', id_laporan: reportId, nlp: nlpRes });
  } catch (error) {
    await client.query('rollback');
    console.error('Create report error:', error);
    res.status(500).json({ message: 'Ralat menyimpan laporan' });
  } finally {
    client.release();
  }
};

const reviewReport = async (req, res) => {
  const { id } = req.params;
  const { status, ulasan } = req.body;
  if (!['Disahkan', 'Ditolak'].includes(status)) return res.status(400).json({ message: 'Status tidak sah' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const r = await client.query('select * from tbl_laporan_harian where id_laporan = $1', [id]);
    if (!r.rows[0]) throw new Error('Laporan tidak wujud');
    await client.query(
      \`insert into tbl_pengesahan_laporan (id_laporan, disahkan_oleh, status_pengesahan, ulasan_ketua)
       values ($1, $2, $3, $4)\`,
      [id, req.user.id_pengguna, status, ulasan]
    );
    await client.query('update tbl_laporan_harian set status_laporan = $1 where id_laporan = $2', [status, id]);
    
    const notifMsg = status === 'Disahkan' ? \`Laporan #\${id} anda telah disahkan.\` : \`Laporan #\${id} anda ditolak. Ulasan: \${ulasan}\`;
    await client.query(
      \`insert into tbl_notifikasi (id_pengguna, tajuk, mesej, jenis, pautan)
       values ($1, $2, $3, $4, $5)\`,
      [r.rows[0].dilapor_oleh, \`Semakan Laporan #\${id}\`, notifMsg, 'Sistem', \`/laporan?id=\${id}\`]
    );

    if (status === 'Disahkan') {
      const nlpResult = await client.query('select tahap_risiko from tbl_hasil_nlp where id_laporan = $1', [id]);
      if (nlpResult.rows[0] && ['High', 'Critical'].includes(nlpResult.rows[0].tahap_risiko)) {
        await client.query(
          \`insert into tbl_tindakan_susulan (id_laporan, ditugaskan_kepada, status_tindakan, tarikh_akhir)
           values ($1, $2, 'Baru', current_date + interval '1 day')\`,
          [id, req.user.id_pengguna]
        );
      }
    }
    await logAudit(client, req.user.id_pengguna, 'REVIEW_REPORT', \`Laporan #\${id}\`, \`Status: \${status}\`);
    await client.query('commit');
    res.json({ message: \`Laporan \${status}\` });
  } catch (error) {
    await client.query('rollback');
    res.status(500).json({ message: error.message || 'Ralat pelayan' });
  } finally {
    client.release();
  }
};

module.exports = { getReports, createReport, reviewReport };
