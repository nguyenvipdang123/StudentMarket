export type Category = "Tất cả" | "Học tập" | "Công nghệ" | "Nội thất" | "Thời trang" | "Khác";

export type ListingCondition = "Mới 100%" | "Như mới" | "Tốt" | "Đã qua sử dụng";
export type ListingStatus = "Active" | "Sold" | "Hidden";
export type ListingType = "Sell" | "Exchange";

export type Listing = {
  id: string;
  sellerId?: string;
  title: string;
  price: number; // 0 = Trao đổi
  category: Exclude<Category, "Tất cả">;
  condition: string;
  location: string;
  seller: string;
  school: string;
  posted?: string;
  image: string;
  images?: string[];
  color?: string;
  emoji?: string;
  description: string;
  featured?: boolean;
  status: ListingStatus;
  reservedUntil?: string | null;
  moderationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  views?: number;
  likes?: number;
  chats?: number;
  promotion?: {
    id: string;
    name: string;
    priority: number;
    badge: string;
    startAt?: string | null;
    endAt?: string | null;
  } | null;
  createdAt?: number | string;
};

export type Viewer = {
  id: number;
  pgUserId?: string;
  fullName: string;
  email: string;
  studentId: string;
  university: string;
  status: "verified" | "pending_email" | "pending_review" | "locked";
  role: "student" | "admin" | "staff";
};

export type MessageItem = {
  id: string;
  conversationId?: string;
  senderId: string | number;
  senderName: string;
  senderRole?: "buyer" | "seller";
  content: string;
  sentAt: number | string;
  isRead: boolean;
  readAt?: string | null;
};

export type Conversation = {
  id: string;
  listingId: string | number;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  listingStatus: ListingStatus;
  buyerId: string | number;
  buyerName: string;
  buyerSchool: string;
  sellerId: string | number;
  sellerName: string;
  sellerSchool: string;
  lastMessage: string;
  updatedAt: number | string;
  unreadCount?: number;
  messages: MessageItem[];
};

export type ReviewItem = {
  id: string;
  reviewerId: string | number;
  reviewerName: string;
  targetUserId: string | number;
  targetUserName: string;
  targetRole: "Người bán" | "Người mua";
  listingId?: string | number | null;
  listingTitle: string;
  rating: number; // 1 to 5 stars
  content: string;
  createdAt: number | string;
};

export type ViewHistoryItem = {
  listingId: string | number;
  title: string;
  price: number;
  image: string;
  seller: string;
  school: string;
  viewedAt: number | string;
};
