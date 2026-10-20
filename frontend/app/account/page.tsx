"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "@/components/TransitionLink";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ReviewItem, ViewHistoryItem, Viewer } from "@/lib/types";
import { formatPrice } from "@/lib/storage";
import { reportReasons, reportStatuses } from "@/lib/reporting";

type AccountTab = "profile" | "settings" | "reviews" | "history" | "reports";
type OwnReport = {
  id: string;
  contextType: "LISTING" | "CONVERSATION";
  contextId: string;
  contextTitle: string;
  reason: keyof typeof reportReasons;
  description: string;
  status: keyof typeof reportStatuses;
  reviewNote: string | null;
  reportedName: string;
  createdAt: string;
  reviewedAt: string | null;
};

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as AccountTab) || "profile";

  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings form states
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  // Password form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Reviews & History states
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [history, setHistory] = useState<ViewHistoryItem[]>([]);
  const [reports, setReports] = useState<OwnReport[]>([]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(res => res.json())
      .then(async data => {
        if (!data.user) {
          setViewer(null);
          setLoading(false);
          return;
        }
        const user = data.user as Viewer;
        setViewer(user);
        setFullName(user.fullName);
        setUniversity(user.university);

        try {
          const [revRes, histRes, reportRes] = await Promise.all([
            fetch("/api/reviews", { cache: "no-store" }),
            fetch("/api/history", { cache: "no-store" }),
            user.role === "student" ? fetch("/api/reports", { cache: "no-store" }) : Promise.resolve(null),
          ]);
          if (revRes.ok) {
            const revData = await revRes.json();
            setReviews(revData.reviews || []);
          }
          if (histRes.ok) {
            const histData = await histRes.json();
            setHistory(
              (histData.history || []).map((h: ViewHistoryItem & { productId: string }) => ({
                listingId: h.productId,
                title: h.title,
                price: h.price,
                image: h.image,
                seller: h.seller,
                school: h.school,
                viewedAt: h.viewedAt,
              }))
            );
          }
          if (reportRes?.ok) {
            const reportData = await reportRes.json();
            setReports(reportData.reports || []);
          }
        } catch (e) {
          console.error("Error loading account data:", e);
        }
        setLoading(false);
      })
      .catch(() => {
        setViewer(null);
        setLoading(false);
      });
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileError("");
    setProfileMessage("");

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, university }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể cập nhật thông tin.");
      setViewer(data.user);
      setProfileMessage("Cập nhật thông tin cá nhân thành công!");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setProfileBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordError("");
    setPasswordMessage("");

    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể đổi mật khẩu.");
      setPasswordMessage("Đổi mật khẩu thành công! Bạn có thể dùng mật khẩu mới từ lần đăng nhập sau.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleRemoveHistoryItem = async (listingId: string | number) => {
    try {
      await fetch(`/api/history?productId=${listingId}`, { method: "DELETE" });
      setHistory(prev => prev.filter(item => String(item.listingId) !== String(listingId)));
    } catch (e) {
      console.error("Failed to delete history item:", e);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử xem tin không?")) {
      try {
        await fetch("/api/history", { method: "DELETE" });
        setHistory([]);
      } catch (e) {
        console.error("Failed to clear history:", e);
      }
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/explore");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="site-shell">
        <Navbar />
        <div style={{ textAlign: "center", padding: "100px", color: "#6a7b70" }}>
          Đang tải thông tin tài khoản...
        </div>
        <Footer />
      </div>
    );
  }

  if (!viewer) {
    return (
      <div className="site-shell">
        <Navbar />
        <main>
          <section className="page-header-banner">
            <div className="container">
              <div className="eyebrow"><span className="eyebrow-line" /> TRUNG TÂM TÀI KHOẢN CÁ NHÂN</div>
              <h1>Quản lý tài khoản của bạn</h1>
            </div>
          </section>
          <section className="container" style={{ padding: "60px 0 100px" }}>
            <div className="empty-state">
              <span>🔒</span>
              <h3>Đăng nhập để xem thông tin tài khoản</h3>
              <p>Vui lòng đăng nhập để xem thông tin cá nhân, cài đặt và lịch sử hoạt động.</p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "16px" }}>
                <Link href="/explore?auth=login">
                  <button type="button" style={{ background: "var(--green)", color: "#fff", border: 0, borderRadius: "8px", padding: "12px 24px", fontWeight: 700, fontSize: "13px" }}>Đăng nhập</button>
                </Link>
                <Link href="/explore?auth=register">
                  <button type="button" style={{ background: "#fff", color: "var(--green)", border: "1px solid var(--green)", borderRadius: "8px", padding: "12px 24px", fontWeight: 700, fontSize: "13px" }}>Đăng ký</button>
                </Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="site-shell">
      <Navbar />

      <main>
        {/* Banner tiêu đề */}
        <section className="page-header-banner">
          <div className="container">
            <div className="eyebrow">
              <span className="eyebrow-line" /> TRUNG TÂM TÀI KHOẢN CÁ NHÂN
            </div>
            <h1>Quản lý tài khoản của bạn</h1>
            <p>
              Xem thông tin cá nhân, cập nhật mật khẩu, quản lý lịch sử xem tin và đánh giá giao dịch.
            </p>
          </div>
        </section>

        {/* Bố cục tài khoản */}
        <section className="container account-shell">
          <div className="account-layout">
            {/* Cột trái: Menu các Tab */}
            <aside className="account-nav-panel">
              <div className="account-user-card">
                <div className="account-big-avatar">
                  {viewer?.fullName.charAt(0).toUpperCase()}
                </div>
                <h3>{viewer?.fullName}</h3>
                <p>{viewer?.email}</p>
                <div className="account-verified-tag">
                  <span>✓</span> {viewer?.role === "admin" ? "Quản trị viên" : "Sinh viên đã xác minh"}
                </div>
              </div>

              <nav className="account-tabs-list">
                <button
                  className={`account-tab-btn ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => setActiveTab("profile")}
                >
                  <span>👤</span> Thông tin cá nhân
                </button>

                <button
                  className={`account-tab-btn ${activeTab === "settings" ? "active" : ""}`}
                  onClick={() => setActiveTab("settings")}
                >
                  <span>⚙️</span> Cài đặt tài khoản
                </button>

                <button
                  className={`account-tab-btn ${activeTab === "reviews" ? "active" : ""}`}
                  onClick={() => setActiveTab("reviews")}
                >
                  <span>⭐</span> Đánh giá từ tôi ({reviews.length})
                </button>

                <button
                  className={`account-tab-btn ${activeTab === "history" ? "active" : ""}`}
                  onClick={() => setActiveTab("history")}
                >
                  <span>🕒</span> Lịch sử xem tin ({history.length})
                </button>

                {viewer?.role === "student" && (
                  <button className={`account-tab-btn ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
                    <span>⚑</span> Báo cáo của tôi ({reports.length})
                  </button>
                )}

                <Link href="/my-listings" className="account-tab-btn">
                  <span>📋</span> Quản lý tin cá nhân ↗
                </Link>

                <Link href="/saved" className="account-tab-btn">
                  <span>📌</span> Tin đã lưu ↗
                </Link>

                <Link href="/messages" className="account-tab-btn">
                  <span>💬</span> Liên hệ / Tin nhắn ↗
                </Link>

                {viewer?.role === "admin" && (
                  <Link href="/admin" className="account-tab-btn" style={{ color: "#2b7044" }}>
                    <span>🛡️</span> Bảng quản trị (Admin) ↗
                  </Link>
                )}

                <button className="account-tab-btn logout" onClick={handleLogout}>
                  <span>🚪</span> Đăng xuất
                </button>
              </nav>
            </aside>

            {/* Cột phải: Nội dung từng Tab */}
            <div className="account-content-card">
              {/* TAB 1: THÔNG TIN CÁ NHÂN */}
              {activeTab === "profile" && (
                <div>
                  <div className="account-card-header">
                    <h2>Hồ sơ sinh viên</h2>
                    <p>Thông tin cơ bản được liên kết với thẻ sinh viên và tin đăng của bạn trên sàn SangTay.</p>
                  </div>

                  <div className="form-group-grid">
                    <div className="form-field">
                      <label>Họ và tên</label>
                      <input value={viewer?.fullName || ""} disabled />
                    </div>

                    <div className="form-field">
                      <label>Mã số sinh viên</label>
                      <input value={viewer?.studentId || ""} disabled />
                    </div>

                    <div className="form-field">
                      <label>Email sinh viên</label>
                      <input value={viewer?.email || ""} disabled />
                    </div>

                    <div className="form-field">
                      <label>Trường đại học</label>
                      <input value={viewer?.university || ""} disabled />
                    </div>

                    <div className="form-field">
                      <label>Vai trò hệ thống</label>
                      <input value={viewer?.role === "admin" ? "Quản trị viên (Admin)" : "Thành viên Sinh viên"} disabled />
                    </div>

                    <div className="form-field">
                      <label>Trạng thái tài khoản</label>
                      <input value={viewer?.status === "verified" ? "Đã xác minh đầy đủ quyền" : viewer?.status || ""} disabled />
                    </div>
                  </div>

                  <div style={{ marginTop: "24px", padding: "16px", background: "#f5f9f4", borderRadius: "10px", border: "1px solid #d8e8d6" }}>
                    <h4 style={{ margin: "0 0 6px", fontSize: "13px", color: "var(--green)" }}>
                      Quyền lợi tài khoản đã xác minh:
                    </h4>
                    <p style={{ margin: 0, fontSize: "12px", color: "#506958", lineHeight: "1.6" }}>
                      Tài khoản của bạn đã được gắn huy hiệu tin cậy. Bạn có thể tự do đăng tin bán hoặc trao đổi đồ, nhắn tin thương lượng trực tiếp với các sinh viên khác và nhận đánh giá uy tín.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: CÀI ĐẶT TÀI KHOẢN (ĐỔI TÊN, ĐỔI MẬT KHẨU) */}
              {activeTab === "settings" && (
                <div>
                  <div className="account-card-header">
                    <h2>Cài đặt tài khoản & Bảo mật</h2>
                    <p>Cập nhật tên hiển thị, trường học và thay đổi mật khẩu đăng nhập định kỳ.</p>
                  </div>

                  {/* Form 1: Đổi thông tin hiển thị */}
                  <form onSubmit={handleUpdateProfile} style={{ marginBottom: "36px" }}>
                    <h3 style={{ fontSize: "15px", margin: "0 0 16px", color: "#1e372b" }}>
                      1. Thông tin hiển thị
                    </h3>

                    {profileMessage && (
                      <div style={{ padding: "10px 14px", background: "#eaf5e9", color: "#28683e", borderRadius: "8px", fontSize: "12px", marginBottom: "16px" }}>
                        ✓ {profileMessage}
                      </div>
                    )}
                    {profileError && (
                      <div style={{ padding: "10px 14px", background: "#fbeeed", color: "#b9382b", borderRadius: "8px", fontSize: "12px", marginBottom: "16px" }}>
                        ⚠ {profileError}
                      </div>
                    )}

                    <div className="form-group-grid">
                      <div className="form-field">
                        <label>Họ và tên hiển thị *</label>
                        <input
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          required
                          minLength={2}
                          maxLength={100}
                        />
                      </div>

                      <div className="form-field">
                        <label>Trường đại học *</label>
                        <input
                          value={university}
                          onChange={e => setUniversity(e.target.value)}
                          required
                          minLength={2}
                          maxLength={120}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="form-submit"
                      style={{ width: "auto", padding: "10px 20px" }}
                      disabled={profileBusy}
                    >
                      {profileBusy ? "Đang lưu..." : "Cập nhật thông tin"}
                    </button>
                  </form>

                  <div style={{ height: "1px", background: "#edf1eb", margin: "30px 0" }} />

                  {/* Form 2: Đổi mật khẩu */}
                  <form onSubmit={handleChangePassword}>
                    <h3 style={{ fontSize: "15px", margin: "0 0 16px", color: "#1e372b" }}>
                      2. Thay đổi mật khẩu
                    </h3>

                    {passwordMessage && (
                      <div style={{ padding: "10px 14px", background: "#eaf5e9", color: "#28683e", borderRadius: "8px", fontSize: "12px", marginBottom: "16px" }}>
                        ✓ {passwordMessage}
                      </div>
                    )}
                    {passwordError && (
                      <div style={{ padding: "10px 14px", background: "#fbeeed", color: "#b9382b", borderRadius: "8px", fontSize: "12px", marginBottom: "16px" }}>
                        ⚠ {passwordError}
                      </div>
                    )}

                    <div className="form-group-grid">
                      <div className="form-field full">
                        <label>Mật khẩu hiện tại *</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          placeholder="Nhập mật khẩu đang dùng"
                          autoComplete="current-password"
                          maxLength={128}
                          required
                        />
                      </div>

                      <div className="form-field">
                        <label>Mật khẩu mới *</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Ít nhất 8 ký tự, có chữ và số"
                          autoComplete="new-password"
                          maxLength={128}
                          minLength={8}
                          required
                        />
                      </div>

                      <div className="form-field">
                        <label>Nhập lại mật khẩu mới *</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Khớp với mật khẩu mới ở trên"
                          autoComplete="new-password"
                          maxLength={128}
                          minLength={8}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="form-submit"
                      style={{ width: "auto", padding: "10px 20px" }}
                      disabled={passwordBusy}
                    >
                      {passwordBusy ? "Đang đổi..." : "Lưu mật khẩu mới"}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 3: ĐÁNH GIÁ TỪ TÔI */}
              {activeTab === "reviews" && (
                <div>
                  <div className="account-card-header">
                    <h2>Đánh giá từ tôi</h2>
                    <p>Các nhận xét và số sao bạn đã gửi cho người bán hoặc người mua sau khi hoàn tất trao đổi.</p>
                  </div>

                  {reviews.length > 0 ? (
                    <div>
                      {reviews.map(rev => (
                        <div className="review-item-card" key={rev.id}>
                          <div className="review-item-top">
                            <div>
                              <span className="review-target-user">
                                Đánh giá cho: {rev.targetUserName} ({rev.targetRole})
                              </span>
                            </div>
                            <div className="review-stars">
                              {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                            </div>
                          </div>

                          <div className="review-product-tag">
                            Về món đồ: {rev.listingTitle}
                          </div>

                          <p className="review-content-text">“{rev.content}”</p>

                          <span className="review-date">
                            Đã đánh giá vào: {new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(new Date(rev.createdAt))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: "40px 20px" }}>
                      <span>⭐</span>
                      <h3>Bạn chưa gửi đánh giá nào</h3>
                      <p>Sau khi hẹn gặp và trao đổi món đồ với bạn học, hãy gửi đánh giá để cộng đồng ngày càng tin cậy nhé!</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LỊCH SỬ XEM TIN */}
              {activeTab === "history" && (
                <div>
                  <div className="account-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h2>Lịch sử xem tin gần đây</h2>
                      <p>Những món đồ bạn đã mở xem trong các phiên duyệt chợ trước đó.</p>
                    </div>
                    {history.length > 0 && (
                      <button
                        className="action-btn-sm delete"
                        onClick={handleClearHistory}
                        style={{ padding: "7px 12px" }}
                      >
                        Xóa tất cả lịch sử
                      </button>
                    )}
                  </div>

                  {history.length > 0 ? (
                    <div className="history-grid">
                      {history.map(item => (
                        <div className="history-card" key={item.listingId}>
                          <button
                            className="history-remove-btn"
                            title="Xóa khỏi lịch sử"
                            onClick={() => handleRemoveHistoryItem(item.listingId)}
                          >
                            ×
                          </button>

                          <Link href={`/listing/${item.listingId}`} className="history-img-wrap">
                            <img src={item.image} alt={item.title} />
                          </Link>

                          <div className="history-card-body">
                            <Link href={`/listing/${item.listingId}`} className="history-card-title">
                              {item.title}
                            </Link>
                            <span style={{ fontSize: "10px", color: "#859489", margin: "2px 0 8px" }}>
                              {item.seller} · {item.school}
                            </span>
                            <div className="history-card-price">{formatPrice(item.price)}</div>

                            <Link
                              href={`/listing/${item.listingId}`}
                              className="action-btn-sm"
                              style={{ marginTop: "10px", textAlign: "center" }}
                            >
                              Xem lại tin
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: "40px 20px" }}>
                      <span>🕒</span>
                      <h3>Lịch sử xem tin trống</h3>
                      <p>Các món đồ bạn xem chi tiết sẽ được tự động ghi nhớ tại đây để bạn tiện tìm lại.</p>
                      <Link href="/explore">
                        <button type="button">Bắt đầu khám phá</button>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "reports" && viewer?.role === "student" && (
                <div>
                  <div className="account-card-header">
                    <h2>Báo cáo của tôi</h2>
                    <p>Theo dõi kết quả các báo cáo người mua hoặc người bán bạn đã gửi cho admin.</p>
                  </div>
                  {reports.length === 0 ? (
                    <div className="empty-state" style={{ padding: "40px 20px" }}>
                      <span>⚑</span><h3>Bạn chưa gửi báo cáo nào</h3>
                      <p>Nếu gặp dấu hiệu lừa đảo hoặc vi phạm quy tắc, hãy báo cáo tại tin đăng hoặc cuộc trò chuyện liên quan.</p>
                    </div>
                  ) : reports.map(report => (
                    <article key={report.id} className="review-item-card">
                      <div className="review-item-top">
                        <strong className="review-target-user">Báo cáo: {report.reportedName}</strong>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: report.status === "APPROVED" ? "#21744b" : report.status === "REJECTED" ? "#9f4837" : "#9b661d" }}>
                          {reportStatuses[report.status]}
                        </span>
                      </div>
                      <div className="review-product-tag">{report.contextType === "LISTING" ? "Tin đăng" : "Đoạn chat"}: {report.contextTitle}</div>
                      <p className="review-content-text"><strong>{reportReasons[report.reason]}:</strong> {report.description}</p>
                      {report.reviewNote && <p className="review-content-text">Phản hồi của admin: {report.reviewNote}</p>}
                      <span className="review-date">Đã gửi: {new Date(report.createdAt).toLocaleString("vi-VN")}</span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "100px", color: "#6a7b70" }}>Đang tải thông tin tài khoản...</div>}>
      <AccountContent />
    </Suspense>
  );
}

