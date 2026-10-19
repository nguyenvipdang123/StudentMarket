"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/storage";
import "./AdminSePayPanel.css";

type PaymentData = { configured: boolean; missingSettings: string[]; authMethod: string; webhookPath: string; reviewCount: number;
  events: { id: string; amount: number; status: string; reason: string; referenceCode: string; orderCode: string | null; listingTitle: string | null;
    sellerName: string | null; packageName: string | null; durationHours: number | null; orderAmount: number | null; canApprove: boolean;
    orderCreatedAt: string | null; expiresAt: string | null; transactionAt: string; receivedAt: string }[] };
const labels: Record<string,string> = { APPLIED: "Đã kích hoạt", REVIEW: "Cần đối soát", IGNORED: "Không áp dụng", RECEIVED: "Đang xử lý" };
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";
export default function AdminSePayPanel({ onApproved }: { onApproved?: () => Promise<void> }) {
  const [data, setData] = useState<PaymentData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/payments/sepay", { cache: "no-store" });
      const value = await response.json(); if (!response.ok) throw new Error(value.error || "Không tải được đối soát SePay.");
      setData(value); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Không tải được đối soát."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function approve(id: string) {
    if (saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/payments/sepay/${id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, confirmed }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Chưa duyệt được gói.");
      setSelected(null); setNote(""); setConfirmed(false);
      setSuccess(value.alreadyApproved ? "Giao dịch đã được duyệt trước đó; gói không bị kích hoạt trùng." : "Đã duyệt và kích hoạt gói cho khách. Doanh thu đã được cập nhật.");
      await load();
      await onApproved?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa duyệt được gói. Hãy làm mới để kiểm tra trạng thái trước khi thử lại."); }
    finally { setSaving(false); }
  }
  return <section className="admin-panel" style={{ marginBottom: 24 }}>
    <div className="admin-panel-head"><div><h2>Thanh toán SePay & duyệt gói</h2><p>{data ? `${data.configured ? "Sẵn sàng nhận thanh toán" : "Chưa hoàn tất cấu hình"} · ${data.reviewCount} giao dịch cần đối soát` : "Đang tải trạng thái…"}</p></div><button type="button" className="admin-refresh" disabled={busy || saving} onClick={() => void load()}>{busy ? "Đang tải…" : "Làm mới"}</button></div>
    {error && <p className="admin-sepay-feedback error" role="alert">{error}</p>}
    {success && <p className="admin-sepay-feedback" role="status">{success}</p>}
    {data && <>
      <div className="admin-sepay-details">
        {!data.configured && <p role="status">Cần kiểm tra cấu hình server: {data.missingSettings.join(", ")}. Xem hướng dẫn SePay trong README.</p>}
        <p>Xác thực: {data.authMethod === "hmac" ? "HMAC-SHA256" : "API Key"}. Webhook: <code>{data.webhookPath}</code></p>
        <p>Với khoản tiền cần đối soát, kiểm tra trên SePay/ngân hàng rồi chọn <strong>Duyệt gói</strong>. Thời hạn gói bắt đầu khi duyệt thành công.</p>
      </div>
      {data.events.length ? <div className="admin-table-wrap"><table className="admin-table admin-sepay-table"><thead><tr><th>Giao dịch</th><th>Khách / Đơn / Gói</th><th>Số tiền</th><th>Kết quả</th><th>Ghi chú</th><th>Thao tác</th></tr></thead><tbody>{data.events.map(event => <Fragment key={event.id}><tr>
        <td>{event.id}<small>Ngân hàng: {dateLabel(event.transactionAt)}</small><small>Nhận: {dateLabel(event.receivedAt)}</small></td>
        <td><strong>{event.sellerName || "—"}</strong><small>{event.orderCode || "Chưa khớp đơn"}</small><small>{event.listingTitle}</small><small>{event.packageName}{event.durationHours ? ` · ${event.durationHours} giờ` : ""}</small></td>
        <td>{formatPrice(event.amount)}{event.orderAmount !== null && event.orderAmount !== event.amount && <small>Đơn yêu cầu: {formatPrice(event.orderAmount)}</small>}</td>
        <td><span className={`admin-sepay-status ${event.status.toLowerCase()}`}>{labels[event.status] || event.status}</span></td>
        <td className="admin-sepay-reason">{event.reason}<small>{event.referenceCode}</small></td>
        <td>{event.canApprove ? <button type="button" className="admin-sepay-approve" disabled={saving} aria-expanded={selected === event.id} onClick={() => { setSelected(event.id); setNote(""); setConfirmed(false); setError(""); setSuccess(""); }}>Duyệt gói</button> : event.status === "REVIEW" ? <small>Chưa đủ điều kiện duyệt: kiểm tra số tiền và trạng thái đơn.</small> : "—"}</td>
      </tr>{selected === event.id && event.canApprove && <tr><td colSpan={6}><form className="admin-sepay-review" onSubmit={e => { e.preventDefault(); void approve(event.id); }}>
        <h3>Duyệt gói cho {event.sellerName}</h3><p><strong>{event.packageName}</strong> · {event.durationHours} giờ · {formatPrice(event.amount)} · Mã đơn {event.orderCode}</p>
        <dl><div><dt>Tạo đơn</dt><dd>{dateLabel(event.orderCreatedAt)}</dd></div><div><dt>Hạn thanh toán</dt><dd>{dateLabel(event.expiresAt)}</dd></div><div><dt>Ngân hàng ghi nhận</dt><dd>{dateLabel(event.transactionAt)}</dd></div></dl>
        <label htmlFor={`sepay-note-${event.id}`}>Ghi chú đối soát</label><textarea id={`sepay-note-${event.id}`} minLength={10} maxLength={1000} required rows={3} value={note} disabled={saving} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Đã kiểm tra khoản tiền và mã đơn trên SePay; giờ máy chủ bị lệch." />
        <label className="admin-sepay-confirm"><input type="checkbox" required checked={confirmed} disabled={saving} onChange={e => setConfirmed(e.target.checked)} />Tôi đã kiểm tra tiền thực nhận, đúng số tiền và mã đơn trên SePay/ngân hàng.</label>
        <div className="admin-sepay-review-actions"><button type="button" disabled={saving} onClick={() => setSelected(null)}>Hủy</button><button type="submit" className="admin-sepay-approve" disabled={saving || !confirmed || note.trim().length < 10}>{saving ? "Đang duyệt…" : "Duyệt và kích hoạt gói"}</button></div>
      </form></td></tr>}</Fragment>)}</tbody></table></div> : <p className="admin-sepay-details">Chưa nhận được giao dịch SePay.</p>}
    </>}
  </section>;
}
