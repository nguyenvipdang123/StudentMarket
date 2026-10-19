-- StudentMarket / SangTay: 20 tin đăng mẫu và 5 người bán mẫu.
-- Chạy trên database student_market sau InitialCreate.sql và postgres-schema.sql.
-- Có thể chạy lại: các UUID cố định sẽ không bị chèn trùng.
-- Người bán @demo.invalid chỉ có hồ sơ mẫu trong users (auth_id NULL), không có tài khoản đăng nhập.
-- Các tin được đặt APPROVED để hiển thị ngay trên trang Khám phá.

BEGIN;

INSERT INTO categories (id, name, slug, sort_order) VALUES
  (1, 'Học tập', 'hoc-tap', 1),
  (2, 'Công nghệ', 'cong-nghe', 2),
  (3, 'Nội thất', 'noi-that', 3),
  (4, 'Thời trang', 'thoi-trang', 4),
  (5, 'Khác', 'khac', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, full_name, email, student_id, university, role, auth_type, status, created_at)
VALUES
  ('d3a1c100-0000-4000-8000-000000000001', 'Người bán mẫu 1', 'seller01@demo.invalid', 'DEMO-0001', 'Đại học Bách khoa TP.HCM', 'Student', 'Demo', 'Demo', NOW()),
  ('d3a1c100-0000-4000-8000-000000000002', 'Người bán mẫu 2', 'seller02@demo.invalid', 'DEMO-0002', 'Đại học Kinh tế TP.HCM', 'Student', 'Demo', 'Demo', NOW()),
  ('d3a1c100-0000-4000-8000-000000000003', 'Người bán mẫu 3', 'seller03@demo.invalid', 'DEMO-0003', 'Đại học Sư phạm TP.HCM', 'Student', 'Demo', 'Demo', NOW()),
  ('d3a1c100-0000-4000-8000-000000000004', 'Người bán mẫu 4', 'seller04@demo.invalid', 'DEMO-0004', 'Đại học Công nghệ Thông tin', 'Student', 'Demo', 'Demo', NOW()),
  ('d3a1c100-0000-4000-8000-000000000005', 'Người bán mẫu 5', 'seller05@demo.invalid', 'DEMO-0005', 'Đại học Mở TP.HCM', 'Student', 'Demo', 'Demo', NOW())
ON CONFLICT (id) DO NOTHING;

