import LoadingIndicator from "@/components/LoadingIndicator";

export default function Loading() {
  return <div className="route-loading" aria-busy="true">
    <div className="route-loading-brand">sangtay<span>.</span></div>
    <div className="route-loading-card">
      <span className="route-loading-symbol" aria-hidden="true">↗</span>
      <h1>Một chút thôi…</h1>
      <p>SangTay đang chuẩn bị nội dung cho bạn.</p>
      <LoadingIndicator label="Đang tải trang" />
      <div className="route-loading-preview" aria-hidden="true"><i /><i /><i /></div>
    </div>
  </div>;
}
