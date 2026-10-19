# Kiểm thử giao diện tự động

StudentMarket dùng Playwright để thao tác trên trình duyệt Chromium headless: mở trang, nhập dữ liệu, bấm nút, xác thực email và kiểm tra kết quả sau khi gọi API thật. Bộ hiện có **26 kịch bản**, chạy ở hai cấu hình **desktop 1440×1000** và **mobile 390×844**, tổng cộng **52 ca**. Mobile là mô phỏng trên Chromium, chưa thay thế kiểm tra Safari/iPhone hoặc thiết bị thật.

## Chạy trên máy hiện tại

Từ thư mục gốc có `package.json`:

```powershell
npm run test:e2e
```

Không cần mở website trước. Script tự tạo database mẫu, build tại `frontend/.next-e2e`, mở server test ở cổng riêng, chạy trình duyệt và dọn server/database khi kết thúc. Có thể giữ website đang phát triển chạy ở cổng 3000; E2E không ghi đè bản build `.next` của website đó.

Lần đầu trên máy mới, sau khi cấu hình PostgreSQL và tạo schema StudentMarket theo README:

```powershell
npm --prefix frontend ci
npm run test:e2e:install
npm run test:e2e
```

Cần Node.js 22+, PostgreSQL 16 hoặc client tương thích. Cấu hình `PG_*` lấy từ `frontend/.env.local`; tài khoản PostgreSQL cần quyền đọc schema nguồn và tạo/xóa database test. Nếu client ở nơi khác, đặt `PG_BIN` trỏ thư mục chứa `pg_dump`. Trên Linux, cài thêm thư viện hệ thống mà Playwright yêu cầu nếu công cụ báo thiếu.

`test:e2e:install` tải Chromium headless vào `.backups/playwright-browsers`. Chỉ cần chạy lại khi đổi phiên bản Playwright hoặc xóa cache trình duyệt. Lệnh test mặc định chạy ẩn; không yêu cầu cài Playwright toàn máy.

## Các luồng được kiểm tra

| Nhóm | Nội dung |
| --- | --- |
| Trang chủ | 12 tin/trang, tổng kết quả, ảnh sản phẩm tải được, không lộ tin chưa duyệt/ẩn/đã bán, không tràn ngang màn hình |
| Tìm kiếm | Tìm không dấu, tìm được sản phẩm ngoài trang hiện tại, đổi từ khóa về trang 1 |
| Phân trang | Trang trước/sau, không trùng sản phẩm, nút trang cuối bị vô hiệu hóa đúng |
| Bộ lọc | Danh mục, khoảng giá, sắp xếp; chọn trường theo mã và lưu sau tải lại |
| Trạng thái lỗi | Không có kết quả; lỗi API 503 và bấm Thử lại phục hồi được |
| Sản phẩm | Mở chi tiết và hồ sơ người bán từ tin trong database test |
| Đăng nhập | Sai mật khẩu, đúng mật khẩu, tạo phiên và đăng xuất |
| Đăng ký | Điều kiện ảnh thẻ theo email, xác nhận mật khẩu, nhận OTP qua SMTP giả lập rồi xác thực trên UI |
| Quyền quản trị | Khách phải đăng nhập; sinh viên không vào Admin; Admin mở dashboard, kiểm duyệt và thông báo ở cả hai kích thước |
| Yêu thích | Lưu tin trên UI, mở trang đã lưu và tải lại vẫn còn |
| Giữ chỗ / lịch hẹn | Đặt lịch, xác nhận, giao đồ và nhận hàng; chống xác nhận trùng đồng thời; quyền riêng tư, từ chối/hủy/đặt lại, hết hạn và vô hiệu khi tin bị ẩn |
| Theo dõi nhu cầu / giảm giá | Lưu, nhận chuông, tạm dừng/bật lại/xóa; khớp bộ lọc, không báo tin chưa duyệt/trùng; giảm giá đã duyệt, quyền sở hữu, origin và giới hạn |
| Chatbot | Mở/đóng bằng Escape, trả focus, chọn câu hỏi; tìm tin thật, xem thêm không trùng, mở Khám phá cùng bộ lọc; không có tin thì không tạo thẻ giả |
| JavaScript | Mỗi ca thất bại nếu có lỗi `pageerror`, gồm lỗi render/hydration phát sinh trên trang |

## Xem kết quả

```powershell
npm run test:e2e:report
```

Lệnh mở báo cáo HTML của lượt Playwright gần nhất. Terminal in đường dẫn cụ thể; có thể mở `report/index.html` trong thư mục đó. Kết quả lưu tại:

