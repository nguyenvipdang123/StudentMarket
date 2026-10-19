// Shared by the web server, Node worker and operational commands. Never log this object.
export function databaseConfig(env = process.env) {
  let connectionString=env.DATABASE_URL;
  if(connectionString && env.PG_SSL_MODE) {
    let url;try{url=new URL(connectionString);}catch{throw new Error('Invalid DATABASE_URL.');}
    for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
    connectionString=url.toString();
  }
  const config = connectionString ? { connectionString } : {
    host: env.PG_HOST || 'localhost', port: Number(env.PG_PORT || 5432),
    database: env.PG_DATABASE || 'student_market', user: env.PG_USER || 'postgres', password: env.PG_PASSWORD,
  };
  // Internal Render URLs use the private network; external TLS can require certificate verification.
  if (env.PG_SSL_MODE === 'verify-full') config.ssl = { rejectUnauthorized: true };
  else if (env.PG_SSL_MODE === 'disable') config.ssl = false;
  else if (env.PG_SSL_MODE) throw new Error('PG_SSL_MODE must be disable or verify-full.');
  return { ...config, connectionTimeoutMillis: 5000 };
}
export function databasePoolSize(env = process.env) {
  const max = Number(env.PG_POOL_MAX || 5);
  if (!Number.isInteger(max) || max < 2 || max > 20) throw new Error('PG_POOL_MAX must be between 2 and 20.');
  return max;
}
