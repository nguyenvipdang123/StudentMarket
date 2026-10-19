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

export async function answerWithGemini(
  message: string,
  history: AssistantTurn[] = [],
  options: { signal?: AbortSignal; env?: NodeJS.ProcessEnv; fetcher?: typeof fetch } = {},
) {
  const { key, model } = assistantAiConfig(options.env);
  if (!key) throw new AssistantAiError("Trợ lý AI chưa được cấu hình. Bạn vẫn có thể tìm sản phẩm và hỏi hướng dẫn nhanh.");
  if (!/^gemini-[a-zA-Z0-9._-]+$/.test(model)) throw new AssistantAiError("Cấu hình model trợ lý chưa hợp lệ. Vui lòng liên hệ Admin.");
  const timeout = AbortSignal.timeout(20000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await (options.fetcher || fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", signal, cache: "no-store", redirect: "error",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [...history.slice(-6).map(turn => ({ role: turn.role, parts: [{ text: turn.text.slice(0, 800) }] })), { role: "user", parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 900, ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}) },
      }),
    });
  } catch {
    throw new AssistantAiError("Trợ lý phản hồi chậm. Bạn vui lòng gửi lại câu hỏi sau ít giây.");
  }
  if (!response.ok) throw new AssistantAiError(response.status === 429
    ? "Trợ lý AI đang đạt giới hạn lượt hỏi. Bạn vẫn có thể tìm sản phẩm hoặc hỏi hướng dẫn nhanh."
    : "Trợ lý AI tạm thời chưa kết nối được. Bạn vui lòng thử lại sau.", response.status === 429 ? 429 : 503);
  try {
    const payload = await response.json();
    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts?.filter((part: { text?: string; thought?: boolean }) => typeof part.text === "string" && !part.thought)
      .map((part: { text: string }) => part.text).join("").trim();
    if (candidate?.finishReason !== "STOP" || !text || text.length > 12000) throw new Error("Incomplete answer");
    return text as string;
  } catch {
    throw new AssistantAiError("Trợ lý chưa trả lời được câu này. Bạn thử diễn đạt cụ thể hơn nhé.");
  }
}
