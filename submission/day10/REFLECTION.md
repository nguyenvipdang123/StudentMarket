# Reflection dự án SangTay Mobile

Lê Hoàng Nam · Nguyễn Quang Phúc · Hồ Xuân Nguyên · Phan Huy Nguyên

Nếu bắt đầu lại, nhóm sẽ chuyển rubric thành danh sách kiểm chứng ngay từ ngày đầu, trước khi thêm hiệu ứng hay chức năng phụ. Một tính năng chạy được chưa chắc đáp ứng cách triển khai mà môn học yêu cầu: tìm kiếm và lọc phải tính trong render; yêu thích phải có nguồn state chung; dữ liệu offline phải còn sau khi mở lại ứng dụng. Làm rõ những điều này sớm sẽ giảm việc sửa kiến trúc khi gần ngày demo.

Về kỹ thuật, nhóm sẽ tách ba loại dữ liệu từ đầu: dữ liệu server do TanStack Query quản lý; trạng thái dùng chung như giỏ và yêu thích có selector; cookie phiên chỉ lưu trong SecureStore. UI sẽ dùng một bộ token màu cho cả sáng và tối, cùng các thành phần loading, empty, error có retry và content. Nhóm cũng sẽ viết sớm một luồng kiểm thử đăng nhập, khôi phục phiên và đăng xuất, thay vì chỉ kiểm tra các hàm nhỏ sau khi đã có nhiều màn hình.

Một đề xuất sai thực tế của trợ lý AI là gán `role="textbox"` cho TextInput của React Native 0.88. Thuộc tính này nghe hợp lý theo thói quen viết web, nhưng không thuộc tập Role được phiên bản React Native này chấp nhận. Lệnh `tsc --noEmit` đã chặn lỗi. Bản sửa giữ vai trò nhập liệu sẵn có của TextInput, thêm label rõ ràng, và chỉ dùng role searchbox ở ô tìm kiếm. Bài học là phải kiểm tra tài liệu và type của đúng SDK; không coi mã AI trông hợp lý là bằng chứng nó tương thích. Component test và kiểm tra trên thiết bị cần đi sau kiểm tra kiểu.

Các kiểm tra hiện có gồm 45 ca logic/static và 5 ca component, query cache, luồng auth; TypeScript và lint sạch. Tuy nhiên, kết quả đó không thay thế việc thử camera, thanh thông báo, chế độ máy bay và TalkBack/VoiceOver trên điện thoại. Nếu làm lại, nhóm sẽ dành một mốc kiểm thử thiết bị trước ngày demo, có tài khoản và dữ liệu thử riêng, rồi quay video dự phòng từ chính các thao tác đã xác minh.

Về phối hợp, nhóm sẽ chia issue và branch cá nhân từ đầu, review chéo rồi commit các thay đổi có ý nghĩa trong suốt thời gian làm. Mỗi phần việc nên có tiêu chí hoàn thành, người phụ trách và một lần kiểm thử chéo. Nhóm cũng sẽ chuẩn bị dữ liệu demo, video dự phòng và bản release sớm hơn, để buổi trình bày tập trung vào trải nghiệm ứng dụng thay vì xử lý môi trường cài đặt. Điều cần cải thiện là cách chia tiến độ và kiểm chứng từng phần, không chỉ số lượng chức năng cuối cùng.
