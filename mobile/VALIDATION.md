# Kiểm tra bản mobile đầu tiên — 27/10/2026

## Auth native — 29/10/2026

- Đăng ký (ảnh thẻ nén), nhập/gửi lại OTP, quên mật khẩu và hồ sơ Google là native forms. Login/Tài khoản dẫn tới route app. Turnstile dùng trang challenge cùng origin trong WebView, không bỏ kiểm tra server. Không persist mật khẩu/OTP, cookie/Google verifier/pending token chỉ SecureStore; lỗi 401 của OTP/Google không hết phiên đang hợp lệ. Sau nhận session, lỗi kiểm tra identity retry identity thay vì dùng lại mã đã tiêu thụ.
- Backend thêm config/challenge và start/authorize/claim/complete Google cho mobile; giữ callback HTTPS hiện có, kiểm S256, nonce, JWT signature/audience/issuer và Workspace trường. App nhận flow bằng proof ngẫu nhiên, hạn 10 phút, chỉ dùng một lần; browser bridge không chứa credentials. Hoàn tất hồ sơ web/mobile dùng transaction chống tiêu thụ token đồng thời. Migration auth thêm mobile_google_flows.
- `npm run mobile:check`: TypeScript/lint sạch, **74 logic/static + 40 Jest đạt**. Thêm 2 pure logic tests và 12 Jest về form/retry, OTP/session, SecureStore isolation/expiry, Google native và Turnstile origin/cancel/retry. Android export đạt; frontend build/typecheck/lint đạt, **46 nhóm integration/PostgreSQL đạt**, trong đó 4 nhóm mới dùng mock OIDC/JWK/JWT RS256 và kiểm PKCE/nonce/domain/replay/concurrency/web regression.
- Không gửi OTP/email thật, không đăng ký/ngồi đăng nhập Google thật hoặc chỉnh tài khoản production. Chưa xác minh Android/iOS UI, WebView Turnstile và cửa sổ Google thực tế. Probe GET `/api/auth/mobile/config` trên sangtay.shop trả **404**, nên backend mới chưa được deploy. Kết nối Render hiện không có; source push không tự triển khai vì Blueprint tắt auto-deploy. Hướng dẫn deploy trong AUTH.md. Không tạo APK/ZIP/release mới.
- Computer Use đã khởi tạo lại được, nhưng dừng trước thao tác trình duyệt vì không xác định URL hiện tại đủ chắc chắn để áp dụng chính sách. Không tiếp tục điều khiển UI hoặc triển khai Render bằng phiên đó.

## Khoảng giá, tình trạng và giá giảm dần — 29/10/2026

- Khám phá có bảng Bộ lọc mở/đóng: giá từ/đến (một đầu có thể trống, chấp nhận 0), các tình trạng hiện có và bốn kiểu sắp xếp. Tất cả kết hợp trường/danh mục/từ khóa; selector tính trong render trên raw catalogue, không lưu kết quả vào state hoặc gọi API theo bộ lọc. Mỗi lần đổi lọc/sort reset số mục hiển thị về 12.
- Giá phải là số nguyên 0–9.999.999.999đ, không có dấu phân cách. Sai số hoặc khoảng ngược có cảnh báo; không áp dụng im lặng một khoảng khác. Món giá 0 được giữ ở cận 0, cả tặng và trao đổi. Empty state có nút xóa bộ lọc; thiếu catalogue có nút thử tải.
- Thêm 3 logic tests (biên giá/invalid/zero/combined/không sửa raw/stable sort) và 3 component tests dùng catalogue giả (combine/reset, lỗi giá/empty/recover, offline). `npm run mobile:check`: TypeScript/lint sạch, **72/72 logic/static + 28/28 Jest đạt**. Android export đạt; chưa xác minh bố cục/bàn phím trên thiết bị thật trong lượt này. Không tạo APK hoặc đổi backend.

## Lưu nháp và ảnh qua lần đóng app — 29/10/2026

