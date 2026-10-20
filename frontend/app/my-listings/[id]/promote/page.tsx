"use client";
/* eslint-disable @next/next/no-img-element */
import { use, useEffect, useRef, useState } from "react";
import Link from "@/components/TransitionLink";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FigmaIcon from "@/components/FigmaIcon";
import { formatPrice } from "@/lib/storage";
import type { Listing } from "@/lib/types";
import type { PaymentOrder } from "@/lib/sepay-payments";
import "./payment.css";

type Package = { id: number; name: string; description: string; durationHours: number; price: number };
type CopyField = "account" | "amount" | "content" | "order";
const statusLabels: Record<string, string> = { PENDING: "Chờ thanh toán", PAID: "Đã thanh toán", REVIEW: "Đang đối soát", EXPIRED: "Đã hết hạn", FAILED: "Không thành công", REFUNDED: "Đã hoàn tiền", CANCELLED: "Đã hủy" };
function CopyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>;
}
export default function PromoteListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [listing, setListing] = useState<Listing | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<{ id: number; field: CopyField; message: string; success: boolean } | null>(null);
  const copySequence = useRef(0);
  const cancelDialog = useRef<HTMLDialogElement>(null);
  const orderVersion = useRef(0);
  const orderMutationInFlight = useRef(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const auth = await fetch("/api/auth/me", { cache: "no-store" }).then(r => r.json());
        if (!auth.user) throw new Error("Vui lòng đăng nhập để mua gói đẩy tin.");
        const response = await fetch(`/api/products/${id}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (data.product.sellerId !== auth.user.pgUserId) throw new Error("Bạn không phải chủ tin.");
        const [catalog, pending, payment] = await Promise.all([
          fetch("/api/promotions/packages", { cache: "no-store" }).then(r => r.json()),
          fetch(`/api/listings/${id}/promotions`, { cache: "no-store" }).then(r => r.json()),
          fetch("/api/payments/sepay/status", { cache: "no-store" }).then(r => r.json()),
        ]);
        if (!cancelled) { setListing(data.product); setPackages(catalog.packages || []); setOrder(pending.order || null); setConfigured(Boolean(payment.configured)); setNow(Date.now()); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Không tải được thông tin."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [id]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!copyFeedback) return;
    const timer = window.setTimeout(() => setCopyFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);
  const orderId = order?.id, orderStatus = order?.status, expiresAt = order?.expiresAt;
  useEffect(() => {
    if (orderStatus && !["PENDING", "EXPIRED"].includes(orderStatus)) cancelDialog.current?.close();
  }, [orderStatus]);
  useEffect(() => {
    if (!orderId || !["PENDING", "EXPIRED", "REVIEW"].includes(orderStatus || "") || !configured) return;
    let cancelled = false, inFlight = false;
    const deadline = new Date(expiresAt || 0).getTime() + 600000;
    const timer = window.setInterval(async () => {
      if (document.hidden || inFlight || orderMutationInFlight.current || (orderStatus !== "REVIEW" && Date.now() > deadline)) return;
      inFlight = true;
      const version = orderVersion.current;
      try {
        const response = await fetch(`/api/promotion-orders/${orderId}`, { cache: "no-store" });
        const data = await response.json();
        if (response.ok && !cancelled && version === orderVersion.current) { setOrder(data.order); setError(""); }
        else if (!cancelled && version === orderVersion.current) setError(data.error || "Chưa kiểm tra được thanh toán.");
      } catch { if (!cancelled && version === orderVersion.current) setError("Kết nối tạm gián đoạn. Bạn có thể kiểm tra lại, không cần chuyển tiền lần nữa."); }
      finally { inFlight = false; }
    }, 4000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [orderId, orderStatus, expiresAt, configured]);
  async function checkPayment() {
    if (!order || busy) return; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/promotion-orders/${order.id}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Chưa kiểm tra được thanh toán.");
      setOrder(data.order); setNotice(data.order.status === "PAID" ? "Đã xác nhận thanh toán và kích hoạt gói." : "Đã kiểm tra trạng thái mới nhất. Nếu đã chuyển tiền, vui lòng chờ xác nhận từ ngân hàng.");
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa kiểm tra được thanh toán."); }
    finally { setBusy(false); }
  }
  async function buy(pkg: Package) {
    if (busy) return; setBusy(true); setError(""); setNotice("");
    orderMutationInFlight.current = true;
    orderVersion.current++;
    try {
      const response = await fetch(`/api/listings/${id}/promotions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: pkg.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Không tạo được đơn.");
      setOrder(data.order);
      if (data.order.packageId !== pkg.id) setNotice("Bạn đã có đơn chờ. Hãy hoàn tất hoặc chờ đơn này hết hạn trước khi đổi gói.");
    } catch (e) { setError(e instanceof Error ? e.message : "Không tạo được đơn thanh toán."); }
    finally { setBusy(false); orderMutationInFlight.current = false; }
  }
  async function cancelPayment() {
    if (!order || busy) return;
    setBusy(true); setCancelling(true); setCancelError(""); setError(""); setNotice("");
    const version = ++orderVersion.current;
    orderMutationInFlight.current = true;
    try {
      const response = await fetch(`/api/promotion-orders/${order.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chưa hủy được đơn thanh toán.");
      setOrder(data.order); setNotice(data.message); cancelDialog.current?.close();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Chưa hủy được đơn thanh toán.";
      setCancelError(message); setError(message);
      // Refresh after a competing webhook or a lost response instead of assuming cancellation succeeded.
      try {
        const response = await fetch(`/api/promotion-orders/${order.id}`, { cache: "no-store" });
        const data = await response.json();
        if (response.ok && version === orderVersion.current) setOrder(data.order);
      } catch { /* Keep the confirmation and error visible so the customer can retry safely. */ }
    } finally { setBusy(false); setCancelling(false); orderMutationInFlight.current = false; }
  }
  async function copy(text: string, field: CopyField, label: string) {
    const sequence = ++copySequence.current;
    try {
      await navigator.clipboard.writeText(text);
      if (sequence === copySequence.current) setCopyFeedback({ id: sequence, field, message: `Đã sao chép ${label}`, success: true });
    } catch {
      if (sequence === copySequence.current) setCopyFeedback({ id: sequence, field, message: "Chưa sao chép được. Bạn có thể chọn và sao chép thông tin trực tiếp.", success: false });
    }
  }
  function copyButton(text: string, field: CopyField, label: string) {
    const copied = copyFeedback?.success && copyFeedback.field === field;
    return <button type="button" className={`sepay-copy-button${copied ? " copied" : ""}`} aria-label={`Sao chép ${label}`} onClick={() => void copy(text, field, label)}>{copied ? <FigmaIcon name="check" size={16} /> : <CopyIcon />}<span>{copied ? "Đã sao chép" : "Sao chép"}</span></button>;
  }
  const left = order?.expiresAt ? Math.max(0, Math.ceil((new Date(order.expiresAt).getTime() - now) / 1000)) : 0;
  const state = order?.status === "PENDING" && !left ? "EXPIRED" : order?.status;
  const selectable = !order || ["EXPIRED", "FAILED", "REFUNDED", "CANCELLED"].includes(state || "");
  const step = !order || selectable ? 1 : state === "PAID" ? 3 : 2;
  return <div className="site-shell"><Navbar />
  <dialog ref={cancelDialog} className="sepay-cancel-dialog" aria-labelledby="sepay-cancel-title" onCancel={e => { if (cancelling) e.preventDefault(); }}>
    <form onSubmit={e => { e.preventDefault(); void cancelPayment(); }}>
      <span className="sepay-cancel-dialog-icon"><FigmaIcon name="close" size={24} /></span><h2 id="sepay-cancel-title">Hủy đơn thanh toán này?</h2>
      <p>Mã đơn <strong>{order?.transactionCode}</strong></p><p>Chỉ hủy khi bạn <strong>chưa chuyển tiền</strong>. Mã QR của đơn sẽ ngừng hiển thị và bạn có thể chọn gói khác.</p>
      <p className="sepay-cancel-dialog-note">Nếu đã chuyển khoản, hãy giữ đơn để chờ xác nhận hoặc liên hệ Admin đối soát.</p>
      {cancelError && <p className="sepay-cancel-error" role="alert">{cancelError}</p>}
      <div><button type="button" autoFocus disabled={busy} onClick={() => cancelDialog.current?.close()}>Tiếp tục thanh toán</button><button type="submit" className="sepay-cancel-confirm" disabled={busy}>{cancelling ? "Đang hủy…" : "Tôi chưa chuyển tiền, hủy đơn"}</button></div>
    </form>
  </dialog><main className="container sepay-page">
    <Link className="sepay-back" href="/my-listings"><FigmaIcon name="back" size={16} />Quay lại tin của tôi</Link>
    <header className="sepay-page-heading"><div><span className="sepay-eyebrow"><FigmaIcon name="sparkles" size={16} />SANGTAY · ĐẨY TIN</span><h1>Thêm nổi bật, thêm cơ hội.</h1><p>Chọn gói phù hợp để món đồ của bạn đến gần người cần.</p></div><span className="sepay-method-label"><FigmaIcon name="money" size={18} />Chuyển khoản qua SePay</span></header>
    <ol className="sepay-steps" aria-label="Tiến trình mua gói">{["Chọn gói dịch vụ", "Thanh toán", "Kích hoạt gói"].map((label, index) => <li key={label} className={index + 1 < step ? "done" : index + 1 === step ? "current" : ""} aria-current={index + 1 === step ? "step" : undefined}><span>{index + 1 < step ? <FigmaIcon name="check" size={15} /> : `0${index + 1}`}</span>{label}</li>)}</ol>
    {loading ? <p className="sepay-loading" role="status">Đang tải thông tin thanh toán…</p> : <>
      {error && <p className="sepay-message error" role="alert">{error}</p>}
      {notice && <p className="sepay-message" role="status">{notice}</p>}
      {listing && <div className="sepay-listing"><img src={listing.image || "/sample/khac.svg"} width={60} height={60} alt="" /><div className="sepay-listing-copy"><small>Tin đăng của bạn</small><strong>{listing.title}</strong><span>{listing.school}</span></div><div className="sepay-listing-price"><small>Giá sản phẩm</small><strong>{formatPrice(listing.price)}</strong></div><Link href={`/listing/${listing.id}`} aria-label={`Xem tin ${listing.title}`}><FigmaIcon name="arrowUp" size={20} /></Link></div>}
      {!configured && <p className="sepay-message" role="status">Thanh toán đang được cấu hình. Bạn vẫn có thể đăng tin miễn phí; vui lòng quay lại sau.</p>}
      {order && <section className="sepay-checkout" aria-label="Đơn thanh toán">
        <div className="sepay-order-meta"><span>Mã đơn <code>{order.transactionCode}</code>{copyButton(order.transactionCode, "order", "mã đơn")}</span><span className={`sepay-status-badge ${(state || "").toLowerCase()}`}><i />{statusLabels[state || ""] || state}</span></div>
        <div className="sepay-checkout-head"><div className="sepay-package-summary"><span className="sepay-package-icon"><FigmaIcon name="gift" size={26} /></span><div><small>GÓI DỊCH VỤ ĐẨY TIN</small><h2>{order.packageName}</h2><span><FigmaIcon name="calendar" size={15} />{order.durationHours} giờ hiển thị ưu tiên</span></div></div><div className="sepay-total"><small>Tổng thanh toán</small><strong>{formatPrice(order.amount)}</strong><span>Thanh toán một lần</span></div></div>
        {state === "PAID" ? <div className="sepay-complete" role="status"><span><FigmaIcon name="check" size={32} /></span><h2>Thanh toán thành công!</h2><p>Gói đẩy tin đã được kích hoạt.<br />Món đồ của bạn đã sẵn sàng để được chú ý hơn.</p><Link className="figma-button primary" href="/my-listings">Xem tin của tôi<FigmaIcon name="arrowWhite" size={18} /></Link>{!listing?.promotion && <button className="figma-button" onClick={() => setOrder(null)}>Chọn gói mới</button>}</div> : state === "REVIEW" ? <div className="sepay-message sepay-review-message" role="status"><FigmaIcon name="alert" size={24} /><div><h3>Giao dịch đang được đối soát</h3><p>{order.reviewReason}</p><p>Vui lòng giữ biên lai và liên hệ Admin kèm mã đơn {order.transactionCode}. Không chuyển tiền thêm cho đơn này.</p></div></div> : <>
          {state === "PENDING" && configured && order.qrUrl && <div className="sepay-payment-grid"><div className="sepay-qr-panel"><h3>Quét mã để thanh toán</h3><p>Mở ứng dụng ngân hàng và quét mã bên dưới</p><div className="sepay-qr"><img src={order.qrUrl} width={280} height={320} alt={`QR chuyển khoản ${order.transactionCode}`} referrerPolicy="no-referrer" /></div><div className={`sepay-countdown${left <= 120 ? " ending" : ""}`}><FigmaIcon name="calendar" size={17} /><span>Hết hạn sau</span><strong role="timer" aria-live="off">{Math.floor(left / 60).toString().padStart(2, "0")}:{(left % 60).toString().padStart(2, "0")}</strong></div><div className="sepay-qr-caption"><FigmaIcon name="money" size={16} />SePay · VietQR</div></div><div className="sepay-transfer-panel">
            <span className="sepay-section-kicker">CHUYỂN KHOẢN NGÂN HÀNG</span><h3>Thông tin thanh toán</h3><p>Bạn cũng có thể sao chép thông tin để chuyển khoản.</p><dl className="sepay-bank-details"><div><dt>Ngân hàng</dt><dd><span className="sepay-bank-name"><span className="sepay-bank-icon"><FigmaIcon name="money" size={19} /></span>{order.bank}</span></dd></div><div><dt>Người nhận</dt><dd>{order.accountName}</dd></div><div><dt>Tài khoản nhận</dt><dd><span className="sepay-transfer-value">{order.accountNumber}</span>{copyButton(order.accountNumber, "account", "số tài khoản")}</dd></div><div className="sepay-amount-row"><dt>Số tiền chuyển</dt><dd><span className="sepay-transfer-value">{formatPrice(order.amount)}</span>{copyButton(String(order.amount), "amount", "số tiền")}</dd></div><div className="sepay-content-row"><dt>Nội dung chuyển khoản</dt><dd><span className="sepay-transfer-value">{order.transferContent}</span>{copyButton(order.transferContent, "content", "nội dung chuyển khoản")}</dd></div></dl>
            <div className="sepay-transfer-note"><FigmaIcon name="alert" size={18} /><p>Chuyển <strong>đúng số tiền</strong> và giữ nguyên <strong>nội dung chuyển khoản</strong> để gói được kích hoạt. Nếu đã chuyển tiền, hãy chờ xác nhận và không chuyển lại lần hai.</p></div>
          </div></div>}
          {state === "EXPIRED" && <p className="sepay-message" role="status">Đơn đã hết thời gian chờ; không chuyển tiền theo QR cũ. Nếu đã chuyển đúng hạn, bấm kiểm tra lại hoặc liên hệ Admin kèm biên lai trước khi tạo đơn mới.</p>}
          {state === "FAILED" && <p className="sepay-message">Đơn không còn nhận thanh toán.</p>}
          {state === "CANCELLED" && <div className="sepay-message sepay-cancelled-message" role="status"><FigmaIcon name="close" size={22} /><div><h3>Đã hủy đơn thanh toán</h3><p>Không chuyển tiền theo mã QR hoặc nội dung của đơn này. Bạn có thể chọn gói bên dưới để tạo đơn mới.</p></div></div>}
        </>}
        {state !== "PAID" && <div className="sepay-checkout-footer"><div><span className="sepay-live-dot" /><p>{state === "REVIEW" ? "Đang chờ Admin đối soát" : state === "PENDING" ? "Đang chờ xác nhận thanh toán" : state === "CANCELLED" ? "Đơn thanh toán đã hủy" : "Kiểm tra trạng thái giao dịch"}<small>{state === "CANCELLED" ? "Bạn có thể chọn gói khác ở bên dưới." : "Trạng thái sẽ cập nhật khi thanh toán được xác nhận."}</small></p></div><div className="sepay-payment-actions">{order.canCancel && ["PENDING", "EXPIRED"].includes(state || "") && <button type="button" className="sepay-cancel-button" disabled={busy} onClick={() => { setCancelError(""); cancelDialog.current?.showModal(); }}><FigmaIcon name="close" size={16} />Hủy thanh toán</button>}<button type="button" className={`figma-button primary sepay-check-button${busy && !cancelling ? " checking" : ""}`} disabled={busy} onClick={() => void checkPayment()}><FigmaIcon name="refresh" size={17} />{busy && !cancelling ? "Đang kiểm tra…" : "Kiểm tra thanh toán"}</button></div></div>}
      </section>}
      {listing && selectable && <section className="sepay-package-grid" aria-label="Chọn gói đẩy tin">{packages.length ? packages.map(pkg => <article key={pkg.id} className="sepay-package"><span className="sepay-package-icon"><FigmaIcon name="gift" size={24} /></span><h2>{pkg.name}</h2><p>{pkg.description}</p><strong>{formatPrice(pkg.price)}</strong><small><FigmaIcon name="calendar" size={16} />{pkg.durationHours} giờ hiển thị ưu tiên</small><button className="figma-button primary" disabled={busy || !configured || Boolean(listing.promotion) || listing.status !== "Active" || listing.moderationStatus !== "APPROVED"} onClick={() => void buy(pkg)}>{busy ? "Đang tạo đơn…" : "Chọn gói này"}<FigmaIcon name="arrowWhite" size={18} /></button></article>) : <p>Chưa có gói đẩy tin được công bố.</p>}</section>}
    </>}
  </main><Footer /><div className="sepay-toast-region" aria-live="polite" aria-atomic="true">{copyFeedback && <div key={copyFeedback.id} className={`sepay-copy-toast${copyFeedback.success ? "" : " error"}`}><span className="sepay-toast-icon"><FigmaIcon name={copyFeedback.success ? "check" : "alert"} size={20} /></span><span>{copyFeedback.message}</span><button type="button" onClick={() => setCopyFeedback(null)} aria-label="Đóng thông báo"><FigmaIcon name="close" size={17} /></button></div>}</div></div>;
}
