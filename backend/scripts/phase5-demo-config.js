const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const database = 'penjaga_phase5_demo';
function configureDemo() {
  const localConfig = path.join(__dirname,'../../.phase5-runtime.local/connection.json');
  if (require('node:fs').existsSync(localConfig)) {
    const local = JSON.parse(require('node:fs').readFileSync(localConfig,'utf8'));
    if(local.host!=='127.0.0.1' || local.port!==55435)throw new Error('Invalid isolated demo cluster configuration.');
    delete process.env.DATABASE_URL;
    Object.assign(process.env,{PGHOST:local.host,PGPORT:String(local.port),PGUSER:local.user,PGPASSWORD:local.password,PGDATABASE:database});
  }
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Phase 5 automatic demo setup requires a local PostgreSQL server.');
    url.pathname = `/${database}`;
    process.env.DATABASE_URL = url.toString();
  } else {
    if (!['localhost','127.0.0.1','::1'].includes(process.env.PGHOST || 'localhost')) throw new Error('Phase 5 automatic demo setup requires local PostgreSQL.');
    process.env.PGDATABASE = database;
  }
  process.env.NODE_ENV = 'development';
  return database;
}
module.exports = { configureDemo, database };
