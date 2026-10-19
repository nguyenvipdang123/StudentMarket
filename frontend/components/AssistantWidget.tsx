"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { assistantAnswer, type AssistantAnswer } from "@/lib/assistant-answer";
import { UNIVERSITY_STORAGE_KEY } from "@/lib/universities";
import { formatPrice } from "@/lib/storage";
import FigmaIcon from "./FigmaIcon";

type Message = AssistantAnswer & { role: "user" | "assistant" };
type ChatEvent = { error?: string; event?: string; data?: unknown };

const suggestedQuestions = [
  "Tìm laptop dưới 5 triệu",
  "Tìm sách ở DNTU",
  "Có đồ trao đổi miễn phí không?",
  "SangTay hoạt động như thế nào?",
  "Làm sao để đăng tin?",
  "Đăng tin có mất phí không?",
  "Cách tìm sản phẩm?",
  "Cách liên hệ người bán?",
  "Làm sao để giao dịch an toàn?",
];

export default function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  useEffect(() => { if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; }, [messages, busy]);
  useEffect(() => () => controller.current?.abort(), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input.trim());
  }
  async function ask(question: string) {
    if (!question || busy) return;
    const previous = [...messages, { role: "user" as const, text: question }];
    setMessages([...previous, { role: "assistant", text: "" }]);
    setInput(""); setBusy(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    let answer = "";
    try {
      let school = "";
      try { school = window.localStorage.getItem(UNIVERSITY_STORAGE_KEY) || ""; } catch { /* School selection is optional. */ }
      const response = await fetch("/api/assistant/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: question, school }), signal: abort.signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Trợ lý đang bận. Vui lòng thử lại sau."); }
      if (!response.body) throw new Error("Chưa nhận được câu trả lời.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      function consume(frame: string) {
        const data = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (!data) return;
        let parsed: ChatEvent;
        try { parsed = JSON.parse(data); } catch { return; }
        const content = assistantAnswer(parsed);
        if (content !== null) { answer = content.text; setMessages([...previous, { role: "assistant", ...content }]); }
      }
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
        let separator: number;
        while ((separator = buffer.indexOf("\n\n")) >= 0) { consume(buffer.slice(0, separator)); buffer = buffer.slice(separator + 2); }
        if (done) { if (buffer.trim()) consume(buffer); break; }
      }
      if (!answer.trim()) throw new Error("Chưa nhận được câu trả lời. Bạn thử gửi lại câu hỏi nhé.");
    } catch (exception) {
      if (!abort.signal.aborted) { setError(exception instanceof Error ? exception.message : "Không kết nối được với trợ lý."); if (!answer) setMessages(previous); setInput(question); }
    } finally { setBusy(false); controller.current = null; }
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) return null;
  return <div className="assistant-widget">
    {open && <section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title" id="assistant-panel">
      <header className="assistant-header"><span className="assistant-symbol"><FigmaIcon name="sparkles" size={23} /></span><div><h2 id="assistant-title">Trợ lý SangTay</h2><p>Tìm đồ thật, hướng dẫn nhanh & hỏi đáp AI</p></div><button type="button" aria-label="Đóng trợ lý" onClick={() => { setOpen(false); toggle.current?.focus(); }}><FigmaIcon name="close" size={20} /></button></header>
      <div className="assistant-transcript" ref={transcript}>
        {messages.length === 0 && <div className="assistant-welcome"><span><FigmaIcon name="chat" size={28} /></span><h3>Chào bạn, mình có thể giúp gì?</h3><p>Chọn câu hỏi bên dưới hoặc nhập điều bạn muốn biết.</p><div>{suggestedQuestions.map(text => <button key={text} type="button" onClick={() => { setInput(text); field.current?.focus(); }}>{text}<FigmaIcon name="arrowUp" size={15} /></button>)}</div></div>}
        {messages.map((message, index) => <article key={index} className={`assistant-message ${message.role}${message.products?.length ? " has-products" : ""}`}><span className="sr-only">{message.role === "user" ? "Bạn" : "Trợ lý"}:</span><p>{message.text || "Đang trả lời…"}</p>
          {message.products && <>
            {message.products.length > 0 && <ul className="assistant-products" aria-label="Sản phẩm tìm được">{message.products.map(product => <li key={product.id}><Link href={`/listing/${product.id}`} onClick={() => setOpen(false)} className="assistant-product">
              <img src={product.image} alt="" loading="lazy" decoding="async"/>
              <div><strong>{product.title}</strong><span className="assistant-product-price">{product.freeGift ? "Tặng miễn phí" : formatPrice(product.price)}</span><small>{product.condition} · {product.school || product.location}</small><span className="assistant-product-action">Xem chi tiết ↗</span></div>
            </Link></li>)}</ul>}
            {message.searchUrl && <Link className="assistant-browse" href={message.searchUrl} onClick={() => setOpen(false)}>Xem trong Khám phá →</Link>}
            {index === messages.length - 1 && !busy && message.products.length > 0 && <div className="assistant-followups">{message.hasMore && <button type="button" onClick={() => void ask("Xem thêm")}>Xem thêm</button>}<button type="button" onClick={() => void ask("Rẻ hơn")}>Tìm món rẻ hơn</button></div>}
          </>}
        </article>)}
      </div>
      {error && <p className="assistant-error" role="alert">{error}</p>}
      <div className="assistant-live sr-only" role="status" aria-live="polite">{busy ? "Trợ lý đang trả lời" : messages.at(-1)?.role === "assistant" ? messages.at(-1)?.text : ""}</div>
      <form className="assistant-compose" onSubmit={submit}><label className="sr-only" htmlFor="assistant-question">Câu hỏi cho trợ lý</label><textarea id="assistant-question" ref={field} rows={2} maxLength={2000} value={input} onChange={event => setInput(event.target.value)} placeholder="Nhập câu hỏi của bạn…" disabled={busy} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" aria-label="Gửi câu hỏi" disabled={busy || !input.trim()}><FigmaIcon name="send" size={21} /></button><small>Câu trả lời của AI có thể chưa chính xác. Hãy kiểm tra thông tin cần thiết.</small></form>
    </section>}
    <button ref={toggle} type="button" className="assistant-toggle" aria-expanded={open} aria-controls="assistant-panel" aria-label={open ? "Thu gọn trợ lý SangTay" : "Mở trợ lý SangTay"} onClick={() => setOpen(value => !value)}><FigmaIcon name={open ? "close" : "chat"} size={23} /><span>{open ? "Thu gọn" : "Hỏi SangTay"}</span></button>
  </div>;
}
