const fs = require('fs/promises');
const pool = require('../config/db');
const roles = require('../config/roles');
const { enqueue, wakeWorker, schemaReady } = require('../services/nlpJobs');
const { logAudit } = require('../utils/audit');
const { processNLP } = require('../ml/nlpService');
const { parseClarificationInput } = require('../ml/clarificationInput');
const { reportFilters } = require('../utils/reportFilters');
const { escapeCSV } = require('../utils/helpers');

const reportSelect = `
  select l.id_laporan,l.id_pengguna,l.id_pos,l.id_kategori_insiden,l.tajuk_laporan,l.syif,
         l.tarikh_laporan,l.masa_laporan,l.kandungan_laporan,l.status_laporan,l.perlu_tindakan_susulan,
         l.lampiran_fail,l.tarikh_dicipta,l.tarikh_kemaskini,to_jsonb(l)->'nlp_context' as nlp_context,p.nama_penuh,pos.nama_pos,
         nlp.kategori_dikesan, case when nlp.tahap_risiko in ('Low','Medium','High','Critical') then nlp.tahap_risiko else 'Unknown' end as tahap_risiko, nlp.skor_risiko,
         nlp.kata_kunci_dikesan, nlp.ringkasan_automatik, nlp.tahap_keyakinan,
         nlp.id_nlp, nlp.metadata as nlp_metadata,
         coalesce(job.status,case when nlp.id_nlp is not null then 'completed' else 'not_requested' end) as analysis_status,
         coalesce(nlp.metadata->'review'->>'status','unavailable') as nlp_review_status,
         case when job.id_job is not null then jsonb_build_object('id_job',job.id_job,'status',job.status,'attempts',job.attempts,'last_error',job.last_error) end as analysis_job,
         exists (select 1 from tbl_tindakan_susulan a where a.id_laporan = l.id_laporan) as ada_tindakan_susulan
  from tbl_laporan_harian l
  join tbl_pengguna p on p.id_pengguna = l.id_pengguna
  left join tbl_pos_kawalan pos on pos.id_pos = l.id_pos
  left join lateral (select * from tbl_hasil_nlp where id_laporan=l.id_laporan order by tarikh_analisis desc,id_nlp desc limit 1) nlp on true
  left join lateral (select * from tbl_job_nlp where id_laporan=l.id_laporan order by id_job desc limit 1) job on true
`;

