# Góp ý AI trước khi đăng tin

Trong **Đăng tin**, sinh viên đã xác minh có thể chọn **Nhờ AI góp ý** sau khi điền nội dung và chọn ảnh. AI góp ý về độ rõ của tiêu đề, thông tin còn thiếu và ảnh khó nhìn (thiếu sáng, mờ hoặc bị che). Đây là bước tùy chọn; lỗi AI không ngăn gửi tin.

Mỗi góp ý có **Sửa mục này** để quay về bước tương ứng. **Dùng tiêu đề này** chỉ đổi tiêu đề khi người bán chủ động bấm. Khi sửa nội dung hoặc đổi thứ tự ảnh, kết quả cũ được đánh dấu và cần góp ý lại trước khi áp dụng. AI không tự đăng, tự duyệt tin hoặc sửa ảnh. Tin gửi đi vẫn qua quy trình kiểm duyệt hiện có.

## Cấu hình

API chạy trong `studentmarket-web`, không cần worker hoặc migration mới. Trên Render, dùng **Environment** của dịch vụ web rồi triển khai lại:

- `LISTING_ADVICE_GEMINI_API_KEY`: tùy chọn; nếu trống dùng `GEMINI_API_KEY`, sau đó `GOOGLE_API_KEY`.
- `LISTING_ADVICE_GEMINI_MODEL`: tùy chọn; nếu trống dùng `GEMINI_MODERATION_MODEL`, sau đó `gemini-3.1-flash-lite`.

Các khóa chỉ nằm trên server. Không dùng tiền tố `NEXT_PUBLIC_`. Nếu dịch vụ web đã có `GEMINI_API_KEY` để kiểm duyệt, tính năng dùng lại khóa đó; có thể cấu hình khóa riêng để quản lý hạn mức. Một lần bấm tạo một yêu cầu Gemini, có thể phát sinh chi phí theo tài khoản Google.

## Dữ liệu và giới hạn

Chỉ khi bấm góp ý, bản nháp và tối đa 8 ảnh xem trước được gửi tới Gemini. Trình duyệt thu nhỏ ảnh tối đa 1024 px, chuyển JPEG để bỏ metadata và tên tệp gốc; ảnh đăng tin gốc không bị thay đổi. Mỗi ảnh góp ý tối đa 1 MB, toàn bộ yêu cầu tối đa 8,2 MB. Người bán nên tránh chọn ảnh chứa thông tin riêng tư.

Server che số điện thoại/email trong văn bản, chỉ gửi việc có/không có khu vực hẹn gặp thay vì địa chỉ cụ thể. Không gửi thông tin tài khoản và không lưu ảnh góp ý hoặc kết quả vào database. Nội dung chữ xuất hiện trong ảnh vẫn có thể được Gemini nhìn thấy.

Giới hạn mỗi tài khoản là 3 lần/phút, 10 lần/giờ; mỗi tiến trình web xử lý tối đa 3 yêu cầu cùng lúc. Hạn mức tài khoản lưu trong bảng `login_attempts` với tiền tố riêng `listing-advice:`. Yêu cầu bị lỗi hoặc hủy sau khi tới server cũng có thể tính vào hạn mức. Mỗi lần gọi nhà cung cấp có thời hạn 25 giây và không tự thử lại. **Dừng góp ý** hủy việc chờ ở trình duyệt; yêu cầu đã gửi nhà cung cấp có thể vẫn được tính phí.

## Kiểm thử

Chạy từ thư mục `frontend`:

```sh
node --experimental-strip-types --test scripts/listing-advice.test.mjs
node scripts/test-e2e.mjs test listing-advice.spec.ts
```

E2E dùng database tạm riêng và Gemini giả lập, kiểm tra trên desktop/mobile: sửa tin, ảnh thu nhỏ, kết quả cũ, áp dụng tiêu đề, hủy, lỗi dịch vụ, quyền truy cập, origin, giới hạn lượt gọi và luồng gửi duyệt. Kết quả giả lập không chứng minh độ chính xác đánh giá ảnh của mô hình thật.
