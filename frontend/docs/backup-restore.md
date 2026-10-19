# Sao lưu và khôi phục StudentMarket

Chạy các lệnh từ thư mục gốc có `package.json` (máy hiện tại: `F:\ThuongMaiDienTu\StudentMarket\StudentMarket`). Cần Node.js 22+, dependencies frontend và PostgreSQL client 16 hoặc phiên bản tương thích với server. Công cụ dùng cấu hình `PG_*` và kho ảnh trong `frontend/.env.local`; không cần nhập mật khẩu vào dòng lệnh.

## Tạo bản sao lưu

```powershell
npm run backup
```

Kết quả ở `.backups/snapshots/<thời-gian>-<mã>/`. Chỉ thư mục có `manifest.json`, `complete: true` và kiểm tra toàn vẹn thành công mới là bản sao dùng được. Nếu lỗi, thư mục `.partial` được giữ lại để kiểm tra; sửa nguyên nhân rồi tạo bản mới.

Mỗi bản gồm:

- `database.dump`: database PostgreSQL đầy đủ, gồm tài khoản, tin đăng, phiên, tin nhắn, giao dịch, đơn thanh toán, sổ giao dịch SePay, log kiểm duyệt, schema, view, trigger, hàm và sequence. Database dump và danh mục ảnh dùng chung một snapshot PostgreSQL.
- `media/products/`, `media/cards/`, `media/chat/`: ảnh đang được database tham chiếu, lấy từ provider đang cấu hình, kể cả ảnh trên Supabase. Ảnh thẻ/chat Private được tải bằng khóa phía server. Không dùng file local thay thế khi provider Supabase đang lỗi.
- `config/frontend.env` cùng cấu hình .NET nếu có và file thông tin admin ban đầu nếu có. Đây là cấu hình nguyên bản, có thể chứa khóa và mật khẩu thật.
- `source.zip`: mã nguồn qua script `package-source.ps1`; bỏ dependencies, cache, backup, `.data` và file môi trường.
- `manifest.json`: thời gian, database nguồn, số bản ghi mỗi bảng, danh mục ảnh và SHA-256/kích thước từng file. Công cụ đọc kiểm tra lại trước khi báo thành công.

Backup **chưa mã hóa**, chứa dữ liệu cá nhân và khóa dịch vụ. Giữ riêng tư; nếu lưu ngoài máy, dùng ổ/thư mục có mã hóa hoặc kho lưu trữ riêng. `.backups` được loại khỏi Git và ZIP mã nguồn. Sau khi tạo, chép **cả thư mục snapshot** sang ổ khác hoặc kho riêng; giữ ít nhất một bản ngoài máy chạy website. Lệnh không tự xóa bản cũ và không tự tạo lịch sao lưu.

Không sao lưu PostgreSQL roles/tablespaces hoặc quyền sở hữu toàn cluster; người khôi phục sở hữu các object. Không sao lưu dữ liệu trong project chatbot PDF riêng, khóa cấu hình ngrok trên máy, ảnh Internet bên ngoài hay ảnh mồ côi không còn được database sử dụng. Ảnh tĩnh trong `public` nằm trong `source.zip`. Khi backup báo thiếu ảnh, cần sửa tham chiếu/kho ảnh trước; không tạo bản sao “thành công” thiếu ảnh. Nên thực hiện khi ít người cập nhật ảnh; ảnh bị xóa trong lúc sao lưu sẽ khiến lệnh thất bại để tránh bản thiếu dữ liệu.

## Kiểm tra bản sao

Thay đường dẫn dưới đây bằng đường dẫn tuyệt đối được lệnh backup in ra:

```powershell
npm run backup:verify -- --from "F:\ThuongMaiDienTu\StudentMarket\StudentMarket\.backups\snapshots\TEN-BAN-SAO"
```

Lệnh kiểm tra mọi checksum, file thiếu/thừa, đường dẫn và tham chiếu ảnh. Checksum phát hiện hỏng/thay đổi file; không thay thế chữ ký xác thực. Chỉ khôi phục bản sao của bạn từ nơi đáng tin cậy, vì PostgreSQL restore thực thi schema/hàm trong dump.

## Khôi phục vào database mới

```powershell
npm run restore -- --from "F:\ThuongMaiDienTu\StudentMarket\StudentMarket\.backups\snapshots\TEN-BAN-SAO" --database student_market_recovered
```

