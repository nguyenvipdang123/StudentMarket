"use client";

import Link from "@/components/TransitionLink";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function HowItWorksPage() {
  const steps = [
    {
      num: "01",
      title: "1. Đăng tin nhanh chóng",
      desc: "Chụp ảnh món đồ bạn không còn dùng (giáo trình, laptop, bàn học...), đặt giá hoặc chọn 0đ để trao đổi, kèm mô tả ngắn gọn.",
      icon: "📦",
      colorClass: "c1",
    },
    {
      num: "02",
      title: "2. Người mua tìm kiếm",
      desc: "Sinh viên trong cùng trường hoặc khu vực lân cận dễ dàng tìm kiếm theo tên trường, danh mục hoặc khoảng giá phù hợp.",
      icon: "🔍",
      colorClass: "c2",
    },
    {
      num: "03",
      title: "3. Liên hệ người bán",
      desc: "Bấm 'Nhắn người bán' để mở hộp thoại trò chuyện P2P trực tiếp trên sàn SangTay mà không sợ bị lộ số điện thoại cá nhân.",
      icon: "💬",
      colorClass: "c3",
    },
    {
      num: "04",
      title: "4. Thỏa thuận & Hẹn gặp",
      desc: "Hai bên cùng thương lượng mức giá tốt nhất, tình trạng món đồ và chọn địa điểm hẹn gặp thuận tiện (sảnh trường, KTX, thư viện...).",
      icon: "🤝",
      colorClass: "c4",
    },
    {
      num: "05",
      title: "5. Gặp mặt & Sang tay",
      desc: "Gặp trực tiếp, kiểm tra món đồ thực tế xem đúng mô tả. Hài lòng thì thanh toán tiền mặt hoặc chuyển khoản ngay tại chỗ.",
      icon: "✨",
      colorClass: "c5",
    },
    {
      num: "06",
      title: "6. Đánh giá sau giao dịch",
      desc: "Gửi đánh giá và chấm sao để xây dựng cộng đồng sinh viên uy tín, an toàn và giúp các bạn khác an tâm khi trao đổi.",
      icon: "⭐",
      colorClass: "c6",
    },
  ];

  return (
    <div className="site-shell">
      <Navbar />

      <main>
        {/* Banner tiêu đề */}
        <section className="page-header-banner">
          <div className="container">
            <div className="eyebrow">
              <span className="eyebrow-line" /> MINH BẠCH & AN TOÀN CHO SINH VIÊN
            </div>
            <h1>Cách thức hoạt động của SangTay</h1>
            <p>
              Mô hình P2P (Peer-to-Peer) kết nối trực tiếp giữa sinh viên với sinh viên. Đơn giản, tiết kiệm chi phí và cùng nhau sống xanh hơn.
            </p>
          </div>
        </section>

        {/* 6 Bước quy trình */}
        <section className="container" style={{ padding: "50px 0 80px" }}>
          <div className="section-heading" style={{ marginBottom: "30px" }}>
            <div>
              <div className="section-kicker">QUY TRÌNH 6 BƯỚC</div>
              <h2>Từ món đồ cũ đến niềm vui mới ✳</h2>
            </div>
          </div>

          <div className="hiw-process-grid">
            {steps.map(step => (
              <div className="hiw-process-card" key={step.num}>
                <span className="hiw-card-step-num">{step.num}</span>
                <div className={`hiw-icon-circle ${step.colorClass}`}>
                  {step.icon}
                </div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Lời khuyên an toàn P2P */}
          <div
            style={{
              background: "#eaf3e8",
              borderRadius: "16px",
              padding: "36px 40px",
              border: "1px solid #d4e5d2",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "30px",
            }}
          >
            <div>
              <span className="section-kicker" style={{ color: "#2d6b49" }}>MẸO GIAO DỊCH AN TOÀN</span>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: "24px", margin: "8px 0 12px", color: "#193c28" }}>
                Giao dịch văn minh cùng bạn bè sinh viên
              </h3>
              <p style={{ fontSize: "13px", color: "#546d5c", lineHeight: "1.7", margin: 0 }}>
                Để đảm bảo trải nghiệm tốt nhất, chúng tôi khuyến khích sinh viên gặp nhau tại các khuôn viên công cộng trong trường vào ban ngày để kiểm tra đồ trước khi thanh toán.
              </p>
            </div>
            <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#365140", justifyContent: "center" }}>
              <li>Luôn kiểm tra thẻ sinh viên hoặc xác minh tài khoản của đối phương.</li>
              <li>Hẹn gặp tại thư viện trường, căn tin hoặc sảnh giảng đường.</li>
              <li>Không chuyển tiền cọc trước khi trực tiếp cầm và kiểm tra món đồ.</li>
              <li>Đánh giá thật tâm sau khi giao dịch để giữ môi trường chợ đồ cũ trong sạch.</li>
            </ul>
          </div>

          {/* CTA Actions */}
          <div style={{ textAlign: "center", marginTop: "60px" }}>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "28px", color: "#1a382b", margin: "0 0 16px" }}>
              Bạn đã sẵn sàng dọn dẹp phòng trọ và tìm món đồ mới?
            </h3>
            <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/create-listing" className="post-button" style={{ padding: "14px 24px", fontSize: "14px" }}>
                Đăng món đồ của bạn ngay
              </Link>
              <Link href="/explore" className="category-pill" style={{ padding: "14px 24px", fontSize: "14px", background: "#fff" }}>
                Khám phá món đồ quanh đây
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
