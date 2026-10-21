# Giữ chỗ và đặt lịch giao dịch

## Người mua

1. Đăng nhập bằng tài khoản sinh viên đã xác minh; mở trang chi tiết sản phẩm.
2. Trong **Giữ chỗ & đặt lịch gặp**, bấm **Yêu cầu giữ chỗ & đặt lịch**.
3. Chọn thời gian theo **giờ Việt Nam**, địa điểm công cộng và ghi chú; gửi yêu cầu.
4. Đợi người bán xác nhận. Gửi yêu cầu chưa đồng nghĩa với giữ được món đồ.
5. Theo dõi tại **Giao dịch của tôi** (`/transactions`) hoặc trong cuộc trò chuyện. Dùng **Nhắn đối tác** và **Chỉ đường** để chuẩn bị gặp.
6. Sau khi người bán ghi nhận giao đồ, vào phần **Xác nhận nhận hàng & đánh giá**, bấm **Tôi đã nhận hàng** khi đã nhận và kiểm tra món đồ, rồi bấm **Xác nhận đã nhận hàng**.
7. Khi cả hai đã xác nhận, giao dịch chuyển sang **Hoàn tất**. Mỗi bên có thể đánh giá đối tác một lần; sau khi gửi, biểu mẫu được thay bằng liên kết xem đánh giá đã lưu.

## Người bán

Vào **Giao dịch của tôi → Tôi bán** hoặc mở trang sản phẩm/cuộc trò chuyện để xem yêu cầu. Chọn **Xác nhận & giữ chỗ** hoặc **Từ chối**. Khi xác nhận một người, các yêu cầu còn chờ cho cùng món đồ được từ chối và gửi thông báo.

Từ giờ hẹn đã thống nhất, khi đã giao đồ, bấm **Đã giao cho người mua**, đọc thông tin và **Đồng ý xác nhận**. Hệ thống đánh dấu tin đã bán, tạo giao dịch chờ người mua xác nhận và liên kết đúng lịch hẹn bằng `transactions.reservation_id`. Hai mốc xác nhận cùng thời gian được hiển thị trên thẻ giao dịch; chỉ khi người mua xác nhận nhận hàng thì giao dịch mới hoàn tất. Không có bước thu tiền đặt cọc hay thanh toán SePay cho việc giữ chỗ.

## Xác nhận hoàn tất và đánh giá đáng tin cậy

- Người bán ghi nhận giao đồ trước; người mua xác nhận đã nhận hàng sau. Không tự xác nhận thay đối tác hoặc tự hoàn tất khi hết thời gian.
- Server dùng giờ PostgreSQL để chặn xác nhận giao đồ trước giờ hẹn. Giữ chỗ vẫn hết hạn 2 giờ sau lịch hẹn nếu người bán chưa ghi nhận giao đồ. Sau khi đã giao, người mua có thể quay lại xác nhận trong **Giao dịch của tôi**.
- Người mua có thể chọn **Tôi không mua món này**, đọc cảnh báo rồi xác nhận: giao dịch bị hủy, tin mở lại và đánh giá không được mở. Việc này không chuyển tiền hay hoàn tiền.
- Khi giao dịch theo lịch hẹn được hoàn tất hoặc người mua không xác nhận, chuông thông báo cập nhật cho cả hai bên.
- API đánh giá nhận `transactionId`, suy ra món đồ và đối tác từ dữ liệu server. Chỉ hai bên của giao dịch có cả hai thời điểm xác nhận và trạng thái `COMPLETED` mới được đánh giá. Mỗi người chỉ có một đánh giá cho mỗi giao dịch, kể cả khi gửi đồng thời.
- Hồ sơ người bán, **Đánh giá từ tôi** và trang đánh giá hiển thị nhãn **Giao dịch đã được hai bên xác nhận** cho đánh giá đáp ứng các điều kiện trên. Đánh giá cũ không liên kết giao dịch được giữ lại nhưng không mang nhãn này.
- Gửi xác nhận nhận hàng lặp lại không tạo thêm sự kiện hay giao dịch. Sau khi hoàn tất/hủy, không thể chuyển sang quyết định ngược lại.
- Trang giao dịch đồng bộ mỗi 20 giây, khi quay lại cửa sổ hoặc bấm **Làm mới giao dịch**.

## Thời hạn và quyền riêng tư

