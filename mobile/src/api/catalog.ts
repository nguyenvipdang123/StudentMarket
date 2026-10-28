import type { Catalog, Product } from "./types.ts";
import { schoolMatchesUniversity } from "../data/universities.ts";
export const catalogSorts = [
  { value: "featured", label: "Nổi bật" },
  { value: "price-asc", label: "Giá tăng dần" },
  { value: "price-desc", label: "Giá giảm dần" },
  { value: "newest", label: "Mới nhất" },
] as const;
export type CatalogSort = typeof catalogSorts[number]["value"];
export type CatalogFilters = {
  search: string; category: string; sort: string; school: string;
  condition?: string; minPrice?: string; maxPrice?: string;
};
export function catalogPriceRange(minPrice = "", maxPrice = "") {
  const parse = (text: string) => text.trim() === "" ? null : /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;
  const min = parse(minPrice), max = parse(maxPrice);
  const invalid = [min, max].some(n => n !== null && (!Number.isSafeInteger(n) || n < 0 || n > 9999999999));
  const error = invalid ? "Giá phải là số nguyên từ 0 đến 9.999.999.999đ (ví dụ: 50000)." :
    min !== null && max !== null && min > max ? "Giá từ không được lớn hơn giá đến." : "";
  return { min, max, error };
}
export function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
}
// Called during render. Store only raw catalogue and user inputs, never these results.
export function selectProducts(items: Product[], filters: CatalogFilters) {
  const range = catalogPriceRange(filters.minPrice, filters.maxPrice);
  if (range.error) return [];
  const words = normalizeText(filters.search.trim()).split(/\s+/).filter(Boolean);
  const result = items.filter(p => {
    const text = normalizeText([p.title, p.description, p.category, p.school, p.location, p.seller].join(" "));
    return (filters.category === "Tất cả" || p.category === filters.category) &&
      (!filters.condition || p.condition === filters.condition) &&
      (range.min === null || p.price >= range.min) && (range.max === null || p.price <= range.max) &&
      schoolMatchesUniversity(p.school, filters.school) && words.every(word => text.includes(word));
  });
  if (filters.sort === "price-asc") result.sort((a, b) => a.price - b.price);
  if (filters.sort === "price-desc") result.sort((a, b) => b.price - a.price);
  if (filters.sort === "newest") result.sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0));
  return result;
}
// Fetch every unfiltered page so client search also covers products beyond page one.
export async function fetchCatalogue(get: (path: string) => Promise<Catalog>) {
  const products = new Map<string, Product>();
  for (let page = 1; page <= 1000; page++) {
    const result = await get(`/api/products?pageSize=48&page=${page}`);
    if (!Array.isArray(result.products) || result.pagination.page !== page) throw Error("Catalogue đã thay đổi. Bạn tải lại nhé.");
    for (const product of result.products) products.set(product.id, product);
    if (!result.pagination.hasNext) return [...products.values()];
    if (!result.products.length) throw Error("Catalogue chưa tải đủ.");
  }
  throw Error("Catalogue quá lớn. Chưa thay thế bản lưu trên thiết bị.");
}
