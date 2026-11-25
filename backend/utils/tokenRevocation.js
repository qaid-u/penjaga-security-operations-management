// Sign-out revokes one token (by its `jti`) until the token would have expired anyway.
// Until migration 011 is applied the table is absent; the API keeps working without revocation.
const MISSING_TABLE = '42P01';
let missingUntil = 0;

async function withTable(operation, fallback) {
  if (Date.now() < missingUntil) return fallback;
  try {
    return await operation();
  } catch (error) {
    if (error.code !== MISSING_TABLE) throw error;
    // Retry after a minute so applying the migration needs no restart.
    missingUntil = Date.now() + 60_000;
    console.warn('tbl_token_dibatalkan is missing: run "npm run db:migrate" to enable sign-out revocation.');
    return fallback;
  }
}

const isRevoked = async (db, jti) => typeof jti === 'string' && withTable(
  async () => (await db.query('select 1 from tbl_token_dibatalkan where jti=$1', [jti])).rowCount > 0, false);

const revoke = async (db, { jti, exp } = {}) => typeof jti === 'string' && withTable(async () => {
  await db.query('delete from tbl_token_dibatalkan where tamat < now()');
  await db.query('insert into tbl_token_dibatalkan(jti, tamat) values($1, to_timestamp($2)) on conflict (jti) do nothing', [jti, exp]);
  return true;
}, false);

module.exports = { isRevoked, revoke };
