export type Registration = { fullName: string; email: string; studentId: string; university: string; password: string; confirmPassword: string };
export const validAuthEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 254;
export const educationEmail = (email: string) => /@(?:[a-z0-9-]+\.)+edu(?:\.vn)?$/i.test(email.trim());
export function passwordError(password: string, confirm: string) {
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Mật khẩu cần 8–128 ký tự, ít nhất một chữ và một số.";
  return password === confirm ? "" : "Xác nhận mật khẩu không khớp.";
}
export function profileError(profile: Pick<Registration, "fullName" | "studentId" | "university">) {
  if (profile.fullName.trim().length < 2 || profile.fullName.trim().length > 100) return "Họ và tên cần từ 2 đến 100 ký tự.";
  if (!/^[A-Z0-9][A-Z0-9._-]{2,29}$/i.test(profile.studentId.trim())) return "Mã sinh viên cần 3–30 ký tự gồm chữ, số, chấm, gạch dưới hoặc gạch ngang.";
  if (profile.university.trim().length < 2 || profile.university.trim().length > 120) return "Vui lòng chọn trường đại học.";
  return "";
}
export function registrationError(profile: Registration, hasCard: boolean) {
  return profileError(profile) || (!validAuthEmail(profile.email) ? "Nhập đúng địa chỉ email." : "") || passwordError(profile.password, profile.confirmPassword) ||
    (!educationEmail(profile.email) && !hasCard ? "Email ngoài miền trường cần ảnh thẻ sinh viên để xác minh." : "");
}
export const validOtp = (code: string) => /^\d{6}$/.test(code.trim());
export function googleErrorMessage(reason: string) {
  const messages: Record<string, string> = {
    school_google: "Chỉ chấp nhận Google Workspace của trường thuộc miền .edu hoặc .edu.vn.",
    account_status: "Tài khoản đang chờ xác minh, xét duyệt hoặc đã bị khóa.",
    email_exists: "Email đã đăng ký bằng mật khẩu. Hãy đăng nhập bằng mật khẩu hoặc dùng Quên mật khẩu.",
  };
  return messages[reason] || (reason.startsWith("Phiên ") ? reason : "Chưa hoàn tất đăng nhập Google. Bạn có thể thử lại.");
}
