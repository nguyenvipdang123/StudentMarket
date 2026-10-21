"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Viewer } from "./AuthDialog";
import { useTurnstile } from './TurnstileChallenge';

export default function EmailCodeFlow({ purpose, initialEmail, alreadySent = false, onBack, onVerified }: {
  purpose: "register" | "reset"; initialEmail: string; alreadySent?: boolean;
  onBack: () => void; onVerified: (viewer: Viewer) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const bot = useTurnstile(purpose === 'register' ? 'resend_verification' : 'reset_password');
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(alreadySent);
  const [cooldown, setCooldown] = useState(alreadySent ? 60 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(alreadySent ? "Mã đã được gửi. Hãy kiểm tra hộp thư và mục thư rác." : "");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault(); if (busy || cooldown || !bot.ready) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(purpose === "register" ? "/api/auth/resend-verification" : "/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, turnstileToken: bot.token }),
      });
      const data = await response.json();
      if (!response.ok) { if (response.status === 429) setCooldown(60); throw new Error(data.error || "Chưa gửi được mã."); }
      setSent(true); setCode(""); setCooldown(data.resendAfter || 60); setNotice(data.message);
    } catch (e) { setError(e instanceof Error ? e.message : "Không gửi được mã."); }
    finally { setBusy(false); bot.reset(); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget);
    if (purpose === "reset" && fields.get("newPassword") !== fields.get("confirmPassword")) { setError("Mật khẩu mới và xác nhận không khớp."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(purpose === "register" ? "/api/auth/verify" : "/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code, newPassword: fields.get("newPassword"), confirmPassword: fields.get("confirmPassword") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không xác nhận được mã.");
      if (purpose === "register" && data.user) onVerified(data.user);
      else setSuccess(data.message);
    } catch (e) { setError(e instanceof Error ? e.message : "Yêu cầu chưa thành công."); }
    finally { setBusy(false); }
  }

  return <>
    <div className="auth-intro"><span className="section-kicker">BẢO MẬT TÀI KHOẢN SANGTAY</span>
      <h2>{purpose === "register" ? "Xác thực email của bạn" : "Đặt lại mật khẩu"}</h2>
      <p>{purpose === "register" ? "Nhập mã 6 số để xác nhận email. Email trường được tự duyệt; email khác chờ xét ảnh thẻ." : "Nhận mã qua email để tạo mật khẩu mới cho tài khoản của bạn."}</p>
    </div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {notice && !success && <div className="auth-notice" role="status">{notice}</div>}
    {success ? <div className="auth-success" role="status"><span>✓</span><h3>Hoàn tất</h3><p>{success}</p><button type="button" onClick={onBack}>Về đăng nhập</button></div> : <>
      {!sent ? <form className="auth-form" onSubmit={requestCode}>
        <label>Email đã đăng ký<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoFocus /></label>
        {bot.widget}
        <button className="auth-submit" disabled={busy || cooldown > 0 || !bot.ready}>{busy ? "Đang gửi…" : cooldown ? `Gửi lại sau ${cooldown}s` : "Gửi mã xác thực"}</button>
      </form> : <form className="auth-form" onSubmit={submit}>
        <label>Email nhận mã<input type="email" value={email} readOnly /></label>
        <label>Mã xác thực 6 số<input className="auth-code-input" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus placeholder="000000" /><small>Mã có hiệu lực 10 phút, chỉ dùng một lần. Mã cũ mất hiệu lực sau khi gửi lại thành công.</small></label>
        {purpose === "reset" && <>
          <label>Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" title="Tối thiểu 8 ký tự, gồm chữ và số" /></label>
          <label>Nhập lại mật khẩu mới<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
        </>}
        <button className="auth-submit" disabled={busy}>{busy ? "Đang xác nhận…" : purpose === "register" ? "Xác thực email" : "Lưu mật khẩu mới"}</button>
        {bot.widget}
        <button className="auth-resend" type="button" disabled={busy || cooldown > 0 || !bot.ready} onClick={() => void requestCode()}>{cooldown ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã"}</button>
        <button className="auth-resend" type="button" disabled={busy} onClick={() => { bot.reset(); setSent(false); setCode(""); setNotice(""); setError(""); }}>Đổi email nhận mã</button>
      </form>}
      <button className="auth-resend auth-back-link" type="button" disabled={busy} onClick={onBack}>← Quay lại đăng nhập</button>
    </>}
  </>;
}
