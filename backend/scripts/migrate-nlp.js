// Compatibility command: all upgrades share one ordered, checksummed migration ledger.
const {main}=require('./migrate');
const pool=require('../config/db');
main().catch(error=>{console.error('Database migration failed:',error.code||error.message,error.constraint||'');process.exitCode=1;}).finally(()=>pool.end());
