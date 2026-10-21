"use client";

import Link from "@/components/TransitionLink";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/storage";
import { dashboardMoney } from "@/lib/admin-dashboard";
import AdminChatPanel from "@/components/AdminChatPanel";
import AdminReportsPanel from "@/components/AdminReportsPanel";
import AdminAiModerationPanel from "@/components/AdminAiModerationPanel";
import AdminSePayPanel from "@/components/AdminSePayPanel";
import NotificationBell from "@/components/NotificationBell";
import SupportTickets from '@/components/SupportTickets';
import AdminOverview, { type AdminTab, type DashboardSource, type DashboardSources } from "@/components/AdminOverview";
import FigmaIcon, { type FigmaIconName } from "@/components/FigmaIcon";

type Status = "pending_review" | "pending_email" | "verified" | "locked";
type Student = {
  id: number;
  fullName: string;
  email: string;
  studentId: string;
  university: string;
  status: Status;
  hasCard: boolean;
  createdAt: number;
  verifiedAt: number | null;
};
type Counts = {
  total: number;
  pendingReview: number;
  pendingEmail: number;
  verified: number;
  locked: number;
};

type ModerationListing = {
  id: string;
  title: string;
  price: number;
  status: string;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  condition: string;
  location: string;
  description: string;
  sellerName: string;
  sellerEmail: string;
  sellerSchool: string;
  image: string;
  rejectionReason?: string | null;
  createdAt: string;
  ai?: { decision: string; confidence: number | null; reason: string; imagesChecked: number } | null;
};

type RevenueData = {
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  paidOrdersCount: number;
  activePromotionsCount: number;
  expiredPromotionsCount: number;
  packagesBreakdown: {
    packageId: number;
    packageName: string;
    packagePrice: number;
    ordersCount: number;
    totalRevenue: number;
  }[];
};

type AdminPromotion = {
  id: string;
  listingId: string;
  listingTitle: string;
  userName: string;
  userEmail: string;
  packageName: string;
  durationHours: number;
  price: number;
  status: "ACTIVE" | "PENDING" | "EXPIRED" | "CANCELLED";
  paymentStatus: "PAID" | "PENDING" | "FAILED";
  transactionId: string;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
};

type StaffMember = {
  id: number;
  fullName: string;
  email: string;
  username: string;
  role: string;
  status: string;
  createdAt: number;
};

type AuditLogItem = {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  description: string;
  createdAt: string;
};

type PackageItem = {
  id: number;
  name: string;
  description: string;
  durationHours: number;
  price: number;
  priority: number;
  isActive: boolean;
  totalOrders?: number;
  totalRevenue?: number;
};

const statusLabels: Record<Status, string> = {
  pending_review: "Chờ duyệt ảnh thẻ",
  pending_email: "Chờ email · tự duyệt",
  verified: "Đã xác minh",
  locked: "Đã khóa",
};

function formatAccountDate(value: number | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";
}

