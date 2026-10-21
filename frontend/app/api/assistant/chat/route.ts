import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { productIntent, type ProductContext } from "@/lib/assistant-product-intent";
import { findAssistantProducts } from "@/lib/assistant-product-search";
import { findFaq } from "@/lib/assistant-faq";
import { streamGeminiAnswer, AssistantAiError, rememberAssistantTurn, type AssistantTurn } from "@/lib/assistant-gemini";

export const runtime = "nodejs";
const sessionCookie = "sangtay_assistant";
const sessions = new Map<string, { threadId?: string; expires: number; busy: boolean; products?: ProductContext; history?: AssistantTurn[] }>();
const requests = new Map<string, { count: number; expires: number }>();
const hour = 60 * 60 * 1000;
const graphUrl = process.env.PDF_CHAT_GRAPH_URL || (process.env.NODE_ENV==='production'?'':"http://127.0.0.1:2024");
const chatbotUrl = process.env.PDF_CHAT_APP_URL || (process.env.NODE_ENV==='production'?'':"http://127.0.0.1:3001");

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
function withSession(response: NextResponse, request: NextRequest, token: string) {
  response.cookies.set(sessionCookie, token, { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production", path: "/api/assistant", maxAge: hour / 1000 });
  return response;
}
function localReply(event: string, data: unknown, request: NextRequest, token: string) {
  return withSession(new NextResponse(`data: ${JSON.stringify({ event, data })}\n\n`, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } }), request, token);
}

export async function POST(request: NextRequest) {
  // Accept the website's current origin, including its ngrok host.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (origin) {
    try { if (new URL(origin).host !== host) return error("Yêu cầu không hợp lệ.", 403); }
    catch { return error("Yêu cầu không hợp lệ.", 403); }
  }
  if (Number(request.headers.get("content-length") || 0) > 12000) return error("Câu hỏi quá dài.", 413);
  let message: string;
  let preferredSchool = "";
  try {
    const raw = await request.text();
    if (raw.length > 12000) return error("Câu hỏi quá dài.", 413);
    const body = JSON.parse(raw);
    if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 2000) return error("Nhập câu hỏi từ 1 đến 2.000 ký tự.", 400);
    message = body.message.trim();
    if (body.school !== undefined && (typeof body.school !== "string" || body.school.length > 200)) return error("Trường không hợp lệ.", 400);
    preferredSchool = body.school?.trim() || "";
  } catch { return error("Câu hỏi không hợp lệ.", 400); }

  const now = Date.now();
  for (const [id, session] of sessions) if (session.expires < now) sessions.delete(id);
  for (const [ip, quota] of requests) if (quota.expires < now) requests.delete(ip);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const quota = requests.get(ip) || { count: 0, expires: now + hour };
  if (quota.count >= 30) return error("Bạn đã gửi nhiều câu hỏi. Vui lòng quay lại sau.", 429);
  if (!requests.has(ip) && requests.size >= 10000) return error("Trợ lý đang bận. Vui lòng thử lại sau.", 503);
  quota.count += 1;
  requests.set(ip, quota);

  const token = request.cookies.get(sessionCookie)?.value;
  let session = token ? sessions.get(token) : undefined;
  if (session?.busy) return error("Vui lòng chờ câu trả lời hiện tại.", 409);
  const newToken = session && token ? token : randomBytes(24).toString("hex");
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(90000)]);
  try {
    if (!session) {
      if (sessions.size >= 10000) return error("Trợ lý đang bận. Vui lòng thử lại sau.", 503);
      session = { expires: now + hour, busy: false };
      sessions.set(newToken, session);
    }
    session.busy = true;
    session.expires = now + hour;
    const intent = productIntent(message, session.products, preferredSchool);
    if (intent?.type === "clarify") {
      session.history = rememberAssistantTurn(session.history, message, intent.text);
      session.busy = false;
      return localReply("assistant/partial", { text: intent.text }, request, newToken);
    }
    if (intent?.type === "search") {
      const found = await findAssistantProducts(intent.search, intent.more);
      session.products = found.context;
      session.history = rememberAssistantTurn(session.history, message, found.answer.text);
      session.busy = false;
      return localReply("assistant/products", found.answer, request, newToken);
    }
    session.products = undefined;
    const faq=findFaq(message);
    if(faq) {session.history=rememberAssistantTurn(session.history,message,faq.answer);session.busy=false;return localReply('assistant/partial',{text:faq.answer},request,newToken);}
    if(!graphUrl || !chatbotUrl) {
      const currentSession = session;
      const body = streamGeminiAnswer(message, currentSession.history || [], {
        signal,
        onComplete: text => { currentSession.history = rememberAssistantTurn(currentSession.history, message, text); },
        onSettled: () => { currentSession.busy = false; },
      });
      return withSession(new NextResponse(body, { headers: {
        "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no",
      } }), request, newToken);
    }
    const status = await fetch(`${chatbotUrl}/api/status`, { cache: "no-store", signal });
    if (!status.ok || !(await status.json()).ready) { session.busy = false; return error("Trợ lý đang được cấu hình. Vui lòng thử lại sau.", 503); }
    if (!session.threadId) {
      const threadResponse = await fetch(`${graphUrl}/threads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal });
      if (!threadResponse.ok) throw new Error("thread unavailable");
      const thread = await threadResponse.json();
      if (typeof thread.thread_id !== "string") throw new Error("invalid thread");
      session.threadId = thread.thread_id;
    }
    const upstream = await fetch(`${chatbotUrl}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, threadId: session.threadId }), signal });
    if (!upstream.ok || !upstream.body) throw new Error("assistant unavailable");
    const currentSession = session;
    const reader = upstream.body.getReader();
    const body = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch { controller.error(new Error("Assistant stream unavailable")); }
        finally { currentSession.busy = false; }
      },
      cancel() { currentSession.busy = false; return reader.cancel(); },
    });
    // Release the concurrency lock even when a client disconnects mid-stream.
    signal.addEventListener("abort", () => { currentSession.busy = false; }, { once: true });
    const response = new NextResponse(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
    return withSession(response, request, newToken);
  } catch (exception) {
    if (session) session.busy = false;
    if (exception instanceof AssistantAiError) return error(exception.message, exception.status);
    return error("Trợ lý chưa kết nối được. Bạn vui lòng thử lại sau.", 503);
  }
}
