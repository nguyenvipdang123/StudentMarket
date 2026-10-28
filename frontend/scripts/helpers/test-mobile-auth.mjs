import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
export async function testMobileAuth({ db, req, origin, google, check }) {
  assert.match(db.database, /^student_market_test_[a-f0-9]{12}$/);
  const digest = value => createHash('sha256').update(value).digest('hex');
  async function begin() {
    const verifier = randomBytes(32).toString('hex');
    const result = await req('/api/auth/mobile/google/start', { method: 'POST', body: { challenge: digest(verifier) } });
    assert.equal(result.status, 200); assert.equal(result.data.verifier, undefined);
    const browser = await fetch(result.data.authorizationUrl, { redirect: 'manual' });
    assert.equal(browser.status, 307);
    const url = new URL(browser.headers.get('location'));
    assert.equal(url.origin, 'https://accounts.google.com'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    return { ...result.data, verifier, url, cookie: browser.headers.get('set-cookie').split(';')[0] };
  }
  const claim = flow => req('/api/auth/mobile/google/claim', { method: 'POST', body: { flowId: flow.flowId, verifier: flow.verifier } });
  async function callback(flow, extra = {}) {
    const code = google.issue({ sub: 'mobile-google-student', email: 'mobile@school.edu.vn', email_verified: true, hd: 'school.edu.vn', nonce: flow.url.searchParams.get('nonce'), name: 'Google sinh viên', ...extra }, flow.url.searchParams.get('code_challenge'));
    const response = await fetch(origin + '/api/auth/google/callback?' + new URLSearchParams({ code, state: flow.url.searchParams.get('state') }), { headers: { Cookie: flow.cookie }, redirect: 'manual' });
    const html = await response.text();
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(!html.includes('pendingToken') && !html.includes('sangtay_session') && !html.includes('mobile@school.edu.vn'));
  }
  const config = await req('/api/auth/mobile/config'); assert.equal(config.data.version, 1); assert.equal(config.data.googleEnabled, true);
  assert.equal((await req('/api/auth/mobile/google/start', { method: 'POST', body: { challenge: 'plain-secret' } })).status, 400);
  assert.equal((await req('/api/auth/mobile/google/start', { method: 'POST', body: { challenge: 'a'.repeat(64) }, headers: { Origin: 'https://wrong.invalid' } })).status, 403);
  const first = await begin(); assert.equal((await claim(first)).data.status, 'pending');
  const proofFailure = await claim({ ...first, verifier: 'b'.repeat(64) }); assert.equal(proofFailure.status, 410);
  await callback(first);
  const onboard = await claim(first); assert.equal(onboard.data.status, 'onboarding'); assert.ok(onboard.data.pendingToken); assert.equal(onboard.cookie, undefined);
  assert.equal((await claim(first)).status, 410);
  check('mobile Google uses S256/nonce and app-held proof; browser bridge exposes no credentials and handoff is single-use');

  const body = { pendingToken: onboard.data.pendingToken, fullName: 'Google sinh viên', studentId: 'GOOGLE-MOBILE-1', university: 'DNTU' };
  assert.equal((await req('/api/auth/mobile/google/complete', { method: 'POST', body: { ...body, studentId: '' } })).status, 400);
  const completes = await Promise.all([1, 2].map(() => req('/api/auth/mobile/google/complete', { method: 'POST', body })));
  assert.deepEqual(completes.map(r => r.status).sort(), [200, 401]);
  const user = completes.find(r => r.status === 200); assert.equal((await req('/api/auth/me', { cookie: user.cookie })).data.user.email, 'mobile@school.edu.vn');
  const existing = await begin(); await callback(existing);
  const claims = await Promise.all([claim(existing), claim(existing)]); assert.deepEqual(claims.map(r => r.status).sort(), [200, 410]);
  const authenticated = claims.find(r => r.status === 200); assert.equal(authenticated.data.status, 'authenticated'); assert.ok(authenticated.cookie);
  check('native Google profile validates student data, consumes onboarding atomically and creates a usable native session');

  for (const [extra, reason] of [[{ email: 'outside@gmail.com', hd: 'gmail.com' }, 'school_google'], [{ nonce: 'incorrect' }, 'school_google']]) {
    const bad = await begin(); await callback(bad, extra); const rejected = await claim(bad);
    assert.equal(rejected.status, 403); assert.equal(rejected.data.error, reason); assert.equal(rejected.cookie, undefined);
  }
  const mismatch = await begin(); const response = await fetch(origin + '/api/auth/google/callback?code=fake&state=incorrect', { headers: { Cookie: mismatch.cookie }, redirect: 'manual' });
  assert.equal(response.status, 307); assert.equal((await claim(mismatch)).data.status, 'pending');
  await db.query('UPDATE mobile_google_flows SET expires_at=0 WHERE id_hash=$1', [digest(mismatch.flowId)]);
  assert.equal((await claim(mismatch)).status, 410);
  check('Google rejects non-school or nonce/state mismatch and expired flows without issuing native sessions');

  const webToken = randomBytes(32).toString('base64url');
  await db.query("INSERT INTO google_onboarding(token_hash,google_sub,full_name,email,expires_at) VALUES($1,'web-google-test','Web Google','web-google@school.edu.vn',$2)", [digest(webToken), Date.now() + 600000]);
  const web = await req('/api/auth/google/complete', { method: 'POST', cookie: `sangtay_google_pending=${webToken}`, body: { fullName: 'Web Google', studentId: 'WEB-GOOGLE-TEST', university: 'DNTU' } });
  assert.equal(web.status, 200); assert.ok(web.cookie?.startsWith('sangtay_session='));
  assert.equal((await req('/api/auth/google/complete', { method: 'POST', cookie: `sangtay_google_pending=${webToken}`, body: { fullName: 'Web Google', studentId: 'WEB-GOOGLE-TEST', university: 'DNTU' } })).status, 401);
  check('existing website Google profile flow still works and cannot reuse onboarding credentials');
}
