# Phân trang và tìm kiếm sản phẩm trên server

Từ khóa, danh mục, hình thức, tình trạng, trường, khoảng giá, cách sắp xếp và số trang được giữ trong query string của URL. F5, mở liên kết ở tab khác hoặc quay lại từ chi tiết tin sẽ khôi phục cùng điều kiện. Chuyển trang có lịch sử Back/Forward; đổi bộ lọc đưa về trang 1. Tham số `school=` rỗng có nghĩa là tất cả trường, kể cả khi máy nhận liên kết đang lưu một trường khác. URL không chứa email hoặc thông tin tài khoản.

Trang chủ và `/explore` lấy 12 sản phẩm mỗi trang từ PostgreSQL. Nút Trước/Sau, số trang và tổng số kết quả dùng metadata do API trả về. Khi đổi từ khóa/bộ lọc/sắp xếp, trang trở về 1. Nhập từ khóa rồi bấm Tìm kiếm hoặc Enter. Giá trị lọc được gửi sau 250 ms; các yêu cầu cũ được hủy để tránh hiển thị kết quả không còn phù hợp.

Tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt, gồm `đ/d`; hỗ trợ nhiều từ theo thứ tự bất kỳ trong tiêu đề, mô tả, địa điểm, danh mục, tên người bán và trường. Trường nhận tên đầy đủ, tên viết tắt và các bí danh trong danh sách trường hiện có. Giá trị `%`, `_`, dấu gạch chéo ngược trong từ khóa được tìm như ký tự thường.

Các mục Gần trường, Đồ học tập, Góc phòng trọ, Dưới 200.000đ, Trao đổi và Mới đăng có truy vấn riêng, mỗi lần lấy 4–6 sản phẩm từ toàn bộ dữ liệu phù hợp trường đang chọn. Mục sản phẩm liên quan lấy tối đa 3 sản phẩm cùng danh mục, loại tin đang xem. Các mục này không lọc lại từ 12 sản phẩm của trang chính. Hiệu ứng xuất hiện khi cuộn và thao tác lưu tin vẫn được giữ.

## Cập nhật database

Đã áp dụng trên database máy hiện tại. Với database mới hoặc máy khác, tại thư mục gốc:

```powershell
npm --prefix frontend run db:migrate:search
```

Lệnh tạo hàm chuẩn hóa, index theo ngày/giá/danh mục/trường và index GIN với extension PostgreSQL `pg_trgm`. Tài khoản migration cần quyền tạo extension trên database. `npm run db:migrate` cũng bao gồm migration tìm kiếm. Migration chạy được nhiều lần. Với database lớn, nên chạy migration lúc ít người dùng vì tạo index thông thường có thể chờ/chặn ghi trong thời gian xây dựng.

Index trigram hỗ trợ tìm chuỗi con; hiệu quả phụ thuộc độ dài từ khóa và số kết quả, từ quá ngắn vẫn có thể cần quét nhiều dòng. Phản hồi API luôn bị giới hạn số sản phẩm; số đếm và trang dữ liệu dùng chung snapshot trong một request. Khi dữ liệu được thêm/sửa giữa hai lần chuyển trang, vị trí sản phẩm có thể thay đổi.

## API

`GET /api/products` và alias `GET /api/listings` trả dữ liệu **đã phân trang**, kể cả khi không truyền tham số. Chỉ trả sản phẩm Active đã APPROVED.

| Tham số | Ý nghĩa |
| --- | --- |
| `q` | Từ khóa, tối đa 200 ký tự / 20 từ |
| `page` | Trang 1–100000, mặc định 1 |
| `pageSize` | 1–48 sản phẩm, mặc định 12 |
| `category` | Tất cả, Học tập, Công nghệ, Nội thất, Thời trang, Khác |
| `sort` | featured, newest, price-asc, price-desc |
| `kind` | all, sell, exchange (giá 0) |
| `condition` | Mới 100%, Như mới, Tốt, Đã qua sử dụng |
| `school` | Trường hoặc mã trường |
| `minPrice`, `maxPrice` | Giá không âm, tối đa 9.999.999.999đ |
| `section` | near, study, dorm, budget, exchange, new |
| `exclude` | UUID sản phẩm loại khỏi kết quả |

Ví dụ: `/api/products?q=sach&school=DNTU&page=2&pageSize=12&sort=newest`.

```json
{
  "products": [],
  "pagination": {
    "page": 1,
    "pageSize": 12,
    "total": 0,
    "totalPages": 0,
    "hasPrevious": false,
    "hasNext": false
  }
}
```

Nếu trang yêu cầu vượt quá trang cuối, API trả trang cuối hiện có. Nếu không có kết quả, `page=1`, `totalPages=0`. Tham số sai trả HTTP 400. Không có chế độ tải tất cả. SQL dùng tham số cho từ khóa/bộ lọc; cột sắp xếp chọn từ danh sách cố định. Thứ tự đồng hạng dùng ngày và UUID; nếu một sản phẩm có nhiều gói đẩy đang hoạt động, chỉ chọn gói ưu tiên cao nhất để sản phẩm không xuất hiện trùng.

## Kiểm thử

```powershell
npm --prefix frontend run test:search
node --experimental-strip-types --test frontend/scripts/explore-url-state.test.mjs
npm run build
npm test
```

Kiểm thử tích hợp dùng database riêng, tạo 35 sản phẩm mẫu (gồm cả tin không công khai), kiểm tra phân trang, tìm không dấu, trường/bí danh, lọc giá, các mục trang chủ, gói đẩy trùng và dữ liệu đầu vào sai. Không thêm sản phẩm thử vào database thật.

Tham khảo: [PostgreSQL pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html).