```text
.backups/e2e/run-.../
  report/index.html       Báo cáo HTML
  results.json            Kết quả máy có thể đọc
  summary.json            Mã thoát, tên database test, trạng thái đã dọn database
  fixtures.json           Tài khoản/sản phẩm mẫu của lượt chạy
  server.log              Log server test
  test-results/           Ảnh chụp + trace của ca thất bại
.backups/e2e/latest.json  Đường dẫn lượt gần nhất đã tạo báo cáo
```

Mã thoát `0` là toàn bộ ca đã chọn vượt qua; khác `0` là có lỗi hoặc không chuẩn bị được môi trường. Không tự retry để tránh che lỗi chập chờn; bộ dừng khi có 5 ca thất bại hoặc hết giới hạn tổng 10 phút. Nếu lỗi ngay lúc chuẩn bị database/build, chưa có báo cáo Playwright mới: xem lỗi terminal và thư mục kết quả vừa in.

Chạy riêng một cấu hình hoặc nhóm khi sửa lỗi:

```powershell
npm run test:e2e -- --project=desktop
npm run test:e2e -- --project=mobile
npm run test:e2e -- --grep chatbot
```

Mỗi lệnh vẫn tạo môi trường sạch và build riêng. Không chạy `npx playwright test` trực tiếp: cấu hình cố ý yêu cầu biến của bộ chạy để không vô tình kiểm thử trên dữ liệu thật.

## Dữ liệu và dịch vụ riêng

Script chỉ sao chép **schema** từ database cấu hình, không sao chép người dùng/giao dịch thật. Tạo database ngẫu nhiên dạng `student_market_e2e_<12 ký tự hex>`, nạp tài khoản/sản phẩm giả và chỉ xóa đúng database đó. Server test không chạy worker AI. Các thư mục ảnh, cookie trình duyệt, khóa chat, email và phiên đều riêng cho lượt chạy.

Email được giữ trong SMTP giả lập trên loopback, không gửi ra ngoài; OTP được test lấy từ hộp thư giả này. Gemini/PDF được giả lập cho phần hỏi đáp chung; truy xuất sản phẩm trong chatbot vẫn dùng PostgreSQL thật của test. SePay và cấu hình ngân hàng thật bị tắt/xóa khỏi môi trường test. WebSocket được trỏ về server test, không dùng chat realtime đang chạy trên máy. Trình duyệt chỉ tải tài nguyên cùng origin của server test, chặn dịch vụ Internet.

Chưa kiểm tra thanh toán ngân hàng thật, Google OAuth thật, gửi email thật, chất lượng Gemini, WebSocket realtime hay so sánh pixel với một ảnh thiết kế chuẩn. Các kiểm thử API/nghiệp vụ hiện có vẫn chạy bằng `npm test`; E2E bổ sung thao tác trình duyệt và kiểm tra hiển thị.

Không đưa `.backups` hay `.next-e2e` lên Git/ZIP mã nguồn. `npm run clean` dọn cả hai thư mục build `.next`/`.next-e2e` khi đã dừng dịch vụ; báo cáo và cache Chromium trong `.backups` được giữ lại.

## Khi lượt test bị ngắt

Thông thường script tự dọn database và đóng server, kể cả khi test thất bại. Nếu tắt cưỡng bức terminal/máy, có thể còn database `student_market_e2e_...`, tiến trình test và file `.backups/e2e/run.lock`. Xác định tiến trình theo PID trong lock và thư mục lượt chạy trước, dừng đúng tiến trình test; sau đó mới xóa file lock và database test bị bỏ lại. Không xóa database `student_market` đang dùng.

Chỉ chạy một lượt E2E tại một thời điểm vì dùng chung `.next-e2e`. Hiện chưa gắn lịch chạy hoặc workflow CI; chạy lệnh sau khi sửa giao diện và trước khi bàn giao/triển khai.

Mã kiểm thử ở `frontend/e2e`, cấu hình trong `frontend/playwright.config.ts`, bộ chuẩn bị/dọn môi trường trong `frontend/scripts/test-e2e.mjs`. Thêm ca mới bằng locator theo role/label, dùng dữ liệu fixture; giữ kiểm tra trạng thái hiển thị và kết quả nghiệp vụ thực tế.

Tham khảo: [Playwright configuration](https://playwright.dev/docs/test-configuration), [fixtures](https://playwright.dev/docs/test-fixtures), [reports](https://playwright.dev/docs/test-reporters).
