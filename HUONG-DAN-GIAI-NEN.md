# Chạy StudentMarket sau khi giải nén

Bản ZIP gồm mã nguồn Next.js, FastAPI, backend EF, migration SQL, giao diện Figma, ảnh minh họa và font. Không gồm dependencies, bản build, cache, backup, mật khẩu, database hoặc file người dùng tải lên. Database cần sao lưu riêng. Nếu ảnh đã chuyển lên Supabase Storage, cấu hình lại cùng project/bucket trên máy mới theo [hướng dẫn Storage](frontend/docs/storage.md); nếu dùng `local`, cần sao lưu và khôi phục thêm các thư mục ảnh trong `frontend/.data`.

## 1. Cài môi trường và dependencies

Cài Node.js 22+, Python 3.12+ và PostgreSQL 16. Mở PowerShell tại thư mục `StudentMarket` vừa giải nén, nơi có `package.json`:

```powershell
npm --prefix frontend ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r fastapi_chat/requirements.txt
if (!(Test-Path -LiteralPath frontend/.env.local)) {
    Copy-Item frontend/.env.example frontend/.env.local
}
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Lệnh sao chép cấu hình chỉ dành cho bản vừa giải nén chưa có `.env.local`. Điền `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD` vào `frontend/.env.local`; dùng chuỗi vừa tạo cho `CHAT_TICKET_SECRET`. Cấu hình SMTP để đăng ký gửi mã xác thực 6 số và khôi phục mật khẩu; cấu hình Google OAuth nếu dùng đăng nhập Google. Mã email có hiệu lực 10 phút. Xem phần **Xác thực email và mật khẩu** trong README.

## 2. Chuẩn bị database

Nếu dùng database hiện tại đã có bảng, bỏ qua bước khởi tạo và trỏ cấu hình tới database đó. Nếu dùng database mới, tạo database `student_market`, chạy file `backend/StudentMarket.API/Data/Migrations/InitialCreate.sql` bằng pgAdmin hoặc psql, sau đó chạy:

```powershell
npm run db:migrate
npm --prefix frontend run admin:create -- admin@example.com
```

Tài khoản quản trị được tạo với mật khẩu ngẫu nhiên trong `frontend/.data/admin-login.txt`. Có thể chạy `frontend/scripts/sample-20-products.sql` để thêm dữ liệu sản phẩm mẫu; xem README để biết chi tiết.

## 3. Chạy website

```powershell
npm run dev
```

Giữ terminal đang chạy. Khi Next.js báo `Ready`, mở http://localhost:3000. Ctrl+C dừng các dịch vụ do lệnh này khởi động; dịch vụ đã chạy sẵn được tái sử dụng. Chạy `npm run build` để tạo bản build production.

Nếu gặp `Cannot find module '...frontend\node_modules\next\dist\bin\next'` hoặc `Thiếu dependencies frontend`, cài lại thư viện tại thư mục gốc trước khi chạy:

```powershell
npm --prefix frontend ci
npm run dev
```

Xem mục **Lỗi thường gặp khi khởi động** trong [README](README.md) để xử lý lỗi Python, database hoặc AI. Nếu có project chatbot PDF bên cạnh, `npm run dev` cũng khởi động project đó; cài dependencies và cấu hình riêng theo `../ai-pdf-chatbot-langchain/LOCAL-SETUP.md`.

`npm run dev` cũng khởi động worker AI kiểm duyệt. Chạy `npm --prefix frontend run db:migrate:ai`, điền `GEMINI_API_KEY` và `GEMINI_MODERATION_MODEL` trong `frontend/.env.local`, sau đó bật công tắc trong Admin → Kiểm duyệt. Nếu chỉ chạy frontend/production, chạy thêm `npm run worker:ai` trong terminal riêng. Công tắc lưu ở PostgreSQL; worker không cần trang Admin mở.

Backend .NET là tùy chọn cho EF/health check; nếu cần, cài .NET 9 và cấu hình `ConnectionStrings__DefaultConnection` hoặc `appsettings.Development.json` bằng thông tin database của bạn. Connection string trong ZIP chỉ là mẫu.

## Thanh toán SePay

Để mở mua gói đẩy tin, điền `SEPAY_*` trong `frontend/.env.local`, tạo webhook SePay trỏ tới `/api/payments/sepay/webhook`, chạy `npm run db:migrate` rồi bật `SEPAY_ENABLED=true` và khởi động lại frontend. Xem [hướng dẫn SePay](frontend/docs/sepay.md) để cấu hình ngân hàng/VA, secret HMAC và ngrok. Khóa thật không đi kèm bản ZIP.

## Tạo ZIP mã nguồn

ZIP mã nguồn không thay thế backup dữ liệu. Dùng `npm run backup` để sao lưu database, ảnh đang dùng, cấu hình và mã nguồn; xem [hướng dẫn sao lưu/khôi phục](frontend/docs/backup-restore.md).

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-source.ps1
```

ZIP được tạo ở thư mục cha của project. Script chỉ đọc mã nguồn và tạo ZIP; không xóa dependencies hay dữ liệu đang dùng.

## Bật Google Maps

Nút mở Google Maps/chỉ đường dùng được ngay. Để bật bản đồ nhúng trong chi tiết sản phẩm và xem trước địa điểm hẹn gặp, cấu hình `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` trong `frontend/.env.local`, bật Maps Embed API và giới hạn key cho localhost/domain ngrok. Xem hướng dẫn đầy đủ tại `frontend/docs/google-maps.md`.

## Truy cập qua ngrok khi phát triển

Chạy `npm run dev`, sau đó dùng `ngrok http 3000`. Domain hiện tại `marital-dominoes-balmy.ngrok-free.dev` đã được thêm vào `allowedDevOrigins` trong `frontend/next.config.ts` để Next.js cho phép tải JavaScript và kết nối dev qua tunnel.

Nếu đổi domain ngrok, cập nhật đúng hostname mới trong cấu hình này (không kèm `https://`), rồi khởi động lại dev server. Nếu trang chỉ hiện “Đang tải…” sau khi sửa, dùng Ctrl+Shift+R để tải lại các script.

## Dọn dung lượng sau khi phát triển

Dừng server bằng Ctrl+C trước khi chạy:

```powershell
npm run clean
```

Lệnh này xóa bản build, cache và file tạm; chúng được tạo lại khi chạy hoặc build. Để xóa thêm `frontend/node_modules` khi cần lưu trữ project gọn:

```powershell
npm run clean:all
```

Cài lại bằng `npm --prefix frontend ci` trước khi chạy website. Hai lệnh dọn giữ nguyên mã nguồn, `.env.local`, `.data`, database và backup. Cache và dependencies sẽ tăng dung lượng trở lại khi phát triển; dùng script tạo ZIP để gửi mã nguồn gọn.
