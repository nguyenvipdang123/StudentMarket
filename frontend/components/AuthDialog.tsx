"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { SOUTHERN_UNIVERSITIES } from "@/lib/universities";
import { isEducationEmail } from "@/lib/education-email";
import EmailCodeFlow from "./EmailCodeFlow";
import { useTurnstile } from './TurnstileChallenge';

export type AuthMode = "login" | "register" | "google-complete" | "forgot" | "verify";
export type Viewer = {
  id: number; fullName: string; email: string; studentId: string;
  university: string; status: "verified" | "pending_email" | "pending_review" | "locked";
  role: "student" | "admin";
};

const universities = [...SOUTHERN_UNIVERSITIES.map(university => university.name), "Trường khác"];

function UniversityField({ value, customValue, onChange, onCustomChange }: {
  value: string; customValue: string; onChange: (value: string) => void; onCustomChange: (value: string) => void;
}) {
  return <label className="full">Trường đại học <span>*</span>
    <select value={value} onChange={event => onChange(event.target.value)} required>
      <option value="">Chọn trường của bạn</option>
      {universities.map(name => <option key={name} value={name}>{name}</option>)}
    </select>
    {value === "Trường khác" && <input value={customValue} onChange={event => onCustomChange(event.target.value)} placeholder="Nhập tên trường đại học" minLength={2} maxLength={120} required />}
  </label>;
}

