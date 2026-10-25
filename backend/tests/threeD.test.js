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
  assert.equal(period().building, 'DJM');
  for (const building of ['BSI', 'BSI_JB', 'C1S', 'DJM OR 1=1', ['DJM'], null, 1]) assert.throws(() => period({ building }), { status: 400 });
  assert.throws(() => period({ building: 'BDARA', zone: 'POST_DJM_MAIN_LOBBY' }), { status: 400 });
  assert.equal(period({ building: 'BSI_KOTA_ISKANDAR', zone: 'POST_BSI_DUN' }).building, 'BSI_KOTA_ISKANDAR');
});

test('modeled building catalogue preserves legacy names and separates shared geometry identities', () => {
  const { catalogue, buildingCatalogue, selectedBuilding, isBuilding, matchesOfficialPost } = require('../services/securityPostCatalogue');
  assert.equal(buildingCatalogue.buildings.length, 8);
  assert.equal(buildingCatalogue.buildings.flatMap(building => building.posts).length, 15);
  assert.deepEqual(selectedBuilding('DJM').posts, catalogue.posts);
  assert.equal(isBuilding('Bangunan Sultan Ismail (BSI), Kota Iskandar', 'BSI_KOTA_ISKANDAR'), true);
  assert.equal(isBuilding('Bangunan Sultan Ismail (BSI)', 'BSI_KOTA_ISKANDAR'), true);
  for (const name of ['BSI', 'Bangunan Sultan Ibrahim', 'Bangunan Sultan Ibrahim (BSI), Johor Bahru']) assert.equal(isBuilding(name, 'BSI_KOTA_ISKANDAR'), false);
  for (const [id, other] of [['BDMSP','BDMIM'],['RUMAH_SS','RUMAH_VIP']]) {
    const own = selectedBuilding(id); const foreign = selectedBuilding(other);
    assert.equal(matchesOfficialPost({ nama_bangunan: own.name, nama_pos: own.posts[0].name }, own.posts[0], id), true);
    assert.equal(matchesOfficialPost({ nama_bangunan: foreign.name, nama_pos: foreign.posts[0].name }, own.posts[0], id), false);
  }
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
    const buildingMigration = await fs.readFile(path.join(__dirname, '../database/migrations/006_security_buildings.sql'), 'utf8');
    await client.query(migration);
    await client.query(await fs.readFile(path.join(__dirname, '../database/migrations/004_nlp_review.sql'), 'utf8'));
    await client.query(`
      insert into tbl_peranan(id_peranan,nama_peranan,tahap_capaian) values (1,'Pentadbir Sistem',1),(2,'Ketua Pengawal',2),(3,'Pengawal Keselamatan',3);
      insert into tbl_pengguna(id_pengguna,id_peranan,nama_penuh,emel,nama_pengguna,kata_laluan) values
       (1,1,'Test Admin','admin@test.invalid','test-admin','unused'),(2,2,'Test Chief','chief@test.invalid','test-chief','unused'),(3,3,'Test Guard','guard@test.invalid','test-guard','unused');
      insert into tbl_pos_kawalan(id_pos,nama_pos,nama_bangunan,status_pos) values
       (1,'Pos Lobi Utama','Bangunan Dato’ Jaafar Muhammad','Aktif'),
       (2,'Pos Bilik Kawalan CCTV','Bangunan Dato’ Jaafar Muhammad','Aktif'),
       (3,'Test Inactive','Other Building','Tidak Aktif'),(4,'Pos Lobi Utama','Other Building','Aktif'),
       (5,'Pos BDARA','Bangunan Dato’ Abdul Rahman Andak, Kota Iskandar','Aktif'),
       (6,'Pos Pejabat Jurutulis','Bangunan Sultan Ismail (BSI)','Aktif'),
       (7,'Pos Dewan Undangan Negeri (DUN)','Bangunan Sultan Ismail (BSI)','Aktif');
      update tbl_pos_kawalan set waktu_operasi='07:00-17:00 existing value' where id_pos=5;
      select setval(pg_get_serial_sequence('tbl_pos_kawalan','id_pos'),7);
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
    await client.query(buildingMigration);
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
      assert.equal((await client.query('select count(*)::int n from tbl_pos_kawalan')).rows[0].n,17);
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
    const { buildingCatalogue } = require('../services/securityPostCatalogue');
    const allLocations = [];
    for (const building of buildingCatalogue.buildings) allLocations.push(...await service.locations(building.id));
    await t.test('building migration reuses IDs and hours, preserves admin unlink and repeats across the full chain', async () => {
      assert.equal(allLocations.length,15);
      const bdara=allLocations.find(location => location.hotspot_id==='POST_BDARA');
      assert.equal(bdara.id_pos,5);
      assert.deepEqual((await service.locations('BSI_KOTA_ISKANDAR')).map(location=>location.id_pos),[6,7]);
      assert.equal((await client.query('select waktu_operasi from tbl_pos_kawalan where id_pos=5')).rows[0].waktu_operasi,'07:00-17:00 existing value');
      for (const building of buildingCatalogue.buildings) {
        const records=await service.locations(building.id);
        assert.deepEqual(records.map(location=>[location.hotspot_id,location.nama_paparan,location.label_aras]),building.posts.map(post=>[post.id,post.name,post.floor]));
        assert.ok(records.every(location=>location.building_id===building.id && location.position===null));
      }
      const selected=allLocations.find(location=>location.hotspot_id==='POST_BDMIM');
      await service.map(selected.id_lokasi,{id_pos:null},1,'BDMIM');
      await client.query(migration);await client.query(officialMigration);await client.query(buildingMigration);await client.query(buildingMigration);
      assert.equal((await service.locations('BDMIM'))[0].id_pos,null);
      assert.equal((await client.query('select count(*)::int n from tbl_pos_kawalan')).rows[0].n,17);
      await service.map(selected.id_lokasi,{id_pos:selected.id_pos},1,'BDMIM');
    });
    await t.test('new-building duplicate aliases abort migration without silently selecting a post', async () => {
      await client.query('savepoint duplicate_building');
      try {
        await client.query("insert into tbl_pos_kawalan(nama_pos,nama_bangunan) values('Pos BDARA','BDARA')");
        await assert.rejects(client.query(buildingMigration),/Ambiguous official post/);
      } finally { await client.query('rollback to savepoint duplicate_building');await client.query('release savepoint duplicate_building'); }
      assert.equal((await service.locations('BDARA'))[0].id_pos,5);
    });
    await client.query(`insert into tbl_pos_kawalan(id_pos,nama_pos,nama_bangunan,waktu_operasi) values
      (99,'Pos C1S','Kabin C1S','existing C1S hours'),
      (100,'Pos Pejabat Jurutulis','Bangunan Sultan Ibrahim (BSI), Johor Bahru','existing JB hours'),
      (101,'Pos BSI Johor Bahru','Bangunan Sultan Ibrahim','existing JB hours');
      select setval(pg_get_serial_sequence('tbl_pos_kawalan','id_pos'),101)`);
    for (const [i,location] of allLocations.filter(location=>location.building_id!=='DJM').entries()) {
      await client.query(`insert into tbl_laporan_harian(id_laporan,id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan)
        values($1,3,$2,$3,'Pagi','2026-10-24','14:00','PRIVATE NARRATIVE')`,[200+i,location.id_pos,`${location.building_id} own report`]);
      await client.query(`insert into tbl_hasil_nlp(id_laporan,teks_diproses,kategori_dikesan,skor_risiko,tahap_risiko)
        values($1,'private',$2,80,'High')`,[200+i,location.building_id]);
    }
    await client.query(`insert into tbl_laporan_harian(id_laporan,id_pengguna,id_pos,tajuk_laporan,syif,tarikh_laporan,masa_laporan,kandungan_laporan) values
      (299,3,99,'Unmodeled C1S','Pagi','2026-10-24','14:00','PRIVATE NARRATIVE'),
      (300,3,100,'Foreign Sultan Ibrahim','Pagi','2026-10-24','14:00','PRIVATE NARRATIVE')`);
    await t.test('selected building isolates locations, metrics, history and references, including shared models', async () => {
      for (const building of buildingCatalogue.buildings.filter(building=>building.id!=='DJM')) {
        const selected=period({date:'2026-10-24',building:building.id,mapping:'all'});
        const overview=await service.overview(selected);const history=await service.incidents(selected);const refs=await service.filters(building.id);
        assert.equal(overview.totals.locations,building.posts.length);assert.equal(overview.totals.reports,building.posts.length);
        assert.equal(history.total,building.posts.length);assert.ok(history.items.every(report=>report.tajuk_laporan===`${building.id} own report`));
        assert.deepEqual(refs.categories,[building.id]);assert.equal(refs.building,building.id);assert.equal(refs.posts.length,building.posts.length);
        assert.ok(history.items.every(report=>report.locations.every(location=>building.posts.some(post=>post.id===location.hotspot_id))));
      }
      const djm=await service.incidents(period({date:'2026-10-24',mapping:'all'}));assert.equal(djm.total,4);
      assert.ok(!JSON.stringify(djm).includes('Foreign Sultan Ibrahim'));
    });
    await t.test('cross-building summary IDs and mappings cannot access or merge reused-geometry records', async () => {
      for (const [id,other] of [['BDMSP','BDMIM'],['RUMAH_SS','RUMAH_VIP']]) {
        const location=allLocations.find(location=>location.building_id===id);const foreign=allLocations.find(location=>location.building_id===other);
        await assert.rejects(service.summary(location.id_lokasi,period({building:other})),{status:404});
        await assert.rejects(service.map(location.id_lokasi,{id_pos:foreign.id_pos},1,id),{status:400});
        await assert.rejects(service.map(location.id_lokasi,{id_pos:null},1,other),{status:404});
      }
      const utc=allLocations.find(location=>location.hotspot_id==='POST_UTC');
      const unlinked=await service.map(utc.id_lokasi,{id_pos:null},1,'UTC_JOHOR');
      assert.equal(unlinked.position,null);assert.equal(unlinked.position_status,'unconfirmed');
      await assert.rejects(service.summary(utc.id_lokasi,period({building:'DJM'})),{status:404});
      await service.map(utc.id_lokasi,{id_pos:utc.id_pos},1,'UTC_JOHOR');
      const bsi=allLocations.find(location=>location.hotspot_id==='POST_BSI_CLERK');
      await assert.rejects(service.map(bsi.id_lokasi,{id_pos:100},1,'BSI_KOTA_ISKANDAR'),{status:400});
      await client.query(buildingMigration);
      assert.deepEqual((await client.query('select id_pos,waktu_operasi from tbl_pos_kawalan where id_pos>=99 order by id_pos')).rows,
        [{id_pos:99,waktu_operasi:'existing C1S hours'},{id_pos:100,waktu_operasi:'existing JB hours'},{id_pos:101,waktu_operasi:'existing JB hours'}]);
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
    await t.test('building query is validated and applied to every API read and mapping write', async () => {
      for (const building of buildingCatalogue.buildings) {
        const response=await request(`/locations?building=${building.id}`,2);
        assert.equal(response.status,200);assert.equal(response.data.length,building.posts.length);
        assert.ok(response.data.every(location=>location.building_id===building.id));
        assert.equal((await request(`/filters?building=${building.id}`,2)).data.building,building.id);
      }
      const utc=allLocations.find(location=>location.hotspot_id==='POST_UTC');
      assert.equal((await request(`/locations/${utc.id_lokasi}/summary?building=UTC_JOHOR`,2)).status,200);
      assert.equal((await request(`/locations/${utc.id_lokasi}/summary?building=DJM`,1)).status,404);
      assert.equal((await request(`/locations/${utc.id_lokasi}/mapping?building=DJM`,1,'PATCH',{id_pos:null})).status,404);
      assert.equal((await request(`/locations/${utc.id_lokasi}/mapping?building=UTC_JOHOR`,1,'PATCH',{id_pos:1})).status,400);
      assert.equal((await request(`/locations/${utc.id_lokasi}/mapping?building=UTC_JOHOR`,2,'PATCH',{id_pos:null})).status,403);
      for (const route of ['/locations','/filters','/overview','/incidents',`/locations/${id}/summary`]) {
        assert.equal((await request(`${route}?building=BSI`,1)).status,400);
        assert.equal((await request(`${route}?building=DJM&building=BDARA`,1)).status,400);
      }
      assert.equal((await request('/filters?date=2026-10-24',1)).status,400);
      assert.equal((await request(`/locations/${utc.id_lokasi}/mapping?building=BSI`,1,'PATCH',{id_pos:null})).status,400);
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
