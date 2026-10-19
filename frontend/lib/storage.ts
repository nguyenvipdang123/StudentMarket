export function formatPrice(price: number) { return price === 0 ? "Trao đổi" : new Intl.NumberFormat("vi-VN").format(price) + "đ"; }
