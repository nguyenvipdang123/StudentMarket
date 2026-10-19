import { normalizeSearch } from "./listing-search.ts";
import { SOUTHERN_UNIVERSITIES } from "./universities.ts";
import { parseListingQuery, type ListingQueryError } from "./listing-query.ts";

export type AssistantSearch = { q: string; category: string; sort: string; kind: string; condition: string; school: string; minPrice: string; maxPrice: string; page: number };
export type ProductContext = { search: AssistantSearch; minimumPrice: number | null };
export type ProductIntent = { type: "search"; search: AssistantSearch; more: boolean } | { type: "clarify"; text: string } | null;
const moneyPattern = "[0-9]+(?:[.,][0-9]+)*(?:\\s*(?:trieu|nghin|ngan|dong|vnd|tr|k|m|d)\\b)?";
function amount(value: string, fallbackUnit = "") {
  const match = value.trim().match(/^([\d.,]+)\s*(trieu|nghin|ngan|dong|vnd|tr|k|m|d)?$/);
  if (!match) return NaN;
  const raw = match[1], unit = match[2] || fallbackUnit;
  const numeric = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw) ? Number(raw.replace(/[.,]/g, "")) : Number(raw.replace(",", "."));
  return Math.round(numeric * (/^(trieu|tr|m)$/.test(unit) ? 1000000 : /^(nghin|ngan|k)$/.test(unit) ? 1000 : 1));
}
const universityAliases = SOUTHERN_UNIVERSITIES.flatMap(university => [...new Set([university.name, university.code, ...university.aliases].flatMap(name => {
  const normalized = normalizeSearch(name).replace(/[^a-z0-9]+/g, " ").trim();
  return [normalized, normalized.replace(/^dh /, "dai hoc "), normalized.replace(/^dh /, "truong dai hoc ")].flatMap(value => [value, value.replace(/\btp hcm\b/g, "tphcm"), value.replace(/\btp hcm\b/g, "thanh pho ho chi minh")]);
}))].map(alias => ({ alias, name: university.name }))).sort((a, b) => b.alias.length - a.alias.length);
const itemWords = /\b(laptop|macbook|may tinh|dien thoai|iphone|samsung|ipad|tablet|sach|giao trinh|ban hoc|ban go|ghe|den ban|tai nghe|balo|ba lo|xe dap|xe dien|tu lanh|may giat|quat|quan ao|giay|dep|may anh|man hinh|ban phim|chuot|casio|dell|asus|acer|lenovo|hp|do hoc tap|noi that|do cong nghe|do phong tro)\b/;

