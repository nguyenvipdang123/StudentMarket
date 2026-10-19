"use client";

import { useMemo, useState } from "react";
import FigmaIcon, { type FigmaIconName } from "@/components/FigmaIcon";
import { dashboardMoney as formatPrice, listingTrend } from "@/lib/admin-dashboard";

export type DashboardSource = "accounts" | "listings" | "revenue" | "audit" | "reports";
export type DashboardSources = Record<DashboardSource, "loading" | "ready" | "error">;
export type AdminTab = "OVERVIEW" | "MODERATION" | "REVENUE" | "PACKAGES" | "STAFF" | "AUDIT" | "ACCOUNTS" | "CHATS" | "REPORTS";

type OverviewProps = {
  listings: { id: string; title: string; sellerName: string; sellerSchool: string; moderationStatus: string; createdAt: string }[];
  counts: { total: number; pendingReview: number; pendingEmail: number; verified: number; locked: number };
  moderation: { all: number; pending: number; approved: number; rejected: number };
  revenue: { monthRevenue: number; todayRevenue: number; paidOrdersCount: number; activePromotionsCount: number } | null;
  reports: number;
  logs: { id: string; actorName: string; description: string; createdAt: string }[];
  sources: DashboardSources;
  onNavigate: (tab: AdminTab) => void;
};

function Metric({ label, value, caption, icon, tone = "green", ready }: {
  label: string; value: string; caption: string; icon: FigmaIconName; tone?: string; ready: boolean;
}) {
  return <article className={`dashboard-metric ${tone}`}>
    <div className="dashboard-metric-top"><span>{label}</span><span className="dashboard-metric-icon"><FigmaIcon name={icon} size={20} /></span></div>
    <strong>{ready ? value : "—"}</strong>
    <p>{ready ? caption : "Đang tải hoặc chưa lấy được dữ liệu"}</p>
  </article>;
}