Lệnh kiểm tra backup trước, yêu cầu quyền tạo database và từ chối database đang dùng, database nguồn, database hệ thống hoặc tên đã tồn tại. Không có chế độ ghi đè. `pg_restore` chạy trong một transaction; sau đó so sánh số bản ghi tất cả bảng với snapshot. Khi thất bại, database đích mới có thể còn tồn tại; kiểm tra và dùng tên đích mới khi thử lại.

Kết quả ở `.backups/restores/<thời-gian>-<mã>/`, gồm ảnh, `restore-report.json` và `frontend.env.restored`. Có thể chỉ định `--output "F:\duong-dan\thu-muc-moi"`; thư mục này phải chưa tồn tại. Đường dẫn tương đối trong lệnh được tính từ `frontend`, nên nên dùng đường dẫn tuyệt đối.

File `frontend.env.restored` trỏ tới database mới và ảnh local đã phục hồi. Các đường dẫn thẻ sinh viên được chuyển thành tham chiếu portable. AI tự duyệt trong database mới và `SEPAY_ENABLED` trong cấu hình mới được tắt để kiểm tra trước; dữ liệu thanh toán, gói đã mua và sổ giao dịch vẫn được khôi phục. Công cụ không tự chạy website, worker, gửi email hay gọi thanh toán, không ghi đè `.env.local` hiện tại.

Để đưa bản khôi phục vào sử dụng:

1. Kiểm tra `restore-report.json` có `complete: true`. Mở database mới trong pgAdmin, đối chiếu người dùng, sản phẩm, tin nhắn, đơn và giao dịch.
2. Nếu máy mới, giải nén `source.zip`, cài dependencies theo README, cài PostgreSQL và điền kết nối của máy mới vào `frontend/.env.local` để chạy lệnh restore. Cần script backup/restore phiên bản này hoặc mới hơn.
3. Dừng website, chat và worker trước khi đổi cấu hình. Lưu lại `.env.local` đang dùng rồi sao chép `frontend.env.restored` thành `frontend/.env.local`; kiểm tra `APP_ORIGIN`, Google OAuth redirect, SMTP và webhook SePay tương ứng domain mới. Các đường dẫn ảnh là đường dẫn tuyệt đối đến thư mục restore: giữ thư mục đó hoặc chuyển ảnh và sửa 3 biến thư mục.
4. Chạy website, kiểm tra ảnh sản phẩm, ảnh thẻ qua Admin, ảnh chat và dữ liệu nghiệp vụ. Phiên/OTP trong backup có thể đã hết hạn; đăng nhập mới khi cần.
5. Khi triển khai trên ổ đĩa tạm, [cấu hình Supabase Storage](storage.md) rồi `storage:setup` và `storage:migrate -- --apply` từ frontend để chuyển ảnh local khôi phục sang kho cloud. Chỉ đổi `MEDIA_STORAGE_PROVIDER=supabase` sau khi chuyển/kiểm tra thành công. Không chạy migration từ cấu hình database cũ.
6. Kiểm tra webhook/ngân hàng và worker trước khi bật lại thanh toán, AI tự duyệt.

Giữ database cũ và bản backup cho đến khi kiểm tra xong. Nếu cần quay lại, dừng dịch vụ, khôi phục file cấu hình cũ rồi chạy lại.

## PostgreSQL client ở nơi khác

Windows mặc định dùng `C:\Program Files\PostgreSQL\16\bin`. Thay nếu cài nơi khác:

```powershell
$env:PG_BIN = 'C:\Program Files\PostgreSQL\17\bin'
npm run backup
```

Lệnh đóng gói mã nguồn hiện dùng Windows PowerShell, giống script ZIP của project. Nếu triển khai Linux, chuẩn bị backup từ máy Windows kết nối database/kho ảnh, hoặc bổ sung công cụ đóng gói tương ứng trước khi dùng lệnh này trên Linux.

## Kiểm thử công cụ

```powershell
npm run test:backup
```

Tạo database fixture riêng, sao lưu/khôi phục dữ liệu mẫu và 3 loại ảnh, kiểm tra view/trigger/sequence, cấu hình và các trường hợp hỏng file/ghi đè. Database fixture được dọn sau kiểm thử; bản backup fixture được giữ trong `.backups`, có `sourceDatabase` mang tên `_backup_test_` để phân biệt với bản thật.

Tham khảo: [PostgreSQL pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html).
