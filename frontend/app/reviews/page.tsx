"use client";

import { useEffect, useState } from "react";
import Link from "@/components/TransitionLink";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ReviewItem, Viewer } from "@/lib/types";

export default function ReviewsPage() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const authRes = await fetch("/api/auth/me", { cache: "no-store" });
        const authData = await authRes.json();
        if (!authData.user) {
          setAuthChecked(true);
          setLoading(false);
          return;
        }
        setViewer(authData.user);
        setAuthChecked(true);

        const revRes = await fetch("/api/reviews", { cache: "no-store" });
        if (revRes.ok) {
          const revData = await revRes.json();
          setReviews(revData.reviews || []);
        }
      } catch (e) {
        console.error("Failed to load reviews:", e);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    }
    init();
  }, []);

  if (authChecked && !viewer) {
    return (
      <div className="site-shell">
        <Navbar />
        <main>
          <section className="page-header-banner">
            <div className="container">
              <div className="eyebrow"><span className="eyebrow-line" /> ĐÁNH GIÁ TỪ TÔI</div>
              <h1>Đánh giá của bạn</h1>
            </div>
          </section>
          <section className="container" style={{ padding: "60px 0 100px" }}>
            <div className="empty-state">
              <span>🔒</span>
              <h3>Đăng nhập để xem đánh giá</h3>
              <p>Xem các đánh giá và phản hồi của bạn đối với các giao dịch mua bán sinh viên.</p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "16px" }}>
                <Link href="/explore?auth=login">
                  <button type="button" style={{ background: "var(--green)", color: "#fff", border: 0, borderRadius: "8px", padding: "12px 24px", fontWeight: 700, fontSize: "13px" }}>
                    Đăng nhập
                  </button>
                </Link>
                <Link href="/explore?auth=register">
                  <button type="button" style={{ background: "#fff", color: "var(--green)", border: "1px solid var(--green)", borderRadius: "8px", padding: "12px 24px", fontWeight: 700, fontSize: "13px" }}>
                    Đăng ký
                  </button>
                </Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="site-shell">
      <Navbar />
      <main>
        <section className="page-header-banner">
          <div className="container">
            <div className="eyebrow"><span className="eyebrow-line" /> ĐÁNH GIÁ TỪ TÔI</div>
            <h1>Đánh giá của bạn</h1>
            <p>Quản lý các phản hồi và đánh giá mức độ uy tín trong giao dịch P2P.</p>
          </div>
        </section>

        <section className="container" style={{ padding: "40px 0 80px" }}>
          {loading ? (
            <p style={{ textAlign: "center", padding: "40px", color: "#6a7b70" }}>Đang tải đánh giá...</p>
          ) : reviews.length === 0 ? (
            <div className="empty-state">
              <span>⭐</span>
              <h3>Chưa có đánh giá nào từ bạn</h3>
              <p>Sau khi mua hoặc trao đổi món đồ, hãy để lại đánh giá cho người bán.</p>
              <Link href="/explore">
                <button type="button">Khám phá chợ đồ cũ</button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px", maxWidth: "700px", margin: "0 auto" }}>
              {reviews.map(r => (
                <div key={r.id} style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e1e8e2" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <strong>{r.listingTitle}</strong>
                    <span style={{ color: "#e67e22" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </div>
                  <p style={{ margin: "4px 0 8px", color: "#3e4f45" }}>{r.content}</p>
                  <span style={{ fontSize: "12px", color: "#8a9c90" }}>Gửi tới {r.targetUserName}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
