# Chatbot tìm sản phẩm thật

Mở **Hỏi SangTay**, nhập tên món đồ và điều kiện tìm. Chatbot đọc trực tiếp database PostgreSQL của StudentMarket, dùng chung bộ lọc, quyền hiển thị và thứ tự gói đẩy với trang Khám phá. Mỗi câu trả lời hiển thị tối đa 4 tin thật với ảnh, giá, tình trạng, trường và liên kết `/listing/<UUID>`.

## Câu hỏi mẫu

- `Tìm laptop dưới 5 triệu ở DNTU`
- `Mình muốn mua sách từ 100k đến 300k`
- `Có đồ trao đổi miễn phí không?`
- `Tìm laptop như mới giá thấp đến cao`
- `Tìm đồ phòng trọ`
- `Tìm sách mới nhất`
- `Còn laptop không?`

Hỗ trợ tiếng Việt có/không dấu, `k/nghìn/ngàn`, `tr/triệu`, giá dạng `1,5 triệu` hoặc `1.500.000đ`. Từ `dưới/trên` là giới hạn nghiêm ngặt; `tối đa/ít nhất` gồm cả mức giá đó. `Khoảng/tầm` một mức giá được hiểu là khoảng ±20%; khoảng áp dụng được nêu trong câu trả lời. Các điều kiện không hợp lệ hoặc quá dài sẽ được yêu cầu làm rõ.

Tên món đồ được tách bằng quy tắc từ câu hỏi thông dụng; đây chưa phải bộ hiểu ngôn ngữ tự nhiên cho mọi cách diễn đạt. Với câu dài/ẩn dụ hoặc tên khó nhận diện, nên ghi ngắn gọn `Tìm <tên món đồ> <khoảng giá> <trường>`. Không có lời hứa về chất lượng thực tế của món đồ; giá/trạng thái là thông tin hiện có trên tin đăng.

## Trường và câu hỏi tiếp nối

Nếu không nêu trường, chatbot dùng trường đang chọn trong website. Nêu `DNTU`, `UEH` hoặc tên trường trong câu hỏi sẽ ưu tiên trường đó. Sau khi tìm được:

- `Xem thêm`: lấy trang tiếp theo cùng điều kiện; không lặp lại trang cuối khi đã hết.
- `Rẻ hơn`: tìm tin có giá thấp hơn mức thấp nhất trong kết quả trước, giữ tên món và trường. Khi đã có tin giá 0đ, chatbot nhắc đổi tiêu chí hoặc xem thêm.
- `Ở UEH`: đổi trường, giữ món đồ/khoảng giá.
- `Dưới 1 triệu`: đổi ngân sách, giữ tên món và trường.

Ngữ cảnh lưu phía server theo cookie HttpOnly ngẫu nhiên, hết hạn sau một giờ không hoạt động; không dùng lịch sử do client tự gửi để quyết định dữ liệu. Khởi động lại server làm mất ngữ cảnh tìm, khi đó cần nhập lại tên món. Câu hỏi quay về FAQ/AI kết thúc ngữ cảnh tìm sản phẩm để tránh áp dụng nhầm bộ lọc cũ.

Nút **Xem trong Khám phá** mang theo từ khóa và bộ lọc; trang Khám phá áp dụng các tham số này cả khi chuyển từ chính `/explore` sang một kết quả khác. Bấm thẻ sản phẩm sẽ đóng khung chat và mở chi tiết tin.

## Dữ liệu và dịch vụ

### Hỏi đáp Gemini khi không chạy dịch vụ PDF

Khi `PDF_CHAT_APP_URL` hoặc `PDF_CHAT_GRAPH_URL` không có giá trị, câu hỏi ngoài tìm sản phẩm/FAQ dùng Gemini trực tiếp với `ASSISTANT_GEMINI_API_KEY` (ưu tiên), rồi `GEMINI_API_KEY` hoặc `GOOGLE_API_KEY`. `ASSISTANT_GEMINI_MODEL` mặc định `gemini-3.5-flash-lite`; khóa nằm ở server. Model chatbot, góp ý và kiểm duyệt dùng ba biến riêng, không kế thừa model của nhau. Không cần thay khóa AI duyệt tin để sửa chatbot. Câu “Món nào rẻ nhất” lấy tin từ catalogue theo giá tăng dần, giữ trường và bộ lọc trước đó nếu có; không cần gọi Gemini.

Gemini trả text theo luồng SSE, hiển thị dần trong khung chat. Giới hạn tổng thời gian là 75 giây cho cả kết nối và đọc câu trả lời; gửi heartbeat mỗi 15 giây khi chờ. Chỉ thử lại một lần với lỗi mạng hoặc HTTP 500/502/503/504 trước khi có nội dung; không tự thử lại khi hết quota, người dùng ngắt kết nối hoặc đã nhận một phần câu trả lời. Ngữ cảnh chỉ lưu 6 lượt gần nhất, mỗi lượt tối đa 800 ký tự và chỉ ghi câu trả lời hoàn tất.

Đóng trang/ngắt kết nối sẽ hủy upstream và giải phóng khóa phiên. Nếu lỗi giữa chừng, khung chat giữ phần đã nhận, hiển thị lý do và cho phép gửi lại. Chức năng tìm sản phẩm/FAQ vẫn chạy độc lập với Gemini. Theo dõi lỗi thực tế từ nhà cung cấp trước khi thay model hoặc tăng thời gian chờ thêm.

- Chỉ tìm tin `Active` + `APPROVED`. Không trả tin đã bán, bị ẩn, đang chờ duyệt hoặc bị từ chối.
- Mỗi lượt hỏi đọc lại dữ liệu; thay đổi giá/ẩn tin được phản ánh ở lần hỏi tiếp theo. Thẻ đã hiển thị có thể cũ, nên mở chi tiết trước khi giao dịch.
- Không thấy kết quả thì báo chưa tìm thấy; không sinh ra tên, giá hoặc UUID giả. Chỉ thử lại một số cách gọi tương đương như laptop/máy tính xách tay; giữ nguyên giới hạn giá và trường.
- Trình duyệt chỉ nhận các trường công khai cần cho thẻ. Không gửi email, mật khẩu, khóa, ảnh thẻ sinh viên hoặc dữ liệu thanh toán vào câu trả lời hay Gemini.
- Luồng tìm sản phẩm thông dụng truy vấn PostgreSQL ngay trong StudentMarket, không cần thêm API key và vẫn hoạt động khi chatbot PDF/Gemini ngừng chạy. FAQ, tài liệu PDF và câu hỏi AI khác tiếp tục đi qua dịch vụ chatbot hiện có, cần cấu hình/dịch vụ tương ứng hoạt động.
- Giữ giới hạn 30 câu hỏi/IP/giờ, kiểm tra origin, độ dài câu hỏi và khóa tránh gửi đồng thời. Cơ chế hạn mức/ngữ cảnh hiện nằm trong bộ nhớ một tiến trình; nếu triển khai nhiều instance cần kho dùng chung như Redis và cấu hình proxy tin cậy.

## Cài đặt và kiểm thử

Không có dependency hoặc khóa mới. Cần database đã áp dụng [migration tìm kiếm](catalog-search.md):

```powershell
npm --prefix frontend run db:migrate:search
npm --prefix frontend run test:assistant
npm run build
npm test
```

Kiểm thử tích hợp dùng database riêng và upstream giả lập, gồm truy xuất tin thật, điều kiện giá/trường, phân trang, ngữ cảnh riêng từng cookie, thay đổi trạng thái tin, DTO công khai, đường dẫn Khám phá, origin và tương thích luồng FAQ/AI cũ.
