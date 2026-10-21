import test from 'node:test';
import assert from 'node:assert/strict';
import {checkTurnstile} from '../lib/turnstile.ts';

const keys=['TURNSTILE_SECRET_KEY','NEXT_PUBLIC_TURNSTILE_SITE_KEY','APP_ORIGIN'];
const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
const originalFetch=globalThis.fetch;
test.beforeEach(()=>{process.env.TURNSTILE_SECRET_KEY='private-test-secret';process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY='public-test-sitekey';process.env.APP_ORIGIN='https://sangtay.shop';});
test.afterEach(()=>{globalThis.fetch=originalFetch;for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}});
const answer=(data,status=200)=>{globalThis.fetch=async()=>Response.json(data,{status});};
test('without keys disabled, partial configuration fails closed',async()=>{
  delete process.env.TURNSTILE_SECRET_KEY;assert.equal((await checkTurnstile('token','register')).status,503);
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;assert.equal(await checkTurnstile(undefined,'register'),null);
  process.env.TURNSTILE_SECRET_KEY='secret';assert.equal((await checkTurnstile('token','register')).status,503);
});
test('missing/oversized token rejected without provider request',async()=>{
  globalThis.fetch=async()=>{throw Error('must not call');};
  for(const token of [undefined,null,{},'', ' ', 'x'.repeat(2049)])assert.equal((await checkTurnstile(token,'register')).status,403);
});
test('server sends secret only to Siteverify and requires matching action/hostname',async()=>{
  globalThis.fetch=async(url,init)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(init.method,'POST');assert.equal(init.cache,'no-store');assert.ok(init.signal instanceof AbortSignal);assert.deepEqual(JSON.parse(init.body),{secret:'private-test-secret',response:'one-use-token'});return Response.json({success:true,hostname:'sangtay.shop',action:'register'});};
  assert.equal(await checkTurnstile('one-use-token','register'),null);
  for(const result of [{success:true,hostname:'evil.invalid',action:'register'},{success:true,hostname:'sangtay.shop',action:'support_create'},{success:'true',hostname:'sangtay.shop',action:'register'},{}]){answer(result);assert.equal((await checkTurnstile('token','register')).status,403);}
});
test('expired and reused tokens rejected',async()=>{
  answer({success:false,'error-codes':['timeout-or-duplicate']});assert.equal((await checkTurnstile('used','register')).status,403);
});
test('provider errors fail closed without exposing secrets or raw provider messages',async()=>{
  for(const code of ['invalid-input-secret','missing-input-secret','internal-error']){answer({success:false,'error-codes':[code]});assert.equal((await checkTurnstile('token','register')).status,503);}
  answer({private:'private-test-secret'},500);assert.equal((await checkTurnstile('token','register')).status,503);
  globalThis.fetch=async()=>{throw Error('private-test-secret');};const result=await checkTurnstile('token','register');assert.equal(result.status,503);assert.ok(!result.error.includes('private-test-secret'));
  globalThis.fetch=async()=>new Response('invalid json');assert.equal((await checkTurnstile('token','register')).status,503);
});
test('no verification when origin missing or real website uses Cloudflare test keys',async()=>{
  delete process.env.APP_ORIGIN;assert.equal((await checkTurnstile('token','register')).status,503);
  process.env.APP_ORIGIN='https://sangtay.shop';process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY='1x00000000000000000000AA';assert.equal((await checkTurnstile('token','register')).status,503);
});
