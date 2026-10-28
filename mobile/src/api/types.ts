export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  freeGift?: boolean;
  category?: string;
  condition: string;
  location: string;
  school: string;
  seller: string;
  sellerId?: string;
  image: string;
  images?: string[];
  status: "Active" | "Sold" | "Hidden";
  moderationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  views?: number;
  likes?: number;
  chats?: number;
  reservedUntil?: string | null;
  createdAt?: string;
};
export type User = {
  id: number;
  pgUserId?: string;
  fullName: string;
  email: string;
  university: string;
  role: "student" | "admin" | "staff";
  status: string;
};
export type Catalog = {
  products: Product[];
  pagination: {
    page: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
};
export const categories = [
  "Tất cả",
  "Học tập",
  "Công nghệ",
  "Nội thất",
  "Thời trang",
  "Khác",
];
export const conditions = ["Mới 100%", "Như mới", "Tốt", "Đã qua sử dụng"];
