function dbOptions(env = process.env) {
  const options = { connectionTimeoutMillis:5000 };
  if(env.DATABASE_URL) {
    const url=new URL(env.DATABASE_URL);
    const mode=env.PGSSLMODE || url.searchParams.get('sslmode');
    // pg's connection-string parser otherwise overrides the explicit certificate policy.
    url.searchParams.delete('sslmode');
    options.connectionString=url.toString();
    options.ssl=mode==='disable' ? false : env.NODE_ENV==='production' || Boolean(mode) || /supabase|neon\.tech/.test(url.hostname) ? {rejectUnauthorized:true} : false;
  } else Object.assign(options,{host:env.PGHOST || 'localhost',port:Number(env.PGPORT)||5432,database:env.PGDATABASE||'penjaga_db',user:env.PGUSER||'postgres',password:env.PGPASSWORD||'postgres',ssl:env.PGSSL==='true'?{rejectUnauthorized:true}:false});
  if(options.ssl && env.PGSSL_CA)options.ssl.ca=env.PGSSL_CA.replace(/\\n/g,'\n');
  return options;
}
module.exports={dbOptions};
