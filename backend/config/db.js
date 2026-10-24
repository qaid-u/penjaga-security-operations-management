const { Pool } = require('pg');

const { dbOptions } = require('./dbOptions');
const pool = new Pool(dbOptions());

module.exports = pool;
