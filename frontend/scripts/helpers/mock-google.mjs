import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
export async function startMockGoogle() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = { ...await exportJWK(publicKey), kid: 'test-google-key', use: 'sig', alg: 'RS256' };
  const codes = new Map();
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/certs') { response.end(JSON.stringify({ keys: [publicJwk] })); return; }
    if (request.url !== '/token') { response.writeHead(404); response.end('{}'); return; }
    let raw = ''; for await (const part of request) raw += part;
    const form = new URLSearchParams(raw), code = codes.get(form.get('code')); codes.delete(form.get('code'));
    if (!code || form.get('client_id') !== 'mobile-test-client' || form.get('client_secret') !== 'mobile-test-secret' || createHash('sha256').update(form.get('code_verifier') || '').digest('base64url') !== code.challenge) {
      response.writeHead(400); response.end('{}'); return;
    }
    const jwt = await new SignJWT(code.claims).setProtectedHeader({ alg: 'RS256', kid: publicJwk.kid }).setIssuer('https://accounts.google.com').setAudience('mobile-test-client').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    response.end(JSON.stringify({ id_token: jwt }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`,
    issue(claims, challenge) { const code = randomBytes(18).toString('hex'); codes.set(code, { claims, challenge }); return code; },
    close: () => new Promise(resolve => server.close(resolve)) };
}
