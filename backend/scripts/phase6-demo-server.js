const { configureDemo } = require('./phase5-demo-config');
configureDemo('penjaga_phase6_demo');
process.env.PORT = process.env.PHASE6_PORT || '3096';
const pool = require('../config/db');
pool.query('select version from phase6_demo_manifest').then(result => {
  if (result.rows[0]?.version !== 1) throw new Error('Invalid Phase 6 demonstration manifest.');
  require('../server');
}).catch(error => { console.error(error.message); process.exitCode=1; pool.end(); });
