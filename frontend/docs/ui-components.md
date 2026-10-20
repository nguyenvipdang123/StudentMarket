# UI components

Ứng dụng Next.js nằm trong `frontend/`, đã có TypeScript 5, Tailwind CSS 4 (PostCSS) và alias `@/*` trỏ vào thư mục này. Không cần tạo project hoặc cài lại Tailwind/TypeScript.

- Component nghiệp vụ: `frontend/components/`.
- Component UI tái sử dụng/registry: `frontend/components/ui/`, import bằng `@/components/ui/...`. Thư mục này giúp dùng cùng đường dẫn mà shadcn/Skiper đề xuất, tách các khối UI khỏi nghiệp vụ và tránh sửa nhầm component cùng tên.
- CSS toàn cục: `frontend/app/globals.css`; CSS của đám đông: `frontend/app/footer-crowd.css`, import tại root layout.

`components/ui/skiper39.tsx` xuất `CrowdCanvas` và `Skiper39` (default). `FooterCrowd` tải component và GSAP khi người dùng đến gần cuối trang. `Footer` đặt hiệu ứng ngay sau thẻ `<footer>`, nên mọi trang đang dùng Footer đều có cùng hiệu ứng. Canvas dừng khi ra ngoài viewport, tab bị ẩn hoặc người dùng bấm tạm dừng; mặc định đứng yên nếu người dùng chọn giảm chuyển động. Khi rời trang, observer, ticker và timeline đều được dọn dẹp.

## shadcn CLI khi cần thêm các component khác

Project chưa khởi tạo đầy đủ bộ theme/CLI shadcn; riêng Crowd Canvas không cần Radix, `cn()` hoặc các dependency của shadcn. Không chạy init tự động để tránh ghi đè theme SangTay. Nếu muốn bổ sung shadcn sau này, chạy từ thư mục `frontend`:

```sh
npx shadcn@latest init
```

Chọn TypeScript, khai báo CSS `app/globals.css`, alias component `@/components`, UI `@/components/ui` và kiểm tra diff trước khi chấp nhận thay đổi theme. Tailwind 4 đang dùng `@import "tailwindcss"`, không cần tạo cấu hình Tailwind 3. Sau khi init hoàn tất có thể dùng `npx shadcn@latest add button`.

## Asset và attribution

Sprite gốc được người dùng cung cấp từ CDN 21st.dev, 3600×2268 px, 15 ô ngang × 7 ô dọc; lưu tại `public/illustrations/open-peeps-crowd.png` để hoạt động cùng origin và có thể kiểm thử offline. Không đưa ảnh người dùng vào thư mục này. Dependency animation: `gsap` (đã khóa trong package-lock).

Giữ credit hiển thị Skiper UI và Open Peeps theo điều kiện free version trong component gốc. Nguồn cảm hứng: https://codepen.io/zadvorsky/pen/xxwbBQV; tác giả component: @gurvinder-singh02, https://gxuri.me.
