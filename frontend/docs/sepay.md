# Thanh toán gói đẩy tin bằng SePay

Tích hợp này thu tiền **gói đẩy tin của SangTay**. Giao dịch mua bán món đồ giữa sinh viên vẫn được thỏa thuận trực tiếp. Website tạo đơn, hiển thị VietQR và chỉ kích hoạt gói khi webhook SePay đã được xác thực và khớp đơn.

## 1. Cấu hình trên máy chủ

Điền các dòng ở cuối `frontend/.env.local` (không gửi khóa bí mật qua chat):

```env
SEPAY_ENABLED=false
SEPAY_BANK_CODE=
SEPAY_ACCOUNT_NUMBER=
SEPAY_ACCOUNT_NAME=
SEPAY_WEBHOOK_AUTH=hmac
SEPAY_WEBHOOK_SECRET=
SEPAY_ORDER_PREFIX=ST
SEPAY_QR_ACCOUNT=
SEPAY_SUB_ACCOUNT=
SEPAY_DESCRIPTION_PREFIX=
```

| Biến | Giá trị cần điền |
| --- | --- |
| `SEPAY_BANK_CODE` | Mã/ngắn tên ngân hàng theo SePay, ví dụ `MBBank`, `Vietcombank`, `ACB`, `TPBank` |
| `SEPAY_ACCOUNT_NUMBER` | Số tài khoản gốc đúng như trường `accountNumber` trong giao dịch SePay; giữ cả số 0 đầu nếu có |
| `SEPAY_ACCOUNT_NAME` | Tên chủ tài khoản thụ hưởng, dùng để người chuyển kiểm tra |
| `SEPAY_WEBHOOK_SECRET` | Secret ít nhất 32 ký tự; nhập cùng một giá trị trong cấu hình webhook SePay |
| `SEPAY_WEBHOOK_AUTH` | Giữ `hmac` và chọn HMAC-SHA256 trong SePay. Chỉ dùng `apikey` nếu webhook đã được cấu hình API Key tương ứng |
| `SEPAY_ORDER_PREFIX` | Tiền tố chữ in hoa, mặc định `ST`; mã đơn gồm tiền tố và 16 ký tự hex |
| `SEPAY_QR_ACCOUNT` | Tùy chọn: tài khoản/VA thực sự để người mua chuyển vào. Bỏ trống nếu dùng tài khoản gốc |
| `SEPAY_SUB_ACCOUNT` | Tùy chọn: VA bắt buộc khớp trường `subAccount` từ SePay khi sử dụng VA |
| `SEPAY_DESCRIPTION_PREFIX` | Tùy chọn: chuỗi bắt buộc ở đầu nội dung chuyển khoản do ngân hàng/VA yêu cầu |

Nếu chưa có secret, tạo tại terminal rồi **chỉ lưu vào file cấu hình và SePay**:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Project trên máy có thể đã được tạo sẵn secret khi tích hợp; dùng lại giá trị đó nếu chưa cấu hình webhook. Không thay secret hoặc thông tin nhận tiền khi đang có đơn chờ nếu chưa kiểm tra ảnh hưởng tới các giao dịch đang xử lý.

### Ngân hàng dùng tài khoản ảo

Không mặc định số tài khoản gốc cũng là số cần đưa vào QR. Với ngân hàng yêu cầu VA, điền `SEPAY_QR_ACCOUNT` theo số VA hiển thị trong SePay, còn `SEPAY_ACCOUNT_NUMBER` theo trường tài khoản gốc mà webhook trả về. Nếu cấu hình bộ lọc VA, điền thêm `SEPAY_SUB_ACCOUNT` đúng giá trị.

Một số ngân hàng yêu cầu nội dung đặc biệt, chẳng hạn VietinBank cá nhân/hộ kinh doanh yêu cầu `SEVQR`; khi đó đặt `SEPAY_DESCRIPTION_PREFIX=SEVQR`. Trường hợp VA theo nội dung của TPBank có thể cần tiền tố TKP do SePay cung cấp. Xác nhận đúng mô hình tài khoản của bạn tại [hướng dẫn VietQR SePay](https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code) trước khi mở thu tiền.