WITH sample (n, seller_no, category_id, title, description, price, condition, location) AS (
  VALUES
  ( 1, 1, 1, 'Giáo trình Giải tích 1', 'Giáo trình còn sạch, không rách trang, có ghi chú nhẹ ở vài chương.',  85000, 'Tốt',             'Quận 10, TP.HCM'),
  ( 2, 2, 1, 'Bộ sách tiếng Anh B1', 'Bộ sách gồm giáo trình và bài tập, phù hợp ôn thi chuẩn đầu ra B1.', 120000, 'Như mới',         'Quận 3, TP.HCM'),
  ( 3, 3, 1, 'Máy tính Casio fx-580VN X', 'Máy hoạt động bình thường, màn hình rõ và còn nắp bảo vệ.',        350000, 'Tốt',             'Quận 5, TP.HCM'),
  ( 4, 4, 1, 'Sổ tay và flashcard học tập', 'Một bộ sổ tay kèm flashcard giấy, tiện ghi nhớ công thức và từ vựng.', 0, 'Như mới',    'Thủ Đức, TP.HCM'),
  ( 5, 5, 2, 'Laptop Lenovo ThinkPad T14', 'Laptop dùng cho học tập, bàn phím tốt, pin ổn và có sạc đi kèm.', 8900000, 'Tốt',         'Quận Gò Vấp, TP.HCM'),
  ( 6, 1, 2, 'Chuột Logitech không dây', 'Chuột kết nối ổn định, có đầu USB và đã vệ sinh sạch sẽ.',       180000, 'Như mới',          'Quận 10, TP.HCM'),
  ( 7, 2, 2, 'Bàn phím cơ Keychron K2', 'Bàn phím đầy đủ phụ kiện, dùng học lập trình và gõ văn bản.',       950000, 'Tốt',             'Quận 3, TP.HCM'),
  ( 8, 3, 2, 'Tai nghe chụp tai Sony', 'Tai nghe nghe rõ, đệm tai còn tốt, phù hợp học trực tuyến.',         420000, 'Đã qua sử dụng', 'Quận 5, TP.HCM'),
  ( 9, 4, 3, 'Bàn học gỗ nhỏ gọn', 'Bàn học chắc chắn, kích thước phù hợp phòng trọ hoặc ký túc xá.',       550000, 'Tốt',             'Thủ Đức, TP.HCM'),
  (10, 5, 3, 'Ghế xoay học bài', 'Ghế xoay có tựa lưng, bánh xe hoạt động tốt và đã được vệ sinh.',           430000, 'Như mới',         'Quận Gò Vấp, TP.HCM'),
  (11, 1, 3, 'Đèn bàn LED chống chói', 'Đèn có nhiều mức sáng, hoạt động bình thường và tiết kiệm điện.',    160000, 'Tốt',            'Quận 10, TP.HCM'),
  (12, 2, 3, 'Kệ sách ba tầng', 'Kệ sách lắp ráp gọn, đủ ốc vít và phù hợp góc học tập nhỏ.',                 0, 'Đã qua sử dụng',  'Quận 3, TP.HCM'),
  (13, 3, 4, 'Áo khoác jean unisex', 'Áo khoác size M, màu xanh cơ bản, đã giặt sạch và không rách.',        190000, 'Tốt',            'Quận 5, TP.HCM'),
  (14, 4, 4, 'Balo laptop chống nước', 'Balo đựng vừa laptop 15 inch, khóa kéo tốt, còn nhiều ngăn.',       230000, 'Như mới',        'Thủ Đức, TP.HCM'),
  (15, 5, 4, 'Giày sneaker trắng size 39', 'Giày size 39, đế còn tốt, đã vệ sinh trước khi đăng bán.',       280000, 'Đã qua sử dụng','Quận Gò Vấp, TP.HCM'),
  (16, 1, 4, 'Áo sơ mi đi thực tập', 'Áo sơ mi màu trắng size L, vải dễ ủi và ít nhăn khi mặc.',              0, 'Tốt',             'Quận 10, TP.HCM'),
  (17, 2, 5, 'Bình giữ nhiệt 500ml', 'Bình giữ nhiệt nắp kín, dung tích 500ml, phù hợp mang đi học.',        100000, 'Như mới',        'Quận 3, TP.HCM'),
  (18, 3, 5, 'Xe đạp mini đi học', 'Xe đạp đã bảo dưỡng phanh và lốp, chạy tốt quãng đường gần.',          1300000, 'Đã qua sử dụng','Quận 5, TP.HCM'),
  (19, 4, 5, 'Bộ dụng cụ vẽ cơ bản', 'Bộ có bút chì, tẩy và thước, phù hợp cho môn vẽ kỹ thuật.',            145000, 'Tốt',            'Thủ Đức, TP.HCM'),
  (20, 5, 5, 'Nồi cơm điện mini', 'Nồi cơm điện loại nhỏ cho phòng trọ, hoạt động ổn định và dễ vệ sinh.',    300000, 'Như mới',       'Quận Gò Vấp, TP.HCM')
)
INSERT INTO products
  (id, user_id, seller_id, category_id, title, description, price, condition, type,
   status, location, university, view_count, created_at, updated_at, moderation_status)
SELECT
  ('d3a1c200-0000-4000-8000-' || lpad(sample.n::text, 12, '0'))::uuid,
  seller.id, seller.id, sample.category_id, sample.title, sample.description,
  sample.price, sample.condition, CASE WHEN sample.price = 0 THEN 'Exchange' ELSE 'Sell' END,
  'Active', sample.location, seller.university, 0,
  NOW() - ((21 - sample.n) * INTERVAL '1 hour'), NOW(), 'APPROVED'
FROM sample
JOIN users AS seller ON seller.id = ('d3a1c100-0000-4000-8000-' || lpad(sample.seller_no::text, 12, '0'))::uuid
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_images (id, product_id, image_url, is_primary, sort_order, created_at)
SELECT
  ('d3a1c300-0000-4000-8000-' || right(product.id::text, 12))::uuid,
  product.id,
  CASE product.category_id
    WHEN 1 THEN '/sample/hoc-tap.svg'
    WHEN 2 THEN '/sample/cong-nghe.svg'
    WHEN 3 THEN '/sample/noi-that.svg'
    WHEN 4 THEN '/sample/thoi-trang.svg'
    ELSE '/sample/khac.svg'
  END,
  TRUE, 1, NOW()
FROM products AS product
WHERE product.id::text LIKE 'd3a1c200-0000-4000-8000-%'
ON CONFLICT (id) DO NOTHING;

COMMIT;

SELECT COUNT(*) AS sample_products FROM products WHERE id::text LIKE 'd3a1c200-0000-4000-8000-%';