/** A fast, bounded interpreter; it never asks a model to invent SQL or product facts. */
export function productIntent(message: string, previous?: ProductContext, preferredSchool = ""): ProductIntent {
  let text = normalizeSearch(message).replace(/[?!;]+/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(cach|lam sao|huong dan|dang tin|ban do|toi muon ban|minh muon ban|dang ky|dang nhap|mat khau|thanh toan|sepay|bao cao|kiem duyet|phi dang)\b/.test(text)
    || /^(?:(?:toi|minh|em) )?(?:(?:muon|can) )?dang ban\b/.test(text)
    || /^(?:co the (?:trao doi do|tang do)(?: khong)?|tim (?:san pham|do) o dau)$/.test(text)) return null;
  const more = /^(?:cho (?:toi|minh) )?(?:xem them|tim them|them san pham|con (?:mon|mau|san pham) nao khac|mon khac|mau khac)(?: (?:khong|nhe|voi))?$/.test(text);
  const cheaper = /^(?:co (?:mon|mau) )?(?:re hon|gia thap hon|re nhat)(?: (?:khong|nhe|voi))?$/.test(text);
  const criteriaOnly = /^(?:o |tai |gan |truong |duoi |toi da |khong qua |tren |tu |khoang |tam |gia |chi |nhu moi|moi 100|moi nhat|moi dang|da qua su dung|tat ca truong|khong gioi han truong)/.test(text);
  if (more || cheaper) {
    if (!previous) return { type: "clarify", text: "Bạn muốn tìm món đồ nào? Ví dụ: “Tìm laptop dưới 5 triệu ở DNTU”." };
    if (more) return { type: "search", search: { ...previous.search, page: previous.search.page + 1 }, more: true };
    if (previous.minimumPrice === 0) return { type: "clarify", text: "Kết quả trước đã có món giá 0đ. Bạn có thể hỏi “Xem thêm” để xem các tin khác hoặc đổi món đồ cần tìm." };
    const max = previous.minimumPrice === null ? previous.search.maxPrice : String(Math.max(0, previous.minimumPrice - 1));
    return { type: "search", search: { ...previous.search, sort: "price-asc", maxPrice: max, page: 1 }, more: false };
  }
  const direct = /\b(tim|mua|can|goi y|de xuat|san pham|mon do|tin dang|co gi|moi dang|moi nhat|mien phi|trao doi)\b/.test(text) || itemWords.test(text);
  if (!direct && !(previous && criteriaOnly)) return null;
  const continuing = Boolean(previous && criteriaOnly);
  const search: AssistantSearch = continuing ? { ...previous!.search, page: 1 } : { q: "", category: "Tất cả", sort: "featured", kind: "all", condition: "", school: preferredSchool, minPrice: "", maxPrice: "", page: 1 };
  const clarify = (text: string): ProductIntent => ({ type: "clarify", text });
  if (/\b(tat ca truong|khong gioi han truong)\b/.test(text)) {
    search.school = ""; text = text.replace(/\b(tat ca truong|khong gioi han truong)\b/g, " ");
  } else {
    const pattern = (alias: string) => new RegExp("\\b" + alias.split(" ").join("[^a-z0-9]+") + "\\b");
    const university = universityAliases.find(item => pattern(item.alias).test(text));
    if (university) {
      search.school = university.name;
      // Remove only the name span so decimal/grouping punctuation in money stays intact.
      text = text.replace(pattern(university.alias), " ").trim();
    }
  }
  let priceChanged = false;
  const touchPrice = () => { if (!priceChanged && continuing) { search.minPrice = ""; search.maxPrice = ""; } priceChanged = true; };
  if (/\b(?:duoi|toi da|tren|tu|khoang|tam)\s*-\d/.test(text)) return clarify("Ngân sách phải là số không âm. Ví dụ: “dưới 500k”.");
  text = text.replace(new RegExp("\\b(?:tu|khoang)\\s+(" + moneyPattern + ")\\s*(?:den|toi|-)\\s*(" + moneyPattern + ")", "g"), (_, lower: string, upper: string) => {
    const inferred = upper.match(/(trieu|nghin|ngan|dong|vnd|tr|k|m|d)$/)?.[1];
    touchPrice(); search.minPrice = String(amount(lower, inferred)); search.maxPrice = String(amount(upper)); return " ";
  });
  text = text.replace(new RegExp("\\b(duoi|toi da|khong qua|khong hon|tren|it nhat|tu|khoang|tam)\\s+(" + moneyPattern + ")", "g"), (_, comparator: string, value: string) => {
    const price = amount(value); touchPrice();
    if (["duoi", "toi da", "khong qua", "khong hon"].includes(comparator)) search.maxPrice = String(price - (comparator === "duoi" ? 1 : 0));
    else if (["tren", "it nhat", "tu"].includes(comparator)) search.minPrice = String(price + (comparator === "tren" ? 1 : 0));
    else { search.minPrice = String(Math.floor(price * .8)); search.maxPrice = String(Math.ceil(price * 1.2)); }
    return " ";
  });
  if (/\b(re nhat|gia re|gia thap|gia tang dan)\b/.test(text)) { search.sort = "price-asc"; text = text.replace(/\b(re nhat|gia re|gia thap(?: den cao)?|gia tang dan)\b/g, " "); }
  if (/\b(dat nhat|gia cao|gia giam dan)\b/.test(text)) { search.sort = "price-desc"; text = text.replace(/\b(dat nhat|gia cao(?: den thap)?|gia giam dan)\b/g, " "); }
  if (/\b(moi dang|moi nhat)\b/.test(text)) { search.sort = "newest"; text = text.replace(/\b(moi dang|moi nhat)\b/g, " "); }
  if (/\b(mien phi|trao doi|tang do)\b/.test(text)) { search.kind = "exchange"; text = text.replace(/\b(mien phi|trao doi|tang do)\b/g, " "); }
  for (const [phrase, condition] of [["nhu moi", "Như mới"], ["moi 100%?", "Mới 100%"], ["da qua su dung", "Đã qua sử dụng"], ["tinh trang tot", "Tốt"]]) {
    const pattern = new RegExp("\\b" + phrase, "g");
    if (pattern.test(text)) { search.condition = condition; text = text.replace(pattern, " "); break; }
  }
  for (const [phrase, category] of [["do hoc tap", "Học tập"], ["do cong nghe", "Công nghệ"], ["do phong tro|noi that", "Nội thất"], ["do thoi trang", "Thời trang"]]) {
    const pattern = new RegExp("\\b(?:" + phrase + ")\\b", "g");
    if (pattern.test(text)) { search.category = category; text = text.replace(pattern, " "); break; }
  }
  text = text.replace(/\bmay tinh xach tay\b/g, "laptop").replace(/\bheadphones?\b/g, "tai nghe");
  text = text.replace(/^(?:hien tai|hien)\s+/, "");
  let old;
  do {
    old = text;
    text = text.replace(/^(?:(?:ban|toi|minh|em)\s+)?(?:(?:dang|muon)\s+)?(?:tim|mua|can|goi y|de xuat|xem|co|con|muon)\b\s*/g, "")
      .replace(/^(?:giup|cho)\s+(?:toi|minh|em)\s*/g, "");
  } while (text !== old);
  text = text.replace(/\b(?:giup toi|giup minh|cho toi|cho minh|cho sinh vien|de hoc tap|de hoc|do cu|dang ban|san pham|mon do|tin dang|ngan sach|khoang gia|tat ca|cac|mot|chiec|cuon|quyen|cai|o|tai|gan|truong|gia|chi)\b/g, " ")
    .replace(/(?:\b(?:co khong|duoc khong|khong|nao|gi|nhe|voi|a)\s*)+$/g, " ").replace(/[^a-z0-9%_\\]+/g, " ").replace(/\s+/g, " ").trim();
  if (/^(?:do|hang|mon)$/.test(text)) text = "";
  if (!continuing || text) search.q = text;
  if (priceChanged && /\d+\s*(trieu|nghin|ngan|k|tr)\b/.test(text)) return clarify("Bạn hãy ghi một khoảng giá rõ hơn, ví dụ “từ 1 đến 2 triệu” hoặc “dưới 500k”.");
  try { assistantSearchFilters(search); }
  catch (error) {
    return clarify((error as ListingQueryError).message || "Bạn hãy nhập tên món đồ và khoảng giá ngắn gọn hơn nhé.");
  }
  return { type: "search", search, more: false };
}
export function assistantSearchParameters(search: AssistantSearch) {
  return new URLSearchParams({ q: search.q, category: search.category, sort: search.sort, kind: search.kind, condition: search.condition, school: search.school, minPrice: search.minPrice, maxPrice: search.maxPrice });
}
export function assistantSearchFilters(search: AssistantSearch) {
  const params = assistantSearchParameters(search); params.set("page", String(search.page)); params.set("pageSize", "4");
  return parseListingQuery(params);
}
