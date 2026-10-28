# Demo dự phòng — 03:40

Video MP4 dùng ảnh UI Expo Web chụp sau khi thao tác với dữ liệu local. Phụ đề được đặt trực tiếp trên hình; có tệp SRT rời. Không dùng tài khoản, tin nhắn hoặc giao dịch thật cho dữ liệu demo.

| Thời gian | Nội dung và lời dẫn gợi ý |
| --- | --- |
| 00:00–00:14 | Giới thiệu SangTay Mobile: mua bán, trao đổi và tặng đồ cho sinh viên; Expo SDK 58 và TypeScript. |
| 00:14–00:32 | Khám phá: nhập “sach”, chọn Học tập; giải thích filter trường và tìm kiếm không dấu được tính khi render. |
| 00:32–00:50 | Yêu thích: trạng thái chung trên card, chi tiết và Đã lưu; lưu theo tài khoản. Thông báo giá cần quyền native. |
| 00:50–01:08 | Cùng một tin: so sánh người mua và chủ tin, nút liên hệ/lưu/giỏ với trạng thái và thống kê chủ tin. |
| 01:08–01:26 | Đăng tin: chọn ảnh; ảnh thử đã nén còn khoảng 27 KB; giới hạn JPEG 72%, 1.600 px. Không gửi tin thật. |
| 01:26–01:44 | Checkout: một món 50.000đ, giao dự kiến 30.000đ, tổng 80.000đ; số lượng tối đa 1 và kiểm tra lại availability. |
| 01:44–02:02 | Offline: còn catalogue, banner và giờ cập nhật thành công gần nhất. Pull-to-refresh khi có mạng. |
| 02:02–02:20 | Chat: hỏi người bán hẹn xem bàn lúc 15 giờ, giữ ngữ cảnh tin đăng; hội thoại local. |
| 02:20–02:38 | Theme: Sáng/Tối/Theo thiết bị, một file token, nhãn hỗ trợ tiếp cận và vùng bấm 44 × 44. |
| 02:38–02:56 | Auth: cookie native trong SecureStore, khôi phục phiên, 401 và đăng xuất; critical-path test bằng API giả. |
| 02:56–03:18 | Kiểm tra: 45 logic/static + 5 Jest đạt, TypeScript strict và lint sạch. |
| 03:18–03:40 | Hướng dẫn npm ci → Expo, repository/release và các tệp nộp. |

## Thử trước demo trực tiếp bằng điện thoại

1. Chạy `npm --prefix mobile ci`, `npm run mobile`, mở Expo Go tương thích SDK 58.
2. Đăng nhập tài khoản thử được phép sử dụng, đóng/mở lại app để xác minh phiên; đăng xuất và kiểm tra dữ liệu riêng đã rời UI.
3. Tải catalogue thành công, bật chế độ máy bay rồi mở lại app: kiểm tra banner và bản lưu. Tắt máy bay, kéo làm mới và kiểm tra giờ cập nhật.
4. Đăng tin: chọn ảnh hoặc chụp bằng camera, kiểm tra ảnh nén và validation; chỉ gửi lên server bằng tin thử được phép tạo.
5. Lưu một tin, xem cùng trạng thái ở Khám phá/Chi tiết/Đã lưu, mở lại app kiểm tra lưu bền.
6. Bật thông báo giá ở Đã lưu, cấp quyền native. Đổi giá một tin thử do nhóm sở hữu từ phiên khác, quay lại/làm mới để nhận thông báo; không kỳ vọng giám sát khi app đã đóng.
7. Kiểm tra giỏ/checkout với món đang có, giữ chỗ và đã bán; thử TalkBack hoặc VoiceOver cùng hai theme.

Video dự phòng hỗ trợ phần trình bày; các bước native trên là phần kiểm tra thiết bị riêng.
