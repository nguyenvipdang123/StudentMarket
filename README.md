# StudentMarket / SangTay

## Triển khai Render

Xem [hướng dẫn Render](DEPLOY-RENDER.md) và `render.yaml` cho website, chat, worker AI và PostgreSQL. `npm run deploy:package` tạo ZIP mã nguồn sạch cho GitHub/Render, loại dependencies/cache/khóa/dữ liệu local và .NET không dùng khi chạy. Production dùng standalone (`npm run build:render`, `npm run start:render`); database trống được khởi tạo qua `npm run db:migrate`. Không dùng `npm run dev` trên Render. FAQ và tìm sản phẩm chạy trong website; hỏi tài liệu PDF cần endpoint chatbot riêng như hướng dẫn.

Mở thư mục chứa file `package.json` này trong VS Code. Trên máy hiện tại, đó là `F:\ThuongMaiDienTu\StudentMarket\StudentMarket`. Khi giải nén bản ZIP mã nguồn, xem [hướng dẫn giải nén](HUONG-DAN-GIAI-NEN.md) để cài dependencies và cấu hình database.

## Bắt đầu nhanh sau khi giải nén hoặc xóa node_modules

Nếu database, `.venv` và `frontend/.env.local` vẫn còn trên máy, chỉ cần cài lại dependencies frontend rồi chạy:

```powershell
cd F:\ThuongMaiDienTu\StudentMarket\StudentMarket
npm --prefix frontend ci
npm run dev
```

Nếu giải nén ở nơi khác, thay đường dẫn `cd` bằng thư mục có `package.json` gốc của project. Lệnh `npm --prefix frontend ci` cài thư viện theo `frontend/package-lock.json`, bao gồm Next.js. Chờ cài xong rồi mới chạy `npm run dev`.

