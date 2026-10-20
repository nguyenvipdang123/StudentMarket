# Triển khai StudentMarket lên Render

## 1. Lấy mã nguồn sạch

Tại thư mục StudentMarket có `package.json`:

```powershell
npm run deploy:package
```

Lệnh tạo `StudentMarket-render-<thời-gian>.zip` ở thư mục cha và kiểm tra SHA-256 mỗi file sau nén. Giải nén, đưa **nội dung bên trong `StudentMarket-render`** vào repo GitHub private. `render.yaml`, `package.json`, `frontend/`, `fastapi_chat/` phải ở cùng gốc repo; Root Directory trên Render để trống.

Gói loại dependencies, `.next*`, `.venv`, `.backups`, `.data`, file môi trường thật, khóa riêng, database, ảnh người dùng, design-reference và backend .NET không dùng khi chạy. Mã nguồn test và tài liệu vẫn có để quản lý phiên bản. Máy local giữ cấu hình/dữ liệu/dependencies hiện có.

## 2. Tạo Blueprint

Render → **New → Blueprint** → kết nối repo → chọn `render.yaml`. Xem chi phí trước khi tạo:

| Resource | Cấu hình ban đầu | Chi phí tham khảo/tháng |
| --- | --- | --- |
| `studentmarket-web` | Next.js, Node 22.20, 512 MB | 7 USD |
| `studentmarket-chat` | FastAPI, Python 3.12.10, 512 MB | 7 USD |
| `studentmarket-ai` | Background Worker, 512 MB | 7 USD |
| `studentmarket-db` | PostgreSQL 16, 256 MB RAM, 1 GB storage | khoảng 6 USD; kiểm tra phần storage khi tạo |

Khoảng **27 USD/tháng** cho phần chính, chưa tính vượt hạn mức, thuế, Gemini/Supabase hay backend PDF riêng. Workspace Hobby đủ; mọi tài nguyên cùng region Singapore, mỗi service 1 instance. Theo dõi RAM thực tế rồi nâng nếu cần. Auto deploy đặt `off`; cập nhật code xong dùng Manual Deploy. Không bật autoscaling/preview mặc định.

File cấu hình/ZIP không tự tạo dịch vụ hoặc chi tiền. Chỉ khi tạo/sync tài nguyên trên Render mới có chi phí. Credit có hạn dùng/điều kiện riêng: xem Billing của tài khoản.

## 3. Điền Environment

Blueprint hỏi trên website service:

| Biến | Giá trị |
| --- | --- |
| `APP_ORIGIN` | URL website thực tế, ví dụ `https://studentmarket-web.onrender.com`, không thêm đường dẫn |
| `NEXT_PUBLIC_CHAT_WS_URL` | URL chat công khai, ví dụ `wss://studentmarket-chat.onrender.com`, không thêm `/ws/chat/...` |
| `SUPABASE_URL` | URL project Supabase chứa bucket ảnh |
| `SUPABASE_SECRET_KEY` | Secret server của Supabase hoặc service-role JWT; không dùng anon/publishable key |
| `GEMINI_API_KEY` | Key Gemini dùng cho AI duyệt tin |

Tên miền Render có thể có hậu tố nếu tên bị trùng. Sau tạo, đối chiếu URL thực tế, sửa hai URL ở trên và redeploy. `NEXT_PUBLIC_*` cần **build lại website** khi đổi. Không đưa các khóa vào GitHub/chat.

`DATABASE_URL` được nối từ database; `CHAT_TICKET_SECRET` tự sinh trên website và được chat tham chiếu. Worker tham chiếu Gemini/Supabase từ website. Khi đổi biến được tham chiếu, sync Blueprint và redeploy các service liên quan. Giữ secret chat giống nhau giữa website và FastAPI.

Mạng database nội bộ dùng `PG_SSL_MODE=disable`. Kết nối bên ngoài có chứng chỉ hợp lệ dùng `PG_SSL_MODE=verify-full`; cấu hình này loại SSL flags trong URI để URI không ghi đè lựa chọn. `DATABASE_URL` ưu tiên hơn PG_* local; pool mặc định 5 mỗi tiến trình, tối thiểu 2 vì worker giữ kết nối khóa hàng chờ.

## 4. Các lệnh Render đã cấu hình

| Service | Build | Pre-deploy | Start |
| --- | --- | --- | --- |
| Website | `npm --prefix frontend ci --include=dev && npm run build:render` | `npm run db:migrate` | `npm run start:render` |
| Chat | `pip install --no-cache-dir -r fastapi_chat/requirements.txt` | — | Xem lệnh uvicorn trong `render.yaml`, bind `0.0.0.0:$PORT`, 1 worker |
| AI worker | `npm --prefix frontend ci --omit=dev` | — | `npm run worker:render` |

