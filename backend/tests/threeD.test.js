process.env.NLP_WORKER_ENABLED='false';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/db');
const { createService, period, positiveId, validDate } = require('../services/threeDService');

test('input validation rejects invalid dates, ranges and SQL-shaped IDs', () => {
  for (const id of ['1 OR 1=1', '1;drop table x', 0, -1, 1.5, {}, [1], true, 2147483648]) assert.throws(() => positiveId(id), { status: 400 });
  assert.equal(positiveId('12'), 12);
  assert.equal(validDate('2026-02-30'), false);
  for (const query of [{ date: '2026-02-30' }, { from: '2026-10-24', to: '2026-10-01' }, { from: '2024-01-01', to: '2026-01-01' }, { date: ['2026-01-01'] }]) assert.throws(() => period(query), { status: 400 });
  assert.equal(period({ date: '2026-10-24' }).timezone, 'Asia/Kuala_Lumpur');
});

test('PostgreSQL integration and actual JWT/role middleware in a rolled-back schema', async (t) => {
  const originalConnect = pool.connect.bind(pool); const originalQuery = pool.query.bind(pool);
  const client = await originalConnect();
  let server;
  try {
    await client.query('begin');
    await client.query(`create schema penjaga_3d_test_${process.pid}`);
    await client.query(`set local search_path to penjaga_3d_test_${process.pid}`);
    await client.query("set local timezone = 'Asia/Kuala_Lumpur'");
    await client.query(await fs.readFile(path.join(__dirname, '../database/schema.sql'), 'utf8'));
    const migration = await fs.readFile(path.join(__dirname, '../database/migrations/003_lokasi_3d.sql'), 'utf8');
    const officialMigration = await fs.readFile(path.join(__dirname, '../database/migrations/005_djm_security_posts.sql'), 'utf8');
    await client.query(migration);
    await client.query(await fs.readFile(path.join(__dirname, '../database/migrations/004_nlp_review.sql'), 'utf8'));
    await client.query(`
      insert into tbl_peranan(id_peranan,nama_peranan,tahap_capaian) values (1,'Pentadbir Sistem',1),(2,'Ketua Pengawal',2),(3,'Pengawal Keselamatan',3);
      insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,emel,nama_pengguna,kata_laluan) values
       (1,1,'Test Admin','admin@test.invalid','test-admin','unused'),(2,2,'Test Chief','chief@test.invalid','test-chief','unused'),(3,3,'Test Guard','guard@test.invalid','test-guard','unused');
      insert into tbl_pos_kawalan(id_pos,nama_pos,nama_bangunan,status_pos) values
       (1,'Pos Lobi Utama','Bangunan Dato’ Jaafar Muhammad','Aktif'),
       (2,'Pos Bilik Kawalan CCTV','Bangunan Dato’ Jaafar Muhammad','Aktif'),
       (3,'Test Inactive','Other Building','Tidak Aktif'),(4,'Pos Lobi Utama','Other Building','Aktif');
      select setval(pg_get_serial_sequence('tbl_pos_kawalan','id_pos'),4);
      update tbl_lokasi_3d set id_pos=1 where hotspot_id='HOTSPOT_MAIN_ENTRANCE';
      insert into tbl_jadual_mingguan(id_jadual_mingguan,tarikh_mula,tarikh_tamat,status_jadual) values (1,'2026-10-19','2026-10-25','Disahkan'),(2,'2026-10-19','2026-10-25','Draf'),(3,'2026-10-19','2026-10-25','Dikunci');
      insert into tbl_jadual_bertugas(id_jadual,id_jadual_mingguan,id_pengguna,id_pos,tarikh_tugas,syif,masa_mula,masa_tamat) values
       (1,1,3,1,'2026-10-23','Malam','23:00','08:00'),(2,2,3,1,'2026-10-24','Pagi','07:00','16:00'),
       (3,3,3,1,'2026-10-24','Petang','14:45','23:45'),(4,1,3,1,'2026-10-23','Malam','18:00','00:00'),
       (5,1,3,2,'2026-10-24','Pagi','07:00','16:00');
      insert into tbl_kehadiran_tugas(id_jadual,id_pengguna,masa_check_in,masa_check_out) values
       (1,3,'2026-10-23 23:00',null),(3,3,'2026-10-24 14:45','2026-10-24 23:45');
      insert into tbl_laporan_harian(id_laporan,id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan) values
       (1,3,1,'Test Report A','Pagi','2026-10-24','09:00','PRIVATE NARRATIVE'),(2,3,1,'Test Report B','Pagi','2026-10-24','10:00','PRIVATE NARRATIVE'),
       (3,3,1,'Test Report C','Pagi','2026-10-24','11:00','PRIVATE NARRATIVE'),(4,3,2,'Other Post','Pagi','2026-10-24','12:00','PRIVATE NARRATIVE'),
       (5,3,1,'Outside range','Pagi','2026-10-22','12:00','PRIVATE NARRATIVE'),
       (6,3,4,'Foreign building report','Pagi','2026-10-24','13:00','PRIVATE NARRATIVE');
      insert into tbl_hasil_nlp(id_laporan,teks_diproses,kategori_dikesan,skor_risiko,tahap_risiko,tarikh_analisis) values
       (1,'private','Test',10,'Low','2026-10-24 09:00'),(1,'private','Test',80,'High','2026-10-24 09:01'),
       (2,'private','Test',20,'Low','2026-10-24 10:00'),(4,'private','Test',99,'Critical','2026-10-24 12:00'),
       (6,'private','Foreign only',99,'Critical','2026-10-24 13:00');
      insert into tbl_tindakan_susulan(id_tindakan,id_laporan,pegawai_bertanggungjawab,tindakan_diambil,status_tindakan) values
       (1,1,'Test','private','Dalam Tindakan'),(2,2,'Test','private','Selesai'),(3,3,'Test','private','Baru');
      insert into tbl_progress_tindakan(id_tindakan,id_pengguna,catatan_progress,jenis_progress,tarikh_progress) values
       (1,2,'private','Kemaskini Ketua','2026-10-24 12:00'),(1,1,'private','Permintaan Admin','2026-10-24 13:00');
    `);
    await client.query(officialMigration);
    // Services use transactions. Savepoints keep their commits inside this test's outer rollback.
    const adapter = { release() {}, async query(sql, params) {
      if (/^begin/i.test(sql)) return client.query('savepoint api_request');
      if (/^commit/i.test(sql)) return client.query('release savepoint api_request');
      if (/^rollback/i.test(sql)) { await client.query('rollback to savepoint api_request'); return client.query('release savepoint api_request'); }
      return client.query(sql, params);
    } };
    pool.connect = async () => adapter; pool.query = (sql, params) => client.query(sql, params);
    const service = createService(pool); const p = period({ date: '2026-10-24' });
    await t.test('official post migration reuses existing IDs, preserves history and repeats without duplicates or invented positions', async () => {
      const before = await service.locations();
      const { catalogue } = require('../services/securityPostCatalogue');
      assert.equal(before.length,7); assert.ok(before.every(l => l.id_pos && l.position === null && l.position_status === 'unconfirmed'));
      assert.deepEqual(before.map(l=>[l.hotspot_id,l.nama_paparan,l.label_aras]),catalogue.posts.map(post=>[post.id,post.name,post.floor]));
      assert.equal(before[0].id_pos,1); assert.equal(before[1].id_pos,2);
      assert.deepEqual(before.map(l=>l.label_aras),[null,null,'Tingkat 3','Tingkat 4','Tingkat 4','LG','LG']);
      await client.query(migration); await client.query(officialMigration); await client.query(officialMigration);
      assert.deepEqual(await service.locations(),before);
      assert.equal((await client.query('select count(*)::int n from tbl_pos_kawalan')).rows[0].n,9);
      const legacy=(await client.query("select id_pos,status_aktif from tbl_lokasi_3d where hotspot_id='HOTSPOT_MAIN_ENTRANCE'")).rows[0];
      assert.deepEqual(legacy,{id_pos:1,status_aktif:false});
      assert.equal((await service.filters()).posts.length,7);
      await assert.rejects(service.map(before[0].id_lokasi,{id_pos:4},1),{status:400});
      await assert.rejects(service.map(before[0].id_lokasi,{id_pos:2},1),{status:400});
    });
    await t.test('ambiguous duplicate posts abort the migration instead of choosing an arbitrary ID', async () => {
      await client.query('savepoint duplicate_post');
      try {
        await client.query("insert into tbl_pos_kawalan(nama_pos,nama_bangunan) values('Pos Lobi Utama','Bangunan Dato’ Jaafar Muhammad')");
        await assert.rejects(client.query(officialMigration), /Ambiguous official post/);
      } finally {
        await client.query('rollback to savepoint duplicate_post');
        await client.query('release savepoint duplicate_post');
      }
      assert.equal((await service.locations()).length,7);
    });
    await client.query("update tbl_lokasi_3d set id_pos=null where hotspot_id like 'POST_DJM_%'");
    const rows = await service.locations(); const id = rows[0].id_lokasi;
    await t.test('retrieves seven unlinked locations without fabricated operations', async () => {
      assert.equal(rows.length, 7); assert.ok(rows.every((l) => l.id_pos === null));
      const summary = await service.summary(id, p); assert.equal(summary.linked, false); assert.equal(summary.metrics, undefined);
    });
    await t.test('maps an eligible post, records audit and preserves mapping on repeated migration', async () => {
      await service.map(id, { id_pos: 1 }, 1); await client.query(officialMigration);
      assert.equal((await service.locations())[0].id_pos, 1);
      const audit = await client.query("select nilai_baharu from tbl_audit_trail where jenis_aktiviti='UPDATE_3D_MAPPING'");
      assert.equal(JSON.parse(audit.rows[0].nilai_baharu).id_pos_baharu, 1);
    });
    await t.test('overnight overlap, midnight boundary, draft/confirmed and attendance semantics', async () => {
      const result = await service.summary(id,p);
      assert.deepEqual(result.assignments.map((a) => a.id_jadual), [1,2,3]);
      assert.deepEqual(result.metrics.schedule, { assignments: 3, confirmed: 2, draft: 1 });
      assert.deepEqual(result.assignments.map((a) => a.attendance_state), ['Checked In','No Check-In Recorded','Checked Out']);
      assert.equal(result.assignments[0].ends_at.toISOString(), '2026-10-24T00:00:00.000Z');
      assert.equal(result.assignments[0].masa_check_in.toISOString(), '2026-10-23T15:00:00.000Z');
    });
    await t.test('latest NLP only, correct post/date filters, unknown classification and minimal report fields', async () => {
      const result = await service.summary(id,p);
      assert.deepEqual(result.metrics.incidents, { total: 3, Low: 1, Medium: 0, High: 1, Critical: 0, Unknown: 1 });
      assert.equal(result.reports.length, 3);
      assert.equal(result.reports[0].tarikh_laporan, '2026-10-24');
      assert.ok(!JSON.stringify(result).includes('PRIVATE NARRATIVE'));
      assert.equal(result.reports[0].kandungan_laporan, undefined);
    });
    await t.test('follow-up counts are independent of progress count and preserve official status', async () => {
      const result = await service.summary(id,p);
      assert.deepEqual(result.metrics.follow_up, { total: 3, open: 2, in_progress: 1, completed: 1 });
      const action = result.actions.find((a) => a.id_tindakan === 1);
      assert.equal(action.jenis_progress,'Permintaan Admin'); assert.equal(action.status_tindakan,'Dalam Tindakan');
      assert.equal(action.catatan_progress, undefined);
    });
    await t.test('official identities reject mapping the lobby record to the CCTV post', async () => {
      await assert.rejects(service.map(rows[1].id_lokasi,{ id_pos: 1 },1),{status:400});
      const result = await service.overview(p);
      assert.equal(result.totals.linked_posts,1); assert.equal(result.totals.reports,3); assert.equal(result.totals.assignments,3);
    });
    await t.test('missing location, invalid mapping and inactive post are rejected', async () => {
      await assert.rejects(service.summary(999,p), { status: 404 });
      for (const body of [{id_pos:999},{id_pos:3},{id_pos:'1 OR 1=1'},{id_pos:[1]},{hotspot_id:'INVALID'}]) await assert.rejects(service.map(id,body,1), { status: 400 });
    });
    await t.test('empty operational period returns true zero counts', async () => {
      const result = await service.summary(id,period({date:'2026-11-01'}));
      assert.equal(result.assignments.length,0); assert.equal(result.metrics.incidents.total,0); assert.equal(result.metrics.follow_up.open,0);
    });
    await t.test('Phase 4 history includes unmapped posts, paginates deterministically and never duplicates reports for mappings', async () => {
      const all = period({ date:'2026-10-24', mapping:'all' });
      const first = await service.incidents(all,{limit:'2'});
      const second = await service.incidents(all,{limit:'2',page:'2'});
      assert.equal(first.total,4); assert.deepEqual(first.items.map((r) => r.id_laporan),[4,3]);
      assert.deepEqual(second.items.map((r) => r.id_laporan),[2,1]);
      assert.equal(first.items[0].locations.length,0);
      assert.equal(second.items[1].locations.length,1);
      assert.deepEqual(second.items[1].action_statuses,['Dalam Tindakan']);
      assert.equal(second.items[1].open_actions,1);
      assert.ok(!JSON.stringify(first).includes('PRIVATE NARRATIVE'));
      const overview = await service.overview(all);
      assert.equal(overview.totals.reports,first.total); assert.equal(overview.totals.unmapped_reports,1);
      assert.equal(overview.totals.linked_posts,1); assert.equal(overview.totals.checked_in,1);
    });
    await t.test('Phase 4 filters agree between overview, history and selected summary', async () => {
      const high = period({ date:'2026-10-24', mapping:'all', risk:'HighCritical', category:'Test', report_status:'Dihantar' });
      const overview = await service.overview(high); const history = await service.incidents(high);
      assert.equal(overview.totals.high_critical,2); assert.equal(history.total,2);
      assert.equal((await service.summary(id,high)).metrics.incidents.total,1);
      assert.equal((await service.incidents(period({date:'2026-10-24',mapping:'all',risk:'Unknown'}))).total,1);
      const done = period({date:'2026-10-24', mapping:'all',action_status:'Selesai'});
      assert.equal((await service.overview(done)).totals.open_actions,0);
      assert.equal((await service.incidents(done)).items[0].id_laporan,2);
      assert.equal((await service.summary(id,done)).actions.length,1);
    });
    await t.test('Phase 4 zone, post and mapping intersection filters have no invented locations', async () => {
      const zone = period({date:'2026-10-24',mapping:'all',zone:rows[0].hotspot_id});
      assert.equal((await service.incidents(zone)).total,3);
      assert.equal((await service.overview(zone)).locations.filter((l) => l.metrics).length,1);
      await service.map(rows[1].id_lokasi,{id_pos:2},1);
      assert.equal((await service.summary(rows[1].id_lokasi,zone)).in_scope,false);
      await service.map(rows[1].id_lokasi,{id_pos:null},1);
      const unlinked = period({date:'2026-10-24',mapping:'unlinked'});
      assert.equal((await service.incidents(unlinked)).items[0].id_pos,2);
      assert.equal((await service.overview(unlinked)).totals.linked_posts,0);
      assert.equal((await service.incidents(period({date:'2026-10-24',mapping:'all',zone:rows[0].hotspot_id,post:'2'}))).total,0);
      assert.equal((await service.incidents(period({date:'2026-10-24',mapping:'all',zone:rows[2].hotspot_id}))).total,0);
    });
    await t.test('Phase 4 reference data uses stored categories and server Kuala Lumpur date', async () => {
      const refs = await service.filters();
      assert.deepEqual(refs.categories,['Test','Unknown']); assert.equal(refs.posts.length,7);
      assert.equal(refs.timezone,'Asia/Kuala_Lumpur'); assert.equal(refs.today,period().date);
    });
    await t.test('Phase 4 safely rejects malformed filters and pagination', async () => {
      for (const query of [{risk:'Extreme'},{category:['Test']},{category:'x'.repeat(101)},{post:'1 OR 1=1'},{zone:'Basement'},{mapping:'private'},{report_status:'approved'},{action_status:'done'}]) assert.throws(() => period(query),{status:400});
      for (const query of [{page:0},{limit:51},{page:10001},{page:['1']}]) await assert.rejects(service.incidents(p,query),{status:400});
      assert.equal((await service.incidents(period({date:'2026-10-24',category:"';drop table x;--"}))).total,0);
    });
    const express = require('express'); const jwt = require('jsonwebtoken'); const { jwtSecret } = require('../middleware/auth');
    const app = express(); app.use(express.json()); app.use('/api/3d',require('../routes/threeDRoutes'));
    server = app.listen(0,'127.0.0.1'); await new Promise((resolve) => server.once('listening',resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/3d`;
    async function request(route, userId, method='GET', body) {
      const response = await fetch(base+route, { method, headers: { 'Content-Type':'application/json', ...(userId ? {Authorization:`Bearer ${jwt.sign({id:userId},jwtSecret,{expiresIn:'5m'})}`} : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status:response.status, data:await response.json(), headers:response.headers };
    }
    await t.test('unauthenticated and guard requests are denied on all endpoints', async () => {
      for (const [route,method,body] of [['/locations','GET'],['/overview','GET'],['/incidents','GET'],['/filters','GET'],[`/locations/${id}/summary`,'GET'],[`/locations/${id}/mapping`,'PATCH',{id_pos:null}]]) {
        assert.equal((await request(route,null,method,body)).status,401); assert.equal((await request(route,3,method,body)).status,403);
      }
    });
    await t.test('chief reads are authorized but mapping writes are denied', async () => {
      for (const route of ['/locations','/overview','/incidents','/filters',`/locations/${id}/summary`]) assert.equal((await request(route,2)).status,200);
      assert.equal((await request(`/locations/${id}/mapping`,2,'PATCH',{id_pos:null})).status,403);
    });
    await t.test('Phase 4 API rejects expired JWT and invalid query filters', async () => {
      for (const route of ['/incidents','/filters']) {
        const response = await fetch(base+route,{headers:{Authorization:`Bearer ${jwt.sign({id:1},jwtSecret,{expiresIn:-10})}`}});
        assert.equal(response.status,401);
      }
      for (const route of ['/incidents?risk=Extreme','/incidents?limit=51','/overview?mapping=invalid',`/locations/${id}/summary?zone=invalid`]) assert.equal((await request(route,1)).status,400);
    });
    await t.test('admin can unlink and operational responses prohibit HTTP caching', async () => {
      assert.equal((await request(`/locations/${id}/mapping`,1,'PATCH',{id_pos:null})).status,200);
      const response = await request(`/locations/${id}/summary`,1); assert.equal(response.data.linked,false); assert.equal(response.headers.get('cache-control'),'no-store');
    });
    await t.test('API rejects SQL-shaped IDs and invalid ranges with 400; unknown IDs give 404', async () => {
      assert.equal((await request('/locations/1%20OR%201=1/summary',1)).status,400);
      assert.equal((await request('/locations/999/summary',1)).status,404);
      assert.equal((await request('/overview?date=2026-02-30',1)).status,400);
      assert.equal((await request('/overview?from=2026-10-24&to=2026-10-01',1)).status,400);
    });
    await t.test('failed database connection is handled without exposing SQL or credentials', async () => {
      pool.connect = async () => { throw Object.assign(new Error('private connection details'), {code:'ECONNREFUSED'}); };
      const result = await request('/overview',1); assert.equal(result.status,503); assert.ok(!JSON.stringify(result).includes('private connection'));
      pool.connect = async () => adapter;
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    pool.connect = originalConnect; pool.query = originalQuery;
    await client.query('rollback'); client.release(); await pool.end();
  }
});
