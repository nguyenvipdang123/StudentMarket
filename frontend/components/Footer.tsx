import Link from "@/components/TransitionLink";
import FooterCrowd from "./FooterCrowd";

export default function Footer() {
  return (
    <><footer className="footer">
      <div className="container footer-main">
        <div>
          <Link className="brand footer-brand" href="/explore">
            <span className="brand-mark">
              <span />
              <span />
            </span>
            <span>
              sang<span className="brand-accent">tay</span>
              <b>.</b>
            </span>
          </Link>
          <p>
            Nơi những món đồ được trao đi,
            <br />
            và những kết nối sinh viên bắt đầu.
          </p>
        </div>

        <div className="footer-links">
          <div>
            <strong>Khám phá</strong>
            <Link href="/explore">Tất cả sản phẩm</Link>
            <Link href="/how-it-works">Cách hoạt động</Link>
            <Link href="/saved">Tin đã lưu</Link>
          </div>
          <div>
            <strong>Cộng đồng & Trao đổi</strong>
            <Link href="/create-listing">Đăng tin miễn phí</Link>
            <Link href="/messages">Tin nhắn / Liên hệ</Link>
            <Link href="/my-listings">Quản lý tin đăng</Link>
          </div>
          <div>
            <strong>Tài khoản</strong>
            <Link href="/account?tab=profile">Thông tin cá nhân</Link>
            <Link href="/account?tab=settings">Cài đặt tài khoản</Link>
            <Link href="/account?tab=reviews">Đánh giá từ tôi</Link>
          </div>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© 2026 SangTay. Sàn trao đổi P2P làm bằng sự tử tế dành cho sinh viên.</span>
        <span>Trao đồ cũ · Gửi niềm vui ♡</span>
      </div>
    </footer><FooterCrowd /></>
  );
}
