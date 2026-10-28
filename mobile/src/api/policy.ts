// This module stays platform-independent so session parsing and URL rules can be tested.
export function apiOrigin(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error("API URL phải chỉ gồm giao thức và tên miền.");
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname)
    )
  )
    throw Error("API cần dùng HTTPS.");
  return url.origin;
}
export function sessionCookie(header: string | null) {
  const match = header?.match(
    /(?:^|[,;]\s*)sangtay_session=([A-Za-z0-9_-]{32,256})(?:;|,|$)/,
  );
  return match ? `sangtay_session=${match[1]}` : null;
}
export function mediaUrl(path: string, origin: string) {
  if (!path || path.startsWith("//")) return undefined;
  try {
    const url = new URL(path, origin);
    return url.protocol === "https:" || url.origin === origin
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function priceLabel(
  price: number,
  description = "",
  freeGift?: boolean,
) {
  return price === 0
    ? (freeGift ?? description.startsWith("Tặng miễn phí."))
      ? "Tặng miễn phí"
      : "Trao đổi"
    : `${new Intl.NumberFormat("vi-VN").format(price)}đ`;
}
export function validateDraft(draft: {
  title: string;
  description: string;
  price: string;
  location: string;
  kind: string;
}) {
  if (draft.title.trim().length < 3 || draft.title.trim().length > 200)
    return "Tên món đồ cần từ 3 đến 200 ký tự.";
  if (
    draft.description.trim().length < 10 ||
    draft.description.length +
      (draft.kind === "Gift" ? "Tặng miễn phí. ".length : 0) >
      10000
  )
    return "Mô tả cần từ 10 đến 10.000 ký tự.";
  if (
    draft.kind === "Sell" &&
    (!/^\d+$/.test(draft.price) ||
      Number(draft.price) <= 0 ||
      Number(draft.price) > 9999999999)
  )
    return "Nhập giá bán lớn hơn 0 và tối đa 9.999.999.999đ.";
  if (draft.location.trim().length < 2 || draft.location.length > 200)
    return "Nhập khu vực hẹn gặp từ 2 đến 200 ký tự.";
  return "";
}