- Một nháp cho mỗi tài khoản/API, tự lưu ngay khi sửa nội dung, flush khi rời màn hình/app ra nền; có Lưu bản nháp và Bỏ bản nháp xác nhận. Form chờ khôi phục trước khi cho sửa, không ghi trắng lên dữ liệu chưa đọc được. Có retry đọc và bỏ nháp lỗi theo xác nhận.
- Ảnh nén được sao chép vào Documents qua expo-file-system SDK 58; metadata trong AsyncStorage. Khôi phục kiểm tra file, báo ảnh thiếu nhưng giữ nội dung. Chỉ dọn bản sao đúng scope sau khi metadata được ghi thành công; lỗi lưu/copy giữ dữ liệu cũ để thử lại. Không ghi cookie/secret vào nháp.
- POST lỗi giữ nháp; POST thành công mới clear. Nếu clear local lỗi sau khi server đã nhận tin, chỉ retry dọn nháp, không gửi lại POST. Tài khoản đổi trong khi picker đang mở không nhận ảnh từ phiên cũ.
- `npm run mobile:check`: TypeScript/lint sạch, **69/69 logic/static + 25/25 Jest đạt**. Bổ sung 9 logic tests, 6 component/critical-path tests và 2 adapter native tests với filesystem giả: restart/scope/offline, hydrate chậm, cache lỗi/retry, ảnh thiếu, write/copy lỗi, queue/clear, gửi lỗi/thành công/cleanup lỗi, picker trả trễ và background flush. `npx expo export --platform android` đạt.
- Chưa xác minh force-stop/mở lại Expo, camera và file thật trên emulator/điện thoại trong lượt này. Test restart tạo store mới với dữ liệu disk/files giả được giữ lại; không coi đó là thử nghiệm thiết bị thật. Không tạo APK hoặc tin đăng production. Nháp thiết bị mất khi gỡ app/xóa dữ liệu; không có đồng bộ server.

## Quản lý tin của chủ tin — 28/10/2026

- Tin của tôi có lọc trạng thái, sửa, ẩn/hiện lại, xóa, mark sold; route edit và modal sold xác minh owner trước khi hiện form. Edit giữ dữ liệu khi lỗi, thay ảnh bìa nén và giữ ảnh phụ. Mark sold phân biệt qua SangTay/chờ buyer xác nhận và bán ngoài hệ thống.
- Backend thêm PATCH/DELETE my-listings/:id với session/ownership/origin, khóa product, expectedStatus, chặn gói đẩy/đơn thanh toán/lịch hẹn/giao dịch đang mở. Delete dùng status Deleted, giữ rows lịch sử; các API detail/favorites/history/owned-list bỏ Deleted. Hiện lại chuyển PENDING; không sửa tin đã Sold/Deleted.
- Cache catalogue/favorites/cart loại tin đã đổi; phản hồi fetch/toggle cũ không được đưa tin trở lại. Chi tiết không lấy nội dung cache nếu API trả 403/404.
- `npm run mobile:check`: **60/60 logic/static + 17/17 Jest đạt**, TypeScript/lint sạch. Frontend typecheck/lint các API đổi và build production đạt. **42/42 nhóm tích hợp API/PostgreSQL** đạt trong database thử riêng, có 6 nhóm về quản lý tin. Expo Android export thành công, không tạo APK.
- Chưa xác minh UI bằng emulator trong lượt này do công cụ cửa sổ không khởi tạo được. Backend ẩn/xóa cần triển khai Render; tại thời điểm ghi log đang chờ kết nối plugin, không dùng tin/tài khoản thật để thử mutation.

## Retry thông báo giá và thao tác Tài khoản — 28/10/2026

- Outbox thông báo nằm cùng cài đặt per-account trong AsyncStorage; chứa identifier ổn định và sự kiện chờ. Refresh favorites thành công gọi notify cả khi không có thay đổi giá mới để thử lại pending; chỉ giữ sự kiện của món còn được lưu. Thành công được xác nhận/xóa từng sự kiện; partial failure không gửi lại các sự kiện đã xong.
- Queue sống qua process restart, bị dọn khi tắt báo/đăng xuất. Gửi tuần tự để hai refresh không cùng gửi một sự kiện; kiểm tra generation sau thao tác async để opt-out/logout không khôi phục lỗi hoặc phát thông báo muộn. Không hỏi lại quyền trong retry tự động.
- Tài khoản nhớ support/logout riêng. Retry hỗ trợ mở lại cùng URL, không gọi refresh phiên. Đăng xuất đã hoàn tất local chỉ cho đóng cảnh báo thu hồi server; không retry bằng tài khoản mới.
- TypeScript/lint sạch, **53/53 logic/static + 10/10 Jest tests đạt**. Test dùng Storage/NotificationDevice/Linking giả; không gửi thông báo, liên hệ hoặc logout tài khoản thật trên production. Không tạo APK hay sửa release đã nộp; notification tray native cần xác minh thêm.

