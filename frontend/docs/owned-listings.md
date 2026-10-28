# Quản lý tin của người bán từ mobile

Các API xác định người bán từ session đã xác minh, không nhận sellerId/userId làm quyền sở hữu.

- `GET /api/my-listings`: danh sách tin của tài khoản, có sellerId, bỏ các tin Deleted.
- `GET /api/products/:id`: lấy dữ liệu để sửa; owner xem được tin ẩn/chờ duyệt, tin Deleted trả 404.
- `PATCH /api/listings/:id`: sửa nội dung, gửi duyệt lại. Body gồm title, description, price, category, condition, location, image, status Active/Hidden; có thể gửi expectedStatus để chặn ghi đè trạng thái cũ. JSON giữ ảnh bìa hiện có; multipart `imageFile` thay một ảnh bìa và giữ ảnh phụ.
- `PATCH /api/my-listings/:id`: `{status:'Hidden'|'Active',expectedStatus?}`. Hiện lại luôn chuyển moderation_status về PENDING, không cho chủ tin tự vượt qua việc ẩn/từ chối của Admin.
- `DELETE /api/my-listings/:id`: `{confirmed:true,expectedStatus?}`. Chuyển trạng thái sang Deleted; không xóa hàng product hoặc lịch sử liên quan. Cùng owner gửi lại DELETE được trả thành công; không thể dùng sửa/hiện để phục hồi.
- `POST /api/listings/:id/mark-sold`: giữ API giao dịch có sẵn. `{viaSangTay:true,buyerId: email hoặc UUID}` kiểm tra người mua đã chat và chờ họ xác nhận. `{viaSangTay:false}` ghi nhận bán ngoài hệ thống, không tạo giao dịch đánh giá.

Ẩn/xóa bị chặn nếu có gói đẩy đang hoạt động, đơn đẩy chờ trả tiền còn hiệu lực, lịch hẹn/giữ chỗ còn hiệu lực hoặc giao dịch chờ người mua xác nhận. Tin Sold không sửa/ẩn/hiện; chỉ gỡ khỏi danh sách khi các ràng buộc lịch sử đã hoàn tất. Product được khóa trước khi kiểm tra các quan hệ để cùng thứ tự khóa với sale/reservation/payment.

Deleted nằm trong cột status VARCHAR(20) hiện có; không thêm cột hoặc xóa dữ liệu. Catalogue, seller profile vốn chỉ lấy Active/Sold phù hợp; favorites/history/detail và owned-list được cập nhật để không hiện Deleted. Lịch sử chat/giao dịch vẫn giữ tham chiếu sản phẩm.

Kiểm tra: `npm run build` và `npm run test:integration` trong frontend. Bộ test tạo database `student_market_test_<random>` riêng, không tạo/xóa tin thật trên Render. Helper `scripts/helpers/test-owned-listings.mjs` kiểm tra auth/origin/ownership, stale status, duyệt lại, ảnh phụ, soft delete, sale và các ràng buộc gói/lịch hẹn.

Backend này cần được triển khai lên studentmarket-web trước khi app dùng ẩn/xóa với API production. Không phải nâng cấp hay tạo APK; mobile chạy bằng Expo source.