Nếu thiếu `.venv`, tạo lại môi trường Python trước khi chạy:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r fastapi_chat/requirements.txt
```

Máy mới còn cần cấu hình PostgreSQL, file môi trường và migration theo mục **Cài lại trên máy mới** bên dưới. Giải nén mã nguồn không tự khôi phục database, ảnh tải lên hoặc khóa dịch vụ.

## Chạy trên máy hiện tại

PostgreSQL phải đang chạy, dependencies đã được cài và `frontend/.env.local` đã có cấu hình database. Tại thư mục gốc:

```powershell
npm run dev
```

Giữ terminal đang chạy trong khi dùng website. Khi Next.js báo `Ready`, mở [StudentMarket](http://localhost:3000/). Lần đầu truy cập, trang có thể cần thêm thời gian biên dịch.

| Dịch vụ | Địa chỉ / cách kiểm tra |
| --- | --- |
| Website StudentMarket | http://localhost:3000/ |
| API sản phẩm | http://localhost:3000/api/listings |
| Chat người mua/người bán | http://127.0.0.1:8000/health |
| AI kiểm duyệt | Worker chạy nền; xem trạng thái trong Admin → Kiểm duyệt |
| Trang nạp PDF của chatbot, nếu có project chatbot bên cạnh | http://127.0.0.1:3001/ |
| Thông tin backend chatbot PDF | http://127.0.0.1:2024/info |

`npm run dev` khởi động website, chat và worker AI; đồng thời khởi động chatbot PDF nếu có `../ai-pdf-chatbot-langchain/scripts/dev-local.mjs`. Chatbot có dependencies và cấu hình riêng, xem [hướng dẫn chatbot](../ai-pdf-chatbot-langchain/LOCAL-SETUP.md). Cài dependencies frontend StudentMarket không cài dependencies chatbot.

- Ctrl+C dừng các tiến trình do terminal này tạo; dịch vụ đã chạy sẵn được tái sử dụng và không bị dừng cùng terminal này.
- Chỉ website: `npm run dev:frontend`.
- Chỉ chat người mua/người bán: `npm run dev:chat`.
- Chỉ worker AI kiểm duyệt: `npm run worker:ai`.
- Sau khi sửa file môi trường, dừng và khởi động lại các dịch vụ liên quan để nạp cấu hình mới. Worker đang được một terminal khác quản lý cũng cần được khởi động lại riêng.

Nếu chưa có `.venv` hoặc `frontend/node_modules`, cài lại theo `HUONG-DAN-GIAI-NEN.md` trước khi chạy. Các cấu hình thật ở `frontend/.env.local`; đừng ghi đè file này bằng file mẫu khi chạy trên máy hiện tại.

## Sử dụng website

1. **Khám phá:** mở trang chủ hoặc `/explore`, chọn trường, tìm kiếm và lọc sản phẩm; bấm tin để xem ảnh, mô tả, người bán và địa điểm hẹn gặp.
2. **Tạo tài khoản:** đăng ký và nhập mã xác thực 6 số được gửi về email, hoặc dùng Google trường. Email `.edu`/`.edu.vn` được tự duyệt sau xác thực; email khác vẫn cần ảnh thẻ sinh viên và Admin duyệt. SMTP/Google OAuth phải được cấu hình để các luồng tương ứng hoạt động.
3. **Đăng tin:** dùng tài khoản đã xác minh, vào **Đăng tin**, thêm ảnh, nhập thông tin, giá/địa điểm rồi gửi. Theo dõi trạng thái và lý do từ chối trong **Tin của tôi**.
4. **Liên hệ, giữ chỗ và giao dịch:** nhắn tin hoặc gửi yêu cầu giữ chỗ tại trang sản phẩm, chọn thời gian/địa điểm gặp. Người bán xác nhận trong **Giao dịch của tôi**; mỗi món chỉ được giữ cho một người và tự hết hiệu lực khi hết hạn. Sau khi giao đồ và người bán ghi nhận, người mua xác nhận nhận hàng; hai bên có thể đánh giá sau khi hoàn tất. Xem [hướng dẫn giữ chỗ và đặt lịch](frontend/docs/reservations.md).
5. **Thông báo và trợ lý:** dùng chuông để xem cập nhật; mở **Hỏi SangTay** để tìm sản phẩm thật hoặc hỏi hướng dẫn. Ví dụ “Tìm laptop dưới 5 triệu ở DNTU”, sau đó “Xem thêm” hoặc “Rẻ hơn”. Kết quả có ảnh, giá và liên kết tin đã duyệt; tìm sản phẩm đọc trực tiếp PostgreSQL, không cần thêm khóa AI. FAQ/PDF và câu hỏi AI khác cần dịch vụ chatbot/Gemini hiện có. Xem [hướng dẫn chatbot tìm sản phẩm](frontend/docs/assistant-products.md).
6. **Quản trị:** đăng nhập tài khoản Admin rồi mở `/admin` để duyệt tài khoản, tin đăng, xử lý báo cáo và quản lý hệ thống. Bật AI tự duyệt trong mục **Kiểm duyệt** khi worker online và đã cấu hình Gemini; nhân viên chỉ có quyền kiểm duyệt tin.

## Cấu trúc duy nhất

```text
StudentMarket/
  frontend/       Next.js: giao diện, đăng nhập và toàn bộ API nghiệp vụ
  fastapi_chat/   FastAPI: WebSocket realtime, không có API đăng nhập riêng
  backend/       .NET: EF models/migration và health check
  scripts/       Lệnh chạy chung
  .venv/         Python environment (ẩn khỏi Explorer của VS Code)
  .backups/      Bản sao trước khi gộp, script cũ và kết quả kiểm thử (ẩn, gitignored)
