const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = __dirname;
const checksum = source => createHash('sha256').update(source.replaceAll('\r\n','\n')).digest('hex');

async function loadMigrations(directory = path.join(root,'migrations')) {
  const names = (await fs.readdir(directory)).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (new Set(names.map(name=>name.slice(0,3))).size !== names.length) throw new Error('Duplicate migration number');
  return Promise.all(names.map(async name => {
    const sql = await fs.readFile(path.join(directory,name),'utf8');
    return {name,sql,checksum:checksum(sql)};
  }));
}

async function migrationStatus(client,migrations) {
  const exists = (await client.query("select to_regclass('tbl_schema_migrations') is not null as ledger, to_regclass('tbl_pengguna') is not null as initialized")).rows[0];
  const applied = exists.ledger ? (await client.query('select name,checksum,applied_at from tbl_schema_migrations order by name')).rows : [];
  const known = new Map(applied.map(row=>[row.name,row]));
  return {
    initialized:exists.initialized,
    migrations:migrations.map(m => ({name:m.name,status:!known.has(m.name)?'pending':known.get(m.name).checksum===m.checksum?'applied':'changed',appliedAt:known.get(m.name)?.applied_at})),
    unknown:applied.filter(row=>!migrations.some(m=>m.name===row.name)).map(row=>row.name),
  };
}

async function migrate(pool,{initialize=false,migrations:provided}={}) {
  const migrations=provided || await loadMigrations();
  const client=await pool.connect();
  let started=false;
  try {
    await client.query('begin');started=true;
    await client.query("set local lock_timeout='5s'");
    await client.query("set local statement_timeout='120s'");
    // Share the legacy migration locks so old and new commands cannot race.
    for(const key of [730003,730004,730006,730007])await client.query('select pg_advisory_xact_lock($1)',[key]);
    const initial=await migrationStatus(client,migrations);
    if(initial.unknown.length)throw new Error('Database has migrations missing from this checkout: '+initial.unknown.join(', '));
    const changed=initial.migrations.find(m=>m.status==='changed');
    if(changed)throw new Error('Applied migration checksum changed: '+changed.name);
    if(!initial.initialized){
      if(!initialize)throw new Error('Empty database: use db:migrate -- --init to create the schema and reference roles.');
      await client.query(await fs.readFile(path.join(root,'schema.sql'),'utf8'));
      await client.query(await fs.readFile(path.join(root,'roles.sql'),'utf8'));
    }
    await client.query(`create table if not exists tbl_schema_migrations (
      name varchar(160) primary key,
      checksum char(64) not null check(checksum ~ '^[a-f0-9]{64}$'),
      applied_at timestamptz not null default now()
    )`);
    const applied=[];
    for(const migration of migrations){
      if(initial.migrations.find(m=>m.name===migration.name)?.status==='applied')continue;
      await client.query(migration.sql);
      await client.query('insert into tbl_schema_migrations(name,checksum) values($1,$2)',[migration.name,migration.checksum]);
      applied.push(migration.name);
    }
    await client.query('commit');started=false;
    return {initialized:!initial.initialized,applied};
  } catch(error) {
    if(started)await client.query('rollback').catch(()=>{});
    throw error;
  } finally { client.release(); }
}
module.exports={loadMigrations,migrationStatus,migrate};
