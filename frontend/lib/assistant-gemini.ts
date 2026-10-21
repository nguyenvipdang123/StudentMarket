import { FAQ } from "./assistant-faq.ts";

export type AssistantTurn = { role: "user" | "model"; text: string };

export class AssistantAiError extends Error {
  status: number;
  constructor(message: string, status = 503) { super(message); this.status = status; }
}

export function assistantAiConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    key: (env.ASSISTANT_GEMINI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY || "").trim(),
    model: (env.ASSISTANT_GEMINI_MODEL || "gemini-3.1-flash-lite").trim(),
  };
}

export function rememberAssistantTurn(history: AssistantTurn[] = [], question: string, answer: string): AssistantTurn[] {
  return [...history, { role: "user" as const, text: question }, { role: "model" as const, text: answer }]
    .slice(-6).map(turn => ({ ...turn, text: turn.text.slice(0, 800) }));
}

const instruction = `Bạn là trợ lý SangTay / StudentMarket, chợ đồ cũ dành cho sinh viên. Trả lời bằng tiếng Việt thân thiện, ngắn gọn, thường dưới 150 từ. Dùng văn bản thuần, không định dạng Markdown. Có thể trò chuyện và đưa ra lời khuyên chọn đồ, học tập, dùng website.
Thông tin chính thức của website:
${FAQ.map(item => item.answer).join("\n")}
Tài khoản cần xác thực email bằng mã gửi vào hộp thư. Đăng nhập tại /explore?auth=login. Cài đặt tài khoản tại /account?tab=settings. Hệ thống có giữ chỗ, hẹn giao dịch và theo dõi nhu cầu mua qua chuông thông báo.
Bạn chỉ tư vấn: không được nói đã duyệt tài khoản, thay mật khẩu, giữ chỗ, đăng tin hay thực hiện giao dịch. Không truy cập tài khoản cá nhân, lịch sử thanh toán hoặc dữ liệu Admin. Không yêu cầu mật khẩu, OTP, khóa API hay số thẻ ngân hàng.
Danh sách sản phẩm và giá phải lấy từ chức năng tìm kiếm thật. Không tự bịa tên, giá, tồn kho hoặc đường dẫn /listing/. Khi cần tìm món cụ thể, hướng dẫn người dùng hỏi ví dụ 'Tìm laptop dưới 5 triệu' hoặc mở /explore.
Trong chế độ này không có tài liệu PDF, tệp đính kèm hay tìm kiếm Internet. Nếu người dùng muốn đọc PDF, nói rõ chưa nhận được tài liệu và mời họ dán đoạn văn cần hỏi; không tuyên bố đã đọc tệp. Với câu hỏi quá ngắn hoặc thiếu ngữ cảnh, hỏi lại một câu ngắn. Không suy đoán chức năng hoặc chính sách website ngoài thông tin ở trên.`;

type GeminiOptions = { signal?: AbortSignal; env?: NodeJS.ProcessEnv; fetcher?: typeof fetch; onPartial?: (text: string) => void };
const slowMessage = "Trợ lý phản hồi chậm. Bạn vui lòng gửi lại câu hỏi sau ít giây.";
const incompleteMessage = "Trợ lý chưa trả lời được câu này. Bạn thử diễn đạt cụ thể hơn nhé.";