## Sửa khởi động Expo Go: module thông báo push — 28/10/2026

- Expo Go trên emulator là 58.0.5. Root import của expo-notifications 58.1.6 nạp cả `ExpoTopicSubscriptionModule` dành cho remote push, gây lỗi từ MarketProvider dù ứng dụng chỉ dùng thông báo cục bộ.
- Adapter native chỉ import các entry thông báo cục bộ trong package đã cài; giữ handler, channel, xin quyền, lập lịch và xóa theo scope tài khoản. Không sửa node_modules hoặc tắt báo đổi giá. Các đường dẫn `build/*` là chi tiết nội bộ, cần kiểm tra lại khi nâng expo-notifications.
- Thêm hai kiểm thử hồi quy: root entry ném lỗi thiếu module push nhưng adapter vẫn xin quyền/lập lịch được; logout chỉ xóa thông báo đúng scope. 45 ca logic/static và 7 ca Jest đạt; typecheck/lint sạch. Export Android thành công, bundle không còn chuỗi `ExpoTopicSubscriptionModule`, vẫn có scheduler/permissions/presenter cục bộ.
- Đã gửi yêu cầu reload qua Metro đang chạy cổng 8081. Công cụ xem cửa sổ không khởi tạo được và Hermes inspector không phản hồi, nên chưa xác nhận lại UI hoặc notification tray trên emulator trong lượt này. Không tạo APK hay thay đổi release đã nộp.

## TECHNICAL REQUIREMENTS — source Expo, 28/10/2026

- Expo 58 + TS strict + Router: bổ sung `+not-found` và ErrorBoundary retry; giữ dynamic routes, login modal và function components. Bảng đối chiếu từng yêu cầu/trạng thái ở [TECHNICAL.md](TECHNICAL.md).
- Light/dark từ `src/tokens.ts`, ThemeProvider hỗ trợ hệ thống hoặc Sáng/Tối trong Tài khoản; splash/icon config lấy cùng token, không còn colour literal ở module source khác. Body/secondary/heading/brand/button/error được kiểm tra tương phản ≥4,5:1 với các nền sử dụng ở cả hai palette.
- Thêm TanStack Query cho server GET cache/dedupe theo phiên/API/path; chi tiết dùng useQuery, mutation làm stale cache, logout/expired clear cache. Store có selectors cho yêu thích và giỏ. Cookie chỉ SecureStore native; bản web không fallback lưu secret vào localStorage.
- `npm run mobile:check`: TypeScript/lint sạch; **45/45 pure-logic/static checks + 5/5 Jest tests** đạt. Có component disabled/target/theme, bốn trạng thái và nút retry; critical path sai mật khẩu→retry→SecureStore→khôi phục sau remount→logout thật trong SessionProvider với API giả; cache server có kiểm thử dedupe/isolation/no auto retry.
- Expo web 390×844: hai theme hiển thị đúng; màn hình tài khoản đo mọi button/tab đều ≥44×44; route không tồn tại hiện fallback và nút Về Khám phá hoạt động. API catalogue trên bản web chưa tải thành công trong lần thử này; error/empty/banner vẫn hiển thị và Thử lại chuyển trở về loading. Không suy ra kết quả API Android từ giới hạn bản xem thử web.
- `expo export --platform android` thành công (Hermes khoảng 3,4 MB); `expo config --type public` giải quyết config/token thành công; `npm ci --ignore-scripts --dry-run` xác nhận lockfile cài nhất quán. Không tạo APK, không gửi OTP/tin đăng/giao dịch thật. Localhost 3000/8085 đã tắt.
- Cần thiết bị Android/iOS để kiểm tra TalkBack/VoiceOver, tăng cỡ chữ, camera, notification tray và cảm ứng. Chưa được chứng minh yêu cầu commit cả bốn thành viên xuyên hai tuần: audit từ 15–28/10 trước đợt này có 27 commit của một tác giả. Đã ghi phân công tương lai tại [TEAM.md](TEAM.md) và nhật ký AI chung ở root; không đổi author/backdate.

