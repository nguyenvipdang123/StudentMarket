"use client";
/* eslint-disable @next/next/no-img-element */
import { use, useCallback, useEffect, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MarketplaceCard from "@/components/MarketplaceCard";
import SellerProfileIcon from "@/components/SellerProfileIcon";
import { EmptyState, CardSkeletons } from "@/components/FigmaStates";
import type { Listing } from "@/lib/types";
import "./seller-profile.css";

type Profile = {
  seller: { id: string; fullName: string; university: string; joinedAt: string; verified: boolean };
  products: Listing[];
  reviews: { id: string; rating: number; content: string; reviewerName: string; listingTitle: string; createdAt: string }[];
};
type SellerTab = "Active" | "Sold" | "Reviews";
const tabs: { id: SellerTab; name: string }[] = [
  { id: "Active", name: "Đang bán" }, { id: "Sold", name: "Đã bán" }, { id: "Reviews", name: "Đánh giá" },
];

function RatingSummary({ reviews, score }: { reviews: Profile["reviews"]; score: string | null }) {
  const stars = score ? Math.round(Number(score)) : 0;
  return <section className="seller-rating-summary" aria-label="Tổng hợp đánh giá">
    <h3>Đánh giá từ cộng đồng</h3>
    <strong className="seller-rating-value">{score?.replace(".", ",") || "—"}</strong>
    <span className="seller-stars" aria-label={score ? score + " trên 5 sao" : "Chưa có đánh giá"}>{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>
    <p>{reviews.length ? reviews.length + " đánh giá từ giao dịch" : "Chưa có đánh giá từ giao dịch"}</p>
    <div className="seller-rating-bars">{[5, 4, 3, 2, 1].map(n => {
      const count = reviews.filter(r => r.rating === n).length;
      return <div key={n}><span>{n} ★</span><progress aria-label={n + " sao: " + count + " đánh giá"} value={count} max={reviews.length || 1} /><span>{count}</span></div>;
    })}</div>
  </section>;
}

export default function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<SellerTab>("Active");
  const [saved, setSaved] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/sellers/" + id, { signal });
      const profile = await response.json();
      if (!response.ok) throw new Error(profile.error || "Không tải được hồ sơ.");
      if (!signal?.aborted) { setData(profile); setTab("Active"); }
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Không tải được hồ sơ.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/favorites", { cache: "no-store", signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(result => { if (result && !controller.signal.aborted) setSaved((result.favorites || []).map((f: { productId: string }) => String(f.productId))); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function save(item: Listing) {
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: item.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Đăng nhập để lưu tin.");
      setSaved(ids => result.isSaved ? [...new Set([...ids, item.id])] : ids.filter(x => x !== item.id));
      window.dispatchEvent(new Event("sangtay_saved_changed"));
      setNotice(result.isSaved ? "Đã lưu tin." : "Đã bỏ lưu tin.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Không lưu được tin."); }
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(tabs[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }

  const active = data?.products.filter(p => p.status === "Active") || [];
  const sold = data?.products.filter(p => p.status === "Sold") || [];
  const visibleProducts = tab === "Sold" ? sold : active;
  const score = data?.reviews.length ? (data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length).toFixed(1) : null;
  const joinedDate = data ? new Date(data.seller.joinedAt) : null;
  const joined = joinedDate ? String(joinedDate.getMonth() + 1).padStart(2, "0") + "/" + joinedDate.getFullYear() : "";
  const counts = { Active: active.length, Sold: sold.length, Reviews: data?.reviews.length || 0 };

  return <div className="site-shell"><Navbar /><main className="figma-screen seller-profile">
    <header className="seller-page-intro">
      <nav className="figma-breadcrumb" aria-label="Đường dẫn"><Link href="/explore">Khám phá</Link><span>/</span><span>Hồ sơ người bán</span></nav>
      <h1>Hồ sơ người bán</h1>
    </header>
    {loading ? <CardSkeletons count={3} /> : error ? <EmptyState title="Không tải được hồ sơ" action="Thử lại" onAction={() => void load()}>{error}</EmptyState> : data && <>
      <section className="seller-profile-header" aria-label="Thông tin người bán">
        <div className="seller-profile-top">
          <div className="seller-information">
            <div className="seller-identity">
              <span className="seller-avatar" aria-hidden="true">{data.seller.fullName.charAt(0).toUpperCase()}</span>
              <div className="seller-identity-text">
                <h2>{data.seller.fullName}</h2>
                <p className="seller-university"><SellerProfileIcon name="school" />{data.seller.university}</p>
                {data.seller.verified && <p className="seller-verified"><SellerProfileIcon name="verified" />Đã xác minh sinh viên</p>}
              </div>
            </div>
            <p className="seller-description">Xem món đồ và đánh giá giao dịch của người bán trên SangTay.</p>
          </div>
          <div className="seller-contact">
            <img className="seller-community-illustration" src="/figma/27-62675-imgCommunityIllustration.png" alt="Túi vải xanh và sách bên cửa sổ" width={280} height={118} />
            {active[0] ? <Link href={"/messages?listingId=" + active[0].id} className="figma-button primary seller-message"><SellerProfileIcon name="message" />Nhắn tin người bán</Link> : <p className="seller-no-listings">Người bán chưa có món đồ đang bán để liên hệ.</p>}
          </div>
        </div>
        <div className="seller-facts">
          <div><strong>{score ? score.replace(".", ",") + "/5" : "—"}</strong><small>{data.reviews.length} đánh giá</small></div>
          <div><strong>{active.length} món</strong><small>Đang bán</small></div>
          <div><strong>{joined}</strong><small>Tham gia</small></div>
        </div>
      </section>
      <div className="seller-content-layout">
        <aside className="seller-trust">
          <div className="seller-desktop-rating"><RatingSummary reviews={data.reviews} score={score} /><button className="seller-rating-link" onClick={() => setTab("Reviews")} aria-label="Xem đánh giá từ cộng đồng" /></div>
          <section className="seller-safety"><SellerProfileIcon name="safety" /><h3>Trao đồ, giữ sự an tâm</h3><p>Hẹn ở nơi công cộng và kiểm tra món đồ trực tiếp trước khi thanh toán.</p></section>
        </aside>
        <div className="seller-listings-and-reviews">
          <div className="seller-tabs" role="tablist" aria-label="Hồ sơ người bán">{tabs.map((t, index) => <button key={t.id} id={"seller-tab-" + t.id} role="tab" aria-selected={tab === t.id} aria-controls="seller-tab-panel" tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)} onKeyDown={event => navigateTabs(event, index)}>{t.name} ({counts[t.id]})</button>)}</div>
          <section id="seller-tab-panel" className="seller-tab-panel" role="tabpanel" aria-labelledby={"seller-tab-" + tab} tabIndex={0}>
            <header className="seller-section-heading"><h2>{tab === "Reviews" ? "Đánh giá từ cộng đồng" : tab === "Sold" ? "Đã tìm được chủ mới" : "Món đồ của " + data.seller.fullName}</h2><p>{tab === "Reviews" ? "Nhận xét từ những lần trao đồ." : tab === "Sold" ? "Những món đồ đã được người bán đánh dấu hoàn tất." : "Nhắn tin cho người bán để kiểm tra tình trạng còn hàng."}</p></header>
            {tab === "Reviews" ? <>
              <div className="seller-mobile-rating"><RatingSummary reviews={data.reviews} score={score} /></div>
              {data.reviews.length ? <div className="seller-review-list">{data.reviews.map(r => <article key={r.id} className="seller-review">
                <div className="seller-reviewer"><span className="seller-review-avatar" aria-hidden="true">{r.reviewerName.charAt(0).toUpperCase()}</span><div><h3>{r.reviewerName}</h3><time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</time></div></div>
                <span className="seller-stars" aria-label={r.rating + " trên 5 sao"}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                <p>{r.content}</p><small>Món đồ: {r.listingTitle}</small>
              </article>)}</div> : <EmptyState title="Chưa có đánh giá">Đánh giá sẽ xuất hiện sau khi người mua và người bán hoàn tất giao dịch.</EmptyState>}
            </> : visibleProducts.length ? <div className="seller-product-grid">{visibleProducts.map(item => <MarketplaceCard key={item.id} item={item} variant="seller" saved={saved.includes(item.id)} onSave={save} />)}</div> : <EmptyState title={tab === "Sold" ? "Chưa có món đồ đã bán" : "Chưa có tin đang bán"}>Ghé lại sau để xem tin đăng mới.</EmptyState>}
          </section>
        </div>
      </div>
    </>}
  </main><Footer />{notice && <div className="figma-toast" role="status">{notice}</div>}</div>;
}
