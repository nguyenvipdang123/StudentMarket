"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { reportReasons, reportStatuses } from "@/lib/reporting";

type ReportStatus = keyof typeof reportStatuses;
type ReportItem = {
  id: string;
  reporterName: string;
  reporterEmail: string;
  reportedName: string;
  reportedEmail: string;
  reportedStatus: string | null;
  contextType: "LISTING" | "CONVERSATION";
  contextId: string;
  contextTitle: string;
  reason: keyof typeof reportReasons;
  description: string;
  status: ReportStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
type ReportDetail = ReportItem & {
  evidence: { id: string; senderName: string; content: string; sentAt: string }[];
};

export default function AdminReportsPanel({
  refreshSignal,
  onOpenChat,
  onReviewed,
}: {
  refreshSignal: number;
  onOpenChat: (conversationId: string) => void;
  onReviewed: () => void;
}) {
  const [filter, setFilter] = useState<ReportStatus | "ALL">("PENDING");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [listRefresh, setListRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ status: filter, q: search, page: String(page) });
        const response = await fetch(`/api/admin/reports?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Không tải được báo cáo.");
        setReports(data.reports);
        setTotal(data.total);
      } catch (cause) {
        if (!controller.signal.aborted) setError((cause instanceof Error ? cause.message : "") || "Không tải được báo cáo.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [filter, search, page, refreshSignal, listRefresh]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const load = async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const response = await fetch(`/api/admin/reports/${selectedId}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Không tải được chi tiết báo cáo.");
        setDetail(data.report);
        setNote(data.report.reviewNote || "");
      } catch (cause) {
        if (!controller.signal.aborted) setDetailError((cause instanceof Error ? cause.message : "") || "Không tải được chi tiết báo cáo.");
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [selectedId]);

  async function review(action: "APPROVE" | "REJECT") {
    if (!detail || busy) return;
    if (action === "REJECT" && note.trim().length < 10) {
      setDetailError("Cần ghi lý do từ chối ít nhất 10 ký tự.");
      return;
    }
    const prompt = action === "APPROVE"
      ? `Duyệt báo cáo và khóa tài khoản ${detail.reportedName}? Người này sẽ bị đăng xuất và các tin đang bán sẽ được ẩn.`
      : `Từ chối báo cáo về ${detail.reportedName}?`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setDetailError("");
    try {
      const response = await fetch(`/api/admin/reports/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không xử lý được báo cáo.");
      setDetail(current => current ? {
        ...current,
        status: data.status,
        reviewNote: note.trim() || null,
        reviewedAt: new Date().toISOString(),
        reportedStatus: action === "APPROVE" ? "locked" : current.reportedStatus,
      } : null);
      setListRefresh(value => value + 1);
      onReviewed();
    } catch (cause) {
      setDetailError((cause instanceof Error ? cause.message : "") || "Không xử lý được báo cáo.");
    } finally {
      setBusy(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const pages = Math.max(1, Math.ceil(total / 25));
  return (
    <section className="admin-panel admin-reports-panel">
      <div className="admin-panel-head">
        <div><h2>Báo cáo người mua / người bán</h2><p>Kiểm tra bằng chứng trước khi duyệt, khóa tài khoản và ẩn tin đang bán; hoặc từ chối báo cáo.</p></div>
        <form className="admin-report-search" onSubmit={submitSearch}>
          <input type="search" aria-label="Tìm báo cáo" maxLength={100} placeholder="Tên, email, tin đăng..." value={searchInput} onChange={event => setSearchInput(event.target.value)} />
          <button type="submit">Tìm</button>
        </form>
      </div>
      <div className="admin-filters">
        {(["PENDING", "ALL", "APPROVED", "REJECTED"] as const).map(status => (
          <button key={status} type="button" className={filter === status ? "active" : ""} onClick={() => { setFilter(status); setPage(1); }}>
            {status === "ALL" ? "Tất cả" : reportStatuses[status]}
          </button>
        ))}
      </div>
      {error && <p className="admin-chat-error" role="alert">{error}</p>}
      {loading ? <p className="admin-empty">Đang tải báo cáo...</p> : reports.length === 0 ? (
        <p className="admin-empty">Chưa có báo cáo phù hợp.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Người bị báo cáo</th><th>Người báo cáo</th><th>Lý do · ngữ cảnh</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>{reports.map(report => (
              <tr key={report.id}>
                <td><strong>{report.reportedName}</strong><small>{report.reportedEmail}</small></td>
                <td><strong>{report.reporterName}</strong><small>{report.reporterEmail}</small></td>
                <td><strong>{reportReasons[report.reason]}</strong><small>{report.contextTitle} · {new Date(report.createdAt).toLocaleString("vi-VN")}</small></td>
                <td><span className={`admin-report-status ${report.status.toLowerCase()}`}>{reportStatuses[report.status]}</span></td>
                <td><div className="admin-actions"><button type="button" onClick={() => { setDetail(null); setSelectedId(report.id); }}>Xem chi tiết</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="admin-chat-pagination">
        <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Trước</button>
        <span>{total} báo cáo · Trang {page}/{pages}</span>
        <button type="button" disabled={page >= pages || loading} onClick={() => setPage(value => value + 1)}>Sau</button>
      </div>

      {selectedId && (
        <div className="admin-report-detail">
          <div className="admin-report-detail-head">
            <h3>Chi tiết báo cáo</h3>
            <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }}>Đóng</button>
          </div>
          {detailLoading ? <p>Đang tải chi tiết...</p> : detail && (
            <>
              <div className="admin-report-facts">
                <div><span>Người bị báo cáo</span><strong>{detail.reportedName}</strong><small>{detail.reportedEmail} · {detail.reportedStatus === "locked" ? "Đã khóa" : "Chưa khóa"}</small></div>
                <div><span>Người báo cáo</span><strong>{detail.reporterName}</strong><small>{detail.reporterEmail}</small></div>
                <div><span>Lý do</span><strong>{reportReasons[detail.reason]}</strong><small>{new Date(detail.createdAt).toLocaleString("vi-VN")}</small></div>
                <div><span>Liên quan</span><strong>{detail.contextTitle}</strong><small>{detail.contextType === "LISTING" ? "Tin đăng" : "Đoạn chat"}</small></div>
              </div>
              <div className="admin-report-description"><strong>Mô tả từ người báo cáo</strong><p>{detail.description}</p></div>
              {detail.contextType === "LISTING" ? (
                <Link className="admin-report-context-link" href={`/listing/${detail.contextId}`} target="_blank">Xem tin đăng liên quan ↗</Link>
              ) : (
                <>
                  <button type="button" className="admin-report-context-link" onClick={() => onOpenChat(detail.contextId)}>Xem toàn bộ đoạn chat ↗</button>
                  <div className="admin-report-evidence">
                    <strong>50 tin nhắn gần nhất</strong>
                    {detail.evidence.length === 0 ? <p>Đoạn chat chưa có tin nhắn hoặc đã không còn tồn tại.</p> : detail.evidence.map(message => (
                      <div key={message.id}><span>{message.senderName} · {new Date(message.sentAt).toLocaleString("vi-VN")}</span><p>{message.content}</p></div>
                    ))}
                  </div>
                </>
              )}
              {detail.status === "PENDING" ? (
                <div className="admin-report-review">
                  <label htmlFor="admin-report-note">Ghi chú xử lý {"(bắt buộc khi từ chối)"}</label>
                  <textarea id="admin-report-note" value={note} maxLength={1000} rows={3} onChange={event => setNote(event.target.value)} placeholder="Nêu căn cứ quyết định, hoặc lý do từ chối báo cáo..." />
                  <div>
                    <button type="button" disabled={busy} className="reject" onClick={() => void review("REJECT")}>Từ chối báo cáo</button>
                    <button type="button" disabled={busy} className="approve" onClick={() => void review("APPROVE")}>{busy ? "Đang xử lý..." : "Duyệt và khóa tài khoản"}</button>
                  </div>
                </div>
              ) : <p className="admin-report-reviewed">{reportStatuses[detail.status]}{detail.reviewNote ? ` · Ghi chú: ${detail.reviewNote}` : ""}</p>}
            </>
          )}
          {detailError && <p className="admin-chat-error" role="alert">{detailError}</p>}
        </div>
      )}
    </section>
  );
}
