# UI components

Ứng dụng Next.js nằm trong `frontend/`, đã có TypeScript 5, Tailwind CSS 4 (PostCSS) và alias `@/*` trỏ vào thư mục này. Không cần tạo project hoặc cài lại Tailwind/TypeScript.

- Component nghiệp vụ: `frontend/components/`.
- Component UI tái sử dụng/registry: `frontend/components/ui/`, import bằng `@/components/ui/...`. Thư mục này giúp dùng cùng đường dẫn mà shadcn/Skiper đề xuất, tách các khối UI khỏi nghiệp vụ và tránh sửa nhầm component cùng tên.
- CSS toàn cục: `frontend/app/globals.css`; các phần giao diện có stylesheet riêng được import tại root layout.

Footer dùng chung tại `components/Footer.tsx`. Hiệu ứng đám đông phía dưới footer đã được gỡ theo yêu cầu ngày 29/10/2026, cùng component, CSS, sprite và kiểm thử dành riêng cho hiệu ứng đó.

## shadcn CLI khi cần thêm các component khác

Project chưa khởi tạo đầy đủ bộ theme/CLI shadcn. Không chạy init tự động để tránh ghi đè theme SangTay. Nếu muốn bổ sung shadcn sau này, chạy từ thư mục `frontend`:

```sh
npx shadcn@latest init
```

Chọn TypeScript, khai báo CSS `app/globals.css`, alias component `@/components`, UI `@/components/ui` và kiểm tra diff trước khi chấp nhận thay đổi theme. Tailwind 4 đang dùng `@import "tailwindcss"`, không cần tạo cấu hình Tailwind 3. Sau khi init hoàn tất có thể dùng `npx shadcn@latest add button`.

## Robot Spline 3D

`components/ui/splite.tsx` xuất `SplineScene`, sử dụng `@splinetool/react-spline` và `@splinetool/runtime`. `components/RobotWidget.tsx` chỉ hiển thị robot nền trong suốt ở góc trái dưới, có nút thu gọn/tạm dừng; không dùng Card, Spotlight hoặc Framer Motion của demo. CSS tại `app/robot-widget.css`. Bộ khung shadcn, Tailwind và TypeScript áp dụng như trên; hai dependency Spline đã có trong package-lock.

Scene do người dùng cung cấp: https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode, lưu tại `public/scenes/robot.splinecode`. Widget trì hoãn tải WebGL sau nội dung trang, giữ lựa chọn thu gọn trong sessionStorage, tạm dừng khi tab bị ẩn hoặc người dùng chọn giảm chuyển động. React Spline tự dispose runtime khi thu gọn/rời widget. Khi không tải được scene/WebGL, error boundary giữ phần còn lại của website hoạt động. Không hiển thị trong trang Admin.

Scene được chỉnh ngày 21/10/2026 để hai tay giữ tư thế tự nhiên: bỏ các sự kiện Start/Transition độc lập trên `arm`, `elbow`, `forearm` và mesh `Hand`; giảm góc Z của state `Hand LEFT` còn 12°. Instance tay đối xứng dùng chung component nên nhận cùng bản sửa. Giữ nguyên hình học, vật liệu, camera và LookAt của đầu/thân. Widget dùng query `v=arms-2` để trình duyệt tải bản scene đã sửa. Khi xuất lại scene gốc từ Spline, cần áp dụng lại chỉnh sửa khớp tay và đổi phiên bản URL nếu thay đổi asset.

Hai tệp WASM dựng hình (`bevel.wasm`, `process.wasm`) được sao chép nguyên bản từ package runtime vào `public/spline-runtime/2.0.95/`. Runtime được pin đúng `2.0.95` để các tệp tương thích; khi nâng phiên bản cần cập nhật cả dependency, thư mục WASM và `wasmPath` trong component. Chuyển động của scene nhận con trỏ toàn trang, nhưng canvas không chặn click trên sản phẩm.
