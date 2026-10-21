export const supportStatuses={OPEN:'Mới tiếp nhận',IN_PROGRESS:'Đang xử lý',WAITING_USER:'Chờ bạn bổ sung',RESOLVED:'Đã giải quyết'} as const;
export type SupportStatus=keyof typeof supportStatuses;
export const supportCategories={ACCOUNT:'Tài khoản',LISTING:'Tin đăng',PAYMENT:'Thanh toán đẩy tin',TRANSACTION:'Giao dịch / lịch hẹn',OTHER:'Vấn đề khác'} as const;
export type SupportCategory=keyof typeof supportCategories;
export type SupportTicket={id:string;subject:string;category:SupportCategory;status:SupportStatus;version:number;createdAt:string;updatedAt:string;ownerName:string;ownerEmail?:string};
export type SupportMessage={id:number;authorRole:'student'|'admin';authorName:string;content:string;newStatus:SupportStatus|null;createdAt:string};
export type SupportDetail={ticket:SupportTicket;messages:SupportMessage[];hasMore:boolean};
export const supportCode=(id:string)=>'HT-'+id.slice(0,8).toUpperCase();
