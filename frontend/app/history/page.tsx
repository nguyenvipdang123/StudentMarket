"use client";

import { useEffect, useState } from "react";
import Link from "@/components/TransitionLink";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ViewHistoryItem, Viewer } from "@/lib/types";
import { formatPrice } from "@/lib/storage";

export default function HistoryPage() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [history, setHistory] = useState<ViewHistoryItem[]>([]);
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

        const histRes = await fetch("/api/history", { cache: "no-store" });
        if (histRes.ok) {
          const histData = await histRes.json();
          setHistory(
            (histData.history || []).map((h: ViewHistoryItem & { productId: string }) => ({
              listingId: h.productId,
              title: h.title,
              price: h.price,
              image: h.image,
              seller: h.seller,
              school: h.school,
              viewedAt: h.viewedAt,
            }))
          );
        }
      } catch (e) {
        console.error("Failed to load history:", e);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    }
    init();
  }, []);

  const handleClearHistory = async () => {
    if (window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử xem tin không?")) {
      try {
        await fetch("/api/history", { method: "DELETE" });
        setHistory([]);
      } catch (e) {
        console.error("Failed to clear history:", e);
      }
    }
  };

  const handleRemoveItem = async (productId: string | number) => {
    try {
      await fetch(`/api/history?productId=${productId}`, { method: "DELETE" });
      setHistory(prev => prev.filter(item => String(item.listingId) !== String(productId)));
    } catch (e) {
      console.error("Failed to delete history item:", e);
    }
  };

  if (authChecked && !viewer) {
    return (
      <div className="site-shell">
        <Navbar />
        <main>
          <section className="page-header-banner">
            <div className="container">
              <div className="eyebrow"><span className="eyebrow-line" /> LỊCH SỬ XEM TIN</div>
              <h1>Lịch sử xem tin của bạn</h1>
            </div>
          </section>
          <section className="container" style={{ padding: "60px 0 100px" }}>
            <div className="empty-state">
              <span>🔒</span>
              <h3>Đăng nhập để xem lịch sử xem tin</h3>
              <p>Mọi món đồ bạn vừa xem sẽ được lưu tại đây để dễ dàng tìm lại.</p>
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
            <div className="eyebrow"><span className="eyebrow-line" /> LỊCH SỬ XEM TIN</div>
            <h1>Lịch sử xem tin của bạn</h1>
            <p>Xem lại những món đồ bạn vừa ghé thăm gần đây nhất.</p>
          </div>
        </section>

        <section className="container" style={{ padding: "40px 0 80px" }}>
          {history.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={handleClearHistory}
                style={{ background: "none", border: "1px solid #dcdfdc", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", color: "#b94a48", cursor: "pointer" }}
              >
                Xóa toàn bộ lịch sử
              </button>
            </div>
          )}

          {loading ? (
            <p style={{ textAlign: "center", padding: "40px", color: "#6a7b70" }}>Đang tải lịch sử xem tin...</p>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <span>🕒</span>
              <h3>Chưa có lịch sử xem tin nào</h3>
              <p>Mỗi khi bạn bấm xem chi tiết một món đồ, món đồ đó sẽ xuất hiện ở đây.</p>
              <Link href="/explore">
                <button type="button">Khám phá chợ đồ cũ</button>
              </Link>
            </div>
          ) : (
            <div className="product-grid">
              {history.map(item => (
                <div key={item.listingId} className="product-card">
                  <Link href={`/listing/${item.listingId}`}>
                    <div className="product-image">
                      <img src={item.image} alt={item.title} />
                    </div>
                  </Link>
                  <button
                    className="save-button"
                    onClick={() => handleRemoveItem(item.listingId)}
                    title="Xóa khỏi lịch sử"
                    style={{ fontSize: "12px" }}
                  >
                    ✕
                  </button>
                  <div className="product-info">
                    <Link href={`/listing/${item.listingId}`}>
                      <h4 className="product-title">{item.title}</h4>
                    </Link>
                    <div className="product-price">{formatPrice(item.price)}</div>
                    <div style={{ fontSize: "11px", color: "#8a9c90", marginTop: "4px" }}>
                      Bởi {item.seller} ({item.school})
                    </div>
                  </div>
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
