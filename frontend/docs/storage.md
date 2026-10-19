# Lưu ảnh khi triển khai StudentMarket

StudentMarket hỗ trợ `local` để phát triển và `supabase` để lưu ảnh ngoài máy chủ. Khi dùng Supabase, đăng tin, đăng ký bằng thẻ sinh viên, gửi ảnh chat và worker AI đều dùng cùng kho ảnh; việc redeploy website không xóa các ảnh đã tải lên Supabase. Database PostgreSQL vẫn cần được triển khai và sao lưu riêng.

## Cấu hình server

Điền trong `frontend/.env.local` khi chạy trên máy; trên Render/Vercel hoặc máy chủ khác, điền vào phần biến môi trường của dịch vụ:

```env
MEDIA_STORAGE_PROVIDER=supabase
MEDIA_STORAGE_READ_LOCAL_FALLBACK=false
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET_KEY
SUPABASE_PRODUCT_BUCKET=studentmarket-products
SUPABASE_CARD_BUCKET=studentmarket-cards
SUPABASE_CHAT_BUCKET=studentmarket-chat
```

Lấy Project URL và Secret key tại project Supabase → **Settings → API Keys / Connect**. Khóa mới có tiền tố `sb_secret_`. Nếu đang dùng khóa JWT `service_role` cũ, có thể đặt `SUPABASE_SERVICE_ROLE_KEY` thay cho `SUPABASE_SECRET_KEY`. Không dùng khóa `anon`/publishable và không thêm `NEXT_PUBLIC_` cho khóa server. Không gửi khóa qua chat hoặc commit `.env.local`. Xem [tài liệu API keys của Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Nếu dùng chung project với chatbot, tạo các bucket riêng như bên dưới; không cần đổi bảng documents, khóa Gemini hoặc chức năng chatbot.

## Tạo bucket và kiểm tra

Chạy ở thư mục gốc StudentMarket:

```powershell
npm --prefix frontend run storage:setup
npm --prefix frontend run storage:check
```

| Bucket mặc định | Chế độ | Nội dung |
| --- | --- | --- |
| `studentmarket-products` | Public | Ảnh tin đăng |
| `studentmarket-cards` | Private | Ảnh thẻ sinh viên, chỉ Admin đọc qua API của ứng dụng |
| `studentmarket-chat` | Private | Ảnh đính kèm chat, chỉ thành viên cuộc trò chuyện đọc qua API |

Script setup chỉ tạo bucket còn thiếu và kiểm tra đúng Public/Private. Nó không tự đổi quyền của bucket đã có, không tạo policy cho phép người lạ upload hoặc đọc ảnh riêng tư. Bucket nhận JPG/PNG/WebP tối đa 5 MiB; giới hạn cụ thể trong form đăng tin/đăng ký vẫn là 5.000.000 byte. Không đổi hai bucket riêng tư sang Public. Phân quyền tải ảnh lên được kiểm tra tại API StudentMarket trước khi server gọi Supabase.

Ảnh vẫn dùng các đường dẫn `/api/product-images/...`, `/api/admin/accounts/.../card` và `/api/conversations/.../attachments/...` nên giao diện và tin cũ không phải đổi URL. Ảnh sản phẩm được phép cache; ảnh thẻ/chat trả `no-store`. Khóa Supabase không được đưa vào các URL hoặc response cho trình duyệt.

## Chuyển ảnh cũ trước khi deploy

Chạy trên máy còn dữ liệu ảnh và cấu hình đúng database hiện tại. Giữ nguyên `.data` để có bản sao gốc.

1. Để `MEDIA_STORAGE_PROVIDER=local` trong khi chuẩn bị. Điền cấu hình Supabase và chạy setup như trên.
2. Kiểm kê các ảnh đang được database tham chiếu:

```powershell
npm --prefix frontend run storage:migrate
```

3. Sao chép ảnh và kiểm tra SHA-256 từng file:

```powershell
npm --prefix frontend run storage:migrate -- --apply
```

Lệnh mặc định chỉ chuyển ảnh được tin đăng, tài khoản hoặc tin nhắn tham chiếu. Có thể thêm `--include-unreferenced` để chuyển cả file chưa được dùng trong các thư mục ảnh. Script không ghi đè file có nội dung khác trên Supabase và không xóa file local. Báo cáo nằm trong `.backups/storage-migration-*.json` (giữ riêng, không đưa vào bản ZIP công khai). Chạy lại sẽ kiểm tra các ảnh đã chuyển thay vì tạo bản trùng.

Nếu project từng đổi thư mục và ảnh thẻ còn trỏ tới đường dẫn cũ, trong khi file UUID tương ứng đã được chuyển vào thư mục ảnh thẻ hiện tại:

```powershell
npm --prefix frontend run storage:migrate -- --apply --legacy-card-dir 'F:\DUONG-DAN-CU\frontend\.data\student-cards'
```

Chỉ khai báo thư mục ảnh thẻ cũ của project. Script đọc file UUID từ thư mục ảnh thẻ hiện tại và chỉ cập nhật `card_path` sang tham chiếu di động `media:cards/...` sau khi ảnh trên Supabase đã được xác minh. File thiếu hoặc tham chiếu không hợp lệ được báo lỗi; xử lý trước khi bỏ bản sao local.

4. Đổi `MEDIA_STORAGE_PROVIDER=supabase`, lưu và khởi động lại frontend **và worker AI**. Có thể tạm bật `MEDIA_STORAGE_READ_LOCAL_FALLBACK=true` khi chuyển đổi: ảnh mới luôn được ghi vào Supabase; chỉ ảnh cũ chưa có trên cloud mới được đọc từ local. Lỗi kết nối hoặc lỗi quyền Supabase không tự chuyển sang ghi local.
5. Chạy lại migration sau khi đổi provider để kiểm tra cả ảnh vừa phát sinh. Khi `failed=0`, `invalidReferences=0`, đặt `MEDIA_STORAGE_READ_LOCAL_FALLBACK=false` và khởi động lại frontend/worker. Giữ bản sao local cho tới khi đã kiểm tra trên môi trường triển khai.

Các ảnh mẫu, font và ảnh giao diện trong `frontend/public/` vẫn đi cùng mã nguồn khi build/deploy; không nằm trong đợt chuyển ảnh tải lên này.

## Khi triển khai Render hoặc máy chủ khác

- Đặt cùng cấu hình Supabase cho website Next.js và worker AI. Để fallback `false` trên máy triển khai.
- Không đóng gói `node_modules`, `.next`, `.env.local`, `.backups` hoặc khóa thật vào ZIP. Điền lại biến môi trường trên dịch vụ triển khai.
- Không cần ổ đĩa cố định cho các ảnh đã lưu trên Supabase; PostgreSQL, WebSocket/chat và chatbot vẫn là các dịch vụ cần cấu hình triển khai riêng.
- Nếu quay về `local`, máy chủ phải có đủ thư mục ảnh gốc. Các biến tùy chọn là `PRODUCT_IMAGE_DIR`, `STUDENT_CARD_DIR`, `CHAT_ATTACHMENT_DIR`; các thư mục này cần ổ đĩa bền vững khi sử dụng trong production.
- Supabase hết quota, bị tạm dừng hoặc khóa sai sẽ khiến upload thất bại rõ ràng; ứng dụng không âm thầm ghi ảnh lên ổ tạm của server. Kiểm tra usage/quota trong Supabase và duy trì sao lưu riêng.

## Kiểm thử

```powershell
npm --prefix frontend run build
npm --prefix frontend run test:storage
npm --prefix frontend run test:storage-integration
npm --prefix frontend run test:ai-storage-integration
```

Các bài kiểm thử dùng Storage giả lập và database tạm, không dùng bucket thật hay gọi Gemini thật. Kiểm thử bao gồm đăng/tải/thay ảnh sản phẩm, quyền đọc ảnh thẻ/chat, lỗi upload, đường dẫn không hợp lệ và worker AI đọc ảnh từ kho ngoài.

Tài liệu Supabase: [bucket Public/Private](https://supabase.com/docs/guides/storage/buckets/fundamentals), [upload ảnh](https://supabase.com/docs/guides/storage/uploads/standard-uploads).