### Điền cho BIDV

Theo hướng dẫn SePay, BIDV cá nhân và hộ kinh doanh bắt buộc sử dụng VA; doanh nghiệp có thể chọn dùng VA. Mở tài khoản BIDV đã liên kết trong SePay, xem phần tài khoản ảo (VA) và lấy đúng thông tin được cấp. Nếu chưa có VA, hoàn tất bước tạo/liên kết VA theo hướng dẫn trong SePay trước khi bật thanh toán.

Điền từng dòng vào `.env.local` rồi Ctrl+S:

```env
SEPAY_BANK_CODE=BIDV
SEPAY_ACCOUNT_NUMBER=SO_TAI_KHOAN_GOC_BIDV
SEPAY_ACCOUNT_NAME=TEN_CHU_TAI_KHOAN
SEPAY_QR_ACCOUNT=SO_VA_DUOC_SEPAY_CAP
SEPAY_SUB_ACCOUNT=
SEPAY_DESCRIPTION_PREFIX=
SEPAY_ENABLED=false
```

Thay các chữ mẫu bằng thông tin thật trên máy. `SEPAY_ACCOUNT_NUMBER` là tài khoản gốc khớp `accountNumber` của webhook; `SEPAY_QR_ACCOUNT` là số VA chính thức dùng để chuyển tiền khi quét QR. Chỉ điền `SEPAY_SUB_ACCOUNT` nếu đã xác định đúng giá trị `subAccount` SePay gửi; không mặc định trường này luôn giống số VA. Nếu SePay cung cấp VA theo nội dung thay vì VA chính thức, làm theo quy tắc `acc`/`des` của SePay và điền tiền tố bắt buộc vào `SEPAY_DESCRIPTION_PREFIX`.

Giữ nguyên `SEPAY_WEBHOOK_SECRET` đã tạo. Giữ `SEPAY_ENABLED=false` tới khi đã cấu hình đúng tài khoản và webhook ở bước 2.

## 2. Tạo webhook trong SePay

1. Đăng nhập SePay → **Webhooks → Thêm webhook**.
2. Đặt tên `StudentMarket - goi day tin`, chọn sự kiện **Có tiền vào** và tài khoản ngân hàng đã liên kết.
3. URL nhận webhook: `https://TEN-MIEN-CUA-BAN/api/payments/sepay/webhook`.
4. Chọn body **JSON / application/json**.
5. Chọn xác thực **HMAC-SHA256** và nhập đúng `SEPAY_WEBHOOK_SECRET` trong file môi trường. Không đưa secret vào URL.
6. Nếu lọc theo tiền tố mã thanh toán, dùng `ST` (hoặc `SEPAY_ORDER_PREFIX` đã chọn). Không bật điều kiện buộc phải có mã nếu muốn Admin nhận được cả các khoản chuyển thiếu/sai mã để đối soát.
7. Ở phần cấu trúc mã thanh toán của SePay, cấu hình nhận tiền tố `ST` và 16 ký tự chữ/số sau nó nếu sử dụng tính năng trích mã. Backend cũng có thể đọc mã trực tiếp từ nội dung chuyển khoản.
8. Bật cảnh báo webhook lỗi trong SePay và lưu cấu hình.

Chữ ký được xác minh theo `HMAC-SHA256(secret, timestamp + '.' + raw_body)` với hai header `X-SePay-Signature`, `X-SePay-Timestamp`. Chấp nhận lệch thời gian tối đa 5 phút. Nguồn: [xác thực SePay](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc).

### Localhost và ngrok

SePay cần gọi vào URL công khai; không dùng `http://localhost:3000` làm webhook. Chạy project, mở ngrok:

```powershell
npm run dev
# Terminal khác:
ngrok http 3000
```

Nếu tunnel hiện tại vẫn là `marital-dominoes-balmy.ngrok-free.dev`, URL webhook là:

```text
https://marital-dominoes-balmy.ngrok-free.dev/api/payments/sepay/webhook
```

