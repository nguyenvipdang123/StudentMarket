# APK cài độc lập

Bản mới nhất: **[SangTay Android 1.0.3](https://github.com/nguyenvipdang123/StudentMarket/releases/tag/mobile-v1.0.3)**. Trong Assets, tải `SangTay-v1.0.3-4.apk` để cài; file `.sha256` dùng kiểm tra tải xuống. APK được phát hành bằng GitHub Releases, không đưa binary hoặc khóa ký vào lịch sử source Git.

APK release dùng API `https://sangtay.shop`, đóng gói JavaScript, ảnh nhận diện và font trong ứng dụng. Không cần Expo Go, Metro hay máy tính khi sử dụng; các chức năng lấy dữ liệu vẫn cần Internet.

## Build trên Windows

Từ gốc repo:

```powershell
npm run mobile:apk
```

Script dùng Android SDK từ `ANDROID_HOME` (mặc định `F:\AndroidSdk`) và JDK từ `JAVA_HOME` (mặc định JBR trong `F:\AndroiStudio\jbr`). Cache Gradle dùng `GRADLE_USER_HOME`, mặc định `<ổ project>:\st-gradle` (máy này là `F:\st-gradle`), để đường dẫn header native ngắn và tránh làm đầy ổ C. Build đầu tải thêm Gradle, Maven và Android SDK/NDK nếu cần.

Expo Prebuild sinh thư mục Android; không sửa tay mã native để duy trì bản build. Script giữ nguyên các lệnh Expo Go trong package.json. Gradle tạo bản release; apksigner thay chữ ký thử của template bằng khóa phát hành riêng và xác minh chữ ký cùng căn chỉnh ZIP trước khi xuất file.

Trên Windows, script nạp `scripts/windows-native-paths.gradle` để CMake rút ngắn tên file đối tượng C++ và dùng cache ở đường dẫn ngắn `<ổ project>:\st-cxx` (máy này là `F:\st-cxx`). Có thể đổi bằng biến `SANGTAY_CXX_DIR`; nên giữ đường dẫn ngắn. Mỗi module có thư mục riêng theo hash đường dẫn. Cấu hình áp dụng cả thư viện native, tránh lỗi Ninja do đường dẫn project dài mà không sửa `node_modules`, thư mục Android được sinh hay cấu hình hệ thống.

Kết quả nằm ở `mobile/releases/SangTay-v<version>-<versionCode>.apk`, kèm tệp SHA-256. Bản APK này chứa hai kiến trúc **arm64-v8a** (điện thoại Android 64 bit) và **x86_64** (máy ảo), không dành cho thiết bị chỉ hỗ trợ 32 bit.

Nếu Gradle đã build xong và chỉ cần chạy lại bước ký, từ gốc repo chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File mobile/scripts/build-apk.ps1 -SignOnly
```

## Bản cập nhật 1.0.3 — 29/10/2026

- VersionCode 4, package `shop.sangtay.mobile`, dùng khóa ký SangTay hiện có để cập nhật bản cũ mà không gỡ app.
- Có đăng ký/ảnh thẻ, OTP/gửi lại mã, quên mật khẩu và hồ sơ Google native; Google xác thực trong cửa sổ hệ thống rồi nhận phiên về app, xem [AUTH.md](AUTH.md).
- Thêm lưu nháp nội dung và ảnh trên thiết bị, quản lý sửa/ẩn/hiện/xóa/đã bán, lọc khoảng giá/tình trạng/giá giảm dần. Bao gồm các sửa lỗi phiên, thông báo đổi giá và retry Tài khoản.
- Source đã qua TypeScript, lint và 114 kiểm thử mobile. API production `/api/auth/mobile/config` trả 200/JSON version 1 với Google/Turnstile bật; chưa coi đó là kiểm thử OTP/Google/Turnstile đầu-cuối bằng tài khoản thật.
- Gradle release build đạt, chữ ký v2/v3 dùng đúng chứng chỉ SangTay cũ và zipalign 16 KB đạt. APK 59.963.011 byte, arm64-v8a/x86_64, Android API 24+, versionName 1.0.3/code 4. SHA-256: `45FC6D61EFF773B4490D5AF8C4A5B87A96CE99D7D3DAA1D3ED2B09C1949CFFDB`.
- Cài đè thành công từ 1.0.0 lên 1.0.3 trên Pixel_7 emulator, mở app không cần Metro/Expo Go; Khám phá tải 34 sản phẩm và hiển thị trường/bộ lọc. Không có lỗi khởi động trong log app đã đọc. Chưa thử thiết bị vật lý hoặc đăng nhập/OTP/Google thật trong APK này.
- API catalogue/chat/xác thực vẫn cần Internet; catalogue đã lưu xem được offline. Admin, thanh toán và các tính năng chỉ có trên website chưa tự trở thành màn hình native.

## Bản cập nhật 1.0.2 — 28/10/2026

- File `SangTay-v1.0.2-3.apk`, versionCode 3, dùng cùng package và khóa phát hành để cài đè bản cũ.
- Nhắn người bán ngay từ chi tiết món đồ và trả lời người mua trong tab Tin nhắn; gửi văn bản, đọc lịch sử/ảnh từ website và trạng thái đã xem. Chat cập nhật khi màn hình mở; chưa gửi ảnh native hoặc thông báo đẩy.
- TypeScript, lint, 23/23 kiểm thử mobile và 39/39 nhóm tích hợp API với database local đạt. Đã kiểm tra giao diện bằng dữ liệu giả trên bản xem thử React Native Web.
- Gradle release build, chữ ký v2/v3 và zipalign 16 KB đạt. APK 58.515.938 byte, arm64-v8a/x86_64, Android API 24 trở lên; bundle đã có chat và không chứa route/dữ liệu xem thử. SHA-256: `EED4C137F9F1585A0CF7F4037ABBD081464460FB8A9C9C183FBA8D7606FBDAD6`.
- Chưa kiểm thử cài/mở bản APK mới trên thiết bị Android thật; xem [VALIDATION.md](VALIDATION.md) để phân biệt kết quả web/API và thiết bị.

## Bản cập nhật 1.0.1 — 28/10/2026

- File `SangTay-v1.0.1-2.apk`, khoảng 56 MB; versionCode 2, cùng package và chứng chỉ ký với bản 1.0.0 nên cài đè để cập nhật, không cần gỡ app.
- Thêm bộ lọc trường dưới ô tìm kiếm trong Khám phá: tìm tên/mã trường, chọn trường và bỏ lọc; giữ trường khi làm mới/tải thêm.
- TypeScript, lint và 16/16 kiểm thử đạt. Bản xem thử ở kích thước điện thoại đã kiểm tra chọn DNTU, tìm tên UTH không dấu và bỏ lọc.
- Gradle release build, chữ ký v2/v3 và zipalign đều đạt. Đã đọc bundle trong APK để xác nhận có bảng chọn trường, API production và không có địa chỉ proxy preview.
- Chưa kiểm thử cài/mở APK mới trên thiết bị Android thật. Kiểm tra giao diện React Native Web không thay thế kiểm thử thiết bị.

## Bản 1.0.0 đã tạo trước đó ngày 28/10/2026

- File `SangTay-v1.0.0-1.apk`, khoảng 56 MB; package `shop.sangtay.mobile`, versionCode `1`, Android 7.0/API 24 trở lên trên hai kiến trúc nêu trên.
- Gradle release build thành công; apksigner xác minh chữ ký v2/v3 bằng khóa riêng SangTay; zipalign xác minh căn chỉnh 16 KB.
- Kiểm tra APK có bundle JavaScript, font và thư viện React Native của cả hai kiến trúc. API sản phẩm thật trả HTTP 200/JSON với thông tin client Android.
- Chưa kiểm thử cài/mở APK trên thiết bị: Android Emulator 37.1.11 trên máy hiện thoát với lỗi thiếu DLL `0xC0000135`. Việc kiểm tra nội dung và chữ ký APK không thay thế kiểm thử trên điện thoại thật.

## Cài đặt

Chép APK sang điện thoại và mở file bằng trình quản lý tệp. Android có thể yêu cầu bạn cho phép ứng dụng đang mở file cài APK. Chỉ cần thực hiện trên điện thoại muốn cài.

Với Pixel_7 đang mở trên máy phát triển:

```powershell
F:\AndroidSdk\platform-tools\adb.exe install -r mobile\releases\SangTay-v1.0.3-4.apk
```

App xuất hiện với tên **SangTay**, application ID `shop.sangtay.mobile`. Đã có chat và các form xác thực native; Admin, thanh toán và AI chưa có màn hình native.

## Giữ khóa ký để cập nhật app

Script tạo và tái sử dụng khóa riêng ở `mobile/.credentials/sangtay-release.keystore`, alias `sangtay-release`. Mật khẩu được mã hóa bằng Windows DPAPI trong `sangtay-password.dpapi`; chỉ tài khoản Windows và máy hiện tại giải mã được. Cả thư mục khóa, cache và APK đều bị loại khỏi Git.

Không xóa khóa: các APK cập nhật cần dùng cùng khóa ký. Trước khi cài lại Windows hoặc chuyển máy, sao lưu khóa và lưu mật khẩu vào trình quản lý mật khẩu. Bạn có thể tự lấy mật khẩu vào clipboard bằng PowerShell trên máy hiện tại (không gửi vào chat/GitHub):

```powershell
$secret = Get-Content mobile/.credentials/sangtay-password.dpapi -Raw | ConvertTo-SecureString
(New-Object Management.Automation.PSCredential('sangtay', $secret)).GetNetworkCredential().Password | Set-Clipboard
```

Dán vào nơi lưu mật khẩu riêng, rồi xóa clipboard. Với lần phát hành tiếp theo, tăng `expo.android.versionCode` trong `mobile/app.json` và build lại bằng cùng thư mục khóa. Nếu cần đưa lên Google Play, cần cấu hình và tạo AAB riêng.
