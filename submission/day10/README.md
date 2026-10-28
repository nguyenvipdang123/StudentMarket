# SangTay Mobile — Bộ nộp Day 10

Repository: https://github.com/nguyenvipdang123/StudentMarket

Release: https://github.com/nguyenvipdang123/StudentMarket/releases/tag/mobile-day10-2026-10-28

Ngày đóng gói: **28/10/2026**. Đây là ngày tạo release, không phải ngày hạn nộp đã xác nhận.

## Các tệp nộp

| Tệp trong release | Nội dung |
| --- | --- |
| `1923050110_1923050161_192305104_1923050059_SangTay.zip` | Source có README.md, AI_LOG.md, lockfile, tests và tài liệu; không có node_modules, secrets, APK hoặc cache |
| `SangTay_Demo_Day10.mp4` | Video walkthrough có phụ đề trên hình, 3 phút 40 giây, Full HD H.264; không có lời đọc |
| `SangTay_Reflection.pdf` | Reflection một trang A4 |
| `SangTay_Demo_Day10.srt` | Phụ đề rời, dùng thêm khi trình chiếu |
| `SHA256SUMS.txt` | Mã kiểm tra toàn vẹn các tệp |

Tên ZIP dùng đủ bốn MSSV của nhóm. MSSV `192305104` được giữ đúng theo thông tin nhóm cung cấp; kiểm tra lại nếu lớp yêu cầu mã khác hoặc tên file theo mẫu riêng. Mẫu đề bài ghi ba MSSV nhưng danh sách nhóm có bốn người.

## Mở source trên máy sạch

Giải nén ZIP, mở thư mục `SangTay/` có package.json gốc. Cài Node.js ≥22.20.0 và Expo Go tương thích SDK 58, rồi chạy:

```sh
npm --prefix mobile ci
npm run mobile
```

Quét QR bằng Expo Go trên cùng mạng Wi-Fi. API mặc định là `https://sangtay.shop`; không cần chạy localhost:3000 hoặc cài database để xem catalogue. Xem hướng dẫn đầy đủ tại [mobile/README.md](../../mobile/README.md).

Kiểm tra chất lượng từ gốc source:

```sh
npm run mobile:check
```

Kết quả ngày đóng gói: TypeScript/lint đạt; 45 kiểm thử logic/static và 5 kiểm thử Jest đạt. Source dùng Expo SDK 58, TypeScript strict, Expo Router, TanStack Query và shared stores có selectors. Không tạo APK mới trong bộ nộp này.

## Trình chiếu và nộp Canvas

Video là walkthrough bằng các ảnh màn hình UI Expo Web đã thao tác với API/tài khoản giả local. Kịch bản và các bước demo trực tiếp nằm trong [DEMO.md](DEMO.md). Camera, SecureStore và thông báo hệ điều hành cần kiểm tra thêm trên Expo Go native; video không phải bản ghi đầu-cuối trên Android.

Tải ZIP, MP4 và PDF trong release rồi đính kèm vào đúng bài Canvas. Chưa có liên kết bài nộp và hạn Day 10 cụ thể trong phiên làm việc, nên bộ tệp được chuẩn bị sẵn, chưa gửi lên Canvas.

Phân công nhóm ở [TEAM.md](../../mobile/TEAM.md), nhật ký chung ở [AI_LOG.md](../../AI_LOG.md). Lịch sử Git hiện có được giữ nguyên; việc tạo release không thay thế yêu cầu commit thực tế của từng thành viên trong thời gian học.
