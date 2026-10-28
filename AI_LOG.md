# Nhật ký sử dụng AI của nhóm SangTay Mobile

Nhật ký bắt đầu ghi nhận từ **28/10/2026**. Không suy diễn rằng mọi thay đổi trước đó có nhật ký đầy đủ, và không gán mã do AI hỗ trợ cho thành viên chưa xác nhận đã làm. Danh sách và phân công hiện tại nằm trong [mobile/TEAM.md](mobile/TEAM.md).

## Thành viên và nguyên tắc ghi nhận

| Thành viên | MSSV | Nhóm việc được giao từ 28/10/2026 |
| --- | --- | --- |
| Lê Hoàng Nam | 1923050110 | UI, Router, theme, accessibility |
| Nguyễn Quang Phúc | 1923050161 | Catalogue, query cache, offline, search/filter |
| Hồ Xuân Nguyên | 192305104 | Đăng tin/ảnh, giỏ, checkout |
| Phan Huy Nguyên | 1923050059 | Auth, yêu thích/chat, thông báo, tích hợp/test |

Mỗi thành viên ghi hoạt động AI thực tế của mình, kèm phần đã tự đọc, sửa và kiểm thử. Không đưa mật khẩu, cookie, API key, database URL hoặc dữ liệu người dùng vào nhật ký. Không tự tạo quá khứ sử dụng AI cho ba thành viên chưa gửi nhật ký.

## Các phiên hỗ trợ đã ghi nhận

### 28/10/2026 — Yêu cầu MUST HAVE cho source Expo

- Công cụ: trợ lý Codex trong cuộc chat của project; người dùng cung cấp rubric và yêu cầu làm bằng Expo, chưa tạo APK.
- Yêu cầu chính: session, catalogue API, ảnh nén bắt buộc, filter/search trong render, state yêu thích, giỏ/checkout và offline.
- AI hỗ trợ: `src/state/*`, `MarketProvider`, ảnh JPEG trên thiết bị, catalogue nguyên bản có cache, kiểm thử pure logic và hướng dẫn demo.
- Kiểm chứng của trợ lý: 33 kiểm thử logic ở mốc `c6a76d9`, typecheck/lint, bản xem thử dùng fixture local và thử nén ảnh thực bằng ImageManipulator web. Chưa kiểm chứng camera/máy bay trên điện thoại thật.
- Ghi nhận đóng góp: đây là thay đổi AI hỗ trợ trong phiên chung, không chứng minh bốn thành viên cùng viết.

### 28/10/2026 — Góc người bán/người mua, thông báo đổi giá và pull-to-refresh

- Yêu cầu chính: cùng tin có UI theo ownership, thông báo cục bộ, giờ cập nhật.
- AI hỗ trợ: helper ownership, native notification adapter, so sánh giá và baseline, thời điểm refresh; thêm kiểm thử và tài liệu.
- Kiểm chứng của trợ lý: 41 kiểm thử logic ở mốc `22fd8d3`, UI hai vai bằng tài khoản giả, bundle Expo Android. Permission/device adapter được mock; OS notification tray cần thành viên kiểm thử trên Expo Go thật.
- Giới hạn đã chấp nhận trong triển khai: theo dõi khi app hoạt động/quay lại/làm mới; không giám sát giá liên tục khi app đã đóng.

### 28/10/2026 — Đối chiếu TECHNICAL REQUIREMENTS

- Người dùng cung cấp rubric kỹ thuật và danh sách bốn thành viên, đồng ý để trợ lý đề xuất phân công.
- AI hỗ trợ: token màu duy nhất và theme sáng/tối, route not-found, shared state selectors, TanStack Query, trạng thái màn hình/retry, vùng bấm/label, Jest + React Native Testing Library và luồng auth tích hợp với API giả; README/TEAM/bảng đối chiếu.
- Cách kiểm chứng: `npm run mobile:check`; kiểm tra tương phản ≥4,5:1 theo công thức, scan màu literal ngoài token, test component và luồng đăng nhập/khôi phục/đăng xuất; xem thử hai theme và not-found; xuất bundle Android, không tạo APK.
- Kết quả kiểm chứng của trợ lý: 45 kiểm thử logic/static và 5 kiểm thử Jest đạt; TypeScript/lint sạch, Expo config/export và npm ci dry-run đạt. Chưa thử TalkBack/VoiceOver, notification/camera trên thiết bị trong lượt này. Web catalogue gặp lỗi mạng, nút retry và thông báo dữ liệu rỗng vẫn hoạt động.
- Phần cần nhóm tự làm: review mã, chạy Expo Go trên thiết bị, bổ sung nhật ký cá nhân và commit thật theo tiến độ. Lịch sử Git không được sửa tác giả hoặc backdate để đáp ứng rubric.

### 28/10/2026 — Chuẩn bị bộ nộp Day 10

