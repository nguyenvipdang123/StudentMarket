"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ReportUserDialog from "@/components/ReportUserDialog";
import { Conversation, MessageItem, Viewer } from "@/lib/types";
import MarketplaceChat from "@/components/MarketplaceChat";

const FASTAPI_WS = process.env.NEXT_PUBLIC_CHAT_WS_URL;

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

function MessagesContent() {
  const searchParams = useSearchParams();
  const listingIdParam = searchParams.get("listingId");

  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [pgUserId, setPgUserId] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [loadError,setLoadError]=useState("");
  const [reload,setReload]=useState(0);
  const [filterType, setFilterType] = useState<"all" | "buying" | "selling">("all");
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [reportContext, setReportContext] = useState<{ id: string; label: string } | null>(null);
  const [reportNotice, setReportNotice] = useState("");

  // Real-time states
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState<string | null>(null);

  // References
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTypingRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Check auth and load conversations from authenticated API
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Check auth
      try {
        const authRes = await fetch("/api/auth/me", { cache: "no-store" });
        const authData = await authRes.json();
        if (!authData.user) {
          setAuthChecked(true);
          setLoading(false);
          return;
        }
        if (!cancelled) setViewer(authData.user);
      } catch {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      // Load conversations from authenticated Next.js API
      try {
        const convRes = await fetch("/api/conversations", { cache: "no-store" });
        if (convRes.status === 401) {
          setAuthChecked(true);
          setLoading(false);
          return;
        }
        if (!convRes.ok) throw new Error("Không tải được hộp thư.");
        setLoadError("");
        const convData = await convRes.json();
        if (!cancelled) {
          setPgUserId(convData.pgUserId || "");
          const mapped: Conversation[] = (convData.conversations || []).map((c: Conversation) => ({
            ...c,
            messages: [],
          }));

          if (listingIdParam) {
            const existingConv = mapped.find(c => String(c.listingId) === listingIdParam);
            if (existingConv) {
              setConversations(mapped);
              setActiveConvId(existingConv.id);
            } else {
              // Create new conversation via POST /api/conversations
              try {
                const createRes = await fetch("/api/conversations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ listingId: listingIdParam }),
                });
                if (createRes.ok) {
                  const createData = await createRes.json();
                  const convRes2 = await fetch("/api/conversations", { cache: "no-store" });
                  if (convRes2.ok) {
                    const convData2 = await convRes2.json();
                    const newMapped = (convData2.conversations || []).map((c: Conversation) => ({
                      ...c,
                      messages: [],
                    }));
                    setConversations(newMapped);
                    setActiveConvId(createData.id);
                  }
                } else {
                  setConversations(mapped);
                }
              } catch {
                setConversations(mapped);
              }
            }
          } else {
            setConversations(mapped);
            if (mapped.length > 0 && !window.matchMedia("(max-width: 700px)").matches) {
              setActiveConvId(current => current || mapped[0].id);
            }
          }
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Không tải được hộp thư.");
      }

      if (!cancelled) {
        setAuthChecked(true);
        setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [listingIdParam,reload]);

  // Active conversation
  const activeConversation = useMemo(
    () => conversations.find(c => c.id === activeConvId),
    [conversations, activeConvId]
  );

  // Role determination based on pgUserId (buyer_id / seller_id from DB)
  const isBuyerInActive = useMemo(() => {
    if (!activeConversation || !pgUserId) return true;
    return String(activeConversation.buyerId) === pgUserId;
  }, [activeConversation, pgUserId]);

  // Scroll to bottom
  useEffect(() => {
    const pane = messagesEndRef.current?.parentElement;
    if (pane && pane.scrollHeight - pane.scrollTop - pane.clientHeight < 160) {
      pane.scrollTo({ top: pane.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [activeConversation?.messages, partnerTyping]);

  // 2. Fetch messages and connect WebSocket when active conversation changes
  useEffect(() => {
    if (!activeConvId || !pgUserId) return;


    let cancelled = false;

    // Fetch message history from authenticated API
    async function fetchMessages() {
      try {
        const res = await fetch(`/api/conversations/${activeConvId}/messages`, { cache: "no-store" });
        if (!res.ok) { setReportNotice("Không tải được tin nhắn. Hệ thống sẽ thử lại."); return; }
        const data = await res.json();
        if (!cancelled && data.messages) {
          const msgs: MessageItem[] = data.messages.map((m: MessageItem) => ({
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            senderName: m.senderName,
            content: m.content,
            sentAt: new Date(m.sentAt).getTime(),
            isRead: m.isRead,
            readAt: m.readAt,
          }));
          setConversations(prev =>
            prev.map(c => c.id === activeConvId ? { ...c, messages: msgs, unreadCount: 0 } : c)
          );
        }
      } catch (e) {
        console.warn("Could not fetch messages:", e);
      }
    }

    fetchMessages();

    // Connect WebSocket
    async function connectWS() {
      let ticket: string;
      try {
        const res = await fetch(`/api/conversations/${activeConvId}/ticket`, { method: "POST" });
        if (!res.ok) throw new Error("Ticket unavailable");
        ticket = (await res.json()).ticket;
      } catch {
        if (!cancelled) { setConnectionStatus("disconnected"); reconnectTimeoutRef.current = setTimeout(connectWS, 10000); }
        return;
      }
      if (cancelled) return;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      setConnectionStatus("connecting");
      const ws = new WebSocket(
        `${FASTAPI_WS || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.hostname}:8000`}/ws/chat/${activeConvId}?ticket=${encodeURIComponent(ticket)}`
      );
      socketRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnectionStatus("connected");
        ws.send(JSON.stringify({ event: "message_read" }));
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);

          if (data.event === "error") setReportNotice(data.error);
          if (data.event === "message" && data.message) {
            const msg = data.message;
            const newMsg: MessageItem = {
              id: msg.id,
              conversationId: msg.conversation_id,
              senderId: msg.sender_id,
              senderName: msg.sender_id === pgUserId ? "Bạn" :
                (isBuyerInActive ? activeConversation?.sellerName || "Người bán" : activeConversation?.buyerName || "Khách hàng"),
              senderRole: msg.sender_role,
              content: msg.content,
              sentAt: new Date(msg.created_at).getTime(),
              isRead: msg.is_read,
              readAt: null,
            };

            setConversations(prev => prev.map(c => {
              if (c.id === msg.conversation_id) {
                const exists = c.messages.some(m => m.id === newMsg.id);
                return {
                  ...c,
                  lastMessage: msg.content,
                  updatedAt: newMsg.sentAt,
                  messages: exists ? c.messages : [...c.messages, newMsg],
                };
              }
              return c;
            }));

            if (msg.sender_id !== pgUserId && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: "message_read" }));
            }
          }

          else if (data.event === "message_read") {
            setConversations(prev => prev.map(c => {
              if (c.id === activeConvId) {
                return {
                  ...c,
                  messages: c.messages.map(m =>
                    String(m.senderId) === pgUserId ? { ...m, isRead: true, readAt: data.read_at } : m
                  ),
                };
              }
              return c;
            }));
          }

          else if (data.event === "typing" && data.user_id !== pgUserId) {
            if (data.is_typing) {
              setPartnerTyping(data.text || "Đang nhập...");
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setPartnerTyping(null), 3000);
            } else {
              setPartnerTyping(null);
            }
          }

          else if (data.event === "user_online" && data.user_id !== pgUserId) {
            setIsPartnerOnline(true);
          } else if (data.event === "user_offline" && data.user_id !== pgUserId) {
            setIsPartnerOnline(false);
          }
        } catch (e) {
          console.error("WS parse error:", e);
        }
      };

      ws.onerror = () => { if (!cancelled) setConnectionStatus("error"); };
      ws.onclose = () => {
        if (cancelled) return;
        setConnectionStatus("reconnecting");
        reconnectTimeoutRef.current = setTimeout(connectWS, 3000);
      };
    }

    connectWS();
    const poll = setInterval(fetchMessages, 5000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (debounceTypingRef.current) clearTimeout(debounceTypingRef.current);
      if (socketRef.current) { socketRef.current.close(); socketRef.current = null; }
    };
  }, [activeConvId, pgUserId, activeConversation?.buyerName, activeConversation?.sellerName, isBuyerInActive]);

  // 3. Input handler with debounced typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      if (!debounceTypingRef.current) {
        socketRef.current.send(JSON.stringify({ event: "typing", is_typing: true }));
      } else {
        clearTimeout(debounceTypingRef.current);
      }
      debounceTypingRef.current = setTimeout(() => {
        socketRef.current?.send(JSON.stringify({ event: "typing", is_typing: false }));
        debounceTypingRef.current = null;
      }, 2000);
    }
  };

  // 4. Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || !activeConvId) return;

    if (debounceTypingRef.current) {
      clearTimeout(debounceTypingRef.current);
      debounceTypingRef.current = null;
    }

    let sentWs = false;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event: "message", content: text }));
      socketRef.current.send(JSON.stringify({ event: "typing", is_typing: false }));
      sentWs = true;
    }

    if (!sentWs) {
      try {
        const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (!res.ok) { setReportNotice("Không gửi được tin nhắn. Vui lòng thử lại."); return; }
        if (res.ok) {
          const msgData = await res.json();
          const newMsg: MessageItem = {
            id: msgData.message.id,
            conversationId: activeConvId,
            senderId: pgUserId,
            senderName: viewer?.fullName || "Bạn",
            content: text,
            sentAt: Date.now(),
            isRead: false,
          };
          setConversations(prev =>
            prev.map(c =>
              c.id === activeConvId
                ? { ...c, messages: [...c.messages, newMsg], lastMessage: text }
                : c
            )
          );
        }
      } catch (err) {
        console.error("Failed to send message via HTTP:", err);
        setReportNotice("Không gửi được tin nhắn.");
        return;
      }
    }
    setInputMessage("");
  };

  return <div className="site-shell"><Navbar/><main><MarketplaceChat viewer={viewer} pgUserId={pgUserId} conversations={conversations} activeId={activeConvId} onActive={setActiveConvId} filter={filterType} onFilter={setFilterType} input={inputMessage} onInput={handleInputChange} onSend={handleSendMessage} loading={loading || !authChecked} error={loadError} onRetry={()=>{setLoading(true);setReload(v=>v+1);}} partnerOnline={isPartnerOnline} partnerTyping={partnerTyping} connectionStatus={connectionStatus} onReport={(id,label)=>setReportContext({id,label})} endRef={messagesEndRef} notice={reportNotice} onNotice={setReportNotice}/>{reportContext&&<ReportUserDialog contextType="CONVERSATION" contextId={reportContext.id} targetLabel={reportContext.label} onClose={()=>setReportContext(null)} onSubmitted={()=>{setReportContext(null);setReportNotice("Đã gửi báo cáo. Bạn có thể theo dõi trong mục Báo cáo của tôi.");}}/>}</main><Footer/></div>;
}

export default function MessagesPage() {return <Suspense fallback={<div className="figma-screen" aria-busy="true">Đang tải hộp thư...</div>}><MessagesContent/></Suspense>;}
