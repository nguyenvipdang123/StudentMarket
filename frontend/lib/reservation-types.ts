export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'FULFILLED';
export type Reservation = {
  id: string; listingId: string; listingTitle: string; buyerId: string; sellerId: string;
  buyerName: string; sellerName: string; conversationId: string; meetingAt: string;
  location: string; note: string; expiresAt: string; status: ReservationStatus; isSeller: boolean;
};
export const reservationLabels: Record<ReservationStatus, string> = {
  PENDING: 'Chờ người bán xác nhận', CONFIRMED: 'Đang giữ chỗ', REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy lịch', EXPIRED: 'Đã hết hạn', FULFILLED: 'Đã giao · Chờ xác nhận giao dịch',
};
export function meetingTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}