- Thời gian gặp phải cách hiện tại ít nhất **15 phút**, trong vòng **7 ngày**.
- Yêu cầu chưa được xác nhận hết hạn sau **24 giờ** hoặc đến giờ gặp, tùy thời điểm nào sớm hơn.
- Khi được xác nhận, giữ chỗ đến **2 giờ sau lịch gặp**. Mỗi sản phẩm chỉ có một lượt giữ chỗ đã xác nhận.
- Hai bên đều có thể hủy yêu cầu/lịch còn hiệu lực. Muốn đổi lịch hoặc địa điểm, hủy lịch cũ rồi gửi yêu cầu mới để cả hai xác nhận lại.
- Thời hạn được kiểm tra bằng giờ PostgreSQL khi đọc và xử lý yêu cầu. Hết hạn tự mất hiệu lực ngay cả khi không mở trang; không cần worker mới. Bản ghi được chuẩn hóa sang `EXPIRED` khi có thao tác tiếp theo trên tin.
- Sửa tin khiến tin phải duyệt lại, ẩn/gỡ tin hoặc đổi người bán sẽ vô hiệu các lịch chưa kết thúc bằng trigger database. Duyệt lại tin không khôi phục lịch cũ.
- Người bán không được ghi nhận bán cho người khác hoặc bán ngoài hệ thống khi đang giữ chỗ; cần hủy lịch trước.
- Công khai trên thẻ sản phẩm chỉ có trạng thái **Đang giữ chỗ** và thời hạn. Tên người mua, thời gian gặp, địa điểm và ghi chú chỉ trả cho hai bên qua API xác thực.
- Chuông thông báo nhận yêu cầu mới, kết quả xác nhận/từ chối, hủy lịch và ghi nhận giao đồ. Chưa gửi email nhắc lịch, push hoặc nhắc trước giờ gặp.
- Giao diện đồng bộ mỗi **20 giây**, khi quay lại cửa sổ hoặc bấm **Làm mới lịch**. Danh sách hiển thị tối đa 100 lịch, ưu tiên lịch đang hoạt động; trên từng sản phẩm/cuộc trò chuyện hiển thị 5 lịch đầu và liên kết xem tất cả.

## Cài đặt và API

Máy hiện tại đã chạy migration. Với bản mã nguồn chuyển sang máy khác:

```powershell
npm run db:migrate
```

Migration `scripts/reservations-schema.sql` tạo `listing_reservations`, `reservation_events`, index và trigger, đồng thời thêm khóa liên kết `transactions.reservation_id`; có thể chạy lại qua lệnh trên. Chạy migration trước khi khởi động bản mã mới; trên Render bước `preDeployCommand: npm run db:migrate` đã thực hiện việc này. Giao dịch cũ được giữ nguyên. PostgreSQL dùng khóa hàng sản phẩm trước khóa giao dịch để ngăn giữ chỗ trùng và xung đột khi có yêu cầu đồng thời.

| API | Chức năng |
| --- | --- |
| `GET /api/reservations` | Lịch của tài khoản đang đăng nhập |
| `GET /api/reservations?listingId=UUID` | Lịch của chính mình với sản phẩm đó và thời hạn giữ chỗ công khai |
| `POST /api/reservations` | `{ listingId, meetingAt, location, note }`; `meetingAt` ISO có múi giờ |
| `PATCH /api/reservations/UUID` | `{ action: "accept" / "reject" / "cancel" / "complete" }` |
| `POST /api/transactions/UUID/confirm` | Người mua gửi `{ confirm: true }` khi nhận hàng, hoặc `{ confirm: false }` khi không mua |
| `POST /api/reviews` | `{ transactionId: UUID, rating: 1..5, content: "..." }`; kiểm tra quyền và điều kiện hai bên hoàn tất |

Chỉ sinh viên đã xác minh được dùng API; ID người mua/người bán được lấy từ phiên và sản phẩm, không nhận từ trình duyệt. API ghi kiểm tra cùng origin như các API nghiệp vụ hiện có.

## Kiểm thử

```powershell
npm run test:e2e
```

Nhóm `e2e/reservations.spec.ts` chạy trên dữ liệu cô lập: toàn bộ luồng đặt lịch đến nhận hàng, hai yêu cầu xác nhận đồng thời, quyền hai bên và Admin, chặn origin lạ, từ chối/hủy/đặt lại, hạn giờ, tự hết hạn và không khôi phục lịch khi mở lại tin. Kiểm tra cả desktop và điện thoại mô phỏng.
