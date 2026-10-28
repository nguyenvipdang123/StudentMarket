# Xác thực native SangTay — 29/10/2026

## Luồng trên app

- Tài khoản/Đăng nhập có các nút Đăng ký, Xác minh email / OTP, Google trường, Quên mật khẩu. Các form là route native `src/app/auth/*`, không chuyển form sang website.
- Đăng ký: họ tên, email, MSSV, trường, mật khẩu/xác nhận; email cá nhân cần ảnh thẻ chọn trên thiết bị, nén JPEG trước khi tải. Thành công chuyển sang nhập OTP; mật khẩu được xóa khỏi form. Email trường được tự duyệt sau OTP; email cá nhân vẫn chờ Admin duyệt ảnh thẻ. App không tự nâng quyền/chuyển trạng thái.
- Xác minh: email + OTP 6 số, gửi lại mã có thời gian chờ 60 giây. Mã hết hạn/sai có lỗi và thử lại, không xóa dữ liệu nhập. Nếu API trả user/cookie, app xác nhận `/api/auth/me` trước khi hiện đăng nhập.
- Quên mật khẩu: gửi OTP → nhập OTP và mật khẩu mới/xác nhận → về Đăng nhập native. API giữ phản hồi trung tính cho email không tồn tại, khóa thử mã/rate limit và thu hồi phiên cũ. Không lưu OTP/mật khẩu vào disk, URL, log hoặc AsyncStorage.
- Turnstile: nếu server bật, app mở WebView chỉ chứa challenge ở chính API origin; token dùng một lần trong request hiện tại. Giữ nguyên kiểm tra action/hostname/secret của backend. Không có header/secret chung trong app để bỏ qua chống bot.
- Google: app tạo verifier ngẫu nhiên bằng expo-crypto, gửi SHA-256 challenge lên server, cất verifier/flowId ngắn hạn trong SecureStore. Cửa sổ hệ thống hiển thị Google; callback HTTPS hiện có xác minh chữ ký JWT/audience/nonce/PKCE/Workspace trường. Sau khi hoàn tất, **đóng cửa sổ Google để trở về app**, app kiểm tra kết quả; có nút Kiểm tra kết quả Google. Không cần scheme callback riêng của Expo Go hoặc cấu hình OAuth client Android mới cho cách bàn giao này.
- Browser bridge không trả cookie, token Google, email hay onboarding token vào URL/HTML. App phải chứng minh verifier mới nhận session hoặc token bổ sung hồ sơ. Handoff hết hạn sau 10 phút, chỉ nhận một lần; hoàn tất hồ sơ dùng transaction/row lock, không tạo trùng khi gửi đồng thời. Tên/MSSV/trường bổ sung bằng native form. Session và Google pending secrets chỉ nằm SecureStore theo API origin; đăng xuất dọn cả hai.

## Triển khai backend trước khi dùng với API thật

1. Đưa source mới lên nhánh `main`.
2. Render → **studentmarket-web → Manual Deploy → Deploy latest commit**. Giữ Pre-Deploy Command **`npm run db:migrate`** (Blueprint đã cấu hình): bổ sung bảng `mobile_google_flows` trong migration auth. Không cần chạy migration thủ công trên database thật nếu Pre-Deploy đã hoàn tất.
3. Dùng các biến hiện có của service: `APP_ORIGIN=https://sangtay.shop`, Google client ID/secret/redirect URI, SMTP, email-code secret, Turnstile site/secret keys. Không đưa các secret này vào `mobile/.env`. Callback Google vẫn là `https://sangtay.shop/api/auth/google/callback` nếu server đang cấu hình như vậy.
4. Mở `/api/auth/mobile/config`: phải trả JSON có `version: 1` cùng hai cờ boolean (không có secret). Trả 404 nghĩa là service chưa chạy source mới. Cờ Google/Turnstile chỉ báo có cấu hình, không chứng minh kết nối ngoài đã hoạt động.
5. Cài dependencies cập nhật trong `mobile` bằng `npm ci`, khởi động/reload Metro Expo. Các thư viện dùng có bản trong Expo Go SDK 58; không tạo APK trong lượt sửa này. APK cũ không tự có module/code mới.

WAF cần cho API native nhận JSON, không trả HTML challenge cho toàn bộ `/api/*`. Turnstile dành cho các thao tác gửi email vẫn được backend xác minh. Không tạo ngoại lệ bỏ qua xác thực/rate limit để làm demo.

## Kiểm chứng và giới hạn

- `npm run mobile:check`: TS strict/lint và tests form, retry, OTP/session/SecureStore, Google/Turnstile với mock; không gửi email thật.
- `npm --prefix frontend run build` và `npm --prefix frontend run test:integration`: database local dùng riêng và mock SMTP/OIDC. Mock Google ký JWT RS256 thật bằng khóa test, backend vẫn kiểm chữ ký/JWK, nonce và PKCE. Kiểm happy path, proof sai, expiry, callback sai, domain trường, replay, song song và tương thích web Google.
- `npx expo export --platform android`: chỉ xác nhận bundle, không thay thử nghiệm WebView/Google/OTP thật trên điện thoại. Cần kiểm tra thực sau deploy bằng email/tài khoản của người dùng. Không khẳng định đã gửi OTP hoặc đăng nhập Google thật trong lượt phát triển.

Tham khảo: [Expo WebBrowser SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/), [Expo Crypto SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/), [Cloudflare Turnstile cho mobile](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/).
