# Đối chiếu MUST HAVE môn Lập trình Mobile

Các thay đổi trong tài liệu này dành cho **source Expo**, chưa tạo APK mới. API mặc định vẫn là `https://sangtay.shop`; không cần chạy website localhost:3000.

| Yêu cầu | Cách triển khai | Mã chính |
| --- | --- | --- |
| Sign in/out, persistent session, complete sign-out | Cookie phiên trong SecureStore; mở lại app xác minh `/api/auth/me`; 401 xóa phiên. Đăng xuất gọi API thu hồi và luôn xóa cookie/UI local kể cả mất mạng. | `src/providers/Session.tsx`, `src/api/client.ts`, `src/api/session-state.ts`, `src/api/logout.ts` |
| Remote listings, tạo tin có ít nhất một ảnh nén từ thiết bị | Catalogue lấy đủ các trang API. Thư viện hoặc camera → xử lý tuần tự bằng ImageManipulator → JPEG chất lượng 0,72, chiều tối đa 1.600px → kiểm tra kích thước → multipart. Chặn gửi nếu không có ảnh. | `src/api/catalog.ts`, `src/api/photos.ts`, `src/api/photos-policy.ts`, `src/app/(tabs)/post.tsx` |
| Category + text search computed during render, không lưu derived state | Chỉ lưu catalogue gốc và input query/category/school/sort/giới hạn hiển thị. Mỗi render gọi `selectProducts`; danh sách lọc, số kết quả và phần hiển thị là biến thông thường, không phải state/useEffect. Tìm không dấu và lọc trường vẫn hoạt động offline. | `src/app/(tabs)/index.tsx`, `src/api/catalog.ts` |
| Favourites shared state, persisted, hai màn hình | Một account store dùng chung qua Context + useSyncExternalStore. Trái tim ở Khám phá/Chi tiết và Đã lưu đọc cùng nguồn; thay đổi nhận xác nhận API rồi lưu AsyncStorage. Mỗi tài khoản/API origin có key riêng. | `src/providers/Market.tsx`, `src/state/account.ts`, `src/components/FavoriteButton.tsx`, `src/components/SavedProducts.tsx` |
| Cart + checkout subtotal/delivery/total, availability messages | Giỏ chung được lưu trên máy; mỗi tin số lượng 1. Chặn tin đã bán, giữ chỗ, chờ duyệt, món của chính mình và trao đổi. Kiểm tra lại API trước checkout; tin không xác minh được cũng chặn. Tổng tiền tính khi render. | `src/state/commerce.ts`, `src/components/CartScreen.tsx`, `src/app/cart.tsx`, `src/app/checkout.tsx` |
| Offline last successful catalogue + banner + không trắng màn hình | Lưu catalogue gốc sau khi tải thành công **đủ trang**. Lỗi tải mới giữ bản cũ; mở lại khôi phục bản lưu trước. Có banner và thời gian cache; chưa có cache thì hiện hướng dẫn/thử lại, không giả vờ có dữ liệu. | `src/state/catalogue.ts`, `src/providers/Market.tsx`, `src/components/OfflineBanner.tsx` |

## Quy tắc giỏ/checkout

- Mỗi tin là một món duy nhất, số lượng luôn 1; bấm thêm trùng nhận thông báo. Giỏ chưa tạo giữ chỗ.
- Tự nhận: 0đ. Giao hàng dự tính: 30.000đ mỗi người bán khác nhau; nhiều món cùng người bán tính một lần. Phí thực tế cần thỏa thuận.
- Giá thay đổi: cập nhật giỏ và yêu cầu xem tổng tiền lại. Hết hàng, giữ chỗ, tin ẩn/xóa hoặc API không kiểm tra được: chỉ ra món lỗi và chặn tiếp tục.
- Checkout hiện là **bảng tổng kết chi phí**, có liên hệ người bán. Không đặt đơn, trừ tiền, tích hợp vận chuyển hay sử dụng SePay của gói đẩy tin. Nếu thầy yêu cầu tạo đơn/thu tiền thật thì đó là phạm vi bổ sung.

## Kịch bản demo trên Expo Go

1. Từ gốc repo chạy `npm --prefix mobile ci`, rồi `npm run mobile:android` (Android emulator) hoặc `npm run mobile` (Expo Go trên điện thoại). Dùng Expo Go tương thích SDK 58.
2. Đăng nhập tài khoản sinh viên đã xác minh; đóng/mở lại app và kiểm tra phiên còn. Đăng xuất rồi mở lại: tài khoản, chat, giỏ và Đã lưu không được hiện dữ liệu phiên vừa thoát. Có mạng thì API cũng thu hồi phiên; khi offline app báo rõ chưa xác nhận thu hồi server.
3. Đăng tin: chưa chọn ảnh phải bị chặn. Chọn ảnh/chụp ảnh, xem nhãn “Đã nén” và dung lượng, điền đủ thông tin rồi gửi. Dùng tài khoản/tin được phép kiểm thử vì API production tạo tin thật.
4. Gõ từ khóa không dấu rồi chọn danh mục/trường; kết quả đổi ngay, không cần bấm gửi/tải API mỗi lần. Xóa từ khóa và bỏ lọc kiểm tra lại catalogue đầy đủ.
5. Bấm trái tim ở Khám phá, mở Chi tiết rồi Đã lưu: trạng thái đồng bộ. Đóng/mở app, kiểm tra còn món đã lưu; bỏ lưu và xem trái tim đổi ở màn hình kia.
6. Thêm 2 món bán vào giỏ, kiểm tra số lượng 1, xóa món, đổi cách nhận và kiểm tra ba dòng tạm tính/phí/tổng. Đến checkout app kiểm tra API lại. Tin bán/giữ chỗ cần bị chặn kèm lý do.
7. Tải catalogue một lần thành công. Bật chế độ máy bay, mở lại app: vẫn có catalogue cũ và banner; tìm kiếm/lọc vẫn hoạt động. Mở chi tiết từ cache và kiểm tra không thể checkout offline. Lần cài đầu chưa tải được lần nào phải có hướng dẫn/thử lại, không phải màn hình trắng.

## Kiểm chứng

`npm run mobile:check` chạy TypeScript, lint và kiểm thử tự động, gồm lưu/khôi phục catalogue, favorites/giỏ, cô lập tài khoản, chống phản hồi cũ, công thức checkout, availability, ảnh bắt buộc và đăng xuất khi API lỗi. Kiểm thử đơn vị không thay thế demo camera, SecureStore, khởi động lại và chế độ máy bay trên Android/iOS thật.