async function readGeminiStream(response: Response, signal: AbortSignal, onPartial: (text: string) => void) {
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new AssistantAiError(incompleteMessage);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", answer = "", finishReason = "", bytes = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  function consume(frame: string) {
    const raw = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!raw || raw === "[DONE]") return;
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new AssistantAiError(incompleteMessage); }
    if (payload.error || payload.promptFeedback?.blockReason) throw new AssistantAiError(incompleteMessage);
    const candidate = payload.candidates?.[0];
    if (candidate?.finishReason) finishReason = candidate.finishReason;
    if (finishReason && finishReason !== "STOP") throw new AssistantAiError(incompleteMessage);
    const text = candidate?.content?.parts?.filter((part: { text?: string; thought?: boolean }) => typeof part.text === "string" && !part.thought)
      .map((part: { text: string }) => part.text).join("") || "";
    if (text) {
      answer += text;
      if (answer.length > 12000) throw new AssistantAiError(incompleteMessage);
      onPartial(answer);
    }
  }
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      bytes += value?.byteLength || 0;
      if (bytes > 262144) throw new AssistantAiError(incompleteMessage);
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
      let separator;
      while ((separator = buffer.indexOf("\n\n")) !== -1) { consume(buffer.slice(0, separator)); buffer = buffer.slice(separator + 2); }
      if (done) { if (buffer.trim()) consume(buffer); break; }
    }
    if (finishReason !== "STOP" || !answer.trim()) throw new AssistantAiError(incompleteMessage);
    return answer.trim();
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function answerWithGemini(message: string, history: AssistantTurn[] = [], options: GeminiOptions = {}) {
  const { key, model } = assistantAiConfig(options.env);
  if (!key) throw new AssistantAiError("Trợ lý AI chưa được cấu hình. Bạn vẫn có thể tìm sản phẩm và hỏi hướng dẫn nhanh.");
  if (!/^gemini-[a-zA-Z0-9._-]+$/.test(model)) throw new AssistantAiError("Cấu hình model trợ lý chưa hợp lệ. Vui lòng liên hệ Admin.");
  // One budget covers both the upstream body and its single connection retry.
  const signal = AbortSignal.any([AbortSignal.timeout(75000), ...(options.signal ? [options.signal] : [])]);
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: instruction }] },
    contents: [...history.slice(-6).map(turn => ({ role: turn.role, parts: [{ text: turn.text.slice(0, 800) }] })), { role: "user", parts: [{ text: message }] }],
    generationConfig: { maxOutputTokens: 900, ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}) },
  });
  let emitted = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      signal.throwIfAborted();
      const response = await (options.fetcher || fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: "POST", signal, cache: "no-store", redirect: "error",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body,
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        if (!attempt && [500, 502, 503, 504].includes(response.status)) continue;
        throw new AssistantAiError(response.status === 429
          ? "Trợ lý AI đang đạt giới hạn lượt hỏi. Bạn vẫn có thể tìm sản phẩm hoặc hỏi hướng dẫn nhanh."
          : "Trợ lý AI tạm thời chưa kết nối được. Bạn vui lòng thử lại sau.", response.status === 429 ? 429 : 503);
      }
      return await readGeminiStream(response, signal, text => { emitted = true; options.onPartial?.(text); });
    } catch (exception) {
      if (exception instanceof AssistantAiError) throw exception;
      if (signal.aborted) throw new AssistantAiError(slowMessage);
      if (attempt || emitted) throw new AssistantAiError("Trợ lý AI tạm thời chưa kết nối được. Bạn vui lòng thử lại sau.");
    }
  }
  throw new AssistantAiError(slowMessage);
}

/** Send incremental text immediately; release the session on completion, failure or disconnect. */
export function streamGeminiAnswer(message: string, history: AssistantTurn[], options: Omit<GeminiOptions, "onPartial"> & {
  onComplete: (text: string) => void; onSettled: () => void;
}) {
  const encoder = new TextEncoder(), cancelled = new AbortController();
  const signal = AbortSignal.any([cancelled.signal, ...(options.signal ? [options.signal] : [])]);
  let closed = false, settled = false;
  function settle() { if (!settled) { settled = true; options.onSettled(); } }
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      function enqueue(text: string) {
        if (closed) return;
        try { controller.enqueue(encoder.encode(text)); } catch { closed = true; cancelled.abort(); }
      }
      enqueue(": connected\n\n");
      const heartbeat = setInterval(() => enqueue(": keep-alive\n\n"), 15000);
      try {
        const text = await answerWithGemini(message, history, { ...options, signal, onPartial: text => enqueue(`data: ${JSON.stringify({ event: "assistant/partial", data: { text } })}\n\n`) });
        if (!signal.aborted) options.onComplete(text);
      } catch (exception) {
        if (!signal.aborted) enqueue(`data: ${JSON.stringify({ event: "assistant/error", data: { message: exception instanceof AssistantAiError ? exception.message : "Trợ lý chưa trả lời được. Bạn vui lòng thử lại sau." } })}\n\n`);
      } finally {
        clearInterval(heartbeat); settle();
        if (!closed) { closed = true; controller.close(); }
      }
    },
    cancel() { closed = true; cancelled.abort(); settle(); },
  });
}
