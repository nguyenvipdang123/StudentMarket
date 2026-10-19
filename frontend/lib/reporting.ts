export const reportReasons = {
  SCAM: "Nghi ngờ lừa đảo",
  MISLEADING: "Thông tin sai sự thật",
  HARASSMENT: "Quấy rối hoặc lời nói không phù hợp",
  OTHER: "Vi phạm quy tắc khác",
} as const;

export const reportStatuses = {
  PENDING: "Chờ xử lý",
  APPROVED: "Đã duyệt · tài khoản vi phạm đã khóa",
  REJECTED: "Không chấp nhận báo cáo",
} as const;
