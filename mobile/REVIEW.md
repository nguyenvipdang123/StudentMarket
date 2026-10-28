# Rà soát SangTay Mobile

## Rà lại source hiện tại — 28/10/2026

Phạm vi: đọc các luồng auth/API, catalogue/cache, favorites/giỏ, ảnh đăng tin, chi tiết theo ownership, chat, theme và đối chiếu rubric môn học. Chạy `npm run mobile:check`: TypeScript/lint đạt, 45 kiểm thử logic/static và 7 kiểm thử Jest đạt. `expo install --check` ở chế độ offline khớp metadata SDK cài sẵn; không khẳng định đây là kiểm tra phiên bản mới nhất trên registry.

### Các phát hiện và kết quả sửa

1. **Thông báo đổi giá mất sau lỗi hiển thị — đã sửa trong source local.** Bổ sung hàng đợi lưu bền trong `src/state/price-alerts.ts`; refresh giá không đổi vẫn thử các sự kiện còn chờ, dùng lại identifier, chỉ bỏ sự kiện gửi thành công. Tắt thông báo/đăng xuất xóa hàng đợi; refresh loại sự kiện của món đã bỏ lưu. Có kiểm thử lỗi OS tạm thời, khởi động lại, gửi một phần, nhiều refresh, quyền bị tắt, lỗi lưu queue và hủy khi opt-out.
2. **Retry trên Tài khoản sai hành động — đã sửa trong source local.** Lỗi lưu kèm loại hành động: mở hỗ trợ retry đúng URL, lỗi logout retry logout nếu tài khoản còn hiện tại; cảnh báo đã logout local chỉ cho đóng, không làm mới phiên hoặc logout nhầm tài khoản mới. Ba component tests xác nhận các nhánh này.
3. **Sửa lỗi khởi động thông báo chưa có trong release đã công khai.** `src/api/local-notifications.native.ts` và test hồi quy đang là thay đổi local chưa commit tại thời điểm rà soát. Tag `mobile-day10-2026-10-28` vẫn trỏ phiên bản trước bản sửa. Người tải release cũ có thể gặp lại lỗi thiếu ExpoTopicSubscriptionModule. Khi phát hành bản sửa, cần commit mới và release mới, giữ nguyên tag đã nộp.

Probe trong cache phục vụ chẩn đoán, không được tính thêm vào 52 tests của lượt rà soát ban đầu. Hai lỗi đầu được sửa sau khi người dùng yêu cầu, với kết quả mới dưới đây.

Cập nhật sau yêu cầu sửa hai lỗi: `npm run mobile:check` đạt TypeScript/lint, **53 kiểm thử logic/static + 10 kiểm thử Jest**. Chưa kiểm tra notification tray native trên thiết bị; kết quả queue dùng device giả và retry dùng component test.

### Đã có theo rubric, cần chứng minh native thêm

- Sign in/out và SecureStore; catalogue từ API; tạo tin có ảnh nén bắt buộc; tìm kiếm/danh mục trong render; yêu thích dùng chung và lưu bền; giỏ + tổng phí + chặn availability; catalogue offline có banner.
- Góc người bán/người mua theo chủ tin; thông báo giá cục bộ khi app hoạt động/quay lại/làm mới; pull-to-refresh và thời điểm cập nhật ở catalogue/chi tiết/Đã lưu/Tin của tôi.
- Router có 5 tab, dynamic routes, login modal, not-found; token sáng/tối; query library; tests logic/component/auth critical path.
- Chưa xác minh lại sau bản sửa thông báo: khởi động Expo Go, camera/chọn ảnh → gửi tin, quyền/banner thông báo, mở lại app offline và TalkBack/VoiceOver trên điện thoại. Unit tests/bundle export không thay thế các bước thiết bị này.
- Audit Git từ 15–28/10 cho module mobile hiện có 6 commit của 1 tác giả; chưa chứng minh yêu cầu bốn thành viên commit xuyên hai tuần.

### Chức năng còn thiếu khi muốn hoàn thiện sản phẩm