export default function AdminDashboard({
  adminName,
  initialTab = "OVERVIEW",
  role = "admin",
}: {
  adminName: string;
  role?: "admin" | "staff";
  initialTab?: AdminTab;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>(role === "staff" ? "MODERATION" : initialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sources, setSources] = useState<DashboardSources>({ accounts: "loading", listings: "loading", revenue: "loading", audit: "loading", reports: "loading" });
  const markSource = useCallback((source: DashboardSource, status: DashboardSources[DashboardSource]) => {
    setSources(current => ({ ...current, [source]: status }));
  }, []);
  const [chatRefreshSignal, setChatRefreshSignal] = useState(0);
  const [reportRefreshSignal, setReportRefreshSignal] = useState(0);
  const [reportPendingCount, setReportPendingCount] = useState(0);
  const [chatFocusId, setChatFocusId] = useState<string | null>(null);

  // Tab 1: Moderation State
  const [modListings, setModListings] = useState<ModerationListing[]>([]);
  const [modFilter, setModFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [modQuery, setModQuery] = useState("");
  const [modBusyId, setModBusyId] = useState<string | null>(null);

  // Reject Reason Modal
  const [rejectingItem, setRejectingItem] = useState<ModerationListing | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Tab 2: Revenue State
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [, setPromotions] = useState<AdminPromotion[]>([]);

  // Tab 3: Packages Management State
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [showPkgModal, setShowPkgModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<PackageItem | null>(null);
  const [pkgError, setPkgError] = useState("");
  const [pkgActionBusyId, setPkgActionBusyId] = useState<number | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: "", description: "", durationHours: 24, price: 19000, priority: 1 });
  const [pkgBusy, setPkgBusy] = useState(false);

  // Tab 4: Staff State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: "", username: "", email: "", password: "", confirmPassword: "" });
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffActionBusyId, setStaffActionBusyId] = useState<number | null>(null);

  // Tab 5: Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Tab 6: Accounts State
  const [students, setStudents] = useState<Student[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, pendingReview: 0, pendingEmail: 0, verified: 0, locked: 0 });
  const [filter, setFilter] = useState<Status | "all">("pending_review");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [cardLoadError, setCardLoadError] = useState(false);
  const accountDialogCloseRef = useRef<HTMLButtonElement>(null);

  // Common State
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Loaders
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/accounts", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.push("/?auth=login&admin=1");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStudents(data.accounts || []);
      setCounts(data.counts || { total: 0, pendingReview: 0, pendingEmail: 0, verified: 0, locked: 0 });
      markSource("accounts", "ready");
    } catch (err) {
      markSource("accounts", "error");
      setError((err instanceof Error ? err.message : "") || "Lỗi tải tài khoản");
    }
  }, [router, markSource]);

  const loadModeration = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/moderation?status=ALL", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải tin đăng.");
      setModListings(data.listings || []);
      markSource("listings", "ready");
    } catch {
      markSource("listings", "error");
      setError("Không thể tải dữ liệu tin đăng. Vui lòng làm mới để thử lại.");
    }
  }, [markSource]);

  const loadRevenue = useCallback(async () => {
    try {
      const [revRes, promoRes] = await Promise.all([
        fetch("/api/admin/revenue", { cache: "no-store" }),
        fetch("/api/admin/promotions", { cache: "no-store" }),
      ]);
      if (!revRes.ok) throw new Error("Không thể tải doanh thu.");
      setRevenueData(await revRes.json());
      markSource("revenue", "ready");
      if (promoRes.ok) {
        const pData = await promoRes.json();
        setPromotions(pData.promotions || []);
      }
    } catch {
      markSource("revenue", "error");
      setError("Không thể tải dữ liệu doanh thu. Vui lòng làm mới để thử lại.");
    }
  }, [markSource]);

  const loadPackages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/promotion-packages", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages || []);
      }
    } catch {}
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
      }
    } catch {}
  }, []);

  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audit-logs", { cache: "no-store" });
      if (!res.ok) throw new Error("Không thể tải lịch sử.");
      const data = await res.json();
      setAuditLogs(data.auditLogs || []);
      markSource("audit", "ready");
    } catch { markSource("audit", "error"); }
  }, [markSource]);

  const loadReportCount = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/reports?status=PENDING&page=1", { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể tải báo cáo.");
      setReportPendingCount((await response.json()).total || 0);
      markSource("reports", "ready");
    } catch { markSource("reports", "error"); }
  }, [markSource]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    setSources({ accounts: "loading", listings: "loading", revenue: "loading", audit: "loading", reports: "loading" });
    setChatRefreshSignal(value => value + 1);
    setReportRefreshSignal(value => value + 1);
    if (role === "staff") { await loadModeration(); setLastUpdated(new Date()); setLoading(false); return; }
    await Promise.all([
      loadAccounts(),
      loadModeration(),
      loadRevenue(),
      loadPackages(),
      loadStaff(),
      loadAuditLogs(),
      loadReportCount(),
    ]);
    setLastUpdated(new Date());
    setLoading(false);
  }, [role, loadAccounts, loadModeration, loadRevenue, loadPackages, loadStaff, loadAuditLogs, loadReportCount]);

  useEffect(() => {
    void Promise.resolve().then(refreshAll);
  }, [refreshAll]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") || []);
    focusable()[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [menuOpen]);

  useEffect(() => {
    if (selectedStudentId === null) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    accountDialogCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedStudentId(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [selectedStudentId]);

  // Tab 1: Moderation Actions
  const visibleListings = useMemo(() => modListings.filter(item => {
    if (modFilter !== "ALL" && item.moderationStatus !== modFilter) return false;
    const term = modQuery.trim().toLocaleLowerCase("vi-VN");
    return !term || `${item.title} ${item.sellerName} ${item.sellerSchool} ${item.location}`.toLocaleLowerCase("vi-VN").includes(term);
  }), [modListings, modFilter, modQuery]);

  const modCounts = useMemo(() => ({
    all: modListings.length,
    pending: modListings.filter(i => i.moderationStatus === "PENDING").length,
    approved: modListings.filter(i => i.moderationStatus === "APPROVED").length,
    rejected: modListings.filter(i => i.moderationStatus === "REJECTED").length,
  }), [modListings]);

  async function handleApproveListing(id: string) {
    setModBusyId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/listings/${id}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể duyệt tin.");
      setMessage("✓ Đã duyệt tin đăng công khai!");
      await loadModeration();
    } catch (e) {
      setError((e instanceof Error ? e.message : "") || "Lỗi kiểm duyệt.");
    } finally {
      setModBusyId(null);
    }
  }

  async function handleConfirmReject() {
    if (!rejectingItem) return;
    if (!rejectReason.trim()) {
      setRejectError("Vui lòng nhập lý do từ chối duyệt tin (bắt buộc).");
      return;
    }
    setModBusyId(rejectingItem.id);
    setRejectError("");
    try {
      const res = await fetch(`/api/admin/listings/${rejectingItem.id}/moderate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          rejectionReason: rejectReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể từ chối tin.");
      setMessage(`Đã từ chối tin đăng "${rejectingItem.title}".`);
      setRejectingItem(null);
      setRejectReason("");
      await loadModeration();
      await loadRevenue();
    } catch (e) {
      setRejectError((e instanceof Error ? e.message : "") || "Lỗi khi từ chối tin.");
    } finally {
      setModBusyId(null);
    }
  }

  // Tab 3: Package Actions
  function openPackageEditor(pkg?: PackageItem) {
    setEditingPackage(pkg || null);
    setPkgForm(pkg ? { name: pkg.name, description: pkg.description || "", durationHours: pkg.durationHours, price: pkg.price, priority: pkg.priority } : { name: "", description: "", durationHours: 24, price: 19000, priority: 1 });
    setPkgError(""); setShowPkgModal(true);
  }
  async function handleSavePackage(e: FormEvent) {
    e.preventDefault();
    if (pkgBusy) return;
    setPkgBusy(true);
    setPkgError(""); setError(""); setMessage("");
    try {
      const res = await fetch(editingPackage ? `/api/admin/promotion-packages/${editingPackage.id}` : "/api/admin/promotion-packages", {
        method: editingPackage ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pkgForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể lưu gói dịch vụ.");
      setMessage(editingPackage ? "Đã cập nhật gói dịch vụ. Các đơn đã mua giữ nguyên quyền lợi." : "Tạo gói đẩy tin mới thành công!");
      setShowPkgModal(false);
      setEditingPackage(null);
      setPkgForm({ name: "", description: "", durationHours: 24, price: 19000, priority: 1 });
      await Promise.all([loadPackages(), loadRevenue(), loadAuditLogs()]);
    } catch (e) {
      setPkgError((e instanceof Error ? e.message : "") || "Không thể lưu gói dịch vụ.");
    } finally {
      setPkgBusy(false);
    }
  }

  async function handleTogglePackage(pkgId: number, currentlyActive: boolean) {
    if (pkgActionBusyId !== null) return;
    setPkgActionBusyId(pkgId); setError(""); setMessage("");
    const action = currentlyActive ? "deactivate" : "activate";
    try {
      const res = await fetch(`/api/admin/promotion-packages/${pkgId}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.message || "Cập nhật trạng thái gói thành công.");
      await loadPackages();
    } catch (e) {
      setError((e instanceof Error ? e.message : "") || "Lỗi thao tác.");
    } finally { setPkgActionBusyId(null); }
  }

  async function handleDeletePackage() {
    if (!deletingPackage || pkgActionBusyId !== null) return;
    setPkgActionBusyId(deletingPackage.id); setPkgError(""); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/promotion-packages/${deletingPackage.id}`, { method: "DELETE" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Không thể xóa gói dịch vụ.");
      setDeletingPackage(null); setMessage(value.message);
      await Promise.all([loadPackages(), loadRevenue(), loadAuditLogs()]);
    } catch (e) {
      setPkgError(e instanceof Error ? e.message : "Không thể xóa gói dịch vụ.");
    } finally {
      setPkgActionBusyId(null);
    }
  }

  // Tab 4: Staff Actions
  async function handleCreateStaff(e: FormEvent) {
    e.preventDefault();
    setStaffBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staffForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tạo nhân viên.");
      setMessage("Tạo tài khoản nhân viên thành công!");
      setShowStaffModal(false);
      setStaffForm({ fullName: "", username: "", email: "", password: "", confirmPassword: "" });
      await loadStaff();
    } catch (e) {
      setError((e instanceof Error ? e.message : "") || "Lỗi tạo nhân viên.");
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleToggleStaffLock(staff: StaffMember) {
    const action = staff.status === "locked" ? "unlock" : "lock";
    const label = action === "lock" ? "khóa" : "mở khóa";
    if (action === "lock" && !window.confirm(`Khóa tài khoản nhân viên ${staff.fullName}? Nhân viên sẽ bị đăng xuất ngay lập tức.`)) {
      return;
    }
    setStaffActionBusyId(staff.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Không thể ${label} nhân viên.`);
      setMessage(`Đã ${label} tài khoản nhân viên ${staff.fullName}.`);
      await loadStaff();
    } catch (e) {
      setError((e instanceof Error ? e.message : "") || `Lỗi khi ${label} nhân viên.`);
    } finally {
      setStaffActionBusyId(null);
    }
  }

  // Tab 6: Students Actions
  const visibleStudents = useMemo(() => students.filter(student => {
    if (filter !== "all" && student.status !== filter) return false;
    const term = query.trim().toLocaleLowerCase("vi-VN");
    return !term || `${student.fullName} ${student.email} ${student.studentId} ${student.university}`.toLocaleLowerCase("vi-VN").includes(term);
  }), [students, filter, query]);
  const selectedStudent = students.find(student => student.id === selectedStudentId);

  async function actionStudent(student: Student, kind: "approve" | "lock") {
    if (kind === "lock" && !window.confirm(`Khóa tài khoản sinh viên ${student.fullName}?`)) return;
    setBusyId(student.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/accounts/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thực hiện được thao tác.");
      setMessage(kind === "approve" ? `Đã duyệt ${student.fullName}.` : `Đã khóa ${student.fullName}.`);
      await loadAccounts();
    } catch (cause) {
      setError((cause instanceof Error ? cause.message : "") || "Lỗi thao tác.");
    } finally {
      setBusyId(null);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword"),
          confirmPassword: data.get("confirmPassword"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không đổi được mật khẩu.");
      form.reset();
      setShowPassword(false);
      setMessage(result.message);
    } catch (cause) {
      setError((cause instanceof Error ? cause.message : "") || "Lỗi đổi mật khẩu.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const navigation = ([
    { key: "OVERVIEW", label: "Tổng quan", icon: "grid" },
    { key: "MODERATION", label: "Kiểm duyệt tin", icon: "shield", count: sources.listings === "ready" ? modCounts.pending : undefined },
    { key: "ACCOUNTS", label: "Tài khoản sinh viên", icon: "graduation", count: sources.accounts === "ready" ? counts.pendingReview : undefined },
    { key: "REPORTS", label: "Báo cáo vi phạm", icon: "alert", count: sources.reports === "ready" ? reportPendingCount : undefined },
    { key: "SUPPORT", label: "Phiếu hỗ trợ", icon: "chat" },
    { key: "CHATS", label: "Hội thoại", icon: "chat" },
    { key: "REVENUE", label: "Doanh thu & đẩy tin", icon: "money" },
    { key: "PACKAGES", label: "Gói dịch vụ", icon: "gift" },
    { key: "STAFF", label: "Nhân viên", icon: "school" },
    { key: "AUDIT", label: "Nhật ký hoạt động", icon: "book" },
  ] satisfies { key: AdminTab; label: string; icon: FigmaIconName; count?: number }[]).filter(item => role === "admin" || item.key === "MODERATION");
  const titles: Record<AdminTab, { title: string; description: string }> = {
    OVERVIEW: { title: "Admin Dashboard", description: `Xin chào ${adminName}, đây là tổng quan hoạt động của SangTay.` },
    MODERATION: { title: "Kiểm duyệt tin đăng", description: "Kiểm tra nội dung trước khi cho phép hiển thị công khai trên sàn." },
    ACCOUNTS: { title: "Tài khoản sinh viên", description: "Xác minh hồ sơ, duyệt ảnh thẻ và quản lý trạng thái tài khoản." },
    REPORTS: { title: "Báo cáo vi phạm", description: "Xem bằng chứng, xử lý vi phạm và bảo vệ cộng đồng sinh viên." },
    SUPPORT: { title: "Trung tâm hỗ trợ", description: "Theo dõi yêu cầu, phản hồi sinh viên và cập nhật tiến độ xử lý." },
    CHATS: { title: "Quản lý hội thoại", description: "Tra cứu trò chuyện giữa người mua và người bán." },
    REVENUE: { title: "Doanh thu & đẩy tin", description: "Theo dõi các đơn đã thanh toán và hiệu quả gói đẩy tin." },
    PACKAGES: { title: "Gói dịch vụ đẩy tin", description: "Quản lý giá, thời hạn và độ ưu tiên hiển thị." },
    STAFF: { title: "Quản lý nhân viên", description: "Quản lý tài khoản nhân viên và quyền kiểm duyệt." },
    AUDIT: { title: "Nhật ký hoạt động", description: "Tra cứu lịch sử các thao tác quản trị trên hệ thống." },
  };
  function navigate(tab: AdminTab) {
    if (role === "staff" && tab !== "MODERATION") return;
    if (tab === "MODERATION") { setModFilter("PENDING"); setModQuery(""); }
    if (tab === "ACCOUNTS") { setFilter("pending_review"); setQuery(""); }
    if (tab === "CHATS") setChatFocusId(null);
    if (tab === 'SUPPORT') window.history.replaceState(window.history.state,'','/admin?tab=SUPPORT');
    else if(activeTab==='SUPPORT') window.history.replaceState(window.history.state,'','/admin');
    setActiveTab(tab);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div className="admin-shell dashboard-shell">
      <a className="dashboard-skip" href="#admin-content">Bỏ qua điều hướng</a>
      {menuOpen && <button className="dashboard-menu-backdrop" aria-label="Đóng menu quản trị" type="button" onClick={() => setMenuOpen(false)} />}
      <aside ref={sidebarRef} className={`dashboard-sidebar ${menuOpen ? "is-open" : ""}`} id="admin-sidebar" aria-label="Thanh bên quản trị">
        <div className="dashboard-brand-row"><Link className="admin-brand" href="/"><span className="dashboard-brand-mark" aria-hidden="true">s</span>sang<span>tay</span><b>.</b></Link><button className="dashboard-drawer-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu quản trị"><FigmaIcon name="close" size={20} /></button></div>
        <span className="dashboard-workspace-label">{role === "admin" ? "ADMIN WORKSPACE" : "STAFF WORKSPACE"}</span>
        <div className="dashboard-nav-label">ĐIỀU HÀNH</div>
        <nav className="dashboard-nav" aria-label="Điều hướng quản trị">
          {navigation.map(item => <button key={item.key} type="button" className={activeTab === item.key ? "active" : ""} aria-current={activeTab === item.key ? "page" : undefined} onClick={() => navigate(item.key)}><FigmaIcon name={item.icon} size={19} /><span>{item.label}</span>{Boolean(item.count) && <b>{item.count}</b>}</button>)}
        </nav>
        <div className="dashboard-sidebar-bottom">
          <Link href="/explore" className="dashboard-return"><FigmaIcon name="arrowUp" size={18} /> Xem trang bán hàng</Link>
          <a href="#admin-security" className="dashboard-return" onClick={() => setMenuOpen(false)}><FigmaIcon name="shield" size={18} /> Đổi mật khẩu</a>
          <div className="dashboard-profile"><span className="dashboard-avatar">{adminName.trim().slice(0, 1).toLocaleUpperCase("vi-VN") || "A"}</span><div><strong>{adminName}</strong><small>{role === "admin" ? "Quản trị viên" : "Nhân viên kiểm duyệt"}</small></div><button type="button" onClick={logout} aria-label="Đăng xuất" title="Đăng xuất"><FigmaIcon name="login" size={19} /></button></div>
        </div>
      </aside>
      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <button className="dashboard-menu-toggle" type="button" aria-label={menuOpen ? "Đóng menu quản trị" : "Mở menu quản trị"} aria-expanded={menuOpen} aria-controls="admin-sidebar" onClick={() => setMenuOpen(value => !value)}><FigmaIcon name="grid" size={21} /></button>
          <div className="dashboard-breadcrumb"><span>Quản trị</span><span aria-hidden="true">/</span><strong>{navigation.find(item => item.key === activeTab)?.label}</strong></div>
          <div className="dashboard-topbar-right"><NotificationBell onNavigate={href => { if(href.includes('tab=SUPPORT')){window.location.assign(href);return;} if (href.includes("tab=ACCOUNTS")) navigate("ACCOUNTS"); else if (href.includes("tab=REPORTS")) navigate("REPORTS"); else navigate("MODERATION"); }} /><span className="dashboard-role-badge"><i />{role === "admin" ? "Quản trị viên" : "Nhân viên"}</span><span className="dashboard-avatar small">{adminName.trim().slice(0, 1).toLocaleUpperCase("vi-VN") || "A"}</span></div>
        </header>
        <main className="admin-container dashboard-main" id="admin-content" tabIndex={-1}>
          <div className="admin-heading dashboard-heading">
            <div><span className="admin-kicker">{activeTab === "OVERVIEW" ? `CHÀO MỪNG TRỞ LẠI, ${adminName || "QUẢN TRỊ VIÊN"}` : "SANGTAY · TRUNG TÂM QUẢN TRỊ"}</span><h1>{titles[activeTab].title}</h1><p>{titles[activeTab].description}</p></div>
            <div className="dashboard-refresh-group"><button className="admin-refresh" type="button" disabled={loading} onClick={() => void refreshAll()}><FigmaIcon name="refresh" size={16} />{loading ? "Đang tải…" : "Làm mới"}</button><small>{lastUpdated ? `Kiểm tra lúc ${lastUpdated.toLocaleTimeString("vi-VN", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}` : "Đang lấy dữ liệu"}</small></div>
          </div>
          {activeTab === "OVERVIEW" && role === "admin" && <AdminOverview listings={modListings} counts={counts} moderation={modCounts} revenue={revenueData} reports={reportPendingCount} logs={auditLogs} sources={sources} onNavigate={navigate} />}

        {message && <div className="admin-message" role="status"><span>✓</span> {message}</div>}
        {error && <div className="admin-error" role="alert"><span>✕</span> {error}</div>}

        {/* TAB 1: MODERATION */}
        {role === "admin" && <AdminAiModerationPanel visible={activeTab === "MODERATION"} onRefresh={loadModeration} />}
        {activeTab === "MODERATION" && (
          <div>
            <div className="admin-stats">
              <div><span>Chờ duyệt</span><strong style={{ color: "#b45309" }}>{modCounts.pending}</strong></div>
              <div><span>Đã duyệt công khai</span><strong style={{ color: "#166534" }}>{modCounts.approved}</strong></div>
              <div><span>Đã từ chối</span><strong style={{ color: "#991b1b" }}>{modCounts.rejected}</strong></div>
              <div><span>Tổng tin</span><strong>{modCounts.all}</strong></div>
            </div>

            <section className="admin-panel">
              <div className="admin-panel-head">
                <div>
                  <h2>Danh sách tin đăng kiểm duyệt</h2>
                  <p>Mỗi thao tác duyệt hoặc từ chối đều được ghi vào Audit Log an toàn.</p>
                </div>
                <input
                  aria-label="Tìm tin đăng"
                  type="search"
                  value={modQuery}
                  onChange={e => setModQuery(e.target.value)}
                  placeholder="Tìm tiêu đề, người bán, trường..."
                />
              </div>

              <div className="admin-filters">
                {(["PENDING", "ALL", "APPROVED", "REJECTED"] as const).map(value => (
                  <button
                    key={value}
                    className={modFilter === value ? "active" : ""}
                    onClick={() => setModFilter(value)}
                  >
                    {value === "ALL" && `Tất cả (${modCounts.all})`}
                    {value === "PENDING" && `⏳ Chờ duyệt (${modCounts.pending})`}
                    {value === "APPROVED" && `✓ Đã duyệt (${modCounts.approved})`}
                    {value === "REJECTED" && `❌ Bị từ chối (${modCounts.rejected})`}
                  </button>
                ))}
              </div>

              {loading ? (
                <p className="admin-empty">Đang tải danh sách tin...</p>
              ) : visibleListings.length === 0 ? (
                <p className="admin-empty">Không có tin đăng nào phù hợp.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th>Giá bán</th>
                        <th>Người đăng</th>
                        <th>Trạng thái</th>
                        <th>Lý do từ chối</th>
                        <th>Đánh giá AI</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleListings.map(item => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <img src={item.image} alt={item.title} style={{ width: "48px", height: "40px", objectFit: "cover", borderRadius: "6px" }} />
                              <div>
                                <strong>{item.title}</strong>
                                <small style={{ maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: "var(--green)" }}>{formatPrice(item.price)}</strong>
                            <small>{item.condition}</small>
                          </td>
                          <td>
                            <strong>{item.sellerName}</strong>
                            <small>{item.sellerSchool}</small>
                          </td>
                          <td>
                            {item.moderationStatus === "PENDING" && <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>⏳ Chờ duyệt</span>}
                            {item.moderationStatus === "APPROVED" && <span style={{ background: "#d1fae5", color: "#065f46", padding: "3px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>✓ Đã duyệt</span>}
                            {item.moderationStatus === "REJECTED" && <span style={{ background: "#fee2e2", color: "#991b1b", padding: "3px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>❌ Bị từ chối</span>}
                          </td>
                          <td>
                            <small style={{ color: "#991b1b" }}>{item.rejectionReason || "—"}</small>
                          </td>
                          <td className="admin-ai-cell">{item.ai ? <><strong>{item.ai.decision === "APPROVED" ? "AI đã duyệt" : item.ai.decision === "PROCESSING" ? "Đang phân tích" : "Cần Admin kiểm tra"}</strong><small>{item.ai.reason || "Đang kiểm tra nội dung và ảnh…"}</small>{item.ai.confidence != null && <small>Mức tự tin AI: {Math.round(item.ai.confidence * 100)}%</small>}</> : <small>Chưa được AI kiểm tra</small>}</td>
                          <td>
                            <div className="admin-actions">
                              <Link href={`/listing/${item.id}`} target="_blank" rel="noopener noreferrer">Xem</Link>
                              {item.moderationStatus !== "APPROVED" && (
                                <button
                                  className="approve"
                                  disabled={modBusyId === item.id}
                                  onClick={() => handleApproveListing(item.id)}
                                >
                                  {modBusyId === item.id ? "Đang xử lý..." : "✓ Duyệt"}
                                </button>
                              )}
                              {item.moderationStatus !== "REJECTED" && (
                                <button
                                  className="lock"
                                  disabled={modBusyId === item.id}
                                  onClick={() => {
                                    setRejectingItem(item);
                                    setRejectReason("");
                                    setRejectError("");
                                  }}
                                >
                                  ✕ Từ chối
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: REVENUE */}
        {activeTab === "REVENUE" && (
          <div>
            <AdminSePayPanel onApproved={loadRevenue} />
            <div className="admin-stats">
              <div><span>Tổng doanh thu (PAID)</span><strong style={{ color: "#ea580c" }}>{dashboardMoney(revenueData?.totalRevenue || 0)}</strong></div>
              <div><span>Doanh thu hôm nay</span><strong style={{ color: "#166534" }}>{dashboardMoney(revenueData?.todayRevenue || 0)}</strong></div>
              <div><span>Doanh thu tháng</span><strong>{dashboardMoney(revenueData?.monthRevenue || 0)}</strong></div>
              <div><span>Đơn thành công</span><strong style={{ color: "#2563eb" }}>{revenueData?.paidOrdersCount || 0}</strong></div>
            </div>

            <section className="admin-panel" style={{ marginBottom: "24px" }}>
              <div className="admin-panel-head">
                <div><h2>Doanh thu theo từng gói</h2><p>Chỉ tính các giao dịch thanh toán thành công (PAID).</p></div>
              </div>
              <div className="dashboard-package-grid">
                {(revenueData?.packagesBreakdown || []).map(pkg => (
                  <div key={pkg.packageId} style={{ background: "#f8faf6", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#1f2937" }}>{pkg.packageName}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", margin: "4px 0 12px" }}>Giá: {formatPrice(pkg.packagePrice)}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: "11px", color: "#4b5563" }}>Đã bán: <strong>{pkg.ordersCount}</strong></span>
                      <span style={{ fontSize: "16px", fontWeight: 800, color: "#ea580c" }}>{dashboardMoney(pkg.totalRevenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: PACKAGES */}
        {activeTab === "PACKAGES" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => openPackageEditor()}
                disabled={pkgActionBusyId !== null}
                style={{ padding: "10px 18px", borderRadius: "8px", border: 0, background: "var(--green)", color: "#ffffff", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
              >
                + Thêm gói đẩy tin mới
              </button>
            </div>

            <section className="admin-panel">
              <div className="admin-panel-head">
                <div><h2>Cấu hình các gói dịch vụ đẩy tin</h2><p>Các gói đẩy tin được lưu trong cơ sở dữ liệu và hiển thị trực tiếp cho người dùng.</p></div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Tên gói</th><th>Thời hạn</th><th>Giá niêm yết</th><th>Priority</th><th>Trạng thái</th><th>Thao tác</th></tr>
                  </thead>
                  <tbody>
                    {!packages.length && <tr><td colSpan={6}>Chưa có gói dịch vụ. Chọn “Thêm gói đẩy tin mới” để tạo gói.</td></tr>}
                    {packages.map(pkg => (
                      <tr key={pkg.id}>
                        <td><strong>{pkg.name}</strong><small>{pkg.description}</small></td>
                        <td>{pkg.durationHours >= 24 ? `${pkg.durationHours / 24} ngày (${pkg.durationHours}h)` : `${pkg.durationHours}h`}</td>
                        <td><strong style={{ color: "#ea580c" }}>{formatPrice(pkg.price)}</strong></td>
                        <td>Cấp {pkg.priority}</td>
                        <td>
                          {pkg.isActive ? (
                            <span style={{ background: "#d1fae5", color: "#065f46", padding: "3px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>Hoạt động</span>
                          ) : (
                            <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "3px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>Đã ẩn</span>
                          )}
                        </td>
                        <td>
                          <div className="admin-actions">
                          <button type="button" disabled={pkgActionBusyId !== null} onClick={() => openPackageEditor(pkg)}>Sửa</button>
                          <button
                            type="button"
                            disabled={pkgActionBusyId !== null}
                            onClick={() => handleTogglePackage(pkg.id, pkg.isActive)}
                            style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db", background: "#ffffff", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                          >
                            {pkgActionBusyId === pkg.id ? "Đang xử lý…" : pkg.isActive ? "Ẩn gói" : "Kích hoạt"}
                          </button>
                          <button type="button" className="lock" disabled={pkgActionBusyId !== null} onClick={() => { setDeletingPackage(pkg); setPkgError(""); }}>Xóa</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: STAFF */}
        {activeTab === "STAFF" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setShowStaffModal(true)}
                style={{ padding: "10px 18px", borderRadius: "8px", border: 0, background: "var(--green)", color: "#ffffff", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
              >
                + Thêm nhân viên
              </button>
            </div>

            <section className="admin-panel">
              <div className="admin-panel-head">
                <div><h2>Danh sách nhân viên (STAFF)</h2><p>Chỉ tài khoản ADMIN mới có quyền tạo, quản lý và khóa tài khoản nhân viên.</p></div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Họ tên</th><th>Email</th><th>Username</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr>
                  </thead>
                  <tbody>
                    {staffList.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#6b7280" }}>Chưa có nhân viên nào. Bấm nút “+ Thêm nhân viên” để tạo.</td></tr>
                    ) : (
                      staffList.map(s => (
                        <tr key={s.id}>
                          <td><strong>{s.fullName}</strong></td>
                          <td>{s.email}</td>
                          <td><code>{s.username}</code></td>
                          <td><span style={{ background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>STAFF</span></td>
                          <td>
                            {s.status === "verified" ? (
                              <span style={{ background: "#d1fae5", color: "#065f46", padding: "3px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>Hoạt động</span>
                            ) : (
                              <span style={{ background: "#fee2e2", color: "#991b1b", padding: "3px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>Đã khóa</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              disabled={staffActionBusyId === s.id}
                              onClick={() => handleToggleStaffLock(s)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: s.status === "locked" ? "1px solid #16a34a" : "1px solid #dc2626",
                                background: "#ffffff",
                                color: s.status === "locked" ? "#16a34a" : "#dc2626",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {s.status === "locked" ? "Mở khóa" : "Khóa tài khoản"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === "AUDIT" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div><h2>Nhật ký kiểm toán hệ thống (Audit Logs)</h2><p>Ghi lại mọi hành vi quan trọng: duyệt tin, từ chối tin, tạo nhân viên, sửa giá gói.</p></div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết mô tả</th></tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "#6b7280" }}>Chưa có nhật ký nào được ghi lại.</td></tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id}>
                        <td><small>{new Date(log.createdAt).toLocaleString("vi-VN")}</small></td>
                        <td>
                          <strong>{log.actorName}</strong>
                          <small>{log.actorRole} · {log.actorEmail}</small>
                        </td>
                        <td><code>{log.action}</code></td>
                        <td><small>{log.targetType} #{log.targetId}</small></td>
                        <td>{log.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 6: ACCOUNTS */}
        {activeTab === "ACCOUNTS" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div><h2>Tài khoản sinh viên</h2><p>Email .edu/.edu.vn được tự duyệt sau khi xác minh email; tài khoản khác cần kiểm tra ảnh thẻ.</p></div>
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, email..." />
            </div>
            <div className="admin-filters">
              {(["pending_review", "all", "pending_email", "verified", "locked"] as const).map(value => (
                <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                  {value === "all" ? "Tất cả" : statusLabels[value]}
                </button>
              ))}
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Sinh viên</th><th>Trường · Mã SV</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {visibleStudents.map(student => (
                    <tr key={student.id}>
                      <td><strong>{student.fullName}</strong><small>{student.email}</small></td>
                      <td><strong>{student.studentId}</strong><small>{student.university}</small></td>
                      <td><span className={`admin-status ${student.status}`}>{statusLabels[student.status]}</span></td>
                      <td>
                        <div className="admin-actions">
                          <button type="button" onClick={() => { setCardLoadError(false); setSelectedStudentId(student.id); }}>Xem chi tiết</button>
                          {student.status === "pending_review" && (
                            <button className="approve" disabled={busyId === student.id} onClick={() => actionStudent(student, "approve")}>Duyệt</button>
                          )}
                          {student.status !== "locked" && (
                            <button className="lock" disabled={busyId === student.id} onClick={() => actionStudent(student, "lock")}>Khóa</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "CHATS" && <AdminChatPanel refreshSignal={chatRefreshSignal} initialConversationId={chatFocusId} />}
        {activeTab === "REPORTS" && <AdminReportsPanel refreshSignal={reportRefreshSignal} onOpenChat={conversationId => { setChatFocusId(conversationId); setActiveTab("CHATS"); }} onReviewed={() => void loadReportCount()} />}
        {activeTab === 'SUPPORT' && role==='admin' && <SupportTickets admin refreshSignal={reportRefreshSignal}/>}

        {selectedStudent && (
          <div className="admin-account-overlay" onClick={event => {
            if (event.target === event.currentTarget) setSelectedStudentId(null);
          }}>
            <div className="admin-account-dialog" role="dialog" aria-modal="true" aria-labelledby="student-detail-title">
              <div className="admin-account-dialog-head">
                <div>
                  <span className="admin-kicker">HỒ SƠ ĐĂNG KÝ</span>
                  <h2 id="student-detail-title">{selectedStudent.fullName}</h2>
                  <span className={`admin-status ${selectedStudent.status}`}>{statusLabels[selectedStudent.status]}</span>
                </div>
                <button ref={accountDialogCloseRef} type="button" className="admin-account-close" aria-label="Đóng chi tiết tài khoản" onClick={() => setSelectedStudentId(null)}>×</button>
              </div>

              <div className="admin-account-dialog-body">
                <dl className="admin-account-details">
                  <div><dt>Họ và tên</dt><dd>{selectedStudent.fullName}</dd></div>
                  <div><dt>Email</dt><dd>{selectedStudent.email}</dd></div>
                  <div><dt>Mã sinh viên</dt><dd>{selectedStudent.studentId || "Chưa cung cấp"}</dd></div>
                  <div><dt>Trường</dt><dd>{selectedStudent.university || "Chưa cung cấp"}</dd></div>
                  <div><dt>Ngày đăng ký</dt><dd>{formatAccountDate(selectedStudent.createdAt)}</dd></div>
                  <div><dt>Ngày xác minh</dt><dd>{formatAccountDate(selectedStudent.verifiedAt)}</dd></div>
                </dl>

                <div className="admin-account-card">
                  <h3>Ảnh thẻ sinh viên đã tải lên</h3>
                  {!selectedStudent.hasCard ? (
                    <p>Tài khoản này chưa tải ảnh thẻ sinh viên.</p>
                  ) : cardLoadError ? (
                    <p role="alert">Không tải được ảnh thẻ. Hãy kiểm tra tệp ảnh trên máy chủ rồi thử làm mới.</p>
                  ) : (
                    <>
                      {/* Authenticated image requests must go directly to the admin-only endpoint. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/accounts/${selectedStudent.id}/card`} alt={`Ảnh thẻ sinh viên của ${selectedStudent.fullName}`} onError={() => setCardLoadError(true)} />
                      <a href={`/api/admin/accounts/${selectedStudent.id}/card`} target="_blank" rel="noopener noreferrer">Mở ảnh kích thước gốc ↗</a>
                    </>
                  )}
                </div>
              </div>

              <div className="admin-account-dialog-actions">
                <button type="button" className="admin-account-dismiss" onClick={() => setSelectedStudentId(null)}>Đóng</button>
                {selectedStudent.status === "pending_review" && selectedStudent.hasCard && (
                  <button type="button" className="admin-account-approve" disabled={busyId === selectedStudent.id || cardLoadError} onClick={() => actionStudent(selectedStudent, "approve")}>Duyệt tài khoản</button>
                )}
                {selectedStudent.status !== "locked" && (
                  <button type="button" className="admin-account-lock" disabled={busyId === selectedStudent.id} onClick={() => actionStudent(selectedStudent, "lock")}>Khóa tài khoản</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE STAFF */}
        {showStaffModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div style={{ background: "#ffffff", borderRadius: "14px", padding: "28px", width: "440px", maxWidth: "90%" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: "18px", color: "#111827" }}>+ Thêm nhân viên (STAFF) mới</h2>
              <form onSubmit={handleCreateStaff} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                  Họ và tên
                  <input
                    type="text"
                    required
                    value={staffForm.fullName}
                    onChange={e => setStaffForm({ ...staffForm, fullName: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                    placeholder="Nguyễn Văn Quản Lý"
                  />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                  Tên đăng nhập (Username)
                  <input
                    type="text"
                    required
                    value={staffForm.username}
                    onChange={e => setStaffForm({ ...staffForm, username: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                    placeholder="staff01"
                  />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                  Email nhân viên
                  <input
                    type="email"
                    required
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                    placeholder="staff01@sangtay.vn"
                  />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                  Mật khẩu
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={staffForm.password}
                    onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                    placeholder="Tối thiểu 8 ký tự"
                  />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                  Xác nhận mật khẩu
                  <input
                    type="password"
                    required
                    value={staffForm.confirmPassword}
                    onChange={e => setStaffForm({ ...staffForm, confirmPassword: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                    placeholder="Nhập lại mật khẩu"
                  />
                </label>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                  <button type="button" onClick={() => setShowStaffModal(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>Hủy</button>
                  <button type="submit" disabled={staffBusy} style={{ padding: "8px 20px", borderRadius: "8px", border: 0, background: "var(--green)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    {staffBusy ? "Đang tạo..." : "Tạo nhân viên"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: REJECT LISTING REASON */}
        {rejectingItem && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div style={{ background: "#ffffff", borderRadius: "14px", padding: "28px", width: "480px", maxWidth: "90%" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: "#dc2626" }}>Từ chối duyệt tin đăng</h2>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6b7280" }}>
                Tin đăng: <strong>{rejectingItem.title}</strong> của {rejectingItem.sellerName}
              </p>

              {rejectError && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: "6px", fontSize: "12px", marginBottom: "12px" }}>{rejectError}</div>}

              <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "6px" }}>
                Lý do từ chối (bắt buộc):
              </label>
              <textarea
                rows={4}
                required
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Hình ảnh mờ, sản phẩm vi phạm danh mục cấm, thông tin giá không đúng thực tế..."
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "13px" }}
              />

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "18px" }}>
                <button type="button" onClick={() => setRejectingItem(null)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button
                  type="button"
                  disabled={modBusyId === rejectingItem.id}
                  onClick={handleConfirmReject}
                  style={{ padding: "8px 22px", borderRadius: "8px", border: 0, background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  {modBusyId === rejectingItem.id ? "Đang xử lý..." : "Xác nhận từ chối"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE OR EDIT PROMOTION PACKAGE */}
        {showPkgModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div role="dialog" aria-modal="true" aria-labelledby="package-editor-title" style={{ background: "#ffffff", borderRadius: "14px", padding: "28px", width: "440px", maxWidth: "90%", maxHeight: "90dvh", overflowY: "auto" }}>
              <h2 id="package-editor-title" style={{ margin: "0 0 16px", fontSize: "18px", color: "#111827" }}>{editingPackage ? "Sửa gói dịch vụ" : "+ Thêm gói đẩy tin mới"}</h2>
              {editingPackage && <p style={{ fontSize: 12, lineHeight: 1.6, color: "#647c70" }}>Thay đổi áp dụng cho đơn mới. Đơn đã tạo và gói đang chạy giữ nguyên giá, thời hạn và độ ưu tiên đã mua.</p>}
              {pkgError && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{pkgError}</p>}
              <form onSubmit={handleSavePackage} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                  Tên gói
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={100}
                    value={pkgForm.name}
                    onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                    placeholder="Ví dụ: Đẩy tin VIP"
                  />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                  Mô tả quyền lợi
                  <input
                    type="text"
                    maxLength={4000}
                    value={pkgForm.description}
                    onChange={e => setPkgForm({ ...pkgForm, description: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                    placeholder="Mô tả ngắn gọn"
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                    Thời hạn (giờ)
                    <input
                      type="number"
                      required
                      min={1}
                      max={8760}
                      step={1}
                      value={pkgForm.durationHours}
                      onChange={e => setPkgForm({ ...pkgForm, durationHours: Number(e.target.value) })}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                    />
                  </label>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                    Giá (VNĐ)
                    <input
                      type="number"
                      required
                      min={1}
                      max={9999999999}
                      step={1}
                      value={pkgForm.price}
                      onChange={e => setPkgForm({ ...pkgForm, price: Number(e.target.value) })}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                    />
                  </label>
                </div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                  Độ ưu tiên hiển thị (Priority cấp 1, 2, 3...)
                  <input
                    type="number"
                    required
                    min={0}
                    max={2147483647}
                    step={1}
                    value={pkgForm.priority}
                    onChange={e => setPkgForm({ ...pkgForm, priority: Number(e.target.value) })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "4px" }}
                  />
                </label>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                  <button type="button" disabled={pkgBusy} onClick={() => setShowPkgModal(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>Hủy</button>
                  <button type="submit" disabled={pkgBusy} style={{ padding: "8px 20px", borderRadius: "8px", border: 0, background: "var(--green)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    {pkgBusy ? "Đang lưu…" : editingPackage ? "Lưu thay đổi" : "Lưu gói"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deletingPackage && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="package-delete-title" style={{ background: "#fffef8", borderRadius: 14, padding: 28, width: 440, maxWidth: "90%" }}>
            <h2 id="package-delete-title" style={{ margin: "0 0 16px", fontSize: 20 }}>Xóa gói “{deletingPackage.name}”?</h2>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "#647c70" }}>Gói sẽ được gỡ khỏi danh sách dịch vụ và khách không thể mua mới. Lịch sử thanh toán, các đơn đã tạo và quyền lợi của khách đã mua vẫn được giữ nguyên.</p>
            {pkgError && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{pkgError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button type="button" autoFocus disabled={pkgActionBusyId !== null} onClick={() => setDeletingPackage(null)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>Hủy</button>
              <button type="button" disabled={pkgActionBusyId !== null} onClick={() => void handleDeletePackage()} style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#b42318", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{pkgActionBusyId !== null ? "Đang xóa…" : "Xóa gói dịch vụ"}</button>
            </div>
          </div>
        </div>}

        {/* SECURITY SETTINGS SECTION */}
        <section className="admin-security" id="admin-security">
          <div>
            <h2>Bảo mật quản trị</h2>
            <p>Đổi mật khẩu tài khoản quản trị viên. Các phiên đăng nhập khác sẽ được bảo vệ.</p>
          </div>
          <button className="admin-change-trigger" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? "Đóng" : "Đổi mật khẩu"}
          </button>
          {showPassword && (
            <form onSubmit={changePassword}>
              <label>Mật khẩu hiện tại<input type="password" name="currentPassword" required /></label>
              <label>Mật khẩu mới<input type="password" name="newPassword" minLength={8} required /></label>
              <label>Xác nhận mật khẩu mới<input type="password" name="confirmPassword" minLength={8} required /></label>
              <button type="submit" disabled={passwordBusy}>{passwordBusy ? "Đang lưu..." : "Lưu mật khẩu"}</button>
            </form>
          )}
        </section>
        </main>
      </div>
    </div>
  );
}
