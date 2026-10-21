import type { Category } from "./types";
import type { ListingKindFilter, ListingSort } from "./listing-search";

export type ExploreFilters = {
  category: Category; search: string; sort: ListingSort; kind: ListingKindFilter;
  condition: string; school: string; minPrice: string; maxPrice: string; page: number;
};
export const defaultExploreFilters: ExploreFilters = {
  category: "Tất cả", search: "", sort: "featured", kind: "all", condition: "", school: "", minPrice: "", maxPrice: "", page: 1,
};

export function readExploreFilters(params: URLSearchParams, savedSchool = ""): ExploreFilters {
  const choice = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = params.get(key); return values.includes(value as T) ? value as T : fallback;
  };
  const price = (key: string) => {
    const value = params.get(key) || "";
    return /^(?:\d+(?:\.\d{1,2})?)?$/.test(value) && Number(value) <= 9999999999 ? value : "";
  };
  const search = (params.get("q") || "").trim(), school = params.get("school") ?? savedSchool;
  const page = params.get("page") || "1";
  return {
    category: choice("category", ["Tất cả", "Học tập", "Công nghệ", "Nội thất", "Thời trang", "Khác"], "Tất cả"),
    search: search.length <= 200 ? search : "",
    sort: choice("sort", ["featured", "newest", "price-asc", "price-desc"], "featured"),
    kind: choice("kind", ["all", "sell", "exchange"], "all"),
    condition: choice("condition", ["", "Mới 100%", "Như mới", "Tốt", "Đã qua sử dụng"], ""),
    school: school.length <= 200 ? school : "", minPrice: price("minPrice"), maxPrice: price("maxPrice"),
    page: /^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= 100000 ? Number(page) : 1,
  };
}

export function writeExploreFilters(filters: ExploreFilters, existing: URLSearchParams) {
  const params = new URLSearchParams(existing);
  for (const [key, value, fallback] of [
    ["q", filters.search, ""], ["category", filters.category, "Tất cả"], ["sort", filters.sort, "featured"],
    ["kind", filters.kind, "all"], ["condition", filters.condition, ""], ["minPrice", filters.minPrice, ""],
    ["maxPrice", filters.maxPrice, ""], ["page", String(filters.page), "1"],
  ]) { if (value === fallback) params.delete(key); else params.set(key, value); }
  // An explicit empty school keeps shared all-school links independent of local preferences.
  params.set("school", filters.school);
  return params;
}