const getReports = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  let client;
  try {
    const { params, where } = reportFilters(req.query, req.user);
    const isCsv = req.path === '/export.csv' || req.query.format === 'csv';
    const base = `with report_rows as (${reportSelect})`;
    client = await pool.connect();
    const countResult = await client.query(
      `${base} select count(*)::int as total from report_rows${where}`,
      params
    );
    const total = countResult.rows[0].total;
    if (isCsv && total > 10000) return res.status(400).json({ message: 'Eksport maksimum 10000 laporan. Sila kecilkan penapis.' });
    const result = await client.query(
      `${base} select *, to_char(tarikh_laporan, 'YYYY-MM-DD') as tarikh_laporan from report_rows${where}
       order by report_rows.tarikh_laporan desc, masa_laporan desc, id_laporan desc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, isCsv ? 10000 : limit, isCsv ? 0 : offset]
    );
    if (isCsv) {
      const rows = [['ID', 'Tarikh', 'Masa', 'Tajuk', 'Pengawal', 'Pos', 'Syif', 'Status', 'Kategori', 'Risiko', 'Laporan'],
        ...result.rows.map(r => [r.id_laporan, r.tarikh_laporan, r.masa_laporan, r.tajuk_laporan, r.nama_penuh, r.nama_pos, r.syif, r.status_laporan, r.kategori_dikesan, r.tahap_risiko, r.kandungan_laporan])];
      res.type('text/csv'); res.attachment('laporan-harian.csv');
      return res.send('\uFEFF' + rows.map(row => row.map(escapeCSV).join(',')).join('\r\n'));
    }
    const posts = await client.query(`select distinct p.id_pos,p.nama_pos from tbl_pos_kawalan p join tbl_laporan_harian l using(id_pos)
      where ($1::int is null or l.id_pengguna=$1) order by p.nama_pos,p.id_pos`, [req.user.nama_peranan === roles.guard ? req.user.id_pengguna : null]);
    res.json({ data: result.rows, filters: { posts: posts.rows }, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
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
    const analysis = report.id_nlp ? (await client.query('select * from tbl_hasil_nlp where id_nlp=$1',[report.id_nlp])).rows[0] : null;
    res.json({ report, reviews: reviews.rows, checklist: checklist.rows, actions: actions.rows, analysis, analysisJob:report.analysis_job });
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

  const date = new Date(`${tarikh_laporan}T00:00:00Z`);
  if (kandungan_laporan.length > 20000 || tajuk_laporan.length > 160 || !/^\d{4}-\d{2}-\d{2}$/.test(tarikh_laporan)
    || Number.isNaN(date.valueOf()) || date.toISOString().slice(0,10)!==tarikh_laporan
    || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(masa_laporan) || !['Pagi','Petang','Malam','Office Hour'].includes(syif)) {
    return res.status(400).json({message:'Panjang teks, tarikh, masa atau syif laporan tidak sah'});
  }

  let checklist;
  try {
    checklist = typeof checklistInput === 'string' ? JSON.parse(checklistInput) : checklistInput;
    if (!Array.isArray(checklist)) throw new Error('Checklist format must be an array');
    if (checklist.some((item) => !item || !Number.isSafeInteger(item.id_checklist) || item.id_checklist < 1 || !['Ya', 'Tidak', 'Tidak Berkaitan'].includes(item.jawapan) || (item.catatan != null && (typeof item.catatan !== 'string' || item.catatan.length > 2000))) || new Set(checklist.map(item => item.id_checklist)).size !== checklist.length) {
      return res.status(400).json({ message: 'Jawapan checklist tidak sah' });
    }
  } catch {
    return res.status(400).json({ message: 'Format checklist tidak sah' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    if (!await schemaReady(client)) return res.status(503).json({message:'Migrasi NLP diperlukan sebelum laporan baharu boleh diproses.'});
    await client.query('begin');
    transactionStarted = true;
    const required = await client.query('select id_checklist from tbl_checklist where status_aktif=true for share');
    const provided = new Set(checklist.map(item => item.id_checklist));
    if (required.rows.length !== provided.size || required.rows.some(item => !provided.has(item.id_checklist))) {
      throw Object.assign(new Error('Sila jawab setiap checklist aktif sekali sahaja. Muat semula borang jika checklist telah berubah.'), { status: 400 });
    }
    const nlpContext=parseClarificationInput(req.body.nlp_context);
    if(nlpContext.clarifications?.length)await processNLP(kandungan_laporan,{db:client,selectedPostId:Number(id_pos),sourceHash:nlpContext.draftHash,clarifications:nlpContext.clarifications});
    const reportResult = await client.query(
      `insert into tbl_laporan_harian
         (id_pengguna,id_pos,id_kategori_insiden,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan,status_laporan,tahap_risiko,lampiran_fail,nlp_context)
       values($1,$2,$3,$4,$5,$6,$7,$8,'Dihantar','Unknown',$9,$10) returning *`,
      [req.user.id_pengguna,id_pos,id_kategori_insiden||null,tajuk_laporan.trim(),syif,tarikh_laporan,masa_laporan,kandungan_laporan,JSON.stringify(uploads.map(file=>`/uploads/${file.filename}`)),nlpContext]
    );
    const reportId=reportResult.rows[0].id_laporan;
    const job=await enqueue(client,reportResult.rows[0],req.user.id_pengguna);
    for (const item of checklist) {
      await client.query(
        `insert into tbl_jawapan_checklist (id_laporan, id_checklist, jawapan, catatan)
         values ($1, $2, $3, $4)`,
        [reportId, item.id_checklist, item.jawapan, item.catatan || null]
      );
    }
    await logAudit(client, req.user.id_pengguna, 'SUBMIT_REPORT', `Laporan #${reportId}`, 'Hantar laporan harian');

    await client.query('commit');
    transactionStarted = false;
    const savedReport = await client.query(`${reportSelect} where l.id_laporan = $1`, [reportId]);
    wakeWorker(pool);
    res.status(201).json({message:'Laporan dihantar. Analisis berjalan di latar belakang.',id_laporan:reportId,report:savedReport.rows[0],nlp:null,analysis:null,analysisJob:job});
  } catch (error) {
    if (transactionStarted) if (client) await client.query('rollback');
    await Promise.all(uploads.map((file) => fs.unlink(file.path).catch((unlinkError) => {
      console.error(`Failed to remove uncommitted upload ${file.filename}:`, unlinkError);
    })));
    if(!error.status||error.status>=500)console.error('Create report error:', error.code || error.name);
    res.status(error.status===400?400:500).json({ message:error.status===400?error.message:'Gagal menyimpan laporan' });
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
    if (normalizedStatus === 'Diluluskan' && requiresFollowUp) {
      await client.query(
        `insert into tbl_notifikasi(id_pengguna,id_laporan,id_tindakan,tajuk_notifikasi,mesej_notifikasi,jenis_notifikasi,tahap_keutamaan)
         select u.id_pengguna,$1,a.id_tindakan,'Tindakan susulan diperlukan',$2,'Tindakan Susulan','Medium'
         from tbl_pengguna u join tbl_peranan r on r.id_peranan=u.id_peranan
         join tbl_tindakan_susulan a on a.id_laporan=$1
         where u.status_akaun='Aktif' and r.nama_peranan='Pentadbir Sistem'`,
        [id, `Laporan #${id} diluluskan dan memerlukan tindakan susulan.`]
      );
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
