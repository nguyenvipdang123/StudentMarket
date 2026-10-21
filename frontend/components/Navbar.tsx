"use client";

import Link from "@/components/TransitionLink";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthDialog, { AuthMode } from "./AuthDialog";
import { Viewer } from "@/lib/types";
import NotificationBell from "./NotificationBell";

const authErrors: Record<string, string> = {
  google_config: "Đăng nhập Google chưa được cấu hình trên máy chủ. Vui lòng đăng nhập bằng email hoặc liên hệ quản trị viên.",
  google: "Không thể hoàn tất đăng nhập Google. Vui lòng thử lại và cho phép truy cập email trường.",
  school_google: "Vui lòng dùng tài khoản Google Workspace của trường có email .edu hoặc .edu.vn. Gmail cá nhân không được hỗ trợ.",
  email_exists: "Email này đã được đăng ký. Vui lòng đăng nhập bằng mật khẩu hoặc chọn Quên mật khẩu; tài khoản chưa được liên kết với Google.",
  account_status: "Tài khoản chưa được duyệt hoặc đang bị khóa. Vui lòng liên hệ quản trị viên.",
  admin_access: "Vui lòng đăng nhập bằng tài khoản có quyền quản trị.",
  verification: "Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng nhận lại mã xác thực email.",
};

