# Kiểm tra bản mobile đầu tiên — 27/10/2026

## Cài lại dependencies và chuẩn bị GitHub — 28/10/2026

- Khôi phục dependencies bằng `npm --prefix mobile ci`, giữ nguyên lockfile.
- TypeScript, lint và 13/13 kiểm thử đạt. Xuất bundle Android lại thành công với 1.259 module và 49 assets.
- Đã tạo APK release 1.0.0/versionCode 1, ký riêng và kiểm tra chữ ký/căn chỉnh ZIP; xem [APK.md](APK.md). APK, khóa ký, dependencies và cache được loại khỏi Git cũng như ZIP mã nguồn sao lưu.
- Chưa kiểm thử lại APK trên thiết bị thật; Android Emulator trên máy hiện có lỗi DLL. Những kiểm thử Expo Go ngày 27/10 dưới đây là kết quả lịch sử, không phải kiểm thử APK mới.

## Bổ sung: liên kết quên mật khẩu

- Tách Quên mật khẩu và Đăng ký thành hai nút; mở lần lượt `auth=forgot` và `auth=register` trên website đã hỗ trợ hai chế độ.
- TypeScript, lint và 13/13 kiểm thử hiện có đạt sau thay đổi. Không thay đổi luồng gửi OTP/đặt lại mật khẩu của backend.

## Bổ sung: nhãn món tặng trong Đã lưu

- API favorites bổ sung description và freeGift từ tin đăng hiện có; mobile và web Đã lưu dùng đúng nhãn.
- 13/13 kiểm thử mobile và 3/3 kiểm thử mapper API đạt; TypeScript mobile/frontend và lint đạt (frontend còn cảnh báo ảnh img có sẵn).
- Đã kiểm tra nối dữ liệu mapper API → dữ liệu card mobile → priceLabel: món tặng giá 0 là Tặng miễn phí, món trao đổi giá 0 là Trao đổi, món bán 50.000đ giữ giá tiền.
- Backend/web commit `8e3b7fb` đã triển khai live trên studentmarket-web; health trả 200. Bundle trang Đã lưu đã có điều kiện freeGift. Đối chiếu thêm dữ liệu công khai của tin “Mèo con tìm chủ” cho nhãn Tặng miễn phí. Chưa đọc danh sách đã lưu của tài khoản thật trong lượt kiểm tra này.

## Bổ sung: sửa phiên hết hạn

- TypeScript, ESLint và 12/12 kiểm thử tự động đạt (gồm 8 ca hồi quy quản lý phiên).
- Kiểm thử Pixel_7 bằng tài khoản giả và API cục bộ: 2 phản hồi 401 đồng thời chỉ phát 1 sự kiện hết hạn, xóa cookie trong SecureStore và xóa user khỏi Provider; màn hình hiện `/login` với đúng 1 route Login và thông báo hết hạn.
- Đăng nhập lại thành công; 401 trả chậm từ phiên cũ không xóa phiên mới. Sai mật khẩu và lỗi 503 giữ phiên hợp lệ. `/api/auth/me` trả 200 `{user:null}` cũng xóa phiên và không tạo thêm màn hình Login khi Login đang mở.
- Không tạo tài khoản, tin đăng hoặc giao dịch thật. Route kiểm thử tạm đã được gỡ khỏi mã ứng dụng.

## Kết quả bản đầu trước khi sửa

- `npm run typecheck`: đạt.
- `npm run lint`: đạt, không lỗi/cảnh báo lint.
- `npm test`: 4/4 đạt (origin HTTPS, cookie phiên, URL ảnh, dữ liệu đăng tin và giá).
- `npx expo-doctor`: 20/20 đạt.
- `npx expo export --platform android`: tạo bundle Hermes và assets thành công; đây chưa phải APK.
- Pixel_7 / Android 13 / Expo Go 58.0.5: app khởi động; màn hình Khám phá tải 34 sản phẩm công khai cùng ảnh từ sangtay.shop; deep link mở được chi tiết sản phẩm, giá và màn hình đăng nhập native.

Chưa kiểm thử đầu-cuối với tài khoản thật: đăng nhập/khôi phục phiên/đăng xuất, lưu sản phẩm, chọn ảnh và gửi tin. Cần người dùng đăng nhập để xác nhận các luồng này; đợt kiểm tra không tạo tài khoản hoặc tin giả trên production. Chưa kiểm thử iOS, thiết bị vật lý hay bản APK độc lập.

`npm audit --omit=dev` ghi nhận 3 cảnh báo high theo chuỗi Expo → Expo CLI → Zod trong bộ công cụ. Gợi ý tự động là hạ Expo về SDK 54, nên chưa áp dụng thay đổi gây lệch SDK. Cần theo dõi bản vá tương thích của Expo CLI trước khi dùng Metro ở môi trường mở; script local dùng kết nối ADB để chạy emulator. Không phát hành Metro như một backend production.
