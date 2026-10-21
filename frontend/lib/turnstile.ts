export type TurnstileAction = 'register' | 'reset_password' | 'resend_verification' | 'support_create';
type Failure = { error: string; status: number };
const unavailable: Failure = {error:'Chưa kết nối được dịch vụ xác minh chống bot. Vui lòng thử lại sau.',status:503};

/** Always verify on the server before any email, upload or database write. */
export async function checkTurnstile(token: unknown, action: TurnstileAction): Promise<Failure | null> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  // Optional on installations that have not enabled Turnstile. Partial config fails closed.
  if (!secret && !sitekey) return null;
  if (!secret || !sitekey) return unavailable;
  let hostname: string;
  try { hostname = new URL(process.env.APP_ORIGIN || '').hostname; } catch { return unavailable; }
  if (!['localhost','127.0.0.1'].includes(hostname) && (/^[123]x0{10}/.test(sitekey) || /^[123]x0{10}/.test(secret))) return unavailable;
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
    return {error:'Vui lòng hoàn tất xác minh chống bot rồi thử lại.',status:403};
  }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',redirect:'error',
      body:JSON.stringify({secret,response:token}),signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) return unavailable;
    const result = await response.json();
    if (!result || typeof result !== 'object') return unavailable;
    const codes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
    if (codes.some((code:unknown)=>['missing-input-secret','invalid-input-secret','internal-error'].includes(String(code)))) return unavailable;
    if (result.success !== true || result.hostname !== hostname || result.action !== action) {
      return {error:'Xác minh chống bot không hợp lệ hoặc đã hết hạn. Vui lòng xác minh lại.',status:403};
    }
    return null;
  } catch { return unavailable; }
}
