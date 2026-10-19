export function productionErrors(env=process.env,role='web') {
  const missing=[];
  if(!env.DATABASE_URL && ![env.PG_HOST,env.PG_DATABASE,env.PG_USER,env.PG_PASSWORD].every(Boolean))missing.push('DATABASE_URL or complete PG_* settings');
  if(env.DATABASE_URL){try{const u=new URL(env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname||!u.pathname.slice(1))missing.push('DATABASE_URL');}catch{missing.push('DATABASE_URL');}}
  if(role==='web') {
    try{const u=new URL(env.APP_ORIGIN);if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||u.username||u.password||['localhost','127.0.0.1'].includes(u.hostname))missing.push('APP_ORIGIN (public HTTPS origin)');}catch{missing.push('APP_ORIGIN');}
    try{const u=new URL(env.NEXT_PUBLIC_CHAT_WS_URL);if(u.protocol!=='wss:'||u.pathname!=='/'||u.search||u.hash||u.username||u.password)missing.push('NEXT_PUBLIC_CHAT_WS_URL (public wss:// origin)');}catch{missing.push('NEXT_PUBLIC_CHAT_WS_URL');}
    if((env.CHAT_TICKET_SECRET||'').length<32)missing.push('CHAT_TICKET_SECRET (32+ characters)');
  }
  if(env.MEDIA_STORAGE_PROVIDER!=='supabase')missing.push('MEDIA_STORAGE_PROVIDER=supabase');
  if(!env.SUPABASE_URL || !/^https:\/\//.test(env.SUPABASE_URL))missing.push('SUPABASE_URL');
  if(!env.SUPABASE_SECRET_KEY&&!env.SUPABASE_SERVICE_ROLE_KEY)missing.push('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}
