"use client";

import { use, useEffect, useState } from "react";
import { CardSkeletons, EmptyState } from "@/components/FigmaStates";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ReportUserDialog from "@/components/ReportUserDialog";
import ListingDetailView from "@/components/ListingDetailView";
import { Listing, Viewer } from "@/lib/types";


export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listingId = resolvedParams.id;
  const router = useRouter();

  const [listing, setListing] = useState<Listing | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState("");
  const [reload,setReload]=useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch product details from PostgreSQL
        const prodRes = await fetch(`/api/products/${listingId}`, { cache: "no-store" });
        if (!prodRes.ok && prodRes.status!==404) throw new Error("Không tải được món đồ. Vui lòng thử lại.");
        setLoadError("");
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setListing(prodData.product);
          void fetch("/api/analytics/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({listingId,eventType:"VIEW"})});
        }

        // Fetch auth status
        const authRes = await fetch("/api/auth/me", { cache: "no-store" });
        const authData = await authRes.json();
        const user = authData.user || null;
        setViewer(user);

        if (user) {
          // Record view history in PostgreSQL
          fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: String(listingId) }),
          }).catch(() => {});

          // Check if favorited
          fetch("/api/favorites", { cache: "no-store" })
            .then(r => r.json())
            .then(favData => {
              const fav = (favData.favorites || []).some(
                (f: { productId: string }) => String(f.productId) === String(listingId)
              );
              setIsSaved(fav);
            })
            .catch(() => {});
        }
      } catch (e) {
        setLoadError(e instanceof Error?e.message:"Không tải được món đồ.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [listingId,reload]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);


  const handleToggleSave = async () => {
  if (!listing) return;
    if (!viewer) {
      setToast("Vui lòng đăng nhập để lưu tin yêu thích.");
      return;
    }

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: String(listing.id) }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsSaved(data.isSaved);
        window.dispatchEvent(new Event("sangtay_saved_changed"));
        setToast(data.isSaved ? "Đã lưu tin vào mục Yêu thích ♡" : "Đã bỏ lưu tin");
      }
    } catch {
      setToast("Có lỗi xảy ra khi lưu tin.");
    }
  };

  const handleContactSeller = () => {
    if (!listing) return;
    if (!viewer) {
      setToast("Vui lòng đăng nhập để liên hệ người bán.");
      router.push("/explore?auth=login");
      return;
    }
    router.push(`/messages?listingId=${listing.id}`);
  };

  const handleSendReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing || !reviewContent.trim()) return;
    if (!viewer) {
      setToast("Vui lòng đăng nhập để gửi đánh giá.");
      return;
    }

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: listing.sellerId,
          productId: String(listing.id),
          rating: reviewRating,
          content: reviewContent.trim(),
        }),
      });

      if (res.ok) {
        setShowReviewModal(false);
        setReviewContent("");
        setToast("Cảm ơn bạn! Đánh giá đã được lưu vào hồ sơ trao đổi.");
      } else {
        const data = await res.json();
        setToast(data.error || "Không thể gửi đánh giá.");
      }
    } catch {
      setToast("Có lỗi xảy ra khi gửi đánh giá.");
    }
  };

  if (loading) return <div className="site-shell"><Navbar/><main className="figma-screen"><CardSkeletons count={2}/></main><Footer/></div>;
  if (!listing || loadError) return <div className="site-shell"><Navbar/><main className="figma-screen">{loadError?<EmptyState title="Chưa tải được món đồ" action="Thử lại" onAction={()=>{setLoading(true);setReload(n=>n+1);}}>{loadError}</EmptyState>:<EmptyState title="Không tìm thấy món đồ" action="Khám phá món đồ khác" href="/explore">Tin này có thể đã được gỡ hoặc chưa được duyệt công khai.</EmptyState>}</main><Footer/></div>;

  return (
    <div className="site-shell">
      <Navbar />

      <main className="figma-screen figma-detail-page">
        <ListingDetailView listing={listing} viewer={viewer} saved={isSaved} onSave={handleToggleSave} onContact={handleContactSeller} onReview={() => setShowReviewModal(true)} onReport={() => setShowReportModal(true)} onNotice={setToast}/>

        {/* Modal Gửi đánh giá sau giao dịch */}
        {showReviewModal && (
          <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowReviewModal(false); }}>
            <div className="post-modal" style={{ maxWidth: "500px" }}>
              <div className="form-header">
                <div>
                  <span className="section-kicker">CỘNG ĐỒNG SANGTAY</span>
                  <h2>Đánh giá người bán ✳</h2>
                  <p>Chia sẻ trải nghiệm trao đổi món đồ với bạn <strong>{listing.seller}</strong>.</p>
                </div>
                <button className="modal-close inline" onClick={() => setShowReviewModal(false)}>×</button>
              </div>

              <form onSubmit={handleSendReview}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#364e3f", marginBottom: "8px" }}>
                    Chấm điểm mức độ hài lòng (Số sao):
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        style={{
                          fontSize: "26px",
                          border: 0,
                          background: "none",
                          color: star <= reviewRating ? "#e8a23d" : "#ccd6cf",
                          cursor: "pointer",
                        }}
                        onClick={() => setReviewRating(star)}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#364e3f", marginBottom: "8px" }}>
                    Nhận xét chi tiết:
                  </label>
                  <textarea
                    rows={4}
                    style={{ width: "100%", padding: "10px", border: "1px solid #dce4da", borderRadius: "8px", fontSize: "13px" }}
                    placeholder="Món đồ có đúng mô tả không? Bạn bán có nhiệt tình, hẹn gặp đúng giờ không?..."
                    value={reviewContent}
                    onChange={e => setReviewContent(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="post-button" style={{ width: "100%", padding: "12px" }}>
                  Gửi đánh giá uy tín
                </button>
              </form>
            </div>
          </div>
        )}

        {showReportModal && (
          <ReportUserDialog contextType="LISTING" contextId={listing.id} targetLabel={`người bán ${listing.seller}`}
            onClose={() => setShowReportModal(false)}
            onSubmitted={() => { setShowReportModal(false); setToast("Đã gửi báo cáo. Admin sẽ kiểm tra và phản hồi trong mục Báo cáo của tôi."); }} />
        )}

        {/* Toast */}
        {toast && (
          <div className="toast" role="status">
            <span>✓</span> {toast}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
