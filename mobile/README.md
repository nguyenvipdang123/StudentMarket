# SangTay Mobile

Có thể phát triển **bằng Expo** hoặc tải [APK cài độc lập 1.0.3](https://github.com/nguyenvipdang123/StudentMarket/releases/tag/mobile-v1.0.3). Xem [hướng dẫn APK](APK.md) và [đối chiếu MUST HAVE/kịch bản demo](RUBRIC.md).

## Lưu nháp tin đăng và ảnh

Trong tab Đăng tin, nội dung tự lưu trên thiết bị khi bạn nhập. Ảnh chọn/chụp được nén rồi sao chép vào thư mục Documents của app, không giữ đường dẫn cache tạm. Có nút **Lưu bản nháp**, thời gian lưu và **Bỏ bản nháp** có xác nhận. Nháp lưu được cả khi offline hoặc thông tin chưa đủ để đăng.

Chờ hết trạng thái xử lý ảnh và hiện **Đã lưu nháp lúc…**, rồi có thể đóng/mở lại Expo và vào Đăng tin để tiếp tục. Mỗi tài khoản/API có một nháp riêng; đăng xuất không xóa nháp, tài khoản khác không thấy nháp đó. Gửi tin lỗi giữ nguyên nháp; server xác nhận gửi thành công mới xóa nháp cùng ảnh sao chép. Lỗi dung lượng/ảnh thiếu được báo để lưu lại hoặc chọn lại ảnh; bản nháp lỗi đọc không bị tự ghi đè bằng form trống.

Nháp chỉ có trên thiết bị này; gỡ app hoặc xóa dữ liệu app sẽ mất nháp. Đây chưa phải đồng bộ nháp lên server. Tài khoản/phiên vẫn dùng SecureStore, không đưa cookie vào nháp.

## Bộ lọc Khám phá

Vào **Khám phá → Bộ lọc** để nhập giá từ/đến, chọn tình trạng và sắp xếp Nổi bật/Giá tăng dần/Giá giảm dần/Mới nhất. Giá dùng số nguyên đồng không có dấu phân cách (ví dụ `50000`); bỏ trống một đầu để không giới hạn phía đó. Giá âm, quá giới hạn hoặc giá từ lớn hơn giá đến được báo lỗi. Món tặng/trao đổi được tính là 0đ khi lọc.

Các điều kiện kết hợp với từ khóa, danh mục và trường; kết quả tính trong render trên catalogue hiện có, không lưu thành derived state hoặc gọi lại API mỗi lần chỉnh lọc. Dùng được offline với catalogue lưu gần nhất. **Xóa bộ lọc** đưa tìm kiếm, trường, danh mục, giá, tình trạng và sắp xếp về mặc định.

## Đăng ký, OTP, Google và quên mật khẩu

Các form đã có trên app: vào Tài khoản hoặc Đăng nhập để chọn. Đăng ký hỗ trợ chọn/nén ảnh thẻ, xác minh/gửi lại OTP; quên mật khẩu nhập OTP và mật khẩu mới ngay trên mobile. Google dùng cửa sổ hệ thống để xác thực, đóng cửa sổ quay về app rồi kiểm tra kết quả/bổ sung hồ sơ native. Cookie và mã bàn giao Google lưu bằng SecureStore, không yêu cầu nhập server secret vào app.

Backend phải có API `/api/auth/mobile/config` trả JSON `version: 1`. Khi đóng gói APK 1.0.3 ngày 29/10, API live đã trả 200 với Google/Turnstile bật. Xem [AUTH.md](AUTH.md) để triển khai và kiểm tra từng luồng; tests/bundle đã đạt không có nghĩa Google/SMTP/Turnstile thật đã được thử trên điện thoại.

## Chạy từ máy sạch bằng Expo Go

Yêu cầu Git, **Node.js ≥22.20.0** và npm, cùng Expo Go tương thích SDK 58 trên Android/iOS. Không cần cài database, Python, Android Studio hoặc chạy backend trên máy nếu dùng điện thoại với API mặc định.

```sh
git clone https://github.com/nguyenvipdang123/StudentMarket.git
cd StudentMarket/mobile
npm ci
npm start
```

Điện thoại và máy tính cùng Wi-Fi; mở Expo Go và quét QR của Metro (iOS có thể dùng Camera). Cho phép Node trên mạng riêng nếu hệ điều hành hỏi firewall. Nếu SDK Expo Go không khớp, dùng bản tương thích theo tài liệu Expo hoặc development build; APK cũ không tự nhận các thay đổi source mới này.

Không cần file `.env` để bắt đầu: API mặc định là `https://sangtay.shop`. Catalogue công khai xem được khi chưa đăng nhập. Tạo/lưu/chat dùng tài khoản sinh viên đã xác minh có sẵn trên website; source không cung cấp mật khẩu mẫu hoặc API secret. Chức năng ghi có tác động dữ liệu thật; không dùng tài khoản của người khác để demo.

Kiểm tra không cần tài khoản/database thật, tại `mobile/`:

```sh
npm run typecheck
npm run lint
npm test
```

`npm test` chạy pure logic + component + luồng auth với API và SecureStore giả. Để kiểm tra bundle: `npx expo export --platform android`; lệnh này không tạo APK. Thử web bằng `npm run web` để xem layout/theme, nhưng camera/permission/notification/SecureStore cần kiểm chứng trên Expo Go native. Web không lưu cookie thay cho SecureStore.

Đối chiếu [yêu cầu kỹ thuật](TECHNICAL.md), [phân công bốn thành viên](TEAM.md) và [nhật ký AI toàn nhóm](../AI_LOG.md). Source mobile dùng token màu duy nhất tại `src/tokens.ts`; Tài khoản → Giao diện cho phép Sáng/Tối/Theo thiết bị. Chưa có lịch sử commit hai tuần của đủ bốn người; cần đóng góp thực theo phân công.

Nếu cần APK trong tương lai, xem [hướng dẫn APK](APK.md); không cần chạy lệnh build APK khi làm bài bằng Expo.

Ứng dụng **React Native + Expo + TypeScript**, dùng chung API và dữ liệu của [sangtay.shop](https://sangtay.shop). Giao diện native được viết riêng cho điện thoại; website Next.js vẫn nằm ở `../frontend`.

## Chạy Android trên máy này

Yêu cầu Node.js 22+, Android Studio và SDK. Máy hiện có SDK tại `F:\AndroidSdk`, AVD `Pixel_7`.

Từ thư mục gốc repo:

```powershell
npm --prefix mobile ci
npm run mobile:android
```

Hoặc vào thư mục `mobile` rồi chạy `npm run android:local`. Script tìm SDK từ `ANDROID_HOME`, mặc định dùng `F:\AndroidSdk`; tự thiết lập đường dẫn ADB cho phiên terminal. Có thể mở Pixel_7 trước trong Android Studio → Device Manager. Giữ terminal Metro chạy trong lúc dùng app. Lần đầu Expo CLI có thể tải Expo Go tương thích SDK 58 vào emulator.

Script gọi trực tiếp Expo CLI trong `mobile/node_modules`, tránh lỗi shim `npx.ps1` của Windows PowerShell. Nếu báo thiếu dependencies, chạy lại `npm --prefix mobile ci` từ gốc repo. Nếu cổng 8081 đã có Metro chạy, có thể trả lời `Y` khi được hỏi dùng cổng tiếp theo.

Trên máy khác, đặt `ANDROID_HOME` đến SDK của máy đó rồi chạy `npm run android`. Muốn chạy điện thoại thật qua Expo Go, dùng `npm start` và kết nối cùng mạng Wi-Fi. Phiên bản Expo Go phải tương thích SDK 58; nếu bản trên cửa hàng chưa hỗ trợ SDK này, dùng emulator hoặc development build theo tài liệu Expo.

## Phạm vi bản đầu

- Catalogue tải đủ trang từ API và lưu bản thành công gần nhất trên máy. Tìm từ khóa không dấu, lọc danh mục/trường và sắp xếp được tính trực tiếp khi render; không lưu danh sách lọc thành state. Offline vẫn xem/tìm/lọc bản lưu với banner; lần đầu chưa có dữ liệu luôn hiện hướng dẫn và nút thử lại.
- Chi tiết sản phẩm, vuốt ảnh, thông tin người bán và hướng dẫn giao dịch an toàn.
- Cùng tin hiển thị góc người bán khi tài khoản là chủ tin: trạng thái duyệt và thống kê, lối vào Tin của tôi/Tin nhắn. Người mua có nút lưu, thêm giỏ và liên hệ; không có nút mua tin của chính mình.
- Đăng nhập email/mật khẩu bằng tài khoản đã xác minh trên website; lưu **cookie phiên** trong Expo SecureStore, không lưu mật khẩu. Khôi phục phiên khi mở app và đăng xuất qua API.
- Khi API xác nhận phiên hết hạn (401 hoặc `/api/auth/me` trả `user: null`), app xóa cookie, bỏ trạng thái đăng nhập và mở màn hình đăng nhập một lần kèm thông báo. Lỗi mật khẩu sai, mất mạng hoặc lỗi server không tự xóa phiên hợp lệ; phản hồi cũ không làm mất phiên vừa đăng nhập lại.
- Yêu thích dùng chung state ở Khám phá, Chi tiết và Đã lưu, lưu AsyncStorage riêng từng tài khoản và đồng bộ API. Đã lưu và giỏ khôi phục sau khi mở lại; không hiện dữ liệu của tài khoản trước sau đăng xuất/đổi tài khoản.
- Đã lưu có tùy chọn thông báo cục bộ khi giá thay đổi, xin quyền khi bấm bật. Kiểm tra khoảng mỗi phút lúc app hoạt động, khi quay lại và khi kéo làm mới; không theo dõi khi app đóng. Cần Expo Go Android/iOS để thử banner hệ thống; bản web không hỗ trợ thông báo này.
- Khám phá, Đã lưu, Tin của tôi và Chi tiết có kéo làm mới cùng thời điểm cập nhật API thành công; tải lỗi giữ giờ cũ.
- Giỏ hàng từ biểu tượng ở Khám phá hoặc Tài khoản. Mỗi tin số lượng 1; checkout tính tạm tính/phí giao/tổng, kiểm tra lại giá/tình trạng từ API và chặn món đã bán/giữ chỗ/không xác minh được. Đây là bảng dự tính và liên hệ người bán, chưa tạo đơn hoặc thu tiền.
- Sinh viên tạo tin chờ duyệt với ít nhất 1 và tối đa 8 ảnh từ thư viện/camera; ảnh được nén JPEG 72%, tối đa 1.600px và 5 MB trước khi gửi. Màn hình giữ dữ liệu khi API báo lỗi; chưa có bản nháp lưu qua lần đóng app.
- **Tin của tôi:** lọc theo trạng thái, sửa nội dung/ảnh bìa, ẩn/hiện lại, xóa và đánh dấu đã bán. Sửa/hiện lại cần duyệt; tin đã bán không sửa được. Xóa gỡ tin khỏi danh sách nhưng giữ lịch sử chat/giao dịch. Có xác nhận trước thao tác, thông báo lỗi và kiểm tra ràng buộc từ server; qua SangTay cần email/UUID người mua đã chat, bán ngoài hệ thống không tạo giao dịch đánh giá. Ẩn/xóa cần backend mới theo [hợp đồng API](../frontend/docs/owned-listings.md).
- Nhắn tin người bán ngay trong chi tiết sản phẩm; tab Tin nhắn có cả cuộc trò chuyện mua và bán, số tin chưa đọc, lịch sử và trạng thái đã xem dùng chung với website. Gửi văn bản ngay trong app và xem ảnh người dùng gửi từ website; chưa gửi ảnh từ app. Gửi lỗi giữ nội dung đang soạn, không tự gửi lại để tránh trùng tin.
- Lịch sử chat cập nhật mỗi 5 giây, danh sách cuộc trò chuyện mỗi 15 giây khi màn hình đang mở; dừng khi chuyển màn hình hoặc đưa app vào nền. Chưa có thông báo đẩy khi đóng app.
- Đăng ký, quên mật khẩu, Google và hỗ trợ mở trên website, có thể cần đăng nhập riêng trên trình duyệt. Chưa có thanh toán native, AI hoặc màn hình Admin.

App và website dùng chung dữ liệu thật: đăng tin hoặc lưu sản phẩm trên app sẽ thay đổi tài khoản thật. Không cần sao chép database hay API key vào app.

## Cấu hình API

Mặc định `https://sangtay.shop`. Muốn thay đổi, sao chép `.env.example` thành `.env`:

```dotenv
EXPO_PUBLIC_API_URL=https://sangtay.shop
```

Biến `EXPO_PUBLIC_*` được đóng vào app và **công khai**. Chỉ đặt URL, tuyệt đối không đặt Gemini key, Supabase secret, SMTP, SePay secret hay database URL vào đây. Khởi động lại Metro sau khi đổi URL.

Backend local Next.js trên cổng 3000: emulator Android dùng `http://10.0.2.2:3000` (địa chỉ máy host); localhost trong emulator là chính điện thoại. HTTP chỉ được chấp nhận cho localhost/127.0.0.1/10.0.2.2; bản sử dụng thực cần HTTPS. Cấu hình WAF cho API cần cho phép client native, không đưa HTML challenge vào mọi API. Các quy tắc xác thực và giới hạn tần suất trên server vẫn áp dụng.

## Cấu trúc

```text
src/app/          Expo Router: tabs, đăng nhập, chi tiết, tin của tôi
src/api/          API client, DTO, kiểm tra URL/session và dữ liệu đầu vào
src/components/   Thành phần giao diện dùng lại
src/providers/    Phiên đăng nhập
src/state/        Catalogue offline, yêu thích và giỏ dùng chung, quy tắc checkout
src/hooks/        Cập nhật chat theo trạng thái màn hình và ứng dụng
src/theme.ts      Theme context và typography SangTay
src/tokens.ts     Toàn bộ token màu sáng/tối, kể cả config native
tests/           Component và critical path bằng Jest/RNTL
assets/fonts/     Font dùng chung nhận diện với website và giấy phép
scripts/          Khởi chạy Android và kiểm thử
```

## Kiểm tra / đóng gói

```powershell
npm run typecheck
npm run lint
npm test
npm run test:logic
npm run test:components
npm run test:chat-integration
npx expo-doctor
npx expo export --platform android
```

Lệnh export kiểm tra bundle JavaScript/assets, **không tạo APK**. Cần development/production build để tạo APK/AAB, cấu hình bằng `app.json` và Expo CNG/EAS; không sửa tay thư mục native được sinh. Android application ID: `shop.sangtay.mobile`.

Tài liệu: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [chạy Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/).

`test:chat-integration` cần PostgreSQL local cấu hình trong `frontend/.env.local` và bản build frontend hiện có. Script từ chối host database ngoài localhost, tạo database tạm, chạy API thật với tài khoản giả rồi dọn dữ liệu; không gửi tin nhắn tới người dùng production.