Website build standalone tại `frontend/.next-render/standalone`, gồm thư viện Next.js trace cần, ảnh/font `public` và static JS/CSS. Artifact không chứa `.env*`; môi trường thật được điền trên server. Build production không ghi đè `.next` đang dùng để phát triển. Worker không cài TypeScript/Playwright/ESLint; dùng khả năng chạy TypeScript của Node 22.20.

`db:migrate` đã khởi tạo được database trống từ `frontend/scripts/base-schema.sql`, sau đó thêm các schema hiện tại. Có khóa migration, chạy lại được, không seed tài khoản/sản phẩm demo và không cần .NET. Worker có thể cần deploy lại sau lượt migration đầu nếu bắt đầu sớm.

Health: website `/api/health` kiểm tra database (200 hoặc 503), chat `/health`. Endpoint không trả khóa/chi tiết kết nối. Worker xem tại Admin → Kiểm duyệt.

## 5. Database và ảnh hiện tại

Blueprint tạo database mới rỗng, không tự mang dữ liệu trên máy bạn lên.

**Bắt đầu mới:** sau deploy, mở Shell của website:

```bash
npm --prefix frontend run admin:create -- admin@tenmiencuaban.vn
cat frontend/.data/admin-login.txt
```

Mật khẩu chỉ ghi vào file một lần, không in log deploy. Lấy trong Shell riêng, đăng nhập đổi mật khẩu rồi xóa file bằng `rm frontend/.data/admin-login.txt`. File ổ tạm có thể mất khi redeploy. Nếu đã có Admin, lệnh không thay đổi tài khoản đó.

**Mang dữ liệu cũ:** sao lưu trước. Trước bước tạo Blueprint, tạo PostgreSQL 16 tên `studentmarket-db` trong cùng workspace/region và import bản `pg_dump` vào database mới còn rỗng; sau đó tạo Blueprint để dùng database đã có và chạy migration bổ sung. Kiểm tra tên database khớp YAML để không vô tình tạo thêm resource. Nếu Blueprint đã khởi tạo schema, dùng database mới và đổi kết nối, không import đè hoặc dùng `--clean` tùy tiện. Công cụ [backup/restore local](frontend/docs/backup-restore.md) khôi phục sang database mới, không tự import vào database Render đã có schema.

Blueprint đặt `ipAllowList: []`: database chỉ nhận mạng nội bộ. Khi cần pgAdmin/pg_restore từ máy bạn, thêm IP công khai của chính bạn `/32` tại Networking (hoặc điều chỉnh Blueprint), dùng External Database URL/TLS, đóng lại sau import. Không mở toàn Internet chỉ để tránh cấu hình.

Kiểm tra các bucket: `studentmarket-products` Public; `studentmarket-cards` và `studentmarket-chat` Private. Trên máy local chạy `npm --prefix frontend run storage:check`. Ảnh còn ở `.data` cần chuyển bằng `storage:migrate -- --apply` theo [Storage](frontend/docs/storage.md). Ảnh thẻ không được đặt vào bucket Public/repo. Khóa/config và ảnh người dùng không nằm trong ZIP mã nguồn.

## 6. Bật SMTP, Google, Maps, SePay

Thêm trong Environment của website service, sau đó redeploy:

- **SMTP Gmail:** `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASSWORD` (App Password), `SMTP_FROM`. Website trả phí có thể dùng 587; Render chặn cổng 25 cho mọi service. Thiếu SMTP thì đăng ký/quên mật khẩu không gửi mã.
- **Google:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; trong Google Cloud thêm redirect `https://URL-WEBSITE/api/auth/google/callback`. `GOOGLE_REDIRECT_URI` dùng URI này hoặc để trống để lấy từ APP_ORIGIN.
- **Maps:** `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`, giới hạn referrer theo domain online rồi build lại.
- **SePay:** thêm các `SEPAY_*` theo [hướng dẫn SePay](frontend/docs/sepay.md). Webhook mới: `https://URL-WEBSITE/api/payments/sepay/webhook`; phương thức xác thực/secret phải khớp hai bên. Blueprint mặc định `SEPAY_ENABLED=false`; chỉ bật khi đủ ngân hàng/VA/secret và kiểm tra URL. `.env.local` trên máy không tự chuyển lên Render.

