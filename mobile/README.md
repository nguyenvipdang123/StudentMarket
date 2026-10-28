# SangTay Mobile

Build bản cài Android độc lập bằng `npm run mobile:apk` từ gốc repo. Xem [hướng dẫn APK](APK.md) về file cài, công cụ build và khóa ký để cập nhật app.

Hiện đang hoàn thiện **bằng Expo**, chưa tạo APK mới cho các yêu cầu môn học. Xem [đối chiếu MUST HAVE và kịch bản demo](RUBRIC.md).

Ứng dụng **React Native + Expo + TypeScript**, dùng chung API và dữ liệu của [sangtay.shop](https://sangtay.shop). Giao diện native được viết riêng cho điện thoại; website Next.js vẫn nằm ở `../frontend`.

## Chạy Android trên máy này

Yêu cầu Node.js 22+, Android Studio và SDK. Máy hiện có SDK tại `F:\AndroidSdk`, AVD `Pixel_7`.

Từ thư mục gốc repo:

```powershell
npm --prefix mobile ci
npm run mobile:android
```

Hoặc vào thư mục `mobile` rồi chạy `npm run android:local`. Script tìm SDK từ `ANDROID_HOME`, mặc định dùng `F:\AndroidSdk`; tự thiết lập đường dẫn ADB cho phiên terminal. Có thể mở Pixel_7 trước trong Android Studio → Device Manager. Giữ terminal Metro chạy trong lúc dùng app. Lần đầu Expo CLI có thể tải Expo Go tương thích SDK 58 vào emulator.

Script gọi trực tiếp Expo CLI trong `mobile/node_modules`, tránh lỗi shim `npx.ps1` của Windows PowerShell. Nếu báo thiếu dependencies, chạy lại `npm --prefix mobile ci` từ gốc repo. Nếu cổng 8081 đã có Metro chạy, có thể trả lời `Y` khi được hỏi dùng cổng tiếp theo.

Trên máy khác, đặt `ANDROID_HOME` đến SDK của máy đó rồi chạy `npm run android`. Muốn chạy điện thoại thật qua Expo Go, dùng `npm start` và kết nối cùng mạng Wi-Fi. Phiên bản Expo Go phải tương thích SDK 58; nếu bản trên cửa hàng chưa hỗ trợ SDK này, dùng emulator hoặc development build theo tài liệu Expo.

## Phạm vi bản đầu

- Catalogue tải đủ trang từ API và lưu bản thành công gần nhất trên máy. Tìm từ khóa không dấu, lọc danh mục/trường và sắp xếp được tính trực tiếp khi render; không lưu danh sách lọc thành state. Offline vẫn xem/tìm/lọc bản lưu với banner; lần đầu chưa có dữ liệu luôn hiện hướng dẫn và nút thử lại.
- Chi tiết sản phẩm, vuốt ảnh, thông tin người bán và hướng dẫn giao dịch an toàn.
- Đăng nhập email/mật khẩu bằng tài khoản đã xác minh trên website; lưu **cookie phiên** trong Expo SecureStore, không lưu mật khẩu. Khôi phục phiên khi mở app và đăng xuất qua API.
- Khi API xác nhận phiên hết hạn (401 hoặc `/api/auth/me` trả `user: null`), app xóa cookie, bỏ trạng thái đăng nhập và mở màn hình đăng nhập một lần kèm thông báo. Lỗi mật khẩu sai, mất mạng hoặc lỗi server không tự xóa phiên hợp lệ; phản hồi cũ không làm mất phiên vừa đăng nhập lại.
- Yêu thích dùng chung state ở Khám phá, Chi tiết và Đã lưu, lưu AsyncStorage riêng từng tài khoản và đồng bộ API. Đã lưu và giỏ khôi phục sau khi mở lại; không hiện dữ liệu của tài khoản trước sau đăng xuất/đổi tài khoản.
- Giỏ hàng từ biểu tượng ở Khám phá hoặc Tài khoản. Mỗi tin số lượng 1; checkout tính tạm tính/phí giao/tổng, kiểm tra lại giá/tình trạng từ API và chặn món đã bán/giữ chỗ/không xác minh được. Đây là bảng dự tính và liên hệ người bán, chưa tạo đơn hoặc thu tiền.
- Sinh viên tạo tin chờ duyệt với ít nhất 1 và tối đa 8 ảnh từ thư viện/camera; ảnh được nén JPEG 72%, tối đa 1.600px và 5 MB trước khi gửi. Màn hình giữ dữ liệu khi API báo lỗi; chưa có bản nháp lưu qua lần đóng app.
- Nhắn tin người bán ngay trong chi tiết sản phẩm; tab Tin nhắn có cả cuộc trò chuyện mua và bán, số tin chưa đọc, lịch sử và trạng thái đã xem dùng chung với website. Gửi văn bản ngay trong app và xem ảnh người dùng gửi từ website; chưa gửi ảnh từ app. Gửi lỗi giữ nội dung đang soạn, không tự gửi lại để tránh trùng tin.
- Lịch sử chat cập nhật mỗi 5 giây, danh sách cuộc trò chuyện mỗi 15 giây khi màn hình đang mở; dừng khi chuyển màn hình hoặc đưa app vào nền. Chưa có thông báo đẩy khi đóng app.
- Đăng ký, quên mật khẩu, Google và hỗ trợ mở trên website, có thể cần đăng nhập riêng trên trình duyệt. Chưa có thanh toán native, AI hoặc màn hình Admin.

App và website dùng chung dữ liệu thật: đăng tin hoặc lưu sản phẩm trên app sẽ thay đổi tài khoản thật. Không cần sao chép database hay API key vào app.

## Cấu hình API

Mặc định `https://sangtay.shop`. Muốn thay đổi, sao chép `.env.example` thành `.env`:

```dotenv
EXPO_PUBLIC_API_URL=https://sangtay.shop
```

Biến `EXPO_PUBLIC_*` được đóng vào app và **công khai**. Chỉ đặt URL, tuyệt đối không đặt Gemini key, Supabase secret, SMTP, SePay secret hay database URL vào đây. Khởi động lại Metro sau khi đổi URL.

Backend local Next.js trên cổng 3000: emulator Android dùng `http://10.0.2.2:3000` (địa chỉ máy host); localhost trong emulator là chính điện thoại. HTTP chỉ được chấp nhận cho localhost/127.0.0.1/10.0.2.2; bản sử dụng thực cần HTTPS. Cấu hình WAF cho API cần cho phép client native, không đưa HTML challenge vào mọi API. Các quy tắc xác thực và giới hạn tần suất trên server vẫn áp dụng.

## Cấu trúc

```text
src/app/          Expo Router: tabs, đăng nhập, chi tiết, tin của tôi
src/api/          API client, DTO, kiểm tra URL/session và dữ liệu đầu vào
src/components/   Thành phần giao diện dùng lại
src/providers/    Phiên đăng nhập
src/state/        Catalogue offline, yêu thích và giỏ dùng chung, quy tắc checkout
src/hooks/        Cập nhật chat theo trạng thái màn hình và ứng dụng
src/theme.ts      Màu và typography SangTay
assets/fonts/     Font dùng chung nhận diện với website và giấy phép
scripts/          Khởi chạy Android và kiểm thử
```

## Kiểm tra / đóng gói

```powershell
npm run typecheck
npm run lint
npm test
npm run test:chat-integration
npx expo-doctor
npx expo export --platform android
```

Lệnh export kiểm tra bundle JavaScript/assets, **không tạo APK**. Cần development/production build để tạo APK/AAB, cấu hình bằng `app.json` và Expo CNG/EAS; không sửa tay thư mục native được sinh. Android application ID: `shop.sangtay.mobile`.

Tài liệu: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [chạy Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/).

`test:chat-integration` cần PostgreSQL local cấu hình trong `frontend/.env.local` và bản build frontend hiện có. Script từ chối host database ngoài localhost, tạo database tạm, chạy API thật với tài khoản giả rồi dọn dữ liệu; không gửi tin nhắn tới người dùng production.
