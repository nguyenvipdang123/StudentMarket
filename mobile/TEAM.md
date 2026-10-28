# Phân công nhóm Mobile

Phân công được đề xuất ngày **28/10/2026**, theo danh sách người dùng cung cấp. Đây là trách nhiệm nhận bàn giao, kiểm chứng và tiếp tục phát triển từ hiện tại; không phải bằng chứng những người này đã viết các commit trước đó.

| MSSV | Thành viên | Phần phụ trách | Kết quả cần tự kiểm chứng và commit |
| --- | --- | --- | --- |
| 1923050110 | Lê Hoàng Nam | Giao diện, điều hướng Expo Router, theme sáng/tối và accessibility | Kiểm tra màn hình/dynamic/modal/not-found, chữ tương phản, TalkBack/VoiceOver và vùng bấm; sửa lỗi UI bằng commit của mình. |
| 1923050161 | Nguyễn Quang Phúc | Catalogue, tìm kiếm/lọc, server query cache và offline | Kiểm tra API đủ trang, filter trong render, kéo làm mới/giờ cập nhật, chế độ máy bay; viết/bổ sung ca kiểm thử dữ liệu. |
| 192305104 | Hồ Xuân Nguyên | Đăng tin, nén ảnh, giỏ hàng và checkout | Thử camera/thư viện trên thiết bị, ảnh bắt buộc, quy tắc khả dụng/số lượng/phí giao; sửa và commit phần mình xác minh. |
| 1923050059 | Phan Huy Nguyên | Phiên đăng nhập, yêu thích/chat, thông báo đổi giá và tích hợp kiểm thử | Kiểm chứng SecureStore, đổi tài khoản/đăng xuất, thông báo native và luồng end-to-end; tổng hợp README/AI_LOG và kiểm tra tích hợp. |

MSSV của Hồ Xuân Nguyên được giữ đúng chuỗi đã cung cấp; nhóm tự đối chiếu danh sách lớp, không tự thêm chữ số.

## Cách chia công việc trong hai tuần

- Ngày 1–2: từng người clone, chạy từ README, chọn issue của phần phụ trách và tạo branch cá nhân. Ghi ngày thực tế bắt đầu; không lùi ngày commit.
- Ngày 3–5: thực hiện/sửa phần đầu, commit nhỏ có nội dung thật, gửi PR và nhờ thành viên khác review.
- Ngày 6–9: hoàn thiện trạng thái lỗi/offline/theme/accessibility, thêm kiểm thử thuộc phần mình.
- Ngày 10–12: kiểm thử chéo trên thiết bị, sửa lỗi bằng commit thực của người phụ trách.
- Ngày 13–14: chạy toàn bộ check, bổ sung ảnh/video demo, tổng hợp báo cáo và AI_LOG. Không dồn hoặc tạo commit rỗng để làm đẹp biểu đồ.

Nếu thời gian còn lại không đủ hai tuần, nhóm cần trao đổi với giảng viên về lịch sử thực tế. Không có thao tác kỹ thuật nào biến một đợt làm tập trung thành lịch sử đóng góp hai tuần của bốn người.

## Quy trình Git và AI_LOG

Mỗi người dùng tên/email Git thật của mình, tự thực hiện phần được giao, commit thay đổi có ý nghĩa và review chéo. Không để người khác commit bằng danh tính của mình. Ghi mọi lần dùng AI vào [AI_LOG.md](../AI_LOG.md): yêu cầu, kết quả nhận được, phần giữ/bỏ, cách tự kiểm chứng và commit liên quan. Phân công không tự chứng minh đóng góp: bằng chứng là issue/PR/commit và kết quả kiểm thử thực.
