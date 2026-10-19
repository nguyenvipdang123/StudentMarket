import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type SePayConfig = { enabled: boolean; bank: string; account: string; holder: string; qrAccount: string; subAccount: string; descriptionPrefix: string; orderPrefix: string; auth: "hmac" | "apikey"; secret: string };
export function sepayConfig(): SePayConfig {
  return { enabled: process.env.SEPAY_ENABLED === "true", bank: (process.env.SEPAY_BANK_CODE || "").trim(), account: (process.env.SEPAY_ACCOUNT_NUMBER || "").trim(),
    holder: (process.env.SEPAY_ACCOUNT_NAME || "").trim(), qrAccount: (process.env.SEPAY_QR_ACCOUNT || process.env.SEPAY_ACCOUNT_NUMBER || "").trim(),
    subAccount: (process.env.SEPAY_SUB_ACCOUNT || "").trim(), descriptionPrefix: (process.env.SEPAY_DESCRIPTION_PREFIX || "").trim(),
    orderPrefix: (process.env.SEPAY_ORDER_PREFIX || "ST").trim().toUpperCase(), auth: process.env.SEPAY_WEBHOOK_AUTH === "apikey" ? "apikey" : "hmac", secret: process.env.SEPAY_WEBHOOK_SECRET || "" };
}
export function missingSePaySettings(config = sepayConfig()) {
  const missing: string[] = [];
  if (!config.enabled) missing.push("SEPAY_ENABLED=true");
  if (!/^[A-Za-z0-9]{2,30}$/.test(config.bank)) missing.push("SEPAY_BANK_CODE");
  if (!/^[A-Za-z0-9]{4,40}$/.test(config.account)) missing.push("SEPAY_ACCOUNT_NUMBER");
  if (!config.holder || config.holder.length > 150) missing.push("SEPAY_ACCOUNT_NAME");
  if (!/^[A-Za-z0-9]{4,40}$/.test(config.qrAccount)) missing.push("SEPAY_QR_ACCOUNT");
  if (!/^[A-Z]{2,8}$/.test(config.orderPrefix)) missing.push("SEPAY_ORDER_PREFIX");
  if (config.secret.length < 32) missing.push("SEPAY_WEBHOOK_SECRET");
  if (config.descriptionPrefix.length > 50 || config.subAccount.length > 50) missing.push("SEPAY_DESCRIPTION_PREFIX / SEPAY_SUB_ACCOUNT");
  if (process.env.SEPAY_WEBHOOK_AUTH && !["hmac", "apikey"].includes(process.env.SEPAY_WEBHOOK_AUTH)) missing.push("SEPAY_WEBHOOK_AUTH");
  return missing;
}
export function validSePaySignature(raw: string, headers: Headers, config: SePayConfig, now = Date.now()) {
  if (config.secret.length < 32) return false;
  if (config.auth === "apikey") {
    const actual = Buffer.from(headers.get("authorization") || ""), expected = Buffer.from(`Apikey ${config.secret}`);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  const timestamp = headers.get("x-sepay-timestamp") || "", signature = headers.get("x-sepay-signature") || "";
  if (!/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", config.secret).update(`${timestamp}.${raw}`).digest();
  const actual = Buffer.from(signature.slice(7), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export type SePayEvent = { id: number; gateway: string; accountNumber: string; subAccount: string; code: string; content: string; transferType: "in" | "out"; transferAmount: number; referenceCode: string; transactionAt: string };
export function parseSePayEvent(value: unknown): SePayEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid event");
  const v = value as Record<string, unknown>;
  const text = (key: string, max: number, optional = false) => {
    const field = v[key];
    if (optional && (field === null || field === undefined)) return "";
    if (typeof field !== "string" || field.length > max || (!optional && !field.trim())) throw new Error("Invalid event field");
    return field.trim();
  };
  if (!Number.isSafeInteger(v.id) || Number(v.id) <= 0 || !Number.isSafeInteger(v.transferAmount) || Number(v.transferAmount) <= 0 || !["in", "out"].includes(String(v.transferType))) throw new Error("Invalid event amount/id");
  const date = text("transactionDate", 19);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) throw new Error("Invalid event date");
  const parsed = new Date(date.replace(" ", "T") + "+07:00");
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 7 * 3600000).toISOString().slice(0,19).replace("T", " ") !== date) throw new Error("Invalid event date");
  return { id: Number(v.id), gateway: text("gateway", 40), accountNumber: text("accountNumber", 50), subAccount: text("subAccount", 100, true), code: text("code", 100, true), content: text("content", 2000), transferType: v.transferType as "in" | "out", transferAmount: Number(v.transferAmount), referenceCode: text("referenceCode", 100, true), transactionAt: parsed.toISOString() };
}
export function paymentEventFingerprint(event: SePayEvent) { return createHash("sha256").update(JSON.stringify(event)).digest("hex"); }
export function paymentCode(event: SePayEvent, prefix: string) {
  const pattern = new RegExp(`(?:^|[^A-Z0-9])(${prefix}[A-F0-9]{16})(?=$|[^A-Z0-9])`, "g");
  const codes = new Set([...event.content.toUpperCase().matchAll(pattern)].map(match => match[1]));
  if (new RegExp(`^${prefix}[A-F0-9]{16}$`).test(event.code.toUpperCase())) codes.add(event.code.toUpperCase());
  return codes.size === 1 ? [...codes][0] : null;
}
export function bankMatches(first: string, second: string) {
  const aliases: Record<string,string> = { mb: "mbbank", vcb: "vietcombank", vtb: "vietinbank", icb: "vietinbank", tcb: "techcombank", vpb: "vpbank", tpb: "tpbank", stb: "sacombank", agr: "agribank", vba: "agribank", klb: "kienlongbank" };
  const normalize = (value: string) => { const key = value.toLowerCase().replace(/[^a-z0-9]/g, ""); return aliases[key] || key; };
  return normalize(first) === normalize(second);
}
export function sepayQr(details: { bank: string; qrAccount: string; descriptionPrefix: string }, code: string, amount: number) {
  const memo = [details.descriptionPrefix, code].filter(Boolean).join(" ");
  return { memo, qrUrl: "https://vietqr.app/img?" + new URLSearchParams({ bank: details.bank, acc: details.qrAccount, amount: String(amount), des: memo, template: "compact" }).toString() };
}