Đổi domain ngrok thì cập nhật URL trong SePay. Website và ngrok phải còn chạy để nhận webhook. Nếu mở giao diện website qua ngrok, làm theo phần cấu hình ngrok/OAuth trong hướng dẫn giải nén.

## 3. Migration và bật thanh toán

```powershell
npm run db:migrate
```

Sau khi thông tin ngân hàng và webhook đúng, đổi `SEPAY_ENABLED=true`, Ctrl+S, rồi khởi động lại frontend. Vào **Admin → Doanh thu & đẩy tin → Thanh toán SePay** để xem trạng thái cấu hình.

Admin cần tạo/kích hoạt ít nhất một gói dịch vụ có giá là số nguyên VNĐ lớn hơn 0 và thời hạn 1–8760 giờ. Tích hợp không tự đặt giá hoặc tạo gói thu tiền thật.

Tại **Admin → Gói dịch vụ**, mỗi dòng có **Sửa**, **Ẩn/Kích hoạt** và **Xóa**. Sửa cho phép thay tên, mô tả, thời hạn, giá và độ ưu tiên; thay đổi áp dụng cho đơn mới, các đơn đã tạo giữ thông tin đã mua. Xóa có bước xác nhận, gỡ gói khỏi danh sách quản lý và danh sách mua mới; các đơn đã tạo, gói đang chạy, doanh thu và lịch sử thanh toán vẫn được giữ. Xóa gói không hủy hoặc hoàn tiền các đơn trước đó. Mọi thao tác sửa/xóa chỉ dành cho Admin và được ghi nhật ký.

## 4. Người dùng thanh toán

1. Đăng nhập tài khoản sinh viên đã xác minh.
2. Vào **Tin của tôi**, chọn tin đang bán đã được duyệt → **Đẩy tin**.
3. Chọn gói → **Thanh toán bằng SePay**.
4. Kiểm tra ngân hàng, người nhận, số tiền và nội dung; dùng ứng dụng ngân hàng quét QR và xác nhận chuyển khoản.
5. Trang tự kiểm tra trạng thái mỗi 4 giây. Khi webhook hợp lệ tới, đơn chuyển `PAID`, gói được kích hoạt và doanh thu được ghi nhận.

Đơn chờ có thời hạn 20 phút, được giữ sau F5. Bấm tạo lại trên cùng tin khi còn đơn chờ sẽ mở lại đơn đó. Giá, thời hạn, ưu tiên và thông tin nhận tiền được chụp tại lúc tạo đơn; Admin sửa gói sau đó không thay đổi điều kiện của đơn đã tạo.

Nếu đã chuyển tiền, không chuyển lần hai chỉ vì trang chưa cập nhật. Giữ biên lai, bấm **Kiểm tra thanh toán** hoặc liên hệ Admin kèm mã đơn.

### Hủy đơn chưa thanh toán

Chọn **Hủy thanh toán** cạnh nút kiểm tra trạng thái, sau đó xác nhận **Tôi chưa chuyển tiền, hủy đơn**. Chỉ chủ tin được hủy đơn chưa thanh toán và chưa ghi nhận giao dịch cần đối soát. Đơn chuyển `CANCELLED`, QR ngừng hiển thị, trạng thái vẫn giữ sau F5 và có thể chọn gói để tạo đơn mới. Lịch sử đơn và thao tác hủy được lưu lại.

Nếu đã chuyển tiền, giữ đơn để chờ ngân hàng xác nhận hoặc liên hệ Admin. Hủy đơn trên website không hoàn tác giao dịch ngân hàng. Nếu webhook tới sau khi hủy, khoản tiền được ghi nhận để Admin đối soát; không tự kích hoạt gói. Sau khi kiểm tra tiền thực nhận, Admin có thể duyệt gói bằng thao tác đối soát ở mục 5.

## 5. Đối soát và trường hợp ngoại lệ

