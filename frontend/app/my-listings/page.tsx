"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Viewer } from "@/lib/types";
import MyListingBoard, { OwnedFilter } from "@/components/MyListingBoard";
import { EmptyState, PageIntro } from "@/components/FigmaStates";
import PromotionPerformanceDialog from "@/components/PromotionPerformanceDialog";

type MyListing = {
  hasPromotions?:boolean;
  id: string;
  title: string;
  price: number;
  status: string;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  condition: string;
  location: string;
  views: number;
  likes: number;
  chats: number;
  seller: string;
  school: string;
  image: string;
  description: string;
  createdAt: string;
  promotion?: {
    id: string;
    name: string;
    priority: number;
    badge: string;
    startAt?: string | null;
    endAt?: string | null;
  } | null;
};

export default function MyListingsPage() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [listings, setListings] = useState<MyListing[]>([]);
  const [statusFilter, setStatusFilter] = useState<OwnedFilter>("Active");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");

  // Performance Modal state
  const [perfItem, setPerfItem] = useState<MyListing | null>(null);

  // Mark Sold Modal state
  const [markSoldItem, setMarkSoldItem] = useState<MyListing | null>(null);
  const [soldViaSangTay, setSoldViaSangTay] = useState(false);
  const [buyerIdentifier, setBuyerIdentifier] = useState("");
  const [soldBusy, setSoldBusy] = useState(false);

  const fetchListings = async () => {
    try {
      const listRes = await fetch("/api/my-listings", { cache: "no-store" });
      if (!listRes.ok) throw new Error("Không tải được tin đăng. Vui lòng thử lại.");
      setLoadError("");
      if (listRes.ok) {
        const listData = await listRes.json();
        setListings(listData.listings || []);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không tải được tin đăng.");
    }
  };

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
        await fetchListings();
      } catch (e) {
        console.error("Failed to load:", e);
        setAuthChecked(true);
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);


  // Confirm Mark Sold
  const handleConfirmMarkSold = async () => {
    if (!markSoldItem) return;
    setSoldBusy(true);
    try {
      const res = await fetch(`/api/listings/${markSoldItem.id}/mark-sold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viaSangTay: soldViaSangTay,
          buyerId: buyerIdentifier.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể cập nhật trạng thái.");
      setToast(data.message || "Đã đánh dấu món đồ là Đã bán!");
      setMarkSoldItem(null);
      await fetchListings();
    } catch (e) {
      setToast((e instanceof Error ? e.message : "") || "Lỗi thao tác.");
    } finally {
      setSoldBusy(false);
    }
  };

  const [clock, setClock] = useState(0);
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const initial = setTimeout(tick, 0);
    const timer = setInterval(tick, 60000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, []);

  const formatRemainingTime = (endAt?: string | null) => {
    if (!endAt) return "";
    const ms = new Date(endAt).getTime() - clock;
    if (ms <= 0) return "Hết hạn";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Còn ${days} ngày ${hours % 24}h`;
    }
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `Còn ${hours}h ${mins}p`;
  };

  if (authChecked && !viewer) return <div className="site-shell"><Navbar/><main className="figma-screen"><PageIntro title="Tin đăng của tôi">Quản lý những món đồ bạn đang bán, trao đổi và chia sẻ.</PageIntro><EmptyState title="Đăng nhập để quản lý tin đăng" action="Đăng nhập" href="/explore?auth=login">Tin đăng của bạn sẽ được lưu tại đây.</EmptyState></main><Footer/></div>;

  return (
    <div className="site-shell">
      <Navbar />
      <main>
        <MyListingBoard viewer={viewer} listings={listings} loading={loading} error={loadError} filter={statusFilter} onFilter={setStatusFilter} onRetry={()=>void fetchListings()} onSold={item=>{setMarkSoldItem(listings.find(i=>i.id===item.id)||null);setSoldViaSangTay(false);setBuyerIdentifier("");}} onPerformance={item=>setPerfItem(listings.find(i=>i.id===item.id)||null)} remaining={formatRemainingTime}/>

        {/* MODAL: MARK AS SOLD (Section 32) */}
        {markSoldItem && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
            }}
            onClick={() => !soldBusy && setMarkSoldItem(null)}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                maxWidth: "460px",
                width: "100%",
                padding: "26px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: "19px", color: "#111827" }}>
                Xác nhận đã bán món đồ
              </h2>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6b7280" }}>
                Tin đăng: <strong>{markSoldItem.title}</strong>
              </p>

              <div style={{ background: "#f9fafb", borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
                  Người mua có liên hệ qua SangTay không?
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setSoldViaSangTay(false)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: !soldViaSangTay ? "2px solid var(--green)" : "1px solid #d1d5db",
                      background: !soldViaSangTay ? "#f0fdf4" : "#ffffff",
                      fontWeight: 700,
                      fontSize: "12px",
                      color: !soldViaSangTay ? "var(--green)" : "#4b5563",
                      cursor: "pointer",
                    }}
                  >
                    Bán ngoài SangTay
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoldViaSangTay(true)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: soldViaSangTay ? "2px solid var(--green)" : "1px solid #d1d5db",
                      background: soldViaSangTay ? "#f0fdf4" : "#ffffff",
                      fontWeight: 700,
                      fontSize: "12px",
                      color: soldViaSangTay ? "var(--green)" : "#4b5563",
                      cursor: "pointer",
                    }}
                  >
                    Bán qua SangTay
                  </button>
                </div>
              </div>

              {soldViaSangTay && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "4px" }}>
                    Email hoặc mã sinh viên người mua:
                  </label>
                  <input
                    type="text"
                    value={buyerIdentifier}
                    onChange={e => setBuyerIdentifier(e.target.value)}
                    placeholder="ví dụ: b@gmail.com hoặc mã SV"
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "13px" }}
                  />
                  <small style={{ color: "#6b7280", fontSize: "11px", display: "block", marginTop: "4px" }}>
                    Người mua sẽ nhận được thông báo để xác nhận giao dịch thành công.
                  </small>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setMarkSoldItem(null)}
                  style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={soldBusy}
                  onClick={handleConfirmMarkSold}
                  style={{ padding: "9px 20px", borderRadius: "8px", border: 0, background: "var(--green)", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}
                >
                  {soldBusy ? "Đang xử lý..." : "Xác nhận đã bán"}
                </button>
              </div>
            </div>
          </div>
        )}

        {perfItem&&<PromotionPerformanceDialog listingId={perfItem.id} title={perfItem.title} onClose={()=>setPerfItem(null)}/>}

        {toast && <div className="toast" role="status"><span>✓</span> {toast}</div>}
      </main>
      <Footer />
    </div>
  );
}
