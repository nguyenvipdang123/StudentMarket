# SangTay Mobile — Day 10

Expo SDK 58 / TypeScript strict / Expo Router, phiên bản app 1.0.2.

- Catalogue API có tìm kiếm, danh mục/trường, cache offline, pull-to-refresh và thời điểm cập nhật.
- Phiên SecureStore trên native, yêu thích dùng chung, ảnh đăng tin nén, giỏ và tóm tắt checkout có kiểm tra tình trạng.
- Góc nhìn người mua/chủ tin, chat và thông báo giá cục bộ khi app hoạt động/quay lại/làm mới.
- Theme sáng/tối từ token chung, trạng thái màn hình và kiểm thử logic/component/critical path.
- README, AI_LOG, phân công bốn thành viên, kịch bản demo và reflection.

Kiểm chứng: `npm run mobile:check` đạt TypeScript, lint, 45 ca logic/static và 5 ca Jest. Video 03:40 là walkthrough có phụ đề dùng UI Expo Web cùng dữ liệu local; camera, thông báo và SecureStore cần kiểm tra native trên Expo Go. Checkout hiện là tóm tắt và liên hệ người bán, chưa tạo đơn hoặc thu tiền.

Tải source ZIP, video MP4, reflection PDF và SHA256SUMS trong assets. Source không có node_modules, cấu hình bí mật hoặc APK. Không tạo APK mới cho bản nộp Expo này.
