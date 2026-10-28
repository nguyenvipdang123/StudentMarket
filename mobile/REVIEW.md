# Rà soát SangTay Mobile — 27/10/2026

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
- Quản lý tin: mới xem/tạo, chưa sửa/xóa/ẩn/đánh dấu đã bán; chưa đổi thứ tự ảnh, chọn ảnh bìa hoặc lưu nháp qua lần đóng app.
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
