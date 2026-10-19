"use client";
import type { ProductPagination as Pagination } from "@/lib/use-product-search";

export default function ProductPagination({ pagination, onPage }: { pagination: Pagination; onPage: (page: number) => void }) {
  const { page, pageSize, total, totalPages, hasPrevious, hasNext } = pagination;
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(value => value > 0 && value <= totalPages).sort((a, b) => a - b);
  return <div className="listing-page-controls">
    <p role="status" aria-live="polite">Hiển thị <strong>{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)}</strong> / {total} món đồ</p>
    {totalPages > 1 && <nav aria-label="Phân trang sản phẩm">
      <button type="button" disabled={!hasPrevious} onClick={() => onPage(page - 1)} aria-controls="listing-results">← Trước</button>
      {pages.map((value, index) => <span key={value} className="listing-page-item">
        {index > 0 && value - pages[index - 1] > 1 && <span className="listing-page-gap" aria-hidden="true">…</span>}
        <button type="button" aria-current={value === page ? "page" : undefined} aria-label={`Trang ${value}`} aria-controls="listing-results" onClick={() => onPage(value)}>{value}</button>
      </span>)}
      <button type="button" disabled={!hasNext} onClick={() => onPage(page + 1)} aria-controls="listing-results">Sau →</button>
    </nav>}
  </div>;
}
