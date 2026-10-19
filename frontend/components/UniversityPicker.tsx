"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { universityMatchesQuery, SOUTHERN_UNIVERSITIES } from "@/lib/universities";

type Props = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onDismiss: () => void;
};

export default function UniversityPicker({ open, value, onChange, onApply, onDismiss }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => SOUTHERN_UNIVERSITIES.filter(university => universityMatchesQuery(university, query)), [query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="region-dialog"
      aria-labelledby="region-dialog-title"
      onCancel={event => { event.preventDefault(); onDismiss(); }}
      onClick={event => { if (event.target === dialogRef.current) onDismiss(); }}
    >
      <div className="region-dialog-content">
        <button className="region-dialog-close" type="button" onClick={onDismiss} aria-label="Đóng chọn trường">×</button>
        <span className="region-dialog-kicker">🎓 TÌM ĐỒ CÙNG TRƯỜNG</span>
        <h2 id="region-dialog-title">Bạn muốn tìm ở trường nào?</h2>
        <p>Chọn trường đại học tại TP.HCM và Đông Nam Bộ để xem tin của sinh viên trường đó. Bạn có thể đổi trường bất cứ lúc nào.</p>
        <label className="region-search-label" htmlFor="region-search">Tìm trường đại học</label>
        <input
          id="region-search"
          className="region-search-input"
          type="search"
          placeholder="Nhập tên trường hoặc viết tắt: UEH, UIT, HUTECH..."
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <div className="region-options" role="group" aria-label="Chọn trường đại học">
          {!query && (
            <button type="button" className={`region-option ${!value ? "active" : ""}`} aria-pressed={!value} onClick={() => onChange("")}>
              Tất cả trường
            </button>
          )}
          {matches.map(university => (
            <button key={university.name} type="button" className={`region-option ${value === university.name ? "active" : ""}`} aria-pressed={value === university.name} onClick={() => onChange(university.name)}>
              <span>{university.name}</span><span className="university-code">{university.code}</span>
            </button>
          ))}
          {matches.length === 0 && <span className="region-no-results">Không tìm thấy trường trong danh sách. Thử tên đầy đủ hoặc tên viết tắt.</span>}
        </div>
        <button className="region-apply" type="button" onClick={onApply}>
          {value ? `Xem tin của ${value}` : "Xem tin tất cả trường"} <span aria-hidden="true">→</span>
        </button>
        <small>Danh sách lựa chọn không bao gồm các trường ở Tây Nam Bộ.</small>
      </div>
    </dialog>
  );
}
