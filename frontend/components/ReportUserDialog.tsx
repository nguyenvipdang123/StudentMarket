"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { reportReasons } from "@/lib/reporting";
import styles from "./ReportUserDialog.module.css";

export default function ReportUserDialog({
  contextType,
  contextId,
  targetLabel,
  onClose,
  onSubmitted,
}: {
  contextType: "LISTING" | "CONVERSATION";
  contextId: string;
  targetLabel: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const titleId = useId();
  const reasonRef = useRef<HTMLSelectElement>(null);
  const [reason, setReason] = useState<keyof typeof reportReasons>("SCAM");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    reasonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, busy]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextType, contextId, reason, description: description.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không gửi được báo cáo.");
      onSubmitted();
    } catch (cause) {
      setError((cause instanceof Error ? cause.message : "") || "Không gửi được báo cáo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.head}>
          <div>
            <span>BÁO CÁO VI PHẠM</span>
            <h2 id={titleId}>Báo cáo {targetLabel}</h2>
          </div>
          <button type="button" aria-label="Đóng báo cáo" onClick={onClose} disabled={busy}>×</button>
        </div>
        <p className={styles.hint}>Hãy mô tả sự việc cụ thể. Admin sẽ kiểm tra tin đăng hoặc cuộc trò chuyện liên quan trước khi quyết định.</p>
        <form onSubmit={submit}>
          <label htmlFor={`${titleId}-reason`}>Lý do báo cáo</label>
          <select id={`${titleId}-reason`} ref={reasonRef} value={reason} onChange={event => setReason(event.target.value as keyof typeof reportReasons)}>
            {Object.entries(reportReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label htmlFor={`${titleId}-description`}>Mô tả chi tiết</label>
          <textarea id={`${titleId}-description`} value={description} onChange={event => setDescription(event.target.value)} minLength={20} maxLength={2000} required rows={5} placeholder="Ví dụ: Người bán yêu cầu chuyển cọc trước, sau đó không giao hàng..." />
          <small>{description.trim().length}/2000 ký tự · Tối thiểu 20 ký tự</small>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="button" onClick={onClose} disabled={busy}>Hủy</button>
            <button type="submit" disabled={busy || description.trim().length < 20}>{busy ? "Đang gửi..." : "Gửi báo cáo"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