| Ưu tiên | Phần còn thiếu | Hiện tại |
| --- | --- | --- |
| Đã thêm | Sửa/ẩn/hiện/xóa tin và đánh dấu đã bán | Tin của tôi có thao tác chủ tin, hai route edit/sold, xác nhận và retry; ẩn/xóa cần triển khai backend mới |
| Đã thêm | Lưu nháp tin và ảnh qua lần đóng app | Tự lưu và nút lưu offline theo tài khoản/API; ảnh nén lưu Documents; khôi phục, bỏ nháp có xác nhận, giữ khi gửi lỗi; cần xác minh đóng/mở Expo trên thiết bị thật |
| Vừa | Lọc khoảng giá, tình trạng và giá giảm dần | Có từ khóa, trường, danh mục, nổi bật/giá tăng/mới nhất |
| Vừa | Auth native đầy đủ | Đăng ký/Google/OTP/quên mật khẩu còn mở trình duyệt, phiên web riêng |
| Vừa | Gửi ảnh chat, push khi đóng app | App gửi văn bản/xem ảnh; polling khi mở; local price alert không theo dõi khi app đã đóng |
| Sau | Admin, hỗ trợ, lịch hẹn/xác nhận giao dịch/đánh giá | Chưa có màn hình native tương ứng |
| Sau | Đơn hàng/thu tiền/gói đẩy tin | Checkout chỉ tổng kết dự kiến và liên hệ; phù hợp yêu cầu checkout summary hiện có, không phải tích hợp thu tiền |
| Nhỏ | Nhớ lựa chọn sáng/tối | ThemeMode chỉ useState; mở lại trở về Theo thiết bị |

Ưu tiên tiếp theo: xác minh native của bản sửa khởi động/thông báo, phát hành source mới; sau đó hoàn thiện quản lý tin và lưu nháp. Những chức năng mở rộng không tự coi là thiếu MUST HAVE khi thầy chỉ yêu cầu phạm vi rubric đã cung cấp.

## Lịch sử rà soát — 27/10/2026

Phạm vi: mã React Native, hợp đồng API Next.js, kiểm tra SDK/dependencies và kiểm thử client phiên trên Android với HTTP fixture cục bộ. Cập nhật: cả 3 lỗi đã xác định dưới đây đều đã được sửa.

## Lỗi đã xác định

### 1. Phiên hết hạn chưa đưa người dùng về đăng nhập — đã sửa

`src/api/client.ts` chỉ ném ApiError khi API trả 401. Cookie vẫn còn trong SecureStore; `SessionProvider` không nhận sự kiện phiên hết hạn để xóa `user`. Vì vậy màn hình tài khoản còn hiển thị đã đăng nhập trong khi Đã lưu/Đăng tin tiếp tục báo lỗi, không có nút đăng nhập lại ở các trạng thái này.

Kiểm thử native với fixture: login, restoreSession, GET có cookie đều đạt. Sau khi fixture thu hồi phiên, API trả 401 nhưng `restoreSession()` vẫn trả true. Đăng xuất rõ ràng và xóa phiên sau đó đạt. Kết luận về giao diện dựa trên đọc Provider/các màn hình; chưa tái hiện toàn bộ UI của một phiên hết hạn bằng tài khoản production.

Đã thêm bộ quản lý phiên có kiểm tra phiên bản, xóa cookie trong bộ nhớ và SecureStore, thông báo SessionProvider để xóa user và mở Login một lần. Xử lý cả 401 và `/api/auth/me` trả 200 với `user: null`. API login sai mật khẩu được loại trừ; phản hồi 401 từ phiên cũ không xóa phiên mới. Có kiểm thử hồi quy riêng trong `scripts/session-state.test.mjs` và kiểm thử native với API giả; không sửa backend.

### 2. Tin tặng miễn phí hiện thành “Trao đổi” trong Đã lưu — đã sửa

`GET /api/favorites` không trả description hoặc loại giao dịch phân biệt Gift/Exchange. `PersonalProducts` thay description thiếu bằng chuỗi rỗng, trong khi `priceLabel` cần tiền tố `Tặng miễn phí.` để phân biệt giá 0.