```

Không cần chạy .NET để dùng website. Giữ project này để quản lý schema EF; ứng dụng .NET không còn tự seed tài khoản demo mỗi lần khởi động.

## Database

Database nghiệp vụ đang dùng là **student_market** (chữ thường), PostgreSQL localhost:5432. Trong pgAdmin mở:
`PostgreSQL 16 → Databases → student_market → Schemas → public → Tables`, rồi Refresh.

`Student_Market` viết hoa là database khác, không phải database website đang dùng. Việc gộp thư mục không xóa database này.

Tài khoản admin/nhân viên nằm trong bảng `public.staff_accounts` (`role` là `admin` hoặc `staff`). Tài khoản sinh viên nằm trong `public.users` (`auth_id` khác NULL); các người bán mẫu trong `users` có `auth_id` NULL nên không đăng nhập được. Bảng `accounts` cũ đã được bỏ. View `public.auth_identities` dưới mục **Views** nối hai loại tài khoản cho mã đăng nhập; phiên nằm trong `public.sessions`. Ảnh thẻ và file mật khẩu admin tạo lần đầu còn ở `frontend/.data/`. FastAPI chat kiểm tra phiên trong PostgreSQL. File SQLite cũ đã chuyển sang `.backups/accounts-legacy-20261001.sqlite` và không được ứng dụng sử dụng.

Áp dụng schema bổ sung, có thể chạy lại:
```powershell
npm run db:migrate
```

Nếu cài từ bản cũ dùng SQLite, sao lưu hai database rồi chạy một lần `npm --prefix frontend run auth:migrate`. Lệnh chỉ nhập khi view PostgreSQL `auth_identities` đang rỗng, giữ nguyên ID, mật khẩu băm, quyền, trạng thái và phiên đăng nhập. Có thể truyền đường dẫn file SQLite cũ sau dấu `--`.

Nếu muốn xem giao diện với 20 tin đăng mẫu, mở `frontend/scripts/sample-20-products.sql`
trong Query Tool của database `student_market` và bấm Execute. Script tạo thêm 5 người bán mẫu,
20 ảnh minh họa nội bộ, chia đều 5 danh mục. Chạy lại không tạo bản ghi trùng.
Các người bán `@demo.invalid` chỉ có trong PostgreSQL nên không đăng nhập hoặc trả lời chat được;
dữ liệu này dành cho việc xem và thử giao diện.

Form đăng và sửa tin cho chọn ảnh JPG, PNG hoặc WebP từ thiết bị (tối đa 5 MB). Project hỗ trợ **Supabase Storage** để ảnh sản phẩm, ảnh thẻ và ảnh chat không phụ thuộc ổ đĩa tạm khi deploy. Ảnh thẻ/chat nằm trong bucket Private và vẫn kiểm tra quyền qua API. Xem [cấu hình Storage và chuyển ảnh cũ](frontend/docs/storage.md). Chế độ `MEDIA_STORAGE_PROVIDER=local` vẫn lưu tại `.data/`; khi dùng chế độ này phải sao lưu thư mục ảnh riêng.

## Kiểm thử giao diện tự động

Chạy `npm run test:e2e` để kiểm tra các luồng giao diện trên Chromium ở kích thước desktop và mobile. Bộ test dùng database, bản build và dịch vụ giả lập riêng; không cần dừng website cổng 3000. Lần đầu trên máy mới chạy `npm run test:e2e:install` sau khi cài dependencies. Xem kết quả bằng `npm run test:e2e:report`; ca lỗi có ảnh chụp và trace. Xem [hướng dẫn chạy, phạm vi kiểm thử và báo cáo](frontend/docs/ui-testing.md).

## Phân trang và tìm kiếm

Trang chủ/Khám phá tìm kiếm, lọc và phân trang trực tiếp trong PostgreSQL, 12 sản phẩm mỗi trang. Tìm tiếng Việt có/không dấu, đổi bộ lọc về trang đầu; các mục sản phẩm trang chủ và tin liên quan có truy vấn riêng. Sau khi cập nhật bản cũ, chạy `npm --prefix frontend run db:migrate:search`. Xem [hướng dẫn API, index và kiểm thử](frontend/docs/catalog-search.md).

## Theo dõi món đang cần mua

Tại **Khám phá**, chọn từ khóa/trường/ngân sách rồi **Theo dõi nhu cầu này**. Quản lý tối đa 10 nhu cầu trong **Đã lưu → Nhu cầu đang theo dõi**: xem kết quả, tạm dừng/bật lại hoặc xóa. Chuông báo khi tin mới phù hợp đã được duyệt; không gửi dồn tin cũ. Lưu sản phẩm bằng trái tim cũng bật báo giảm giá; có thể tắt riêng từng món trong **Đã lưu**. Thông báo giảm giá so với giá công khai được duyệt gần nhất, không báo khi sửa giá còn chờ duyệt. Chạy `npm run db:migrate` khi cập nhật máy khác. Xem [hướng dẫn theo dõi nhu cầu và giảm giá](frontend/docs/saved-searches.md).

## Sao lưu và khôi phục

Chạy `npm run backup` để lưu database PostgreSQL, ảnh đang dùng (kể cả Supabase), cấu hình và ZIP mã nguồn vào `.backups/snapshots`. Kiểm tra bằng `npm run backup:verify -- --from "DUONG-DAN-BAN-SAO"`; khôi phục sang database mới bằng `npm run restore -- --from "DUONG-DAN-BAN-SAO" --database student_market_recovered`. Dùng đường dẫn tuyệt đối. Công cụ không ghi đè database hoặc cấu hình đang dùng.

Bản sao chứa khóa và dữ liệu cá nhân, cần giữ riêng tư và chép thêm một bản ra ngoài máy. Xem [hướng dẫn sao lưu, khôi phục và kiểm tra dữ liệu](frontend/docs/backup-restore.md) trước khi chuyển website sang bản phục hồi.

## Cài lại trên máy mới

Yêu cầu Node.js 22+, Python 3.12+, PostgreSQL 16; .NET 9 nếu cần build backend.

```powershell
npm --prefix frontend ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r fastapi_chat/requirements.txt
if (!(Test-Path -LiteralPath frontend/.env.local)) {
    Copy-Item frontend/.env.example frontend/.env.local
}
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Điền PG_* và CHAT_TICKET_SECRET vừa sinh vào `frontend/.env.local`. Không dùng khóa mẫu cố định.
Tạo database `student_market`; chạy `backend/StudentMarket.API/Data/Migrations/InitialCreate.sql` trong Query Tool của database đó, rồi `npm run db:migrate`. Migration bổ sung tạo 5 danh mục mặc định khi chưa có.

