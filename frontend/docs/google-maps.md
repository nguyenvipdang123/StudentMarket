# Google Maps trong StudentMarket

Đã tích hợp Maps Embed API để xem địa điểm hẹn gặp, cùng Maps URLs để mở Google Maps và chỉ đường. Không cần thêm npm package hoặc thay đổi database. Địa điểm vẫn được lưu trong trường `location` của tin đăng; địa điểm lịch hẹn vẫn nằm trong tin nhắn được người dùng chủ động gửi.

## Những nơi đã tích hợp

- Chi tiết sản phẩm: địa điểm + trường, bản đồ nhúng và nút chỉ đường.
- Đăng tin, bước 3 và sửa tin: nút xem trước bản đồ sau khi nhập địa điểm.
- Chat: xem trước điểm hẹn khi soạn lịch; lịch đã gửi có nút xem địa điểm và chỉ đường.

Nếu chưa cấu hình key, các nút mở Google Maps/chỉ đường vẫn dùng được; website không tải iframe lỗi. Việc chỉ đường diễn ra trên Google Maps. StudentMarket không đọc GPS hay lưu vị trí thiết bị. Kết quả từ tên trường/địa điểm có thể khớp nhiều cơ sở, nên người mua và người bán cần xác nhận địa chỉ cụ thể.

## Bật bản đồ nhúng

1. Mở [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/overview), chọn hoặc tạo project của bạn. Làm bước thiết lập billing mà Google yêu cầu.
2. Bật **Maps Embed API**, sau đó tạo một API key riêng cho bản đồ nhúng.
3. Giới hạn key: **Application restrictions → Websites** và **API restrictions → Maps Embed API**. Thêm các website thực tế đang dùng:

   ```text
   http://localhost:3000/*
   http://127.0.0.1:3000/*
   https://marital-dominoes-balmy.ngrok-free.dev/*
   ```

   Nếu đổi ngrok hoặc deploy, cập nhật domain mới. Khi xem qua IP mạng LAN, thêm đúng origin LAN đó.

4. Điền key vào `frontend/.env.local` trên máy của bạn; không ghi đè các cấu hình database/auth khác:

   ```dotenv
   NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=YOUR_RESTRICTED_MAPS_EMBED_KEY
   ```

5. Dừng `npm run dev` bằng Ctrl+C rồi chạy lại. Với production, chạy lại `npm run build` vì biến `NEXT_PUBLIC_` được nhúng lúc build.

Key này được gửi cho trình duyệt/Google qua URL iframe; cần giới hạn website và API như trên. `.env.local` được bỏ qua khi tạo ZIP. Không cần cung cấp key trong chat này.

Google công bố Maps Embed API không thu phí sử dụng và yêu cầu project/API key được thiết lập; billing của các API khác là riêng biệt. Xem [quickstart](https://developers.google.com/maps/documentation/embed/quickstart) và [usage and billing](https://developers.google.com/maps/documentation/embed/usage-and-billing).

## Cách hoạt động

`lib/google-maps.ts` tạo URL bằng `URLSearchParams`, mã hóa địa chỉ tiếng Việt, dấu `&`, plus code và ký tự đặc biệt. URL luôn trỏ tới `www.google.com`. Không nhận URL từ tin nhắn làm đích chuyển hướng. Bản đồ dùng chế độ `place`, ngôn ngữ `vi`, vùng `VN`, iframe lazy và `referrerPolicy="strict-origin-when-cross-origin"` để key giới hạn website hoạt động mà không gửi đường dẫn trang cho Google.

Trong biểu mẫu, thay đổi địa chỉ sẽ ẩn bản đồ cũ; bấm **Xem bản đồ** để xem địa chỉ mới. Tin nhắn hẹn gặp cũ không có địa điểm hợp lệ vẫn hiển thị bình thường.

## Nếu Google Maps báo lỗi

Kiểm tra Maps Embed API đã bật, đúng key, đúng referrer/domain và thiết lập billing. Nút mở Google Maps/chỉ đường vẫn có sẵn nếu iframe bị chặn bởi mạng hoặc cấu hình Google Cloud. Không thể xác nhận key hợp lệ từ code khi chưa có key thật.

Tài liệu: [Embedding a map](https://developers.google.com/maps/documentation/embed/embedding-map), [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [API key security](https://developers.google.com/maps/api-security-best-practices).
