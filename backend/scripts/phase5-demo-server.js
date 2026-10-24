const { configureDemo } = require('./phase5-demo-config');
configureDemo();
process.env.PORT=process.env.PHASE5_PORT || '3095';
const pool=require('../config/db');
pool.query('select version from phase5_demo_manifest').then(({rows})=>{
  if(rows[0]?.version!==1)throw new Error('Run prepare-phase5-demo.js first.');
  require('../server');
}).catch(async(error)=>{console.error(error.message);await pool.end();process.exitCode=1;});