- Yêu cầu: tagged release, source ZIP, video 3–5 phút và reflection một trang. Giữ cách viết reflection ngắn gọn theo yêu cầu của người dùng.
- AI hỗ trợ: tài liệu nộp bài, reflection PDF, video walkthrough có phụ đề dài 03:40 từ ảnh UI Expo Web thực tế và dữ liệu demo local; đóng gói source từ Git.
- Kiểm chứng: kiểm tra lại TypeScript/lint và 45 + 5 tests; ảnh thử được chọn và nén còn khoảng 27 KB. Phần demo tạm được gỡ khỏi app trước đóng gói; không tạo APK, tài khoản, tin đăng hoặc giao dịch thật.
- Video không phải bản quay Android đầu-cuối; các bước camera/thông báo/SecureStore native được ghi trong kịch bản để thử bằng Expo Go. Chưa nộp Canvas khi chưa có liên kết bài nộp.

### 28/10/2026 — Sửa lỗi ExpoTopicSubscriptionModule trong Expo Go

- Người dùng gửi ảnh màn hình lỗi khởi động. AI xác định root import expo-notifications kéo theo remote topic module mà Expo Go 58.0.5 thiếu.
- Sửa adapter native chỉ nạp entry thông báo cục bộ, giữ tính năng báo đổi giá. Thêm hai regression tests và export Android để kiểm tra module push đã rời bundle.
- TypeScript/lint và 45 + 7 tests đạt. Chưa xác nhận UI/notification tray vì công cụ cửa sổ không khởi tạo được, debugger không phản hồi. Không sửa/xây lại bộ ZIP đã nộp hoặc APK.

### 28/10/2026 — Sửa retry thông báo giá và lỗi thao tác Tài khoản

- Người dùng yêu cầu sửa hai phát hiện trong rà soát. AI thêm outbox thông báo lưu trên máy với identifier ổn định, retry khi refresh/restart, dọn khi tắt/đăng xuất/bỏ lưu và gửi tuần tự.
- Tách lỗi hỗ trợ/logout trong Tài khoản để retry đúng hành động; không refresh phiên thay cho mở hỗ trợ, không dùng lỗi logout cũ để đăng xuất tài khoản mới.
- Thêm 8 kiểm thử logic hồi quy và 3 component tests. `npm run mobile:check` đạt TypeScript/lint, 53 logic/static + 10 Jest. Chưa xác minh notification tray trên thiết bị thật trong lượt này; không tạo APK hoặc thay release đã nộp.

### 28/10/2026 — Quản lý tin trên mobile

- Người dùng yêu cầu thêm sửa, ẩn/xóa và đánh dấu đã bán. AI thêm UI Tin của tôi, route edit/sold, API adapter, cache invalidation và backend visibility/soft delete có kiểm tra chủ tin cùng các ràng buộc giao dịch.
- Giữ API sửa/mark-sold hiện có; sửa/hiện lại phải duyệt, xóa bảo toàn lịch sử. Bổ sung tests payload, lifecycle cache, component CRUD/retry/offline và API tích hợp trên database riêng.
- Kiểm chứng: TypeScript/lint mobile + 60 logic/static + 17 Jest đạt; frontend typecheck/lint/build và 42 nhóm tích hợp đạt; Android export đạt, không APK. Không mutation dữ liệu production. Triển khai API mới đang chờ kết nối Render; UI emulator chưa xác minh vì công cụ cửa sổ không khởi tạo được.

### 29/10/2026 — Lưu nháp tin và ảnh trên mobile

- Người dùng yêu cầu giữ nháp và ảnh sau khi đóng app. AI thêm store lưu theo API/tài khoản, tự lưu và nút lưu/bỏ nháp, trạng thái khôi phục/lỗi/retry, sao chép ảnh nén vào Documents và dọn sau khi manifest được ghi thành công.
- Gửi tin lỗi giữ dữ liệu. Khi server nhận tin thành công mới clear; nếu dọn local lỗi, chỉ thử dọn lại để tránh POST trùng trong phiên hiện tại. Ảnh thiếu giữ text và báo chọn lại; picker trả muộn khi đổi tài khoản không gắn ảnh cũ.
- `npm run mobile:check`: TypeScript/lint sạch, 69 logic/static + 25 Jest đạt. Android export đạt. Tests dùng disk/files/API giả; chưa kiểm tra force-stop/mở lại trên thiết bị thật. Không tạo APK, tin production hoặc phục hồi bộ submission đã xóa.

## Mẫu cho lần dùng AI tiếp theo

| Ngày thực tế | Thành viên/công cụ | Prompt hoặc mục tiêu | Tệp/chức năng nhận từ AI | Giữ/bỏ/sửa gì | Tự kiểm chứng ra sao | Issue/PR/commit |
| --- | --- | --- | --- | --- | --- | --- |
| Chưa ghi | Điền người thực hiện | Không ghi secret | Điền cụ thể | Nêu quyết định của người làm | Lệnh test + thiết bị + kết quả | Dán liên kết thật |

Không coi kết quả do trợ lý báo là chứng cứ thành viên đã tự chạy. Người thực hiện ghi lại lần kiểm tra của mình và những lỗi tìm thấy, kể cả khi kết quả khác trợ lý.
