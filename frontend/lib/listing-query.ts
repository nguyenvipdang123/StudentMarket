import { normalizeSearch } from "./listing-search.ts";
import { findUniversity, normalizeUniversity } from "./universities.ts";

export class ListingQueryError extends Error {}
export const listingPageSize = 12;
const sorts = { featured: "COALESCE(lp.priority_snapshot, pp.priority, 0) DESC, p.created_at DESC, p.id DESC", newest: "p.created_at DESC, p.id DESC", "price-asc": "p.price ASC, p.created_at DESC, p.id DESC", "price-desc": "p.price DESC, p.created_at DESC, p.id DESC" };
const categories = ["Tất cả", "Học tập", "Công nghệ", "Nội thất", "Thời trang", "Khác"];
export function parseListingQuery(params: URLSearchParams) {
  const text = (key: string, fallback = "", max = 200) => {
    const value = (params.get(key) ?? fallback).trim();
    if (value.length > max) throw new ListingQueryError("Bộ lọc quá dài: " + key);
    return value;
  };
  const choice = (key: string, choices: readonly string[], fallback: string) => {
    const value = text(key, fallback); if (!choices.includes(value)) throw new ListingQueryError("Bộ lọc không hợp lệ: " + key); return value;
  };
  const integer = (key: string, fallback: number, max: number) => {
    const raw = text(key, String(fallback)); const number = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isInteger(number) || number < 1 || number > max) throw new ListingQueryError("Phân trang không hợp lệ: " + key);
    return number;
  };
  const price = (key: string) => {
    const raw = text(key); if (!raw) return null;
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || !Number.isFinite(Number(raw)) || Number(raw) > 9999999999) throw new ListingQueryError("Giá lọc không hợp lệ.");
    return Number(raw);
  };
  const minPrice = price("minPrice"), maxPrice = price("maxPrice");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw new ListingQueryError("Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.");
  const search = text("q");
  if (normalizeSearch(search).split(/\s+/).filter(Boolean).length > 20) throw new ListingQueryError("Từ khóa tối đa 20 từ.");
  const exclude = text("exclude");
  if (exclude && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exclude)) throw new ListingQueryError("Mã tin không hợp lệ.");
  return { search, category: choice("category", categories, "Tất cả"), sort: choice("sort", Object.keys(sorts), "featured") as keyof typeof sorts,
    kind: choice("kind", ["all", "sell", "exchange"], "all"), condition: choice("condition", ["", "Mới 100%", "Như mới", "Tốt", "Đã qua sử dụng"], ""),
    school: text("school"), minPrice, maxPrice, exclude, section: choice("section", ["", "near", "study", "dorm", "budget", "exchange", "new"], ""),
    page: integer("page", 1, 100000), pageSize: integer("pageSize", listingPageSize, 48) };
}
export function listingQuery(filters: ReturnType<typeof parseListingQuery>) {
  const values: (string | number | string[])[] = [];
  const bind = (value: string | number | string[]) => { values.push(value); return "$" + values.length; };
  const clauses = ["p.status = 'Active'", "p.moderation_status = 'APPROVED'"];
  if (filters.category !== "Tất cả") clauses.push("cat.name = " + bind(filters.category));
  if (filters.kind === "sell") clauses.push("p.price > 0");
  if (filters.kind === "exchange") clauses.push("p.price = 0");
  if (filters.condition) clauses.push("p.condition = " + bind(filters.condition));
  if (filters.minPrice !== null) clauses.push("p.price >= " + bind(filters.minPrice));
  if (filters.maxPrice !== null) clauses.push("p.price <= " + bind(filters.maxPrice));
  if (filters.exclude) clauses.push("p.id <> " + bind(filters.exclude) + "::uuid");
  if (filters.school) {
    const school = findUniversity(filters.school);
    const names = school ? [school.name, school.code, ...school.aliases] : [filters.school];
    clauses.push("market_university_text(u.university) = ANY(" + bind([...new Set(names.map(normalizeUniversity))]) + "::text[])");
  }
  for (const word of [...new Set(normalizeSearch(filters.search).split(/\s+/).filter(Boolean))]) {
    const pattern = bind("%" + word.replace(/[\\%_]/g, "\\$&") + "%");
    // Separate indexed lookups avoid an OR across joined relations that cannot use their GIN indexes.
    clauses.push(`(p.id IN (SELECT sp.id FROM products sp WHERE sp.status='Active' AND sp.moderation_status='APPROVED'
        AND market_search_text(COALESCE(sp.title,'') || ' ' || COALESCE(sp.description,'') || ' ' || COALESCE(sp.location,'')) LIKE ${pattern})
      OR p.seller_id IN (SELECT su.id FROM users su WHERE market_search_text(COALESCE(su.full_name,'') || ' ' || COALESCE(su.university,'')) LIKE ${pattern})
      OR p.category_id IN (SELECT sc.id FROM categories sc WHERE market_search_text(sc.name) LIKE ${pattern}))`);
  }
  if (filters.section === "study") clauses.push("cat.name IN ('Học tập','Công nghệ')");
  if (filters.section === "dorm") clauses.push("cat.name = 'Nội thất'");
  if (filters.section === "budget") clauses.push("p.price > 0 AND p.price < 200000");
  if (filters.section === "exchange") clauses.push("p.price = 0");
  return { where: " WHERE " + clauses.join(" AND "), values, orderBy: sorts[filters.section === "new" ? "newest" : filters.sort] };
}