function clearAuthParameters() {
  const url = new URL(window.location.href);
  for (const key of ["auth", "authError", "google"]) url.searchParams.delete(key);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load viewer session & favorites count
  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      if (data.user) {
        setViewer(data.user);
        try {
          const favRes = await fetch("/api/favorites", { cache: "no-store" });
          if (favRes.ok) {
            const favData = await favRes.json();
            setSavedCount((favData.favorites || []).length);
          } else {
            setSavedCount(0);
          }
        } catch {
          setSavedCount(0);
        }
      } else {
        setViewer(null);
        setSavedCount(0);
      }
    } catch {
      setViewer(null);
      setSavedCount(0);
    }
  };

  // Sync saved count & viewer on mount & events
  useEffect(() => {
    void Promise.resolve().then(() => refreshUser());

    const handleStorageChange = () => {
      refreshUser();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sangtay_saved_changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sangtay_saved_changed", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("authError");
      if (authError) {
        setAuthNotice(authErrors[authError] || "Không thể đăng nhập. Vui lòng thử lại.");
        setAuthMode("login");
        return;
      }
      const mode = params.get("auth");
      if (mode === "login" || mode === "register" || mode === "forgot" || mode === "verify" || mode === "google-complete") {
        setAuthNotice("");
        setAuthMode(mode);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setViewer(null);
      setSavedCount(0);
      setUserDropdownOpen(false);
      setMobileMenuOpen(false);
      window.dispatchEvent(new Event("sangtay_saved_changed"));
      window.dispatchEvent(new Event("sangtay_auth_changed"));
      router.push("/explore");
      router.refresh();
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const handlePostClick = () => {
    if (!viewer) {
      setAuthNotice("Vui lòng đăng nhập bằng tài khoản sinh viên để đăng tin.");
      setAuthMode("login");
      return;
    }
    router.push("/create-listing");
  };

  const isExplore = pathname === "/" || pathname === "/explore";
  const isHowItWorks = pathname === "/how-it-works";
  const isSaved = pathname === "/saved";
  const isMessages = pathname === "/messages";

  return (
    <>
      <div className="announcement">
        <span className="announcement-dot" />
        Một món đồ cũ, một câu chuyện mới. Sàn trao đổi P2P thân thiện dành riêng cho sinh viên!
        <span className="announcement-spark">✦</span>
      </div>

      <header className="site-header">
        <div className="header-inner container">
          {/* Logo Brand */}
          <Link className="brand" href="/explore" aria-label="Sang Tay - Trang chủ">
            <span className="brand-mark">
              <span />
              <span />
            </span>
            <span>
              sang<span className="brand-accent">tay</span>
              <b>.</b>
            </span>
          </Link>

          {/* Navigation Links - Pages độc lập */}
          <nav className={`main-nav ${mobileMenuOpen ? "open" : ""}`} id="main-navigation" aria-label="Điều hướng chính">
            <Link
              href="/explore"
              className={isExplore ? "active" : ""}
              aria-current={isExplore ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              Khám phá
            </Link>

            <Link
              href="/how-it-works"
              className={isHowItWorks ? "active" : ""}
              aria-current={isHowItWorks ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              Cách hoạt động
            </Link>

            <Link
              href="/saved"
              className={isSaved ? "active" : ""}
              aria-current={isSaved ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              Đã lưu {viewer && savedCount > 0 && <span className="nav-count">{savedCount}</span>}
            </Link>

            <Link
              href="/messages"
              className={isMessages ? "active" : ""}
              aria-current={isMessages ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              Tin nhắn
            </Link>

            <Link href="/support" className={pathname==='/support'?'active':''} aria-current={pathname==='/support'?'page':undefined} onClick={()=>setMobileMenuOpen(false)}>Hỗ trợ</Link>
            {/* Mobile-only account shortcuts */}
            {!viewer ? (
              <div className="mobile-auth-links">
                <button
                  className="mobile-account-link"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthMode("login");
                  }}
                >
                  Đăng nhập
                </button>
                <button
                  className="mobile-account-link"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthMode("register");
                  }}
                >
                  Đăng ký
                </button>
              </div>
            ) : (
              <div className="mobile-auth-links">
                <Link
                  href="/account"
                  className="mobile-account-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Tài khoản ({viewer.fullName})
                </Link>
                <Link
                  href="/my-listings"
                  className="mobile-account-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Quản lý tin đăng
                </Link>
                <Link href="/transactions" className="mobile-account-link" onClick={() => setMobileMenuOpen(false)}>Giao dịch của tôi</Link>
                {(viewer.role === "admin" || viewer.role === "staff") && (
                  <Link
                    href={viewer.role === "staff" ? "/admin/moderation" : "/admin"}
                    className="mobile-account-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Quản lý hệ thống
                  </Link>
                )}
                <button className="mobile-account-link danger" onClick={handleLogout}>
                  Đăng xuất
                </button>
              </div>
            )}
          </nav>

          {/* Header Right Actions */}
          <div className="header-actions">
            <NotificationBell key={viewer?.id ?? "guest"} authenticated={Boolean(viewer)} onLogin={() => { setAuthNotice("Đăng nhập để xem thông báo của bạn."); openAuthModal("login"); }} />
            {/* Account dropdown / Login buttons */}
            {viewer ? (
              <div className="user-dropdown-container" ref={dropdownRef}>
                <button
                  className={`user-profile-button ${userDropdownOpen ? "active" : ""}`}
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-expanded={userDropdownOpen}
                >
                  <span className="user-avatar-badge">{viewer.fullName.charAt(0).toUpperCase()}</span>
                  <span>{viewer.fullName.split(" ").slice(-2).join(" ")}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {userDropdownOpen && (
                  <div className="user-dropdown-menu">
                    <div className="dropdown-user-header">
                      <span className="dropdown-user-name">{viewer.fullName}</span>
                      <span className="dropdown-user-email">{viewer.email}</span>
                    </div>

                    <Link
                      href="/account?tab=profile"
                      className="dropdown-item"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <span>👤</span> Thông tin cá nhân
                    </Link>

                    <Link
                      href="/account?tab=settings"
                      className="dropdown-item"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <span>⚙️</span> Cài đặt tài khoản
                    </Link>

                    <Link
                      href="/account?tab=reviews"
                      className="dropdown-item"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <span>⭐</span> Đánh giá từ tôi
                    </Link>

                    <Link
                      href="/account?tab=history"
                      className="dropdown-item"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <span>🕒</span> Lịch sử xem tin
                    </Link>

                    <Link
                      href="/saved"
                      className="dropdown-item"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <span>📌</span> Tin đã lưu
                      {savedCount > 0 && <span className="dropdown-badge">{savedCount}</span>}
                    </Link>

                    <Link
                      href="/my-listings"
                      className="dropdown-item"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <span>📋</span> Quản lý tin cá nhân
                    </Link>

                    <Link
                      href="/messages"
                      className="dropdown-item"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <span>💬</span> Liên hệ / Tin nhắn
                    </Link>

                    <Link href="/transactions" className="dropdown-item" onClick={() => setUserDropdownOpen(false)}>Giao dịch của tôi</Link>
                    {(viewer.role === "admin" || viewer.role === "staff") && (
                      <Link
                        href={viewer.role === "staff" ? "/admin/moderation" : "/admin"}
                        className="dropdown-item"
                        onClick={() => setUserDropdownOpen(false)}
                        style={{ color: "#2b7044", fontWeight: 700 }}
                      >
                        <span>🛡️</span> Quản lý hệ thống
                      </Link>
                    )}

                    <button className="dropdown-item danger" onClick={handleLogout}>
                      <span>🚪</span> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-desktop-buttons">
                <button
                  className="auth-login-button"
                  onClick={() => openAuthModal("login")}
                >
                  Đăng nhập
                </button>
                <button
                  className="auth-register-button"
                  onClick={() => openAuthModal("register")}
                >
                  Đăng ký
                </button>
              </div>
            )}

            {/* Post Listing Button */}
            <button className="post-button" aria-label="Đăng tin miễn phí" onClick={handlePostClick}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Đăng tin miễn phí
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              className="icon-button menu-button"
              aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="main-navigation"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen ? (
                  <path d="M5 5 19 19M19 5 5 19" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Auth Dialog Modal */}
      {authMode && (
        <AuthDialog
          key={authMode}
          initialMode={authMode}
          notice={authNotice}
          onClose={() => {
            clearAuthParameters();
            setAuthMode(null);
            setAuthNotice("");
          }}
          onAuthenticated={account => {
            clearAuthParameters();
            setViewer(account);
            window.dispatchEvent(new Event("sangtay_auth_changed"));
            window.dispatchEvent(new Event("sangtay_saved_changed"));
            setAuthMode(null);
            setAuthNotice("");
            if (account.role === "admin") {
              router.push("/admin");
            } else {
              router.refresh();
            }
          }}
        />
      )}
    </>
  );

  function openAuthModal(mode: AuthMode) {
    setAuthNotice("");
    setAuthMode(mode);
  }
}
