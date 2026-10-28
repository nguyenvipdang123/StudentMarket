import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const frontend = fileURLToPath(new URL('../../frontend/', import.meta.url));
process.loadEnvFile(join(frontend, '.env.local'));
if (!['localhost', '127.0.0.1', '::1'].includes(process.env.PG_HOST || 'localhost')) {
  throw Error('Chỉ chạy kiểm thử mobile chat với PostgreSQL local, không dùng database production.');
}
const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/integration-test.mjs'], {
  cwd: frontend, windowsHide: true, stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: '', TEST_MOBILE_CHAT: '1' },
});
child.on('error', () => { console.error('Không khởi chạy được kiểm thử chat.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
