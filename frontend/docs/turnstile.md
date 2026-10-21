# Chống bot bằng Cloudflare Turnstile

Phạm vi: đăng ký bằng email, yêu cầu mã quên mật khẩu, gửi lại mã xác thực email và tạo phiếu hỗ trợ. Đăng nhập, nhập OTP đã nhận, Google OAuth, phản hồi phiếu và webhook SePay giữ luồng hiện có. Rate limit hiện có vẫn áp dụng.

## Cấu hình Render

Tạo widget Managed trên Cloudflare, thêm hostname `sangtay.shop` (không có giao thức/đường dẫn). Nếu dùng domain Render, thêm hostname tương ứng vào widget và giữ APP_ORIGIN khớp domain chính của website.

Trong studentmarket-web → Environment:
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Site key công khai.
- `TURNSTILE_SECRET_KEY`: Secret key, chỉ dùng server, không đưa vào Git/chat.
- `APP_ORIGIN`: `https://sangtay.shop`.

Save, rebuild and deploy. Site key được đóng vào bundle lúc build, nên đổi khóa phải rebuild. Không cần bật proxy Cloudflare để dùng Turnstile.

Hai khóa đều trống: chưa bật Turnstile (phục vụ môi trường phát triển/cài đặt chưa cấu hình). Chỉ có một khóa: backend từ chối yêu cầu. Khóa test Cloudflare bị từ chối trên hostname ngoài localhost/127.0.0.1. Không tắt Turnstile bằng cách xóa khóa để xử lý lỗi tạm thời.

## Kiểm tra

Backend gọi Siteverify, kiểm tra success, hostname theo APP_ORIGIN và action theo từng API trước khi gửi mail/ghi dữ liệu. Cloudflare kiểm tra token một lần, thời hạn 5 phút. Lỗi mạng/khóa trả 503, token thiếu/sai/hết hạn trả 403, không tự bỏ qua xác minh. Không ghi secret/token vào log.

Widget chỉ tải khi mở form được bảo vệ; token được làm mới sau mỗi lần gửi, hết hạn hoặc lỗi. Có nút thử lại khi trình chặn quảng cáo/mạng ngăn script. Nội dung form được giữ khi lỗi. Vẫn nhập OTP đã nhận được nếu Cloudflare tạm mất kết nối.

Chạy unit: `npm --prefix frontend run test:turnstile`.

Chạy E2E PowerShell:
```powershell
$env:STUDENTMARKET_TEST_TURNSTILE='1'
npm --prefix frontend run test:e2e -- turnstile.spec.ts
Remove-Item Env:STUDENTMARKET_TEST_TURNSTILE
```
Runner dùng database riêng, SMTP giả, browser widget giả và Siteverify giả trên loopback; không gửi email hoặc tạo tài khoản thật. App không có đường vòng/bỏ qua xác minh dành cho test. Kiểm tra thực tế sau deploy vẫn cần trình duyệt người dùng hoàn tất widget thật.
