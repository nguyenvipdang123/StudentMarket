export type AssistantProduct = { id: string; title: string; price: number; image: string; school: string; location: string; condition: string; freeGift: boolean };
export type AssistantAnswer = { text: string; id?: string; products?: AssistantProduct[]; searchUrl?: string; hasMore?: boolean };
type ChatEvent = { error?: string; event?: string; data?: unknown };
function validProduct(value: unknown): value is AssistantProduct {
  if (!value || typeof value !== "object") return false;
  const item = value as AssistantProduct;
  const safeImage = typeof item.image === "string" && item.image.length <= 2048 && (/^https?:\/\//i.test(item.image) || /^\/(?:api\/product-images|sample|figma)\//.test(item.image));
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id) && typeof item.title === "string" && item.title.length <= 200 && Number.isFinite(item.price) && item.price >= 0 && item.price <= 9999999999 && safeImage && typeof item.school === "string" && typeof item.location === "string" && typeof item.condition === "string" && typeof item.freeGift === "boolean";
}
/** Render text as text, and only accept bounded product cards with same-site navigation. */
export function assistantAnswer(event: ChatEvent): AssistantAnswer | null {
  if (event.error || event.event === "error") throw new Error("Trợ lý chưa trả lời được. Bạn vui lòng thử lại sau.");
  if (event.event === "assistant/products" && event.data && typeof event.data === "object") {
    const data = event.data as AssistantAnswer;
    if (typeof data.text !== "string" || !Array.isArray(data.products) || data.products.length > 4 || !data.products.every(validProduct) || typeof data.searchUrl !== "string" || !data.searchUrl.startsWith("/explore?") || /[\r\n]/.test(data.searchUrl)) throw new Error("Kết quả tìm sản phẩm không hợp lệ. Vui lòng thử lại.");
    return { text: data.text, products: data.products, searchUrl: data.searchUrl, hasMore: data.hasMore === true };
  }
  if (event.event === "assistant/partial" && event.data && typeof event.data === "object") {
    const partial = event.data as { text?: unknown; id?: string };
    if (typeof partial.text === "string" && partial.text) return { text: partial.text, id: partial.id };
  }
  if (event.event === "updates" && event.data && typeof event.data === "object") {
    const updates = event.data as Record<string, { messages?: unknown }>;
    const messages = (updates.generateResponse || updates.directAnswer)?.messages;
    if (!Array.isArray(messages)) return null;
    const last = messages.at(-1) as { type?: string; content?: unknown; id?: string } | undefined;
    if (last?.type === "ai" && typeof last.content === "string" && last.content.trim()) return { text: last.content, id: last.id };
  }
  return null;
}
