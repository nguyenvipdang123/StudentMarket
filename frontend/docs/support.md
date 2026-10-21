# Trung tâm hỗ trợ

Mở **Hỗ trợ** trên thanh điều hướng hoặc **Trung tâm hỗ trợ** ở cuối trang (`/support`). Khách chưa đăng nhập vẫn đọc được câu hỏi thường gặp và hướng dẫn giao dịch an toàn.

## Dành cho sinh viên

Tài khoản sinh viên đã xác minh có thể gửi phiếu với nhóm vấn đề, tiêu đề và mô tả. Với thanh toán đẩy tin, cung cấp mã đơn, thời điểm và số tiền cần kiểm tra. Không gửi mật khẩu, OTP, số thẻ ngân hàng hoặc giấy tờ riêng tư trong nội dung hỗ trợ. Phiên bản này hỗ trợ văn bản, chưa có tệp đính kèm.

Danh sách **Phiếu hỗ trợ của tôi** cho phép tìm theo tiêu đề/mã `HT-…`, lọc trạng thái và phân trang. Mở phiếu để xem lịch sử, bổ sung thông tin hoặc bấm **Làm mới cuộc trao đổi**. Liên kết `?ticket=<uuid>` mở lại đúng phiếu sau khi tải lại trang. Mỗi sinh viên chỉ đọc/gửi bổ sung vào phiếu của mình; Admin đọc được toàn bộ phiếu. Nhân viên kiểm duyệt không có quyền xử lý hỗ trợ.

## Dành cho Admin

Vào **Admin → Phiếu hỗ trợ**, hoặc `/admin?tab=SUPPORT`. Admin có thể tìm thêm theo tên/email người gửi, đọc trao đổi, phản hồi và cập nhật:

| Trạng thái | Ý nghĩa |
| --- | --- |
| Mới tiếp nhận | Phiếu mới hoặc người gửi vừa bổ sung thông tin cần xem lại |
| Đang xử lý | Admin đang kiểm tra vấn đề |
| Chờ bạn bổ sung | Cần người gửi cung cấp thêm thông tin |
| Đã giải quyết | Admin hoàn tất xử lý yêu cầu |

Phản hồi khi phiếu **Chờ bạn bổ sung** hoặc **Đã giải quyết** đưa phiếu về **Mới tiếp nhận** để Admin tiếp tục theo dõi. Thay đổi trạng thái được lưu trong lịch sử trao đổi; thao tác Admin được ghi vào nhật ký hoạt động. Nếu phiếu vừa được người khác cập nhật, server trả 409 và yêu cầu tải lại trước khi lưu để tránh ghi đè.

Chuông thông báo hiển thị cập nhật hỗ trợ trong 30 ngày: sinh viên nhận cập nhật Admin gần nhất cho từng phiếu; Admin nhận thông tin mới/bổ sung từ sinh viên đối với phiếu chưa giải quyết. Thông báo được kiểm tra định kỳ theo cơ chế hiện có (30 giây), không gửi email hỗ trợ.

## Triển khai và dữ liệu

Chạy `npm run db:migrate` từ `frontend` để tạo `support_tickets`, `support_messages` cùng chỉ mục. Migration chỉ thêm bảng, chạy lại an toàn. Render đã có bước migration trước triển khai; triển khai commit mới của `studentmarket-web` sẽ chạy bước này. Không cần biến môi trường hoặc dịch vụ mới. Bản sao lưu database hiện có bao gồm hai bảng này.

API người dùng: `GET/POST /api/support`, `GET/POST /api/support/[id]`. API Admin: `GET /api/admin/support`, `GET/POST /api/admin/support/[id]`. Kiểm tra quyền từ session ở server, xác thực origin cho thao tác ghi, nội dung JSON tối đa 24 KB. Tiêu đề dài 5–160 ký tự, mô tả tạo phiếu 20–4000 ký tự, phản hồi tối đa 4000 ký tự. Tối đa 5 phiếu mới/giờ và 10 phiếu chưa giải quyết/tài khoản; mỗi tài khoản gửi tối đa 30 mục trao đổi/giờ (kể cả nội dung khởi tạo). Danh sách 20 phiếu/trang, lịch sử 40 mục/lần với nút tải mục cũ hơn.

Gửi yêu cầu hỗ trợ không tự xác nhận thanh toán, hoàn tiền, khóa tài khoản hoặc thay đổi tin đăng. Báo cáo vi phạm vẫn dùng luồng Báo cáo riêng trong tin đăng/cuộc trò chuyện.

Kiểm thử: `node scripts/test-e2e.mjs test support.spec.ts` từ `frontend`. Bộ kiểm thử tạo database riêng và dùng tài khoản mẫu, không tạo phiếu trên production.
