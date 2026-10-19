"use client";
import { useEffect, useState } from "react";
import type { Listing } from "./types";

export type ProductPagination = { page: number; pageSize: number; total: number; totalPages: number; hasPrevious: boolean; hasNext: boolean };
type SearchResult = { key: string; products: Listing[]; pagination: ProductPagination; error: string };
const empty: ProductPagination = { page: 1, pageSize: 12, total: 0, totalPages: 0, hasPrevious: false, hasNext: false };

/** Request only one page, debounce edits and discard responses from old filters. */
export function useProductSearch(parameters: string | null) {
  const [revision, setRevision] = useState(0);
  const key = parameters === null ? "disabled" : parameters + "#" + revision;
  const [result, setResult] = useState<SearchResult | null>(null);
  useEffect(() => {
    if (parameters === null) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/products?" + parameters, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Không tải được tin đăng. Vui lòng thử lại.");
        if (active) setResult({ key, products: data.products, pagination: data.pagination, error: "" });
      } catch (error) {
        if (active && !controller.signal.aborted) setResult({ key, products: [], pagination: empty, error: error instanceof Error ? error.message : "Không tải được tin đăng. Vui lòng thử lại." });
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [parameters, key]);
  const current = result?.key === key ? result : null;
  return { products: current?.products || [], pagination: current?.pagination || empty, loading: parameters !== null && !current, error: current?.error || "", retry: () => setRevision(value => value + 1) };
}
