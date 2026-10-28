# Đối chiếu yêu cầu kỹ thuật Mobile

Phạm vi là module `mobile/` (ứng dụng Expo); website Next.js/backend có sẵn trong `frontend/` là project riêng, không được đổi toàn bộ hệ màu web trong đợt này.

| Yêu cầu | Triển khai/bằng chứng |
| --- | --- |
| SDK 56+, TS, Router, function components/hooks | Expo 58, React Native 0.88, TS strict; route/components dạng function. `ApiError` là lớp lỗi dữ liệu, không phải React class component. |
| ≥5 màn hình, dynamic, modal, not-found | 5 tab, chi tiết `listing/[id]`, chat `chat/[id]`, liên hệ `contact/[listingId]`, giỏ/checkout/tin của tôi; `login` dùng Stack `presentation: modal`; `src/app/+not-found.tsx` có lối về Khám phá. |
| Loading/empty/error+retry/content | `ScreenState`, trạng thái API/form/auth và `ErrorBoundary` cấp Router; xem bảng bên dưới. |
| Một token file cho sáng/tối | `src/tokens.ts` chứa toàn bộ colour literal; `theme.ts` lấy scheme thiết bị hoặc tùy chọn Sáng/Tối ở Tài khoản. `app.config.ts` cũng nhập token cho splash/icon. |
| Role/label, ≥44×44, contrast ≥4,5:1 | Controls dùng role+label, TextInput giữ vai trò nhập liệu native và label (search có searchbox); buttons/chips/icon nhỏ có target tối thiểu. Kiểm thử các cặp chữ/nền của cả hai palette. Cần TalkBack/VoiceOver trên thiết bị để bổ sung kiểm chứng thực. |
| Shared store + selectors | `state/account.ts`, `catalogue.ts`, `price-alerts.ts`; selector `selectSaved`, `selectFavorites`, `selectCartCount`, `selectCheckout` trong `state/selectors.ts`; UI đọc qua context/useSyncExternalStore. |
| Server data library | TanStack Query: mọi GET qua `queryClient.fetchQuery`, dedupe theo API origin + revision phiên + path; chi tiết dùng `useQuery`. Mutations làm stale cache, không tự retry POST. Snapshot offline là bản public/non-secret riêng; cache server không ghi cookie ra disk. |
| Secrets chỉ SecureStore | Cookie và Google verifier/pending token native dùng Expo SecureStore theo API origin. Password/OTP chỉ ở form RAM, không log/persist/URL. AsyncStorage giữ catalogue, yêu thích/giỏ, cài đặt và nháp tin không bí mật. Web preview không thay SecureStore bằng localStorage. Không đóng server secrets vào `EXPO_PUBLIC_*`. |
| Strict/typecheck/lint | `npm run typecheck` (`tsc --noEmit`), `npm run lint` (`expo lint`), lệnh tổng từ root `npm run mobile:check`. |
| Logic/component/critical path tests | `scripts/*.test.mjs` gồm logic/contrast; `tests/components.test.tsx` kiểm UI states/disabled; `tests/auth-critical.test.tsx` dùng SessionProvider/client thật + API giả để kiểm sai mật khẩu→retry→SecureStore→remount→logout; query cache có test riêng. |
| Commits mỗi thành viên xuyên hai tuần | **Chưa được chứng minh.** Lịch sử gần đây tập trung một tác giả; không tạo giả. Xem `TEAM.md` và lịch sử Git thật. |
| README + AI_LOG toàn nhóm | README ở module và lối vào từ root; `../AI_LOG.md` có những phiên hỗ trợ đã biết, phân công bốn thành viên và mẫu nhật ký cho từng người. Nhật ký cũ chưa có không được tự bịa. |

## Trạng thái theo loại màn hình

| Màn hình | Loading | Empty | Error/retry | Content |
| --- | --- | --- | --- | --- |
| Khám phá | Tải/khôi phục catalogue | Chưa có dữ liệu/không khớp filter | Thử lại API; giữ cache | Grid/filter/search |
| Đã lưu/Tin của tôi/Tin nhắn | Khôi phục phiên/tải dữ liệu | Chưa login hoặc chưa có món/phòng | Nút tải lại; lỗi không xóa dữ liệu tốt | Danh sách |
| Chi tiết/Chat | Query/lịch sử | Tin/phòng thiếu, chưa có message | Refetch lịch sử/tin; giữ draft gửi lỗi | Tin hoặc hội thoại |
| Contact | Tạo/lấy phòng | Chưa đăng nhập/id không hợp lệ | Tạo lại phòng bằng nút Thử lại | Chuyển vào Chat khi API thành công |
| Giỏ/Checkout | Khôi phục store/kiểm tra API | Giỏ trống/chưa login | Kiểm tra lại, xóa món lỗi; giữ giỏ | Dòng món + tổng chi phí |
| Login/Đăng tin/Tài khoản | Session, gửi form, nén ảnh, logout | Chưa login/form trống/ảnh chưa chọn | Retry thao tác với dữ liệu form còn nguyên | Form/profile |
| Đăng ký/OTP/Quên mật khẩu/Google | Gửi form/chọn ảnh/xác minh/nhận phiên; tải profile SecureStore | Form trống/chưa bắt đầu/Google chưa trả kết quả | Retry đúng thao tác; không dùng lại OTP/handoff đã nhận khi chỉ lỗi kiểm tra identity | Form native, mã, kết quả chờ duyệt/thành công; xem AUTH.md |
| Not-found | Không tải dữ liệu | Đường dẫn không tồn tại | Hành động về Khám phá; Router boundary xử lý crash | Trang điều hướng an toàn |

Màn hình tĩnh/form không bịa bốn request trạng thái để làm demo. Với không tìm thấy đường dẫn, thông báo không có màn hình là nội dung đúng; loading/content API chỉ áp dụng màn hình có dữ liệu bất đồng bộ.

## Tự kiểm tra trên máy sạch

Theo `README.md`, chạy `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` trong `mobile/`. `npm run test:chat-integration` là test tùy chọn cần backend/PostgreSQL local; tests thường không yêu cầu database hoặc tài khoản thật.

Kiểm tra thiết bị: bật/tắt theme, đọc chữ/các input bằng TalkBack/VoiceOver, tăng cỡ chữ, mở route sai, thử API lỗi rồi retry, bật máy bay sau khi có cache, thử thông báo và camera. Bundle export và test renderer không thay thế các bước này.

Kết quả lượt 28/10: 45 pure-logic/static checks + 5 Jest tests đạt; typecheck/lint sạch, config Expo/bundle Android/dry-run npm ci đạt. Chi tiết bằng chứng và giới hạn thử thiết bị xem `VALIDATION.md`.