Nếu chạy .NET, cấu hình `ConnectionStrings:DefaultConnection` trong `backend/StudentMarket.API/appsettings.Development.json` (gitignored) hoặc biến môi trường `ConnectionStrings__DefaultConnection`.

Tạo admin lần đầu, không ghi đè admin đã có:
```powershell
npm --prefix frontend run admin:create -- admin@example.com
```
Mật khẩu ngẫu nhiên được ghi vào `frontend/.data/admin-login.txt`; đổi mật khẩu sau khi đăng nhập.

## Lỗi thường gặp khi khởi động

### Thiếu Next.js hoặc báo Cannot find module

Ví dụ: `Cannot find module '...frontend\node_modules\next\dist\bin\next'`, `next is not recognized` hoặc `Thiếu dependencies frontend`.

Dependencies frontend đang thiếu hoặc cài chưa đầy đủ, thường gặp sau khi giải nén ZIP hoặc chạy `npm run clean:all`. Dừng lệnh đang chạy bằng Ctrl+C, mở terminal tại thư mục gốc rồi chạy:

```powershell
npm --prefix frontend ci
npm run dev
```

Giữ lại `frontend/package.json` và `frontend/package-lock.json` để cài lại đúng thư viện. Chỉ thấy dòng địa chỉ website trong terminal chưa đủ xác nhận dịch vụ đã sẵn sàng; kiểm tra thông báo `Ready` và mở website.

### Thiếu môi trường Python hoặc thư viện chat

Nếu báo `Create .venv and install fastapi_chat/requirements.txt` hoặc `ModuleNotFoundError` từ chat, tạo `.venv` nếu chưa có, rồi cài requirements bằng đúng Python của project:

```powershell
# Chỉ tạo môi trường nếu thư mục .venv chưa có.
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r fastapi_chat/requirements.txt
npm run dev
```

