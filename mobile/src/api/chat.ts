export type Conversation = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  listingStatus: string;
  buyerId: string;
  buyerName: string | null;
  buyerSchool: string | null;
  sellerId: string;
  sellerName: string | null;
  sellerSchool: string | null;
  lastMessage?: string;
  updatedAt?: string;
  unreadCount?: number;
};
export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
  isRead: boolean;
  readAt?: string | null;
};
export type ChatHistory = {
  conversation: Conversation;
  messages: ChatMessage[];
  pgUserId: string;
};
export type ChatInbox = { conversations: Conversation[]; pgUserId: string };
export const validChatId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function chatPeer(conversation: Conversation, actorId: string) {
  if (conversation.buyerId === actorId)
    return { name: conversation.sellerName || "Người bán", school: conversation.sellerSchool || "", buying: true };
  if (conversation.sellerId === actorId)
    return { name: conversation.buyerName || "Người mua", school: conversation.buyerSchool || "", buying: false };
  return null;
}
export function chatMessageBody(content: string) {
  const text = content.trim();
  if (!text || text.length > 5000) throw Error("Nhập tin nhắn từ 1 đến 5.000 ký tự.");
  // The server determines sender and participant identity from the native session.
  return { content: text };
}
export function chatImagePath(content: string, conversationId: string) {
  if (!validChatId(conversationId) || !content.startsWith("[Ảnh] ")) return null;
  const path = content.slice(6).trim();
  const prefix = `/api/conversations/${conversationId}/attachments/`;
  if (!path.startsWith(prefix)) return null;
  return /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(path.slice(prefix.length)) ? path : null;
}
export const chatPreview = (text = "") => text.startsWith("[Ảnh] ") ? "Ảnh đính kèm" : text;
export function mergeChatMessages(previous: ChatMessage[], incoming: ChatMessage[], conversationId: string) {
  const messages = new Map<string, ChatMessage>();
  for (const item of [...previous, ...incoming]) {
    if (item.conversationId !== conversationId) continue;
    const old = messages.get(item.id);
    messages.set(item.id, { ...item, isRead: Boolean(old?.isRead || item.isRead), readAt: item.readAt || old?.readAt || null });
  }
  return [...messages.values()].sort((a, b) => (Date.parse(a.sentAt) || 0) - (Date.parse(b.sentAt) || 0) || a.id.localeCompare(b.id));
}
type ChatRequest = <T>(path: string, options?: RequestInit) => Promise<T>;
export function createChatApi(send: ChatRequest) {
  const path = (id: string) => {
    if (!validChatId(id)) throw Error("Cuộc trò chuyện không hợp lệ.");
    return `/api/conversations/${id}/messages`;
  };
  const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return {
    inbox: () => send<ChatInbox>("/api/conversations"),
    history: (id: string) => send<ChatHistory>(path(id)),
    contact: (listingId: string) => {
      if (!validChatId(listingId)) throw Error("Món đồ không hợp lệ.");
      return send<{ id: string }>("/api/conversations", json({ listingId }));
    },
    send: (id: string, content: string) => send<{ message: ChatMessage }>(path(id), json(chatMessageBody(content))),
  };
}
