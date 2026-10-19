"use client";

import { FormEvent, useEffect, useState } from "react";

type ChatSummary = {
  id: string;
  listingTitle: string;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  lastMessage: string;
  messageCount: number;
  lastMessageAt: string;
};

type ChatDetail = {
  id: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
};

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
};

function formatChatTime(value: string) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

export default function AdminChatPanel({ refreshSignal, initialConversationId = null }: { refreshSignal: number; initialConversationId?: string | null }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [conversations, setConversations] = useState<ChatSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId);
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagePage, setMessagePage] = useState(1);
  const [messageTotal, setMessageTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRefresh, setDetailRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setListLoading(true);
      setListError("");
      try {
        const params = new URLSearchParams({ q: search, page: String(page) });
        const response = await fetch(`/api/admin/conversations?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Không tải được danh sách chat.");
        setConversations(data.conversations);
        setTotal(data.total);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setListError((cause instanceof Error ? cause.message : "") || "Không tải được danh sách chat.");
      } finally {
        if (!controller.signal.aborted) setListLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [search, page, refreshSignal]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const load = async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const response = await fetch(`/api/admin/conversations/${selectedId}?page=${messagePage}`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Không tải được nội dung chat.");
        setDetail(data.conversation);
        setMessageTotal(data.total);
        setMessages(current => messagePage === 1 ? data.messages : [...data.messages, ...current]);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setDetailError((cause instanceof Error ? cause.message : "") || "Không tải được nội dung chat.");
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [selectedId, messagePage, detailRefresh]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    setDetail(null);
    setMessages([]);
    setMessagePage(1);
    setDetailRefresh(value => value + 1);
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <section className="admin-panel admin-chat-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Quản lý đoạn chat</h2>
          <p>Xem và tìm kiếm hội thoại giữa người mua và người bán. Việc xem không đổi trạng thái đã đọc của họ.</p>
        </div>
        <span className="admin-chat-total">{total} hội thoại</span>
      </div>

      <div className="admin-chat-layout">
        <div className="admin-chat-list-pane">
          <form className="admin-chat-search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="admin-chat-search">Tìm hội thoại</label>
            <input id="admin-chat-search" type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={100} placeholder="Tên, email hoặc tin đăng..." />
            <button type="submit">Tìm</button>
          </form>
          {listError && <p className="admin-chat-error" role="alert">{listError}</p>}
          {listLoading ? <p className="admin-chat-empty">Đang tải hội thoại...</p> : conversations.length === 0 ? (
            <p className="admin-chat-empty">{search ? "Không có hội thoại khớp với từ khóa." : "Chưa có hội thoại nào."}</p>
          ) : (
            <ul className="admin-chat-list">
              {conversations.map(conversation => (
                <li key={conversation.id}>
                  <button type="button" className={selectedId === conversation.id ? "selected" : ""} onClick={() => selectConversation(conversation.id)}>
                    <span className="admin-chat-list-title">{conversation.listingTitle}</span>
                    <span className="admin-chat-list-people">{conversation.buyerName} ↔ {conversation.sellerName}</span>
                    <span className="admin-chat-list-preview">{conversation.lastMessage}</span>
                    <span className="admin-chat-list-meta">{conversation.messageCount} tin nhắn · {formatChatTime(conversation.lastMessageAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="admin-chat-pagination">
            <button type="button" disabled={page <= 1 || listLoading} onClick={() => setPage(value => value - 1)}>Trước</button>
            <span>Trang {page}/{totalPages}</span>
            <button type="button" disabled={page >= totalPages || listLoading} onClick={() => setPage(value => value + 1)}>Sau</button>
          </div>
        </div>

        <div className="admin-chat-detail-pane">
          {!selectedId ? (
            <p className="admin-chat-empty">Chọn một hội thoại để xem nội dung.</p>
          ) : (
            <>
              <div className="admin-chat-detail-head">
                <div>
                  <strong>{detail?.listingTitle || "Đang tải hội thoại..."}</strong>
                  {detail && <small>Người mua: {detail.buyerName} ({detail.buyerEmail || "Không có email"})<br />Người bán: {detail.sellerName} ({detail.sellerEmail || "Không có email"})</small>}
                </div>
                <button type="button" disabled={detailLoading} onClick={() => { setMessagePage(1); setMessages([]); setDetailRefresh(value => value + 1); }}>Làm mới</button>
              </div>
              {detailError && <p className="admin-chat-error" role="alert">{detailError} <button type="button" onClick={() => setDetailRefresh(value => value + 1)}>Thử lại</button></p>}
              {detailLoading && messagePage === 1 ? <p className="admin-chat-empty">Đang tải tin nhắn...</p> : (
                <div className="admin-chat-messages">
                  {messages.length < messageTotal && (
                    <button type="button" className="admin-chat-older" disabled={detailLoading || Boolean(detailError)} onClick={() => setMessagePage(value => value + 1)}>
                      {detailLoading ? "Đang tải..." : "Tải tin nhắn cũ hơn"}
                    </button>
                  )}
                  {messages.length === 0 && !detailError ? <p className="admin-chat-empty">Hội thoại chưa có tin nhắn.</p> : messages.map(message => (
                    <div key={message.id} className={`admin-chat-message ${message.senderId === detail?.buyerId ? "buyer" : "seller"}`}>
                      <div><strong>{message.senderName}</strong><time dateTime={message.sentAt}>{formatChatTime(message.sentAt)}</time></div>
                      <p>{message.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