Google OAuth trên website hiện tại: đặt `GOOGLE_REDIRECT_URI=https://studentmarket-web.onrender.com/api/auth/google/callback` trong Environment của `studentmarket-web`, dùng cùng Client ID/Secret của loại Web application. Thêm chính xác URI này tại Google Cloud → Google Auth Platform → Clients → client StudentMarket → Authorized redirect URIs, rồi Save; giữ URI localhost nếu còn phát triển local. Không sao chép callback localhost/ngrok từ `.env.local` vào Render. Khi đổi domain, cập nhật cả hai nơi. OAuth chỉ nhận tài khoản Google Workspace có miền `.edu`/`.edu.vn`; lỗi Google có thể do ứng dụng Internal giới hạn tổ chức hoặc quản trị viên trường chặn ứng dụng. Nếu cần phục vụ nhiều trường, kiểm tra Audience và chính sách Google trước khi chuyển External/publish. Khóa thật chỉ lưu trong Environment, không đưa lên GitHub.

## 7. Chatbot và chi phí

**Có trong gói:** tìm sản phẩm thật bằng PostgreSQL, FAQ tức thì và hỏi đáp Gemini trực tiếp trong website. Khi chưa cấu hình hai URL PDF, câu hỏi ngoài FAQ/tìm đồ dùng `ASSISTANT_GEMINI_API_KEY` hoặc `GEMINI_API_KEY` đang có, với model `ASSISTANT_GEMINI_MODEL` (mặc định `gemini-3.1-flash-lite`). Có thể đặt khóa riêng cho chatbot để tách quota với AI Admin. Khóa chỉ dùng phía server. Không cần thêm service Render cho nhánh này; lượt gọi Gemini vẫn chịu quota/chi phí của project Google tương ứng.

**Cần kết nối riêng:** AI hỏi tài liệu PDF thuộc project bên cạnh `ai-pdf-chatbot-langchain`, chưa đóng trong Blueprint. Cần backend chatbot production, rồi cấu hình `PDF_CHAT_APP_URL`, `PDF_CHAT_GRAPH_URL`. Hợp đồng dùng `/api/status`, `/api/chat` và `/threads`; chỉ điền Gemini key chưa tạo ra các endpoint này. Không dùng localhost/ngrok từ máy cá nhân nếu muốn website độc lập máy bạn.

Project PDF local đang dùng `langgraph dev` và `next dev`; không đưa các lệnh dev đó lên Render rồi gọi là production. Gemini trực tiếp không đọc được PDF chưa kết nối; có thể trả lời nội dung người dùng dán vào chat. AI duyệt tin Admin vẫn hoạt động bằng worker riêng.

## 8. Kiểm tra và vận hành

Sau deploy: mở `/api/health`, chat `/health`; thử đăng ký OTP, đăng nhập/Google, tải ảnh, chat hai tài khoản, giữ chỗ, lưu nhu cầu và chuông. Admin kiểm tra worker online trước khi bật tự duyệt. Dùng chức năng thử webhook của SePay và đối chiếu trạng thái; không tự đánh dấu giao dịch thật là đã thanh toán.

Chat giữ 1 worker/instance vì room ở trong bộ nhớ; mở nhiều instance cần broadcast chung như Redis. Website cũng giữ 1 instance vì phiên tạm trợ lý/tần suất hỏi nằm trong bộ nhớ. Dữ liệu nghiệp vụ/ảnh ở PostgreSQL/Supabase.

Kiểm thử local:

```powershell
npm --prefix frontend run test:production
npm --prefix frontend run test:deploy
npm run test:e2e
```

`test:deploy` tạo database trống riêng, chạy migration hai lần, worker qua DATABASE_URL, build/chạy standalone, kiểm tra health/ảnh/font/CSS/FAQ và chat; dọn database test. `--skip-build` chỉ dùng khi vừa có artifact đúng phiên bản. E2E dùng build/database riêng.

Backup đầy đủ hiện đóng source bằng PowerShell: giữ chạy từ Windows theo [backup/restore](frontend/docs/backup-restore.md), dùng PG_* và TLS của database Render. Không đặt lệnh backup đó vào cron Linux khi chưa đổi phần đóng gói. Render Postgres trả phí có backup riêng; vẫn giữ bản sao ảnh/config ngoài service.

Nguồn: [Blueprint](https://render.com/docs/blueprint-spec), [PostgreSQL](https://render.com/docs/postgresql-creating-connecting), [WebSocket](https://render.com/docs/websocket), [giá](https://render.com/pricing), [giới hạn Free](https://render.com/docs/free). Xác thực YAML trên máy không thay thế deploy thật trong tài khoản Render.
