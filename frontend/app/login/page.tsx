"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/TransitionLink";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/explore";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          router.push(returnUrl);
        }
      })
      .catch(() => {});
  }, [router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Đăng nhập thất bại.");
      }

      window.dispatchEvent(new Event("sangtay_saved_changed"));
      router.push(returnUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="site-shell">
      <Navbar />
      <main style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 16px" }}>
        <div style={{ maxWidth: "420px", width: "100%", background: "#fff", border: "1px solid #dcdfdc", borderRadius: "16px", padding: "36px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <h2 style={{ fontSize: "22px", color: "#1e3328", marginBottom: "8px" }}>Đăng nhập tài khoản</h2>
            <p style={{ fontSize: "14px", color: "#6a7b70" }}>Chào mừng bạn quay lại chợ sinh viên SangTay</p>
          </div>

          {error && (
            <div style={{ background: "#fdf2f2", color: "#c0392b", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#324a3c", marginBottom: "6px" }}>
                Email đăng nhập
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@student.edu.vn"
                required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #dcdfdc", borderRadius: "8px", fontSize: "14px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#324a3c", marginBottom: "6px" }}>
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #dcdfdc", borderRadius: "8px", fontSize: "14px" }}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              style={{
                background: "var(--green)",
                color: "#fff",
                border: 0,
                borderRadius: "8px",
                padding: "12px",
                fontWeight: 700,
                fontSize: "14px",
                cursor: busy ? "not-allowed" : "pointer",
                marginTop: "8px",
              }}
            >
              {busy ? "Đang đăng nhập..." : "Đăng nhập ngay"}
            </button>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16, fontSize: 13 }}>
            <Link href="/explore?auth=forgot">Quên mật khẩu?</Link>
            <Link href="/explore?auth=verify">Xác thực email bằng mã</Link>
          </div>

          <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#6a7b70" }}>
            Chưa có tài khoản?{" "}
            <Link href="/explore?auth=register" style={{ color: "var(--green)", fontWeight: 700 }}>
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "100px" }}>Đang tải...</div>}>
      <LoginContent />
    </Suspense>
  );
}