## Bổ sung ba yêu cầu Mobile — 28/10/2026

- Góc người bán/người mua suy ra từ phiên và chủ tin, không dùng nút đổi vai trong app thật. Chủ tin có trạng thái duyệt/thống kê và lối vào quản lý; người mua có lưu/giỏ/liên hệ. Đổi tài khoản khởi tạo lại chi tiết để không giữ dữ liệu riêng của chủ tin.
- Thêm expo-notifications tương thích SDK 58, opt-in riêng theo tài khoản, channel Android và xử lý quyền; thông báo giá cũ → mới sau lần refresh API thành công. Không đăng ký push token. Dừng polling lúc nền/offline, tiếp tục khi trở lại; giới hạn là app hoạt động, không phải giám sát khi đã đóng.
- TypeScript/lint đạt và 41/41 kiểm thử tự động: ownership/role, tăng/giảm giá, baseline sau restart, không báo trùng, giờ cập nhật khi offline/HTTP lỗi, cấp/từ chối quyền, tắt thông báo và phản hồi cũ sau đổi tài khoản/đăng xuất. Device adapter được mock trong kiểm thử thông báo, chưa xác nhận OS notification tray trên máy thật.
- UI Expo React Native Web 390 × 844 với cùng tin và hai phiên giả: người bán thấy 42 lượt xem/7 lưu/3 cuộc trò chuyện và hai nút quản lý, người mua chỉ có lưu/thêm giỏ/liên hệ; catalogue và chi tiết hiện giờ cập nhật. Không có lỗi render trong console. Route và export Context dùng riêng cho QA đã xóa trước khi xuất bundle.
- Không tạo APK mới. Cần Expo Go Android/iOS thật để kiểm tra quyền, banner local, thao tác kéo làm mới bằng cảm ứng và đổi tài khoản thật.
- Xuất bundle Expo Android thành công (Hermes khoảng 3,3 MB); kiểm tra có adapter thông báo native và API production, không còn route/địa chỉ API giả. Các server xem thử đã dừng, localhost:3000 vẫn tắt.

## MUST HAVE cho môn Mobile, kiểm thử source Expo — 28/10/2026

- Đã triển khai đối chiếu trong [RUBRIC.md](RUBRIC.md): tìm kiếm/danh mục tính khi render từ catalogue gốc, state yêu thích/giỏ dùng chung lưu riêng theo tài khoản, catalogue offline, ảnh bắt buộc nén từ thư viện/camera và đăng xuất local ngay cả khi API lỗi.
- TypeScript, ESLint không lỗi/cảnh báo; 33/33 kiểm thử mobile đạt. Bao phủ khôi phục cache sau restart, dữ liệu lỗi không thay thế bản tốt, hai subscriber yêu thích, tách tài khoản, phản hồi cũ, stock/availability, phí giao theo người bán, giá thay đổi, ảnh bắt buộc và logout khi mất mạng.
- Bản xem thử Expo React Native Web 390 × 844 với API/tài khoản giả: gõ `sach` và lọc Học tập ra đúng món; lưu/bỏ lưu cập nhật ngay màn hình Đã lưu; bản catalogue vẫn tìm được khi chuyển trạng thái offline; tổng 50.000đ + giao 30.000đ = 80.000đ; tin vừa chuyển Sold bị chặn với lý do. Hai cảnh báo render phát hiện trong QA đã sửa và kiểm tra lại.
- Chạy ImageManipulator thực trên bản web với ảnh local 4.000 × 3.000, 265.882 byte: JPEG kết quả 1.600 × 1.200, 27.897 byte. Đây là kiểm chứng pipeline nén; chưa xác minh camera hoặc hiệu năng nén trên Android thật.
- Đọc API công khai production: 34 sản phẩm, tất cả hợp lệ với schema catalogue cache mới. Không tạo tài khoản/tin đăng/thanh toán hay lưu yêu thích của người dùng thật.
- `expo export --platform android` thành công, bundle Hermes khoảng 3,2 MB. Xác nhận bundle dùng API production và không còn route/địa chỉ API giả. Không chạy Gradle hoặc tạo APK mới theo yêu cầu người dùng.
- Trang kiểm thử giả đã xóa; server local 8085/18865 đã dừng, localhost:3000 vẫn tắt. Cần demo Expo Go trên Android/iOS thật cho SecureStore, camera, chọn ảnh/upload, khởi động lại và chế độ máy bay. Checkout là bảng chi phí dự kiến, chưa tạo đơn hay thu tiền.

