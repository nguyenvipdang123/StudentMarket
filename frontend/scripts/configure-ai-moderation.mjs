import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const target = new URL("../.env.local", import.meta.url);
let current = await readFile(target, "utf8");
const configured = current.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m)?.[1]?.trim();
if (!configured || configured === '""' || configured === "''") {
  try { process.loadEnvFile(fileURLToPath(new URL("../../../ai-pdf-chatbot-langchain/backend/.env", import.meta.url))); }
  catch { console.error("Chưa đọc được cấu hình Gemini chatbot."); process.exit(1); }
  const key = process.env.GOOGLE_API_KEY?.trim();
  if (!key) { console.error("Chatbot chưa có Google API key. Điền GEMINI_API_KEY trong frontend/.env.local."); process.exit(1); }
  current = /^GEMINI_API_KEY\s*=/m.test(current) ? current.replace(/^GEMINI_API_KEY\s*=.*$/m, "GEMINI_API_KEY=" + key) : current.trimEnd() + "\nGEMINI_API_KEY=" + key + "\n";
}
if (!/^GEMINI_MODERATION_MODEL\s*=/m.test(current)) current = current.trimEnd() + "\nGEMINI_MODERATION_MODEL=gemini-3.1-flash-lite\n";
await writeFile(target, current, { mode: 0o600 });
console.log("Đã cấu hình Gemini kiểm duyệt ở server. Khóa được giữ trên máy, không hiển thị.");