### Không kết nối được database hoặc không tải được sản phẩm

Kiểm tra dịch vụ PostgreSQL đang chạy và các biến `PG_*` trong `frontend/.env.local` trỏ đúng database `student_market`. Nếu database mới chưa có bảng, thực hiện phần khởi tạo và migration trong mục **Cài lại trên máy mới**. Nếu báo thiếu bảng sau khi cập nhật mã nguồn, dừng app, chạy `npm run db:migrate`, rồi khởi động lại.

### Chatbot hoặc AI kiểm duyệt chưa hoạt động

- **Hỏi SangTay:** kiểm tra backend chatbot tại `http://127.0.0.1:2024/info`, project chatbot bên cạnh và hướng dẫn `LOCAL-SETUP.md` của project đó.
- **AI kiểm duyệt:** kiểm tra worker online, công tắc trong Admin, migration AI và `GEMINI_API_KEY` trong `frontend/.env.local`. Nếu chỉ chạy frontend, mở terminal riêng chạy `npm run worker:ai`.
- Sau khi đổi key/model, khởi động lại dịch vụ AI liên quan. Không gửi khóa thật vào chat hoặc đưa vào ZIP mã nguồn.

## Dọn dung lượng và tạo ZIP

Dừng các dịch vụ đang dùng project trước khi dọn. Tại thư mục gốc:

| Lệnh | Tác dụng | Trước khi chạy lại |
| --- | --- | --- |
| `npm run clean` | Xóa build/cache và file tạm trong các thư mục được script quản lý | Chạy `npm run dev`; cache sẽ được tạo lại |
| `npm run clean:all` | Dọn như trên và xóa thêm `frontend/node_modules` | Chạy `npm --prefix frontend ci`, rồi `npm run dev` |

Các lệnh dọn giữ nguyên mã nguồn, file môi trường, dữ liệu tải lên và database. Giữ `frontend/.data` hoặc thư mục ảnh đã cấu hình và sao lưu PostgreSQL nếu muốn chuyển cả dữ liệu sang máy khác.