Đã bổ sung description và cờ freeGift trong API favorites, tính theo dữ liệu các tin hiện có mà không cần migration. Card mobile ưu tiên cờ này và vẫn hỗ trợ API có description; trang Đã lưu trên web cũng hiển thị đúng món tặng. Kiểm thử cả món tặng giá 0, món trao đổi giá 0 và món bán có giá để tránh đổi nhãn sai.

### 3. Nút Quên mật khẩu dẫn đến đăng ký — đã sửa

Đã tách thành hai nút trong `src/app/login.tsx`: Quên mật khẩu mở `/explore?auth=forgot`, Đăng ký mở `/explore?auth=register`. Quên mật khẩu đặt cạnh khu vực đăng nhập; cả hai có thông báo nếu không mở được trình duyệt. Website hiện có hỗ trợ hai chế độ này nên không cần thay đổi backend hay triển khai Render cho bản sửa này.

## Chức năng chưa có trên mobile

- Admin/staff: dashboard, kiểm duyệt, tài khoản, giao dịch, phiếu hỗ trợ.
- Đăng ký, Google, OTP và quên mật khẩu native: hiện hướng sang trình duyệt.
- Đã có chat văn bản native, lịch sử và trạng thái đã xem dùng chung website. Chưa gửi ảnh từ app, thông báo đẩy và chatbot/AI góp ý tin.
- Quản lý tin đã bổ sung sửa/ẩn/hiện/xóa/đánh dấu đã bán và đổi ảnh bìa; chưa đổi thứ tự toàn bộ gallery hoặc lưu nháp qua lần đóng app.
- Đã có giỏ và checkout tổng kết chi phí, kiểm tra availability; chưa có đặt đơn/thu tiền, gói đẩy tin, QR/thanh toán hoặc thống kê hiệu quả đẩy tin native.
- Lịch hẹn, xác nhận giao dịch, đánh giá, báo cáo và yêu cầu hỗ trợ native.
- Đã có bộ lọc trường với tìm tên/mã trường. Khoảng giá/tình trạng và sắp xếp giá giảm dần chưa có UI dù backend hỗ trợ.
- Đã có APK Android ký riêng và lệnh `npm run mobile:apk`; xem [APK.md](APK.md). Chưa có AAB hoặc phát hành lên cửa hàng.

Các màn hình mở bằng trình duyệt có phiên đăng nhập riêng; đăng nhập app không tự đăng nhập website.

Source Expo hiện được bổ sung offline catalogue, state yêu thích/giỏ chung và ảnh bắt buộc nén; xem [RUBRIC.md](RUBRIC.md). APK 1.0.2 trước đó chưa chứa các bổ sung này; chưa tạo APK mới theo yêu cầu người dùng.

## Kết quả kiểm tra

- TypeScript, ESLint: đạt.
- Kiểm thử tự động: 4/4 đạt; mới bao phủ origin/cookie/ảnh và dữ liệu biểu mẫu, chưa phải kiểm thử toàn bộ nghiệp vụ.
- Kiểm thử native cục bộ trên Expo Go / Android: đăng nhập, đọc lại cookie từ SecureStore, API yêu cầu cookie và đăng xuất đạt; phát hiện lỗi xử lý hết hạn nêu trên. Không dùng mật khẩu thật, không tạo tài khoản/tin/giao dịch production.
- Expo Doctor hiện 19/20: registry vừa có bản vá Expo `~58.0.20` và expo-router `~58.0.27`, trong repo là `58.0.19` / `58.0.26`. Đây là cảnh báo cập nhật patch, không phải bằng chứng app bị crash.
- Máy ảo mất kết nối sau lượt kiểm thử client đầu tiên; chưa kiểm tra lại toàn bộ thao tác UI, chọn ảnh, gửi tin với tài khoản thật, thiết bị vật lý và iOS.

Ba lỗi nêu trên đã được sửa; bộ lọc trường và chat native được bổ sung ngày 28/10. Ưu tiên tiếp theo là thử APK và đăng tin có ảnh trên điện thoại thật, rồi bổ sung Admin theo phạm vi bài môn Mobile.
