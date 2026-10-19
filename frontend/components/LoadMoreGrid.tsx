"use client";

import { useState, type ReactNode } from "react";
import type { Listing } from "@/lib/types";

const BATCH_SIZE = 12;

export default function LoadMoreGrid({ items, renderItem, initialCount = BATCH_SIZE }: {
  items: Listing[];
  renderItem: (item: Listing, index: number) => ReactNode;
  initialCount?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const shownCount = Math.min(visibleCount, items.length);
  const hasMore = shownCount < items.length;

  return (
    <>
      <div className="product-grid" id="listing-results">
        {items.slice(0, shownCount).map(renderItem)}
      </div>
      <div className="load-more-listings">
        <p role="status" aria-live="polite" aria-atomic="true">
          Đang hiển thị <strong>{shownCount}</strong> / {items.length} món đồ
        </p>
        {hasMore ? (
          <button
            className="load-more-button"
            type="button"
            aria-controls="listing-results"
            aria-label={`Xem thêm ${Math.min(BATCH_SIZE, items.length - shownCount)} món đồ`}
            onClick={() => setVisibleCount(count => Math.min(count + BATCH_SIZE, items.length))}
          >
            Xem thêm <span aria-hidden="true">↓</span>
          </button>
        ) : (
          <span className="load-more-end">Bạn đã xem hết món đồ phù hợp <span aria-hidden="true">✦</span></span>
        )}
      </div>
    </>
  );
}
