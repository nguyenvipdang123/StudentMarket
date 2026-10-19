"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/notifications.css";

type Notice = { id: string; kind: string; title: string; body: string; href: string; createdAt: string; read: boolean };
type Feed = { notifications: Notice[]; unreadCount: number };
const empty: Feed = { notifications: [], unreadCount: 0 };
export default function NotificationBell({ authenticated = true, onLogin, onNavigate }: {
  authenticated?: boolean; onLogin?: () => void; onNavigate?: (href: string) => void;
}) {
  const router = useRouter();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [feed, setFeed] = useState<Feed>(empty);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok) { if (response.status===401) setFeed(empty); throw Error(data.error || "Chưa tải được thông báo."); }
    setFeed(data); setError("");
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    const refresh = () => { if (document.visibilityState!=="hidden") void load().catch(e => setError(e.message)); };
    void Promise.resolve().then(refresh);
    const interval = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [authenticated, load]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key==="Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  async function toggle() {
    if (!authenticated) { onLogin?.(); return; }
    if (open) { setOpen(false); return; }
    setOpen(true); setLoading(true);
    try { await load(); } catch (e) { setError(e instanceof Error ? e.message : "Chưa tải được thông báo."); }
    finally { setLoading(false); }
  }
  async function mark(notice?: Notice) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (!notice?.read) {
        const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notice ? { ids: [notice.id] } : { all: true }), signal: AbortSignal.timeout(10000) });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Chưa đánh dấu được thông báo.");
        setFeed(data);
      }
      if (notice) { setOpen(false); if (onNavigate) onNavigate(notice.href); else router.push(notice.href); }
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa xử lý được thông báo."); }
    finally { setBusy(false); }
  }
  return <div className="notification-bell" ref={root}>
    <button type="button" ref={trigger} className="notification-trigger" title="Thông báo" aria-label={`Thông báo${authenticated && feed.unreadCount ? `, ${feed.unreadCount} chưa đọc` : ""}`} aria-expanded={open} aria-controls={panelId} onClick={() => void toggle()}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      {authenticated && feed.unreadCount>0 && <span className="notification-count" aria-hidden="true">{feed.unreadCount>99 ? "99+" : feed.unreadCount}</span>}
    </button>
    {open && <section id={panelId} className="notification-panel" aria-label="Danh sách thông báo">
      <div className="notification-heading"><div><h2>Thông báo</h2><small>{feed.unreadCount} chưa đọc</small></div><button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }} aria-label="Đóng thông báo">×</button></div>
      <div className="notification-tools"><span>Hoạt động trong 30 ngày gần đây</span><button type="button" disabled={busy || !feed.unreadCount} onClick={() => void mark()}>Đọc tất cả</button></div>
      {error && <p className="notification-error" role="alert">{error} <button type="button" onClick={() => void load().catch(e => setError(e.message))}>Thử lại</button></p>}
      <div className="notification-list" aria-busy={loading}>
        {loading && !feed.notifications.length ? <p className="notification-empty">Đang tải thông báo…</p> : !feed.notifications.length ? <p className="notification-empty">Chưa có thông báo mới.<br/><small>Các cập nhật sẽ xuất hiện ở đây.</small></p> : feed.notifications.map(notice => <button key={notice.id} type="button" disabled={busy} className={`notification-item ${notice.read ? "is-read" : "is-unread"}`} onClick={() => void mark(notice)}>
          <span className="notification-dot" aria-label={notice.read ? "Đã đọc" : "Chưa đọc"}/><span className="notification-text"><strong>{notice.title}</strong><span>{notice.body}</span><time dateTime={notice.createdAt}>{new Date(notice.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time></span><span aria-hidden="true">›</span>
        </button>)}
      </div>
      {feed.notifications.length===50 && <p className="notification-footnote">Hiển thị 50 thông báo gần nhất.</p>}
    </section>}
  </div>;
}
