"use client";

import { useEffect, useState } from "react";
import Link from "@/components/TransitionLink";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Viewer } from "@/lib/types";
import { formatPrice } from "@/lib/storage";
import SavedSearches from "@/components/SavedSearches";

type FavoriteItem = {
  id: string;
  productId: string;
  title: string;
  price: number;
  freeGift: boolean;
  status: string;
  condition: string;
  location: string;
  seller: string;
  school: string;
  image: string;
  savedAt: string;
  priceAlertEnabled: boolean;
};

export default function SavedPage() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [savedListings, setSavedListings] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [alertBusy,setAlertBusy]=useState('');
  async function togglePrice(item:FavoriteItem) {
    setAlertBusy(item.productId);
    try {
      const res=await fetch('/api/favorites',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:item.productId,enabled:!item.priceAlertEnabled})});
      const data=await res.json();if(!res.ok)throw Error(data.error||'Không đổi được theo dõi giảm giá.');
      setSavedListings(items=>items.map(row=>row.productId===item.productId?{...row,priceAlertEnabled:data.priceAlertEnabled}:row));
      setToast(data.priceAlertEnabled?'Đã bật thông báo giảm giá cho món đồ này.':'Đã tắt thông báo giảm giá cho món đồ này.');
    }catch(e){setToast(e instanceof Error?e.message:'Không đổi được theo dõi giảm giá.');}finally{setAlertBusy('');}
  }

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

        // Load favorites from authenticated API
        const favRes = await fetch("/api/favorites", { cache: "no-store" });
        if (favRes.ok) {
          const favData = await favRes.json();
          setSavedListings(favData.favorites || []);
        }
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
      const timer = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleRemove = async (productId: string, title: string) => {
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        setSavedListings(prev => prev.filter(item => item.productId !== productId));
        setToast(`Đã bỏ lưu tin: "${title}"`);
        window.dispatchEvent(new Event("sangtay_saved_changed"));
      }
    } catch (e) {
      console.error("Failed to remove favorite:", e);
    }
  };

  // Not logged in
  if (authChecked && !viewer) {
    return (
      <div className="site-shell">
        <Navbar />
        <main>
          <section className="page-header-banner">
            <div className="container">
              <div className="eyebrow"><span className="eyebrow-line" /> DANH SÁCH YÊU THÍCH</div>
              <h1>Các món đồ bạn đã lưu</h1>
            </div>
          </section>
          <section className="container" style={{ padding: "60px 0 100px" }}>
            <div className="empty-state">
              <span>🔒</span>
              <h3>Đăng nhập để xem tin đã lưu</h3>
              <p>Theo dõi tình trạng và giá cả những món đồ bạn đang quan tâm.</p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "16px" }}>
                <Link href="/explore?auth=login">
                  <button type="button" style={{ background: "var(--green)", color: "#fff", border: 0, borderRadius: "8px", padding: "12px 24px", fontWeight: 700, fontSize: "13px" }}>Đăng nhập</button>
                </Link>
                <Link href="/explore?auth=register">
                  <button type="button" style={{ background: "#fff", color: "var(--green)", border: "1px solid var(--green)", borderRadius: "8px", padding: "12px 24px", fontWeight: 700, fontSize: "13px" }}>Đăng ký</button>
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
            <div className="eyebrow"><span className="eyebrow-line" /> DANH SÁCH YÊU THÍCH CỦA BẠN</div>
            <h1>Các món đồ bạn đã lưu</h1>
            <p>Theo dõi tình trạng và giá cả những món đồ bạn đang quan tâm để thuận tiện trao đổi khi cần.</p>
          </div>
        </section>

        <section className="container" style={{ padding: "40px 0 80px" }}>
          <SavedSearches viewer={viewer}/>
          <h2>Món đồ yêu thích & thông báo giảm giá</h2>
          <p style={{fontSize:13,color:'#657a69',marginBottom:20}}>Lưu một món đồ sẽ bật theo dõi giảm giá. Bạn có thể tắt riêng từng món; thông báo chỉ xuất hiện khi giá mới được duyệt.</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#324a3c" }}>
              {savedListings.length} món đồ trong danh sách đã lưu
            </span>
            {savedListings.length > 0 && (
              <Link href="/explore" style={{ fontSize: "12px", color: "var(--green)", fontWeight: 700 }}>
                + Khám phá thêm món đồ khác
              </Link>
            )}
          </div>

          {loading ? (
            <p style={{ color: "#7a8c80", textAlign: "center", padding: "40px" }}>Đang tải tin đã lưu...</p>
          ) : savedListings.length === 0 ? (
            <div className="empty-state">
              <span>💛</span>
              <h3>Chưa có tin yêu thích nào</h3>
              <p>Nhấn biểu tượng trái tim ♡ trên mỗi sản phẩm để lưu vào đây.</p>
              <Link href="/explore"><button type="button">Khám phá chợ đồ cũ</button></Link>
            </div>
          ) : (
            <div className="product-grid">
              {savedListings.map(item => (
                <div key={item.id} className="product-card">
                  <Link href={`/listing/${item.productId}`}>
                    <div className="product-image">
                      <img src={item.image} alt={item.title} />
                    </div>
                  </Link>
                  <button
                    className="save-button is-saved"
                    onClick={() => handleRemove(item.productId, item.title)}
                    title="Bỏ lưu"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                  <div className="product-info">
                    <div className="product-meta">
                      <span>{item.condition}</span>
                      <span className="meta-dot">·</span>
                      <span>{item.status}</span>
                    </div>
                    <Link href={`/listing/${item.productId}`} className="product-title">{item.title}</Link>
                    <div className="product-price">{item.price === 0 && item.freeGift ? 'Tặng miễn phí' : formatPrice(item.price)}</div>
                    <button type="button" className="figma-button" aria-pressed={item.priceAlertEnabled} disabled={!!alertBusy} onClick={()=>void togglePrice(item)} style={{fontSize:11,margin:'12px 0',width:'100%'}}>{item.priceAlertEnabled?'Tắt báo giảm giá':'Bật báo giảm giá'}</button>
                    <div className="product-location">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                      {item.location}
                    </div>
                    <div className="product-seller">
                      <span className="seller-avatar">{item.seller?.charAt(0)}</span>
                      <span>{item.seller} <small>{item.school}</small></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
