import type { Category, Listing } from "./types";
import { schoolMatchesUniversity } from "./universities.ts";

export type ListingSort = "featured" | "newest" | "price-asc" | "price-desc";
export type ListingKindFilter = "all" | "sell" | "exchange";

export type ListingFilters = {
  category: Category;
  search: string;
  sort: ListingSort;
  kind: ListingKindFilter;
  condition: string;
  school: string;
  minPrice: string;
  maxPrice: string;
};

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

function priceBound(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function filterListings(listings: Listing[], filters: ListingFilters): Listing[] {
  const words = normalizeSearch(filters.search).split(/\s+/).filter(Boolean);
  const min = priceBound(filters.minPrice);
  const max = priceBound(filters.maxPrice);
  if (min !== null && max !== null && min > max) return [];

  const filtered = listings.filter(item => {
    if (item.status === "Hidden") return false;
    if (filters.category !== "Tất cả" && item.category !== filters.category) return false;
    if (filters.kind === "exchange" && item.price !== 0) return false;
    if (filters.kind === "sell" && item.price === 0) return false;
    if (filters.condition && item.condition !== filters.condition) return false;
    if (!schoolMatchesUniversity(item.school, filters.school)) return false;
    if (min !== null && item.price < min) return false;
    if (max !== null && item.price > max) return false;

    const haystack = normalizeSearch([
      item.title, item.description, item.category, item.location, item.school, item.seller,
    ].filter(Boolean).join(" "));
    return words.every(word => haystack.includes(word));
  });

  if (filters.sort === "price-asc") return filtered.sort((a, b) => a.price - b.price);
  if (filters.sort === "price-desc") return filtered.sort((a, b) => b.price - a.price);
  if (filters.sort === "newest") {
    return filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }
  return filtered.sort((a, b) => {
    const priority = (b.promotion?.priority || 0) - (a.promotion?.priority || 0);
    return priority || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}