## Bổ sung chat native — 28/10/2026

- Thêm tab Tin nhắn, mở/tạo cuộc trò chuyện từ chi tiết sản phẩm, gửi văn bản, xem lịch sử/ảnh đính kèm và trạng thái đã xem. Dùng chung API và cookie phiên của app; không cần đăng nhập trình duyệt để chat.
- TypeScript, ESLint và 23/23 kiểm thử mobile đạt. Bao phủ danh tính người tham gia, payload không giả mạo người gửi, gộp lịch sử sau phản hồi chậm, giới hạn đường dẫn ảnh riêng tư, cập nhật nối tiếp và dừng khi rời màn hình/đưa app vào nền.
- `npm --prefix mobile run test:chat-integration`: 39/39 nhóm kiểm thử tích hợp đạt với API Next.js thật và database local tạm. Xác nhận tạo phòng đồng thời không trùng, hai bên gửi/nhận và đã xem; người ngoài không được đọc/gửi hoặc xem ảnh, người chưa đăng nhập nhận 401. Không nhắn tin đến người dùng production.
- Giao diện React Native Web ở kích thước 390 × 844 với API giả: gửi/nhận, đã xem, xóa ô soạn sau gửi thành công, giữ nội dung khi gửi lỗi. Route giả đã được gỡ trước khi build APK.
- Phiên bản 1.0.2/versionCode 3. Chưa kiểm thử APK mới trên Android thật; kết quả xem thử trên web và kiểm thử API không thay thế kiểm thử bàn phím, cài đặt và chạy trên thiết bị.
- APK release đã build và xác minh chữ ký v2/v3 bằng cùng chứng chỉ bản cũ, zipalign 16 KB đạt. Đọc manifest xác nhận package/version/ABIs, đọc bundle xác nhận có chat native và không có route/dữ liệu giả. Cổng local 3000 và 8085 đã dừng sau khi kiểm tra.

## Bổ sung bộ lọc trường — 28/10/2026

- Bảng chọn trường trong Khám phá dùng cùng danh sách và alias với website; hỗ trợ tìm tên không dấu/mã trường, chọn và bỏ lọc.
- Tham số school đi cùng tìm kiếm, danh mục và sắp xếp khi làm mới/tải thêm. Đổi trường bắt đầu lại trang 1; phản hồi cũ không ghi đè danh sách mới.
- TypeScript, lint và 16/16 kiểm thử đạt, gồm kiểm tra danh sách trường khớp web và hợp đồng phân trang với parser API.
- Đọc API production với DNTU/UTH cho đúng 9/4 món tương ứng; bỏ lọc trả tổng 34 món tại thời điểm kiểm tra. Bản xem thử React Native Web ở kích thước điện thoại đã mở bảng chọn, tìm mã DNTU và hiển thị 9 món của trường.
- Phiên bản ứng dụng tăng lên 1.0.1/versionCode 2 để cài cập nhật bằng cùng khóa ký. Kiểm tra giao diện web không thay thế kiểm thử APK trên thiết bị Android thật.

## Cài lại dependencies và chuẩn bị GitHub — 28/10/2026

- Khôi phục dependencies bằng `npm --prefix mobile ci`, giữ nguyên lockfile.
- TypeScript, lint và 13/13 kiểm thử đạt. Xuất bundle Android lại thành công với 1.259 module và 49 assets.
- Đã tạo APK release 1.0.0/versionCode 1, ký riêng và kiểm tra chữ ký/căn chỉnh ZIP; xem [APK.md](APK.md). APK, khóa ký, dependencies và cache được loại khỏi Git cũng như ZIP mã nguồn sao lưu.
- Chưa kiểm thử lại APK trên thiết bị thật; Android Emulator trên máy hiện có lỗi DLL. Những kiểm thử Expo Go ngày 27/10 dưới đây là kết quả lịch sử, không phải kiểm thử APK mới.