Để tạo ZIP mã nguồn gọn mà vẫn giữ dependencies trên máy đang dùng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-source.ps1
```

ZIP nằm ở thư mục cha của project. Xem [hướng dẫn giải nén](HUONG-DAN-GIAI-NEN.md) để cài lại trên máy nhận.

## Dịch vụ cần cấu hình thêm

### Xác thực email và mật khẩu

- **Đăng ký bằng email:** sau khi gửi biểu mẫu, nhập mã 6 số trong màn hình **Xác thực email**. Mọi email đăng ký mới đều phải xác thực; email ngoài `.edu`/`.edu.vn` xác thực xong chuyển sang chờ Admin duyệt ảnh thẻ, không tự đăng nhập.
- **Gửi lại mã:** nếu chưa nhận được, kiểm tra thư rác và đợi 60 giây rồi bấm **Gửi lại mã**. Có thể mở lại qua liên kết **Xác thực email bằng mã** ở `/login`, hoặc từ thông báo chưa xác minh khi đăng nhập.
- **Đổi mật khẩu:** vào **Tài khoản → Cài đặt tài khoản & Bảo mật** (`/account?tab=settings`), nhập mật khẩu hiện tại, mật khẩu mới và xác nhận. Các phiên cũ bị thu hồi; trình duyệt thực hiện thao tác nhận phiên mới.
- **Quên mật khẩu:** tại Đăng nhập chọn **Quên mật khẩu?**, nhập email, nhận mã, nhập mã cùng mật khẩu mới và xác nhận. Sau khi thành công, đăng nhập lại; mọi phiên cũ đã bị thu hồi. Chỉ tài khoản đang hoạt động mới nhận mã đặt lại.
- Mã có hiệu lực **10 phút**, chỉ dùng một lần và khóa sau **5 lần nhập sai**. Gửi lại thành công vô hiệu mã cũ; tối đa 5 lần gửi cho mỗi mục đích trong một giờ. Mật khẩu cần 8–128 ký tự, gồm chữ và số.
- Cần SMTP hợp lệ để đăng ký và khôi phục mật khẩu. Mã được băm HMAC trong database, không trả qua API hay ghi log. Khóa dùng `EMAIL_CODE_SECRET` (nếu đặt) hoặc `CHAT_TICKET_SECRET`, tối thiểu 32 ký tự, chỉ lưu phía server. Khởi động lại frontend sau khi đổi khóa; mã cũ sẽ không còn hợp lệ.
- Chạy `npm run db:migrate` sau khi cập nhật mã nguồn để tạo bảng `account_email_codes`. Các liên kết xác minh email trường đã gửi theo phiên bản cũ vẫn được hỗ trợ đến khi hết hạn hoặc người dùng yêu cầu mã mới.
- Kiểm thử: build frontend rồi chạy `npm test`. Bộ kiểm thử dùng database cô lập và hộp thư giả lập, không gửi mã tới địa chỉ email thật.

### Thông báo trên website và Admin

Nút chuông ở thanh điều hướng hiển thị cập nhật trong 30 ngày gần đây (tối đa 50 dòng). Người dùng nhận kết quả duyệt/từ chối tin, tin nhắn gửi đến và kết quả báo cáo. Admin nhận tin đang chờ duyệt, tài khoản cần xét ảnh thẻ và báo cáo mới; nhân viên chỉ thấy hàng chờ tin đăng.

Danh sách cập nhật mỗi 30 giây khi trang đang hiển thị và tải lại khi mở chuông. Bấm thông báo mở trang liên quan; **Đọc tất cả** lưu trạng thái đọc riêng cho tài khoản trong PostgreSQL. Đọc thông báo tin nhắn không tự đánh dấu nội dung chat đã đọc. Các mục Admin đã giải quyết rời hàng chờ thông báo. Khi cài mới, `npm run db:migrate` tạo bảng đọc; trên database đã chạy dùng `npm --prefix frontend run db:migrate:notifications`.

### Trợ lý AI từ tài liệu PDF

Nút **Hỏi SangTay** tìm sản phẩm thật qua PostgreSQL và trả FAQ trực tiếp trong website. Phần hỏi tài liệu PDF dùng chatbot tại thư mục bên cạnh `../ai-pdf-chatbot-langchain`. Khi thư mục này tồn tại, `npm run dev` tự chạy LangGraph tại localhost:2024 và trang nạp PDF tại localhost:3001. Xem `../ai-pdf-chatbot-langchain/LOCAL-SETUP.md` để cấu hình Gemini/Supabase và nạp tài liệu. Khóa PDF ở `backend/.env` của chatbot, khác key AI duyệt tin trong `frontend/.env.local`. Khi deploy, kết nối endpoint PDF riêng theo [hướng dẫn Render](DEPLOY-RENDER.md); FAQ/tìm sản phẩm không cần dịch vụ PDF.

API `/api/assistant/chat` chuyển tiếp câu hỏi từ cùng tên miền website nên dùng được qua ngrok cổng 3000. Hai cổng chatbot 3001/2024 giữ nội bộ. Nếu chạy chatbot ở vị trí khác, cấu hình `PDF_CHAT_APP_URL` và `PDF_CHAT_GRAPH_URL` trên server StudentMarket.

### AI tự duyệt tin đăng trong Admin

Admin có thể bật **AI tự duyệt** tại `/admin/moderation`. Gemini chỉ nhận tiêu đề, mô tả đã ẩn thông tin liên hệ và các ảnh sản phẩm đã tải lên máy chủ. Tin hợp lệ phải đạt ngưỡng tin cậy 0,90 và không có cờ cảnh báo mới được chuyển sang `APPROVED`. Giá thấp và mô tả ngắn kiểu chợ đồ cũ không tự bị xem là lừa đảo khi tiêu đề và ảnh giúp nhận biết món đồ. Tin thiếu ảnh, dùng ảnh ngoài hệ thống, có dấu hiệu rủi ro cụ thể hoặc không nhận biết được sản phẩm vẫn ở `PENDING` để Admin xử lý. Kết quả, lý do và thao tác được lưu trong Audit Log. Khi đổi phiên bản chính sách, worker đánh giá lại các tin còn chờ đã được kiểm tra theo chính sách cũ; các tin Admin đã xử lý giữ nguyên.

Đặt khóa server-only trong `frontend/.env.local` (không dùng tiền tố `NEXT_PUBLIC_`), rồi chạy migration một lần:

```powershell
npm --prefix frontend run db:migrate:ai
```

Worker AI là tiến trình Node.js riêng, dùng PostgreSQL để lấy hàng chờ và lưu trạng thái bật/tắt. `npm run dev` tự khởi động worker; nếu chỉ chạy Next.js hoặc dùng bản production, chạy worker trong tiến trình riêng:

```powershell
npm run worker:ai
```

Vào **Admin → Kiểm duyệt → Bật AI tự duyệt** một lần sau migration. Công tắc được lưu ở server, dùng chung giữa các trình duyệt và vẫn giữ sau F5/khởi động lại. Worker quét tối đa 2 tin mỗi lượt, nghỉ 20 giây giữa các lượt và tiếp tục làm việc khi đóng Admin. Máy/server, worker và PostgreSQL phải còn chạy. Không cần Redis cho cấu hình hiện tại.

Admin thấy heartbeat, thời điểm quét gần nhất và lỗi worker. Tắt công tắc sẽ dừng các lượt mới và vô hiệu hóa kết quả tự duyệt còn đang chờ từ lượt cũ; nút **Quét & duyệt tin hợp lệ** vẫn là thao tác thủ công riêng. Worker kiểm tra lại quyền của Admin đã bật nó, giữ tin nghi ngờ ở hàng chờ, thử lại lỗi Gemini sau 15 phút và dùng khóa PostgreSQL để tránh chạy nhiều worker cùng database. Không tạo tài khoản Admin hoặc phiên đăng nhập riêng cho worker.

Worker đọc `.env.local` khi khởi động. Khi thay Gemini key/model, khởi động lại worker để dùng cấu hình mới. Trong production nên quản lý tiến trình bằng dịch vụ của hệ điều hành hoặc container có chính sách tự khởi động lại; lệnh này không tự cài Windows Service.

Kiểm thử worker trên database cô lập (cần build frontend trước): `npm --prefix frontend run test:ai-integration`. Kiểm thử bao gồm chạy worker khi Next.js đã đóng, bật/tắt, hủy kết quả đang xử lý và chống worker trùng.

### Các dịch vụ khác

- **Thanh toán gói đẩy tin:** đã tích hợp SePay QR chuyển khoản, webhook HMAC-SHA256 và bảng đối soát trong Admin. Điền cấu hình `SEPAY_*`, tạo webhook và bật thanh toán theo [hướng dẫn SePay](frontend/docs/sepay.md). Chỉ webhook xác thực, khớp đơn/số tiền/tài khoản mới kích hoạt gói; không có nút tự đánh dấu đã thanh toán từ trình duyệt. Việc mua bán hàng giữa sinh viên vẫn thỏa thuận trực tiếp.
- **Hiệu quả đẩy tin:** vào **Tin đăng của tôi → Xem hiệu quả**, chọn từng gói đã mua để so sánh lượt xem, người lưu và người nhắn tin trong hai khoảng trước/trong đẩy dài bằng nhau; xem giờ bắt đầu/hết hạn, lịch sử gói cũ và ghi chú nếu dữ liệu chưa đầy đủ. Xem [hướng dẫn thống kê đẩy tin](frontend/docs/promotion-analytics.md).
- **Góp ý AI trước khi đăng:** trong **Đăng tin**, bấm **Nhờ AI góp ý** để xem gợi ý ảnh, tiêu đề và thông tin nên bổ sung; tự chọn sửa hoặc áp dụng tiêu đề. Xem [cấu hình và cách dùng](frontend/docs/listing-advice.md).
- **Trung tâm hỗ trợ:** đọc FAQ và hướng dẫn giao dịch an toàn tại `/support`; sinh viên gửi/theo dõi phiếu, Admin phản hồi và cập nhật tiến độ trong **Phiếu hỗ trợ**. Có thông báo, lịch sử trao đổi, tìm kiếm và phân trang. Xem [hướng dẫn hỗ trợ](frontend/docs/support.md).

- SMTP Gmail dùng để gửi mã xác thực đăng ký và mã đặt lại mật khẩu. Điền các biến sau vào `frontend/.env.local` rồi khởi động lại frontend:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=địa_chỉ_gmail_của_bạn
SMTP_PASSWORD=mật_khẩu_ứng_dụng_16_ký_tự
SMTP_FROM=SangTay <địa_chỉ_gmail_của_bạn>
```

