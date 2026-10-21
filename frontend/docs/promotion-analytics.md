# Hiệu quả đẩy tin cho người bán

## Sử dụng

Vào **Tin đăng của tôi → Xem hiệu quả** bên dưới tin đã mua gói đẩy. Chọn gói trong **Gói đã mua** để xem lại từng lượt đẩy, kể cả gói đã hết hạn, tin đã ẩn hoặc đã bán. Danh sách mỗi tin hiển thị tối đa 100 gói đã thanh toán và kích hoạt gần nhất.

Hộp thống kê hiển thị tên/trạng thái gói, bắt đầu, hết hạn theo **giờ Việt Nam**, hai khoảng đo và bảng so sánh lượt xem, người lưu, người nhắn tin. Khi gói đang chạy, số liệu tự làm mới mỗi 30 giây lúc tab đang hiển thị; cũng có nút **Làm mới thống kê**. Lỗi tải có nút thử lại, không thay số liệu bị lỗi bằng số 0.

## Hai khoảng so sánh

- **Trong đẩy:** từ `start_at` đến thời điểm sớm hơn giữa giờ PostgreSQL hiện tại và `end_at`. Gói đã hủy dừng tại `updated_at` khi hủy. Gói chưa thanh toán hoặc chưa có khoảng kích hoạt hợp lệ không được đưa vào thống kê.
- **Trước đẩy:** khoảng liền trước `start_at` có đúng cùng độ dài với khoảng trong đẩy đã đo. Ví dụ gói 24 giờ mới chạy được 2 giờ thì so sánh 2 giờ trước lúc kích hoạt với 2 giờ đang chạy; khi hết hạn thì so sánh 24 giờ trước với 24 giờ chạy gói.
- Cả hai dùng khoảng **bao gồm đầu, không bao gồm cuối**. Sự kiện đúng lúc bắt đầu chỉ nằm trong đẩy; đúng lúc hết hạn không còn nằm trong đẩy. SQL tính bằng timestamp PostgreSQL, không dùng đồng hồ trình duyệt hoặc tổng lượt xem cả đời tin.
- Cột thay đổi hiển thị chênh lệch và tỷ lệ phần trăm khi có nền trước đẩy lớn hơn 0. Nền bằng 0 không hiển thị phần trăm vô hạn. Tin chưa có đủ lịch sử, khoảng trước đẩy có gói khác, hoặc lịch sử lưu chưa đầy đủ sẽ có ghi chú và không tính tỷ lệ gây hiểu nhầm.
- Chênh lệch là số ghi nhận, không chứng minh mọi tương tác trong khoảng đó đều do gói đẩy tạo ra.

## Định nghĩa dữ liệu

| Chỉ số | Nguồn và cách đếm |
| --- | --- |
| Lượt xem | `listing_analytics.VIEW` trong khoảng đo; không cộng `products.view_count` cả đời. Bỏ sự kiện của chủ tin; endpoint ghi sự kiện gộp lượt xem lặp cùng visitor trong 30 giây. |
| Người lưu tin | `COUNT(DISTINCT user_id)` của sự kiện `FAVORITE` trong mỗi khoảng, bỏ chủ tin. Trigger PostgreSQL ghi khi thêm vào favorites; bỏ lưu không xóa sự kiện, lưu lại trong cùng khoảng không tăng số người. |
| Người nhắn tin | Người mua khác nhau thực sự có `messages.sent_at` trong khoảng, qua cuộc trò chuyện về đúng sản phẩm và người bán. Không tính hội thoại rỗng, người bán trả lời, hay nhiều tin nhắn của cùng người trong cùng khoảng. Cả REST và WebSocket đều ghi vào bảng messages nên cùng được tính. |

Migration khôi phục các lượt lưu còn tồn tại bằng chính `favorites.created_at`. Không thể khôi phục lượt lưu đã bị bỏ trước khi bật ghi lịch sử; `analytics_tracking.FAVORITE.started_at` ghi mốc bắt đầu đầy đủ và không bị đặt lại khi chạy migration lần nữa. Khoảng đo chạm vào lịch sử trước mốc này được đánh dấu `favoritesPartial`. Lượt xem cũ chỉ có tổng mà không có sự kiện/timestamp cũng không được chia ngược vào từng gói.

## Triển khai và API

```powershell
npm run db:migrate
```

`scripts/promotion-analytics-schema.sql` được chạy sau schema hiện có: thêm bảng mốc theo dõi, index theo sản phẩm/loại sự kiện/thời gian, trigger lưu tin và khôi phục có kiểm tra trùng. Không sửa giao dịch thanh toán, không cần worker mới. Render đã cấu hình `preDeployCommand: npm run db:migrate`.

- `GET /api/my-promotions?listingId=UUID`: lịch sử gói đã kích hoạt của chính người đang đăng nhập, tối đa 100 gói. Không đổi trạng thái gói trong yêu cầu đọc này.
- `GET /api/my-promotions/UUID/analytics`: `before`, `during`, `change`, `coverage`, `startAt`, `endAt`, `asOf`, `durationSeconds`. Chỉ chủ gói hoặc Admin; người ngoài nhận 404, khách chưa đăng nhập nhận 401. Phản hồi `private, no-store`.
- `GET /api/my-listings`: có `hasPromotions` để mở thống kê gói cũ khi không còn gói đang chạy.

## Kiểm thử

```powershell
npm --prefix frontend run test:e2e -- promotion-analytics.spec.ts
```

Database E2E riêng kiểm tra ranh giới bắt đầu/kết thúc, hai khoảng bằng nhau, gói đang chạy/hết hạn/hủy, không dùng tổng cả đời, xem lặp, bỏ lưu và lưu lại, tin nhắn thực, quyền chủ gói, gói chưa trả tiền, lịch sử thiếu, chạy lại migration, chuyển gói cũ và lỗi tải/thử lại trên desktop và điện thoại.