## Bổ sung: liên kết quên mật khẩu

- Tách Quên mật khẩu và Đăng ký thành hai nút; mở lần lượt `auth=forgot` và `auth=register` trên website đã hỗ trợ hai chế độ.
- TypeScript, lint và 13/13 kiểm thử hiện có đạt sau thay đổi. Không thay đổi luồng gửi OTP/đặt lại mật khẩu của backend.

## Bổ sung: nhãn món tặng trong Đã lưu

- API favorites bổ sung description và freeGift từ tin đăng hiện có; mobile và web Đã lưu dùng đúng nhãn.
- 13/13 kiểm thử mobile và 3/3 kiểm thử mapper API đạt; TypeScript mobile/frontend và lint đạt (frontend còn cảnh báo ảnh img có sẵn).
- Đã kiểm tra nối dữ liệu mapper API → dữ liệu card mobile → priceLabel: món tặng giá 0 là Tặng miễn phí, món trao đổi giá 0 là Trao đổi, món bán 50.000đ giữ giá tiền.
- Backend/web commit `8e3b7fb` đã triển khai live trên studentmarket-web; health trả 200. Bundle trang Đã lưu đã có điều kiện freeGift. Đối chiếu thêm dữ liệu công khai của tin “Mèo con tìm chủ” cho nhãn Tặng miễn phí. Chưa đọc danh sách đã lưu của tài khoản thật trong lượt kiểm tra này.

## Bổ sung: sửa phiên hết hạn

- TypeScript, ESLint và 12/12 kiểm thử tự động đạt (gồm 8 ca hồi quy quản lý phiên).
- Kiểm thử Pixel_7 bằng tài khoản giả và API cục bộ: 2 phản hồi 401 đồng thời chỉ phát 1 sự kiện hết hạn, xóa cookie trong SecureStore và xóa user khỏi Provider; màn hình hiện `/login` với đúng 1 route Login và thông báo hết hạn.
- Đăng nhập lại thành công; 401 trả chậm từ phiên cũ không xóa phiên mới. Sai mật khẩu và lỗi 503 giữ phiên hợp lệ. `/api/auth/me` trả 200 `{user:null}` cũng xóa phiên và không tạo thêm màn hình Login khi Login đang mở.
- Không tạo tài khoản, tin đăng hoặc giao dịch thật. Route kiểm thử tạm đã được gỡ khỏi mã ứng dụng.

## Kết quả bản đầu trước khi sửa

- `npm run typecheck`: đạt.
- `npm run lint`: đạt, không lỗi/cảnh báo lint.
- `npm test`: 4/4 đạt (origin HTTPS, cookie phiên, URL ảnh, dữ liệu đăng tin và giá).
- `npx expo-doctor`: 20/20 đạt.
- `npx expo export --platform android`: tạo bundle Hermes và assets thành công; đây chưa phải APK.
- Pixel_7 / Android 13 / Expo Go 58.0.5: app khởi động; màn hình Khám phá tải 34 sản phẩm công khai cùng ảnh từ sangtay.shop; deep link mở được chi tiết sản phẩm, giá và màn hình đăng nhập native.

Chưa kiểm thử đầu-cuối với tài khoản thật: đăng nhập/khôi phục phiên/đăng xuất, lưu sản phẩm, chọn ảnh và gửi tin. Cần người dùng đăng nhập để xác nhận các luồng này; đợt kiểm tra không tạo tài khoản hoặc tin giả trên production. Chưa kiểm thử iOS, thiết bị vật lý hay bản APK độc lập.

`npm audit --omit=dev` ghi nhận 3 cảnh báo high theo chuỗi Expo → Expo CLI → Zod trong bộ công cụ. Gợi ý tự động là hạ Expo về SDK 54, nên chưa áp dụng thay đổi gây lệch SDK. Cần theo dõi bản vá tương thích của Expo CLI trước khi dùng Metro ở môi trường mở; script local dùng kết nối ADB để chạy emulator. Không phát hành Metro như một backend production.
