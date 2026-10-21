const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.PGSSLMODE === 'disable'
          ? false
          : process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('sslmode=require') || process.env.DATABASE_URL.includes('supabase') || process.env.DATABASE_URL.includes('neon.tech')
          ? { rejectUnauthorized: false }
          : false,
    })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'penjaga_db',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    });

module.exports = pool;