`SMTP_PASSWORD` phải là **App Password** của Google, không phải mật khẩu đăng nhập Gmail. Không gửi giá trị này vào chat và không commit `.env.local`.

- Google OAuth cần tạo OAuth Client dạng **Web application** trong Google Cloud Console. Thêm đúng redirect URI vào mục **Authorized redirect URIs**:

```text
http://localhost:3000/api/auth/google/callback
https://TEN-NGROK-CUA-BAN.ngrok-free.dev/api/auth/google/callback
```

Sau đó điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` và `GOOGLE_REDIRECT_URI` trong `frontend/.env.local`. Khi chạy bằng ngrok, `APP_ORIGIN` và `GOOGLE_REDIRECT_URI` phải dùng cùng một hostname ngrok hiện tại.

- Mọi đăng ký email đều cần SMTP để gửi mã xác thực. Email .edu hoặc .edu.vn nhập đúng mã được tự động chuyển sang `verified`. Email khác nhập đúng mã chuyển sang `pending_review`, cần ảnh thẻ và Admin duyệt. Thiếu SMTP hoặc gửi mail thất bại trả lỗi 503 và không giữ tài khoản đăng ký dở.
- Google OAuth cần GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và redirect URI tương ứng.
- Khi chưa điền đủ cấu hình SePay hoặc `SEPAY_ENABLED=false`, việc tạo đơn thu phí được tắt. Các khoản thiếu/thừa tiền, sai mã hoặc ngoài hạn được lưu để Admin đối soát; hệ thống chưa tự hoàn tiền. Chạy `npm --prefix frontend run test:sepay` và `npm --prefix frontend run test:sepay-integration` để kiểm tra thanh toán trên dữ liệu thử nghiệm.
- Khi triển khai HTTPS, đặt APP_ORIGIN đúng website và NEXT_PUBLIC_CHAT_WS_URL thành địa chỉ wss:// của chat rồi build lại. Hai dịch vụ cần cùng CHAT_TICKET_SECRET và cấu hình PG_*. Chat hiện chạy một worker; nhiều worker/máy cần cơ chế broadcast dùng chung như Redis.
- Tài khoản được xác minh bởi logic demo cũ nên được admin kiểm tra lại trước khi đưa hệ thống vào dùng thật.

## Kiểm tra

```powershell
npm run build
npm run lint
npm test
dotnet build backend/StudentMarket.API
```

`npm test` cần PostgreSQL role có quyền tạo database và pg_dump trong PG_BIN (mặc định C:/Program Files/PostgreSQL/16/bin). Test chỉ sao chép schema, tạo database tên student_market_test_<ngẫu nhiên>, rồi xóa database tạm. Không chạy test ghi dữ liệu vào database nghiệp vụ.

Build và kiểm tra tích hợp đã thành công. ESLint còn các cảnh báo tối ưu thẻ ảnh; xem báo cáo sửa lỗi để biết phạm vi kiểm tra và giới hạn.

Bản sao trước khi gộp: `.backups/before-consolidation-20261001.zip`. Bản sao có cấu hình cục bộ và dữ liệu tài khoản, nên giữ riêng trên máy.

