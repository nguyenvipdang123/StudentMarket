import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {databaseConfig} from '../lib/database-config.mjs';

const frontend=fileURLToPath(new URL('..',import.meta.url));process.chdir(frontend);
try{process.loadEnvFile('.env.local');}catch(e){if(e.code!=='ENOENT')throw e;}
const settings=new pg.Client(databaseConfig()).connectionParameters;
const database='student_market_deploy_'+randomBytes(6).toString('hex');
assert.match(database,/^student_market_deploy_[a-f0-9]{12}$/);assert.notEqual(database,settings.database);
await mkdir('../.backups/deploy-tests',{recursive:true});
const directory=await mkdtemp(resolve('../.backups/deploy-tests/run-'));
const admin=new pg.Client({...databaseConfig(),connectionString:undefined,host:settings.host,port:settings.port,user:settings.user,password:settings.password,database:'postgres'});
let db,created=false,server,chat;let output='';const children=new Set();
const uri=new URL('postgresql://localhost');uri.hostname=settings.host;uri.port=String(settings.port);uri.username=settings.user;uri.password=settings.password;uri.pathname='/'+database;
const env={...process.env,DATABASE_URL:uri.toString(),PG_SSL_MODE:process.env.PG_SSL_MODE||'disable',PG_POOL_MAX:'3',NODE_ENV:'production',
  APP_ORIGIN:'https://deploy-test.example',NEXT_PUBLIC_CHAT_WS_URL:'wss://deploy-chat.example',CHAT_TICKET_SECRET:randomBytes(32).toString('hex'),
  MEDIA_STORAGE_PROVIDER:'supabase',MEDIA_STORAGE_READ_LOCAL_FALLBACK:'false',SUPABASE_URL:'https://deploy-storage.invalid',SUPABASE_SECRET_KEY:'sb_secret_deploy_test_only',SUPABASE_SERVICE_ROLE_KEY:'',
  GEMINI_API_KEY:'',GOOGLE_API_KEY:'',NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY:'',PDF_CHAT_APP_URL:'',PDF_CHAT_GRAPH_URL:'',SEPAY_ENABLED:'false',NODE_OPTIONS:''};
for(const k of Object.keys(env))if(k.startsWith('SEPAY_'))env[k]='';env.SEPAY_ENABLED='false';
function launch(script,args=[],override={}){
  const child=spawn(process.execPath,[script,...args],{env:{...env,...override},cwd:frontend,windowsHide:true,stdio:['ignore','pipe','pipe']});children.add(child);
  child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});child.once('exit',()=>children.delete(child));return child;
}
const done=child=>new Promise((res,rej)=>{child.once('error',rej);child.once('exit',code=>res(code));});
async function stop(child){if(!child||child.exitCode!==null)return;const ended=done(child);child.kill();await ended;}
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function ready(url,child){for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Test service exited; see sanitized server.log.');try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,150));}throw Error('Test service did not become ready.');}
try{
  await admin.connect();await admin.query(`CREATE DATABASE "${database}"`);created=true;
  console.log('Verify empty-database deployment: '+database);
  assert.equal(await done(launch('scripts/migrate-postgres.mjs')),0);
  db=new pg.Client({...databaseConfig(env)});await db.connect();
  assert.equal((await db.query('SELECT count(*)::int n FROM products')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM auth_identities')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM categories')).rows[0].n,5);
  assert.equal(await done(launch('scripts/migrate-postgres.mjs')),0);
  assert.equal(await done(launch('scripts/ai-moderation-worker.mjs',['--once'],{NODE_OPTIONS:'--experimental-strip-types'})),0);
  console.log('PASS fresh migration, repeat migration, worker with DATABASE_URL and no .NET runtime.');
  console.log('Building isolated standalone production artifact...');
  if(!process.argv.includes('--skip-build'))assert.equal(await done(launch('scripts/build-production.mjs')),0);
  assert.ok(!(await readdir('.next-render/standalone')).some(name=>name.startsWith('.env')));
  const webPort=await port();
  // Launch the actual self-contained artifact directly; no full node_modules or local env is required at runtime.
  server=launch('.next-render/standalone/server.js',[],{HOSTNAME:'127.0.0.1',PORT:String(webPort)});
  const origin='http://127.0.0.1:'+webPort;await ready(origin+'/api/health',server);
  assert.equal((await (await fetch(origin+'/api/products')).json()).pagination.total,0);
  assert.equal((await fetch(origin+'/')).status,200);
  for(const file of ['/fonts/dm-serif-display.ttf','/images/thu-vien-dntu.jpg','/sample/hoc-tap.svg']) {
    const res=await fetch(origin+file);assert.equal(res.status,200,'Static asset '+file);assert.ok((await res.arrayBuffer()).byteLength>0);
  }
  const manifests=JSON.parse(await readFile('.next-render/build-manifest.json','utf8'));
  assert.ok(manifests.rootMainFiles.length>0);
  const staticFile=(await readdir('.next-render/static/css'))[0];assert.equal((await fetch(origin+'/_next/static/css/'+staticFile)).status,200);
  const faq=await fetch(origin+'/api/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Làm sao để đăng tin?'})});
  assert.equal(faq.status,200);assert.match(await faq.text(),/create-listing/);
  const unknown=await fetch(origin+'/api/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Tài liệu PDF nói về quang hợp như thế nào?'})});
  assert.equal(unknown.status,503);assert.match((await unknown.json()).error,/PDF/);
  console.log('PASS standalone HTTP, health/database, fonts/images/CSS and local FAQ; missing PDF service is explicit.');
  const python=resolve('../.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const chatPort=await port();
  chat=spawn(python,['-m','uvicorn','fastapi_chat.main:app','--host','127.0.0.1','--port',String(chatPort),'--no-access-log'],{cwd:resolve('..'),env,windowsHide:true,stdio:['ignore','pipe','pipe']});children.add(chat);
  chat.stdout.on('data',b=>{output+=b;});chat.stderr.on('data',b=>{output+=b;});chat.once('exit',()=>children.delete(chat));
  await ready('http://127.0.0.1:'+chatPort+'/health',chat);console.log('PASS Python chat with DATABASE_URL.');
  await writeFile(join(directory,'summary.json'),JSON.stringify({passed:true,database,checks:['fresh-schema','repeat-migration','worker','standalone','static-assets','faq','chat-database-url']}));
}catch(e){console.error(e.message);process.exitCode=1;}
finally{
  for(const child of children)await stop(child);
  await db?.end();if(created)await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end();
  // Only fake test-service credentials are present, but redact connection strings defensively.
  await writeFile(join(directory,'server.log'),output.replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[REDACTED DATABASE URL]'),{mode:0o600});
  console.log('Deployment verification report: '+directory);
}
