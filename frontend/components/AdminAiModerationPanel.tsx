"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import FigmaIcon from "./FigmaIcon";
import "@/app/admin/ai-moderation.css";

type Result = { id: string; title: string; decision: string; reason: string; confidence?: number | null; imagesChecked?: number };
type Worker = { enabled: boolean; online: boolean; lastError: string; lastScanAt: string | null };
type Status = { configured: boolean; schemaReady: boolean; model: string; threshold: number; results: Result[]; worker: Worker | null };
export default function AdminAiModerationPanel({ visible, onRefresh }: { visible: boolean; onRefresh: () => Promise<void> }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const running = useRef(false);
  const ready = Boolean(status?.configured && status.schemaReady);
  const enabled = Boolean(status?.worker?.enabled);
  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/admin/moderation/ai", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Chưa tải được trạng thái AI.");
    setStatus(data);
  }, []);
  useEffect(() => {
    const refresh = () => { void loadStatus().catch(e => setError(e instanceof Error ? e.message : "Chưa kết nối được AI.")); };
    void Promise.resolve().then(refresh);
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [loadStatus]);
  useEffect(() => { if (visible) void onRefresh(); }, [status?.worker?.lastScanAt, visible, onRefresh]);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/moderation/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(45000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chưa quét được hàng chờ.");
      setMessage(data.results.length ? `Đã tự duyệt ${data.approved} tin; ${data.review} tin cần Admin kiểm tra.` : "Không có tin mới cần AI phân tích.");
      await Promise.all([loadStatus(), onRefresh()]);
    } catch (e) { setError(e instanceof Error ? e.message : "AI chưa phản hồi. Tin vẫn ở hàng chờ."); }
    finally { running.current = false; setBusy(false); }
  }, [loadStatus, onRefresh]);
  async function toggleEnabled() {
    setToggling(true); setError("");
    try {
      const response = await fetch("/api/admin/moderation/ai", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !enabled }), signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không đổi được trạng thái worker.");
      setStatus(current => current ? { ...current, worker: data.worker } : current);
      setMessage(data.worker.enabled ? "Đã bật tự duyệt ở server. Worker sẽ quét cả khi đóng trang Admin." : "Đã tắt tự duyệt ở server.");
    } catch (e) { setError(e instanceof Error ? e.message : "Không đổi được trạng thái worker."); }
    finally { setToggling(false); }
  }

  if (!visible) return null;
  return <section className="admin-ai-panel" aria-label="AI tự duyệt tin đăng">
    <div className="admin-ai-head"><div className="admin-ai-title"><span className="admin-ai-icon"><FigmaIcon name="sparkles" size={22} /></span><div><h2>AI tự duyệt tin đăng</h2><p>Gemini kiểm tra nội dung và ảnh. Tin đủ điều kiện được duyệt; tin nghi ngờ giữ chờ Admin.</p></div></div><span className={enabled ? "admin-ai-state running" : "admin-ai-state"}>{enabled ? "Tự duyệt đang bật" : "Tự duyệt đang tắt"}</span></div>
    <div className="admin-ai-controls"><button type="button" className="admin-ai-toggle" aria-pressed={enabled} disabled={toggling || !status?.schemaReady || (!enabled && !ready)} onClick={() => void toggleEnabled()}>{toggling ? "Đang lưu…" : enabled ? "Tắt AI tự duyệt" : "Bật AI tự duyệt"}</button><button type="button" disabled={!ready || busy} onClick={() => void run()}>{busy ? "AI đang kiểm tra…" : "Quét & duyệt tin hợp lệ"}</button><button type="button" disabled={busy} onClick={() => { void loadStatus().then(() => setError("")).catch(() => setError("Chưa tải được trạng thái AI.")); }}>Kiểm tra kết nối</button></div>
    <p className="admin-ai-hint">Worker quét tối đa 2 tin mỗi lượt, nghỉ 20 giây giữa các lượt; không cần giữ trang Admin mở. Trạng thái bật/tắt được lưu ở server.</p>
    {status?.schemaReady && <p className="admin-ai-hint">{status.worker?.online ? "Worker đang kết nối." : "Worker chưa kết nối. Chạy npm run worker:ai hoặc npm run dev trên server."}{status.worker?.lastScanAt && ` Quét gần nhất: ${new Date(status.worker.lastScanAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })}.`}</p>}
    {status?.worker?.lastError && <p className="admin-ai-error" role="alert">{status.worker.lastError}</p>}
    {status && !ready && <p className="admin-ai-notice">{!status.configured ? "Cần cấu hình Gemini API key ở server." : "Cần khởi tạo bảng kiểm duyệt AI để sử dụng."}</p>}
    {error && <p className="admin-ai-error" role="alert">{error}</p>}
    {message && <p className="admin-ai-message" role="status">{message}</p>}
    <details className="admin-ai-results"><summary>Kết quả AI gần đây ({status?.results.length || 0})</summary>{status?.results.length ? <ul>{status.results.map(result => <li key={result.id}><div><strong>{result.title}</strong><span className={result.decision === "APPROVED" ? "approved" : "review"}>{result.decision === "APPROVED" ? "AI đã duyệt" : result.decision === "PROCESSING" ? "Đang phân tích" : "Cần Admin kiểm tra"}</span></div><p>{result.reason || "AI đang phân tích tin."}</p>{result.confidence != null && <small>Mức tự tin do AI đánh giá: {Math.round(result.confidence * 100)}% · Đã kiểm tra {result.imagesChecked} ảnh</small>}</li>)}</ul> : <p>Chưa có kết quả kiểm duyệt AI.</p>}</details>
  </section>;
}