export default function AdminOverview({ listings, counts, moderation, revenue, reports, logs, sources, onNavigate }: OverviewProps) {
  const [days, setDays] = useState<7 | 30>(7);
  const trend = useMemo(() => listingTrend(listings, days), [listings, days]);
  const recentCount = trend.reduce((sum, point) => sum + point.count, 0);
  const max = Math.max(2, Math.ceil(Math.max(0, ...trend.map(point => point.count)) / 2) * 2);
  const coordinates = trend.map((point, index) => ({ x: 44 + index * 512 / (trend.length - 1), y: 178 - point.count / max * 140 }));
  const line = coordinates.map(point => `${point.x},${point.y}`).join(" ");
  const pending = listings.filter(item => item.moderationStatus === "PENDING").slice(0, 4);
  const ready = (source: DashboardSource) => sources[source] === "ready";
  const sourceMessage = (source: DashboardSource) => sources[source] === "error" ? "Chưa lấy được dữ liệu. Nhấn Làm mới để thử lại." : "Đang tải dữ liệu…";
  const approvedEnd = moderation.all ? moderation.approved / moderation.all * 100 : 0;
  const pendingEnd = moderation.all ? (moderation.approved + moderation.pending) / moderation.all * 100 : 0;
  const queue = [
    { label: "Tin đăng chờ kiểm duyệt", detail: "Kiểm tra nội dung trước khi công khai", count: moderation.pending, source: "listings" as const, tab: "MODERATION" as const, icon: "shield" as const },
    { label: "Tài khoản chờ duyệt", detail: "Xác minh hồ sơ và ảnh thẻ sinh viên", count: counts.pendingReview, source: "accounts" as const, tab: "ACCOUNTS" as const, icon: "graduation" as const },
    { label: "Báo cáo chờ xử lý", detail: "Xem bằng chứng và phản hồi vi phạm", count: reports, source: "reports" as const, tab: "REPORTS" as const, icon: "alert" as const },
  ];

  return <div className="dashboard-overview">
    <div className="dashboard-metrics">
      <Metric label="Tổng sinh viên" value={counts.total.toLocaleString("vi-VN")} caption={`${counts.verified} tài khoản đã xác minh`} icon="graduation" ready={ready("accounts")} />
      <Metric label="Tin đăng trên sàn" value={moderation.all.toLocaleString("vi-VN")} caption={`${moderation.approved} đã được duyệt công khai`} icon="grid" tone="blue" ready={ready("listings")} />
      <Metric label="Doanh thu tháng này" value={formatPrice(revenue?.monthRevenue ?? 0)} caption={`Hôm nay: ${formatPrice(revenue?.todayRevenue ?? 0)}`} icon="money" tone="orange" ready={ready("revenue")} />
      <Metric label="Tin đang được đẩy" value={(revenue?.activePromotionsCount ?? 0).toLocaleString("vi-VN")} caption={`${revenue?.paidOrdersCount ?? 0} đơn đẩy tin đã thanh toán`} icon="arrowUp" ready={ready("revenue")} />
    </div>

    <div className="dashboard-chart-grid">
      <section className="dashboard-card dashboard-trend">
        <div className="dashboard-card-head"><div><h2>Hoạt động tin đăng</h2><p>Tin mới theo ngày · giờ Việt Nam</p></div>
          <div className="dashboard-period" aria-label="Khoảng thời gian biểu đồ">{([7, 30] as const).map(period => <button key={period} type="button" aria-pressed={days === period} onClick={() => setDays(period)}>{period} ngày</button>)}</div>
        </div>
        {ready("listings") ? <>
          <div className="dashboard-chart-summary"><strong>{recentCount.toLocaleString("vi-VN")}</strong><span>tin mới trong {days} ngày qua</span><span className="dashboard-chart-key"><i /> Tin đăng</span></div>
          <svg className="dashboard-chart" viewBox="0 0 590 220" role="img" aria-label={`${recentCount} tin đăng mới trong ${days} ngày qua`}>
            <defs><linearGradient id="admin-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#287b5c" stopOpacity=".2" /><stop offset="100%" stopColor="#287b5c" stopOpacity="0" /></linearGradient></defs>
            {[0, 1, 2].map(index => { const value = Math.ceil(max * index / 2); const y = 178 - value / max * 140; return <g key={index}><line x1="44" y1={y} x2="556" y2={y} stroke="#e7ece9" strokeDasharray="4 5" /><text x="30" y={y + 4} textAnchor="end">{value}</text></g>; })}
            <polygon points={`44,178 ${line} 556,178`} fill="url(#admin-trend-fill)" />
            <polyline points={line} fill="none" stroke="#287b5c" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {trend.map((point, index) => <g key={point.day}><circle cx={coordinates[index].x} cy={coordinates[index].y} r={days === 7 ? 4 : 2} fill="#287b5c"><title>{`${point.label}: ${point.count} tin mới`}</title></circle>{(days === 7 || index === 0 || index === 29 || index % 7 === 0) && <text x={coordinates[index].x} y="205" textAnchor="middle">{point.label}</text>}</g>)}
          </svg>
          <details className="dashboard-chart-data"><summary>Xem số liệu theo ngày</summary><div>{trend.map(point => <span key={point.day}>{point.label}: <strong>{point.count} tin</strong></span>)}</div></details>
          {recentCount === 0 && <p className="dashboard-chart-note">Chưa có tin đăng mới trong khoảng thời gian này.</p>}
        </> : <p className="dashboard-empty">{sourceMessage("listings")}</p>}
      </section>

      <section className="dashboard-card dashboard-distribution">
        <div className="dashboard-card-head"><div><h2>Tình trạng tin đăng</h2><p>Toàn bộ tin trên hệ thống</p></div><FigmaIcon name="grid" size={20} /></div>
        {ready("listings") ? <>
          <div className="dashboard-donut" role="img" aria-label={`${moderation.approved} tin đã duyệt, ${moderation.pending} chờ duyệt, ${moderation.rejected} từ chối`} style={{ background: moderation.all ? `conic-gradient(#378562 0% ${approvedEnd}%, #d7ad64 ${approvedEnd}% ${pendingEnd}%, #bc776c ${pendingEnd}% 100%)` : "#e8efe4" }}><div><strong>{moderation.all.toLocaleString("vi-VN")}</strong><span>tin đăng</span></div></div>
          <div className="dashboard-legend">{[{ label: "Đã duyệt", value: moderation.approved, color: "#378562" }, { label: "Chờ duyệt", value: moderation.pending, color: "#d7ad64" }, { label: "Từ chối", value: moderation.rejected, color: "#bc776c" }].map(item => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.value.toLocaleString("vi-VN")}</strong></div>)}</div>
        </> : <p className="dashboard-empty">{sourceMessage("listings")}</p>}
      </section>
    </div>

    <div className="dashboard-lower-grid">
      <section className="dashboard-card dashboard-queue">
        <div className="dashboard-card-head"><div><h2>Cần bạn xử lý</h2><p>Ưu tiên những việc đang chờ</p></div><span className="dashboard-soft-badge">Hàng đợi</span></div>
        {queue.map(item => <button className="dashboard-queue-item" type="button" key={item.tab} onClick={() => onNavigate(item.tab)}><span className="dashboard-queue-icon"><FigmaIcon name={item.icon} size={21} /></span><span><strong>{item.label}</strong><small>{item.detail}</small></span><b>{ready(item.source) ? item.count : "—"}</b><FigmaIcon name="arrow" size={18} /></button>)}
      </section>
      <section className="dashboard-card dashboard-activity">
        <div className="dashboard-card-head"><div><h2>Hoạt động gần đây</h2><p>Lịch sử thao tác quản trị</p></div><button className="dashboard-text-button" type="button" onClick={() => onNavigate("AUDIT")}>Xem tất cả <FigmaIcon name="arrow" size={15} /></button></div>
        {!ready("audit") ? <p className="dashboard-empty">{sourceMessage("audit")}</p> : logs.length === 0 ? <p className="dashboard-empty">Chưa có thao tác quản trị được ghi nhận.</p> : <ol className="dashboard-activity-list">{logs.slice(0, 4).map(log => <li key={log.id}><span className="dashboard-activity-dot" /><div><strong>{log.actorName || "Quản trị viên"}</strong><p>{log.description}</p><time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time></div></li>)}</ol>}
      </section>
    </div>

    <section className="dashboard-card dashboard-recent">
      <div className="dashboard-card-head"><div><h2>Tin đăng chờ duyệt</h2><p>Xem nhanh nội dung mới trước khi kiểm duyệt</p></div><button className="dashboard-text-button" type="button" onClick={() => onNavigate("MODERATION")}>Đi đến kiểm duyệt <FigmaIcon name="arrow" size={15} /></button></div>
      {!ready("listings") ? <p className="dashboard-empty">{sourceMessage("listings")}</p> : pending.length === 0 ? <div className="dashboard-clear-queue"><span><FigmaIcon name="check" size={22} /></span><div><strong>Hàng đợi đã được xử lý</strong><p>Hiện không có tin đăng chờ kiểm duyệt.</p></div></div> : <>
        <div className="admin-table-wrap dashboard-pending-table"><table className="admin-table"><thead><tr><th>Tin đăng</th><th>Người đăng</th><th>Ngày đăng</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{pending.map(item => <tr key={item.id}><td><strong>{item.title}</strong></td><td><strong>{item.sellerName || "Sinh viên"}</strong><small>{item.sellerSchool}</small></td><td>{new Date(item.createdAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Bangkok" })}</td><td><span className="admin-status pending_review">Chờ duyệt</span></td><td><button className="dashboard-text-button" type="button" onClick={() => onNavigate("MODERATION")}>Kiểm duyệt <FigmaIcon name="arrowUp" size={15} /></button></td></tr>)}</tbody></table></div>
        <ul className="dashboard-pending-cards">{pending.map(item => <li key={item.id}><div className="dashboard-pending-card-head"><span className="admin-status pending_review">Chờ duyệt</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Bangkok" })}</time></div><h3>{item.title}</h3><p>{item.sellerName || "Sinh viên"}<span>{item.sellerSchool}</span></p><button className="dashboard-text-button" type="button" onClick={() => onNavigate("MODERATION")}>Đi đến kiểm duyệt <FigmaIcon name="arrowUp" size={16} /></button></li>)}</ul>
      </>}
    </section>
  </div>;
}
