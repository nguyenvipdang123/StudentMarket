import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseConfig,databasePoolSize} from '../lib/database-config.mjs';
import {productionErrors} from './production-config.mjs';
test('cloud database URL wins over local PG variables and explicit TLS mode wins over URI options',()=>{
  const c=databaseConfig({DATABASE_URL:'postgresql://test:fake@cloud.invalid/demo?sslmode=require',PG_DATABASE:'local',PG_SSL_MODE:'verify-full'});
  assert.equal(c.database,undefined);assert.equal(new URL(c.connectionString).searchParams.has('sslmode'),false);assert.equal(c.ssl.rejectUnauthorized,true);
  assert.equal(databaseConfig({PG_SSL_MODE:'disable'}).ssl,false);
  assert.throws(()=>databaseConfig({PG_SSL_MODE:'unsafe'}));assert.equal(databasePoolSize({}),5);assert.throws(()=>databasePoolSize({PG_POOL_MAX:'1'}));
});
test('production rejects ephemeral storage and unsafe application URLs without exposing credentials',()=>{
  const env={DATABASE_URL:'postgresql://test:fake@cloud.invalid/demo',APP_ORIGIN:'https://sangtay.example',NEXT_PUBLIC_CHAT_WS_URL:'wss://chat.example',CHAT_TICKET_SECRET:'x'.repeat(32),MEDIA_STORAGE_PROVIDER:'supabase',SUPABASE_URL:'https://storage.example',SUPABASE_SECRET_KEY:'test-placeholder'};
  assert.deepEqual(productionErrors(env),[]);
  const errors=productionErrors({...env,APP_ORIGIN:'http://localhost:3000',NEXT_PUBLIC_CHAT_WS_URL:'ws://localhost:8000',MEDIA_STORAGE_PROVIDER:'local'});
  assert.equal(errors.length,3);assert.ok(!errors.join('').includes('test-placeholder'));
  assert.equal(productionErrors({...env,APP_ORIGIN:''},'worker').length,0);
});