export default function AuthDialog({ initialMode, notice, onClose, onAuthenticated }: {
  initialMode: AuthMode; notice?: string; onClose: () => void; onAuthenticated: (viewer: Viewer) => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const bot = useTurnstile('register');
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [customSchool, setCustomSchool] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const loginFormRef = useRef<HTMLFormElement>(null);
  const schoolName = school === "Trường khác" ? customSchool.trim() : school;
  const isEducation = isEducationEmail(email);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  function switchMode(nextMode: AuthMode) {
    bot.reset();
    setMode(nextMode); setErrorMessage(""); setResendMessage(""); setSuccessMessage("");
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setErrorMessage(""); setResendMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể đăng nhập.");
      onAuthenticated(data.user as Viewer);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Không thể đăng nhập."); }
    finally { setBusy(false); }
  }

  async function resendVerification() {
    if (!loginFormRef.current) return;
    const form = new FormData(loginFormRef.current);
    setEmail(String(form.get("email") || "")); setCodeSent(false); switchMode("verify");
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !bot.ready) return; setBusy(true); setErrorMessage("");
    const form = new FormData(event.currentTarget);
    if (String(form.get("password")) !== String(form.get("confirmPassword"))) {
      setErrorMessage("Xác nhận mật khẩu không khớp."); setBusy(false); return;
    }
    form.set("university", schoolName);
    form.set('turnstileToken', bot.token);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể đăng ký.");
      setEmail(data.email || email); setCodeSent(true); switchMode("verify");
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Không thể đăng ký."); }
    finally { setBusy(false); bot.reset(); }
  }

  async function submitGoogleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setErrorMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/google/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: form.get("fullName"), studentId: form.get("studentId"), university: schoolName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể hoàn tất tài khoản.");
      onAuthenticated(data.user as Viewer);
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Không thể hoàn tất tài khoản."); }
    finally { setBusy(false); }
  }

  if (mode === "verify" || mode === "forgot") return <div className="auth-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-label={mode === "verify" ? "Xác thực email" : "Đặt lại mật khẩu"}>
      <button type="button" className="auth-close" onClick={onClose} aria-label="Đóng">×</button>
      <EmailCodeFlow key={mode} purpose={mode === "verify" ? "register" : "reset"} initialEmail={email} alreadySent={mode === "verify" && codeSent} onBack={() => switchMode("login")} onVerified={onAuthenticated} />
    </section>
  </div>;

  return <div className="auth-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-label={mode === "login" ? "Đăng nhập" : mode === "register" ? "Đăng ký" : "Hoàn tất tài khoản Google"}>
      <button type="button" className="auth-close" onClick={onClose} aria-label="Đóng">×</button>
      <div className="auth-intro"><span className="section-kicker">CỘNG ĐỒNG SINH VIÊN SANGTAY</span><h2>{mode === "login" ? "Chào mừng trở lại" : mode === "register" ? "Tạo tài khoản sinh viên" : "Hoàn tất tài khoản"}</h2><p>{mode === "google-complete" ? "Google đã xác minh email trường. Bổ sung mã sinh viên và trường để tiếp tục." : "Kết nối với cộng đồng và trao tay những món đồ hay."}</p></div>
      {mode !== "google-complete" && <div className="auth-tabs" role="tablist" aria-label="Đăng nhập hoặc đăng ký"><button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Đăng nhập</button><button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Đăng ký</button></div>}
      {notice && <div className="auth-notice">{notice}</div>}
      {errorMessage && <div className="auth-error" role="alert">{errorMessage}</div>}
      {resendMessage && <div className="auth-notice" role="status">{resendMessage}</div>}
      {successMessage ? <div className="auth-success" role="status"><span>✓</span><h3>Đăng ký thành công</h3><p>{successMessage}</p><button type="button" onClick={() => switchMode("login")}>Đến đăng nhập</button></div> : <>
        {mode === "login" && <form className="auth-form" ref={loginFormRef} onSubmit={submitLogin}>
          <label>Email đã đăng ký <span>*</span><input name="email" type="email" autoComplete="username" required placeholder="tenban@truong.edu.vn" /></label>
          <label>Mật khẩu <span>*</span><input name="password" type="password" autoComplete="current-password" required placeholder="Nhập mật khẩu" /></label>
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Đang kiểm tra..." : "Đăng nhập"}</button>
          <button className="auth-resend" type="button" disabled={busy} onClick={() => { setEmail(String(new FormData(loginFormRef.current!).get("email") || "")); switchMode("forgot"); }}>Quên mật khẩu?</button>
          {errorMessage.includes("chưa xác minh email") && <button className="auth-resend" type="button" onClick={resendVerification} disabled={busy}>Nhập hoặc nhận lại mã xác thực</button>}
        </form>}
        {mode === "register" && <form className="auth-form auth-register-form" onSubmit={submitRegister}>
          <label className="full">Họ và tên <span>*</span><input name="fullName" minLength={2} maxLength={100} required autoComplete="name" placeholder="Nguyễn Văn A" /></label>
          <label>Email sinh viên <span>*</span><input name="email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="tenban@truong.edu.vn" /></label>
          <label>Mã sinh viên <span>*</span><input name="studentId" minLength={3} maxLength={30} required placeholder="Ví dụ: 22123456" /></label>
          <UniversityField value={school} customValue={customSchool} onChange={setSchool} onCustomChange={setCustomSchool} />
          <label>Mật khẩu <span>*</span><input name="password" type="password" minLength={8} maxLength={128} required autoComplete="new-password" pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" title="Tối thiểu 8 ký tự, gồm chữ và số" placeholder="Tối thiểu 8 ký tự, có chữ và số" /></label>
          <label>Xác nhận mật khẩu <span>*</span><input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" placeholder="Nhập lại mật khẩu" /></label>
          <label className="full">Ảnh thẻ sinh viên {!isEducation && <span>*</span>}<input name="studentCard" type="file" accept="image/jpeg,image/png,image/webp" required={!isEducation} /><small>{isEducation ? "Không bắt buộc với email .edu/.edu.vn; tài khoản tự được duyệt sau khi nhập mã xác thực email." : "Bắt buộc với email ngoài miền .edu/.edu.vn. JPG, PNG, WebP, tối đa 5 MB; xác thực email bằng mã trước khi Admin xét duyệt."}</small></label>
          <p className="auth-rule full">Mỗi email và mã sinh viên chỉ đăng ký một lần. Tài khoản cần xác minh trước khi đăng tin hoặc nhắn người bán.</p>
          {bot.widget}
          <button className="auth-submit full" type="submit" disabled={busy || !bot.ready}>{busy ? "Đang đăng ký..." : "Tạo tài khoản"}</button>
        </form>}
        {mode === "google-complete" && <form className="auth-form auth-register-form" onSubmit={submitGoogleComplete}>
          <label className="full">Họ và tên <span>*</span><input name="fullName" minLength={2} maxLength={100} required autoComplete="name" placeholder="Tên hiển thị của bạn" /></label>
          <label className="full">Mã sinh viên <span>*</span><input name="studentId" minLength={3} maxLength={30} required placeholder="Ví dụ: 22123456" /></label>
          <UniversityField value={school} customValue={customSchool} onChange={setSchool} onCustomChange={setCustomSchool} />
          <button className="auth-submit full" type="submit" disabled={busy}>{busy ? "Đang hoàn tất..." : "Hoàn tất đăng ký"}</button>
        </form>}
        {mode !== "google-complete" && <><div className="auth-separator"><span>hoặc</span></div><a className="google-auth-button" href="/api/auth/google/start"><span className="google-g">G</span> Tiếp tục với Google trường</a><p className="auth-google-note">Chỉ chấp nhận Google Workspace của trường thuộc miền .edu hoặc .edu.vn.</p></>}
      </>}
    </section>
  </div>;
}