- Chỉ nhận tiền vào đúng ngân hàng/tài khoản/VA và đúng **một** mã đơn, đúng số tiền mới tự kích hoạt.
- Thiếu/thừa tiền, thiếu/sai mã, chuyển sau hạn, tài khoản bị khóa, tin đã bán/ẩn hoặc có gói hoạt động khác: giữ lại để Admin đối soát; không tự cộng dồn các khoản chuyển lẻ.
- Giao dịch chuyển đúng hạn nhưng webhook tới trễ vẫn có thể được xác nhận nếu tin còn đủ điều kiện.
- Gửi lại cùng giao dịch không kích hoạt hai lần. Một khoản chuyển thêm cho đơn đã thanh toán được ghi nhận để đối soát, không tự gia hạn gói.
- Chỉ webhook được xác thực mới xác nhận thanh toán. Nút **Kiểm tra thanh toán** và endpoint từ trình duyệt không có quyền đặt đơn thành `PAID`.
- Admin xem 50 sự kiện gần nhất và số giao dịch cần đối soát trong **Doanh thu & đẩy tin**. Hệ thống chưa cung cấp lệnh tự hoàn tiền; việc hoàn tiền thực hiện sau khi kiểm tra trên ngân hàng và SePay.
- Với giao dịch **Cần đối soát** đã khớp đơn và đúng số tiền, chọn **Duyệt gói**, đối chiếu giao dịch thực nhận trên SePay/ngân hàng, nhập ghi chú (10–1000 ký tự), đánh dấu xác nhận rồi bấm **Duyệt và kích hoạt gói**. Có thể xử lý trường hợp quá hạn hoặc giờ máy chủ bị lệch sau khi kiểm tra biên lai. Gói bắt đầu tại thời điểm duyệt và giữ nguyên thời lượng/giá đã mua.
- Chỉ Admin có quyền duyệt; giao dịch thiếu/thừa tiền, sai tài khoản, chưa khớp đơn, tin không còn đủ điều kiện hoặc đã có gói hoạt động không được kích hoạt bằng thao tác này. Mỗi giao dịch chỉ kích hoạt một lần, kể cả bấm đồng thời hay webhook gửi lại. Ghi chú, người duyệt, lý do ban đầu và thời gian duyệt được lưu trong nhật ký quản trị; doanh thu và trạng thái của khách cập nhật sau khi duyệt thành công.
- Đồng hồ máy chủ cần được đồng bộ tự động. Trên Windows: **Settings → Time & language → Date & time → Set time automatically → Sync now**. Múi giờ Việt Nam là UTC+07:00. Giao dịch có thời điểm trước lúc tạo đơn quá 60 giây hoặc sau hạn sẽ chuyển đối soát; không sửa thời gian giao dịch trong database để lách kiểm tra.
- Lịch sử đơn thanh toán được giữ bằng ràng buộc database; không xóa cứng sản phẩm/tài khoản có đơn. Nếu cần gỡ tin, dùng ẩn tin.

## 6. Kiểm thử

Sau khi build frontend:

```powershell
npm --prefix frontend run build
npm --prefix frontend run test:sepay
npm --prefix frontend run test:sepay-integration
npm test
```

Lệnh integration tạo database `student_market_sepay_test_<ngẫu nhiên>`, dùng tài khoản và webhook giả lập có chữ ký rồi xóa database tạm. Không chuyển tiền thật, không ghi đơn `PAID` vào database nghiệp vụ.

Để thử từ phía SePay, dùng [Test mode/Webhook Sandbox](https://developer.sepay.vn/vi/sepay-webhooks/test-mode/bat-dau-nhanh) với môi trường và database thử nghiệm riêng. Không gửi payload thanh toán giả khớp đơn thật vào môi trường live. Sau khi cấu hình xong, chủ tài khoản có thể tự thực hiện một giao dịch thật theo hướng dẫn của SePay và kiểm tra nhật ký webhook; cần phân biệt rõ thử nghiệm với khoản thu thực tế.

Tài liệu chính thức: [luồng QR](https://developer.sepay.vn/vi/sepay-webhooks/tao-qr-va-form-thanh-toan), [payload và phản hồi webhook](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook), [xác thực](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc).
