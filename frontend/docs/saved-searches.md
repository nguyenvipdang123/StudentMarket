# Theo dõi nhu cầu mua và giảm giá

## Lưu nhu cầu

1. Đăng nhập bằng tài khoản sinh viên đã xác minh và mở **Khám phá**.
2. Tìm từ khóa, chọn trường, danh mục, ngân sách hoặc các bộ lọc khác.
3. Bấm **Theo dõi nhu cầu này**, đặt tên (ví dụ “Laptop dưới 5 triệu tại DNTU”), rồi **Lưu & bật thông báo**.
4. Mở **Đã lưu / Yêu thích → Nhu cầu đang theo dõi** để xem món phù hợp, tạm dừng, bật lại hoặc xóa nhu cầu.

Mỗi tài khoản lưu tối đa **10 nhu cầu**. Không lưu nhu cầu trống hoặc bộ lọc trùng; thứ tự từ khóa, chữ hoa/thường/dấu và mã trường tương đương được chuẩn hóa để kiểm tra trùng. Muốn sửa tiêu chí, mở kết quả, đổi bộ lọc và lưu nhu cầu mới; xóa nhu cầu cũ nếu không dùng.

Nhu cầu lưu từ khóa, danh mục, hình thức, tình trạng, trường và khoảng giá; không lưu thứ tự sắp xếp hoặc số trang. Liên kết **Xem món phù hợp** mở Khám phá với đầy đủ bộ lọc và sắp xếp mới nhất.

## Thông báo tin phù hợp

- Khi lưu nhu cầu, các tin đang hiển thị được ghi nhận làm mốc, không gửi dồn thông báo cũ.
- Khi có tin mới hoặc tin được sửa lần đầu khớp tiêu chí và **đã được duyệt**, chuông hiện **Có món đồ phù hợp nhu cầu của bạn**. Từ khóa tiếng Việt hỗ trợ tìm không dấu; trường dùng cùng bộ mã/tên tương đương với Khám phá.
- Tin ẩn, đã bán, chờ duyệt hoặc bị từ chối không gửi thông báo. Không báo tin của chính bạn.
- Một nhu cầu chỉ báo một lần cho một sản phẩm, kể cả khi sản phẩm được duyệt lại. Nhiều nhu cầu cùng khớp một sản phẩm ở cùng lượt cập nhật chỉ tạo một thông báo cho tài khoản đó.
- Tạm dừng chặn các thông báo mới. Khi bật lại, những tin đang hiển thị được lấy làm mốc mới; không gửi dồn tin trong lúc tạm dừng. Thông báo cũ vẫn xem được. Xóa nhu cầu xóa các thông báo gắn với nhu cầu đó.

## Theo dõi giảm giá món đã lưu

Nhấn trái tim để lưu sản phẩm sẽ bật báo giảm giá mặc định. Trong **Đã lưu**, dùng **Tắt báo giảm giá / Bật báo giảm giá** để quản lý riêng từng món.

Chuông báo **Món đồ đã lưu vừa giảm giá**, kèm giá cũ và giá mới. Hệ thống so với **giá công khai được duyệt gần nhất**, không gửi khi giá tăng hoặc giữ nguyên. Ví dụ giá 3 triệu giảm xuống 2,5 triệu nhưng đang chờ duyệt: chỉ sau khi duyệt mức giá 2,5 triệu mới báo giảm giá. Nếu giảm tiếp lần khác sẽ có thông báo mới; F5 không tạo thêm thông báo.

Bỏ lưu hoặc tắt báo giảm giá sẽ ngừng thông báo mới và ẩn các thông báo giảm giá cũ cho món đó khỏi chuông. Bật lại không gửi bù các lần giảm trước. Tin bị ẩn/chờ duyệt/đã bán cũng được loại khỏi thông báo; thông báo đã tạo có thể hiện lại nếu tin được mở công khai trở lại trong thời hạn lưu.

## Cách hoạt động và giới hạn

Thông báo được lưu trong PostgreSQL ngay trong giao dịch đăng/duyệt/cập nhật tin, hoạt động với cả Admin duyệt tay và worker AI. Không cần khóa AI, dịch vụ trả phí hay worker mới cho phần này. Chuông hiện có tải lại mỗi **30 giây** khi trang đang hiển thị, khi quay lại cửa sổ hoặc khi mở chuông. Xử lý vẫn lưu thông báo khi người mua không mở website; người mua xem được lúc quay lại.

Đây là thông báo trong website, chưa có email, SMS hay push khi đóng trình duyệt. Chuông giữ phạm vi 30 ngày và tối đa 50 thông báo hiển thị như các nhóm thông báo khác. Không tự tạo lịch chạy hoặc gửi tin ra bên ngoài.

Nhu cầu, trạng thái theo dõi và thông báo chỉ truy cập được bằng tài khoản sở hữu; API không nhận ID người dùng từ trình duyệt. Các mutation kiểm tra cùng origin. Tin đang giữ chỗ vẫn có thể khớp nhu cầu (có nhãn giữ chỗ); người mua cần xem trạng thái mới nhất trước khi hẹn gặp.

## Cài đặt và dữ liệu

Máy hiện tại đã chạy migration. Máy khác chạy từ thư mục gốc:

```powershell
npm run db:migrate
```

Migration `frontend/scripts/saved-searches-schema.sql` bổ sung:

- `favorites.price_alert_enabled`: tùy chọn nhận giảm giá, mặc định bật cả với các món đã lưu trước đây.
- `saved_searches`, `saved_search_matches`: nhu cầu và những sản phẩm đã được ghi nhận.
- `product_alert_state`: giá công khai gần nhất và phiên bản cập nhật.
- `product_alert_events`: sự kiện cho chuông thông báo.
- Trigger `trg_publish_product_alerts` trên sản phẩm: chỉ xử lý các thay đổi liên quan đến tiêu chí/giá/công khai, không xử lý tăng lượt xem.

Migration có thể chạy lại, không gửi thông báo lịch sử và không thay đổi duyệt tin. Dữ liệu trên nằm trong backup PostgreSQL hiện có. Khi tăng quy mô lớn, nên đánh giá thời gian duyệt tin vì việc khớp nhu cầu hiện được thực hiện đồng bộ trong transaction PostgreSQL.

| API | Chức năng |
| --- | --- |
| `GET /api/saved-searches` | Danh sách nhu cầu của tài khoản |
| `POST /api/saved-searches` | `{ name, filters: { q,category,kind,condition,school,minPrice,maxPrice } }`, giá là chuỗi như bộ lọc Khám phá |
| `PATCH /api/saved-searches/UUID` | `{ enabled: true/false }` |
| `DELETE /api/saved-searches/UUID` | Xóa nhu cầu thuộc tài khoản |
| `PATCH /api/favorites` | `{ productId, enabled: true/false }`, quản lý báo giảm giá của món đã lưu |

## Kiểm thử

```powershell
npm run test:e2e
```

`frontend/e2e/saved-searches.spec.ts` kiểm tra giao diện lưu/quản lý nhu cầu và chuông; lọc trường/giá/danh mục/tình trạng, chuẩn hóa từ khóa, không gửi tin chưa duyệt hay thông báo trùng; giảm giá qua duyệt, bật/tắt/bỏ lưu; quyền sở hữu, origin, giới hạn và bật lại không gửi dồn. Tất cả dùng database và tài khoản giả riêng.
