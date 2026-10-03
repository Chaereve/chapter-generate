# Nhật ký thay đổi

## 3.0.1 — 2026-10-03

### Sửa
- **Hoàn tác việc đổi tên thư mục** `chapter generate/` → `chapter-generate/`.
  Dự án Cloudflare Pages `chuseoz-chapter` trỏ **Root directory** vào đúng đường dẫn
  `chapter generate` (thiết lập nằm ở dashboard, repo không có file cấu hình Cloudflare).
  Việc đổi tên ở commit `c8f5f14` làm check **"Cloudflare Pages" = 🚫 Build failed** vì
  Cloudflare không tìm thấy thư mục gốc. Đã đổi lại tên cũ và ghi chú trong README +
  `.github/workflows/ci.yml` để không ai đổi lại lần nữa.
- **GitHub Actions chưa từng chạy**: trigger cũ là `push: branches: [main]` + `pull_request`,
  nên đẩy lên nhánh làm việc không kích hoạt gì. Đổi thành `on: [push, pull_request]`.

## 3.0.0 — 2026-10-03

### Kiến trúc
- **Tách `index.html` 2.348 dòng thành module ES**: `src/lib/*` (hàm thuần), `src/ui/*`
  (modal, toast, theme), `src/app.js` (render + sự kiện). Sản phẩm build vẫn là **một file
  HTML duy nhất** nhờ `vite-plugin-singlefile`.
- **Xóa app React/TS chết** (`src/App.tsx`, `src/components/**`, `src/utils/**`, 1.957 dòng).
  Bản này không được build: `npm run build` cũ chỉ ra "2 modules transformed" và
  `dist/index.html` không chứa `react-dom`. Gỡ luôn `react`, `react-dom`, `@vitejs/plugin-react`,
  `tailwindcss`, `@tailwindcss/vite`, `clsx`, `tailwind-merge`, `typescript`.
- Thêm **ESLint**, **Vitest** (100 test), **GitHub Actions**. Bỏ `tsconfig.json` (hết TypeScript),
  đổi `vite.config.ts` → `vite.config.js`.
- Phiên bản đọc từ `package.json` qua Vite `define`, không hardcode `CZ_VERSION` nữa.

### Sửa lỗi
- **Ô tiêu đề mất chữ ở chế độ tối**: `#storyTitle:focus` hardcode `background:#fff` trong khi
  chữ là `#ece5d8`. Đổi sang `var(--card)`.
- **5 cặp màu không đạt WCAG AA** (đo bằng công thức relative luminance):
  - `--ink3` sáng `#a39a8b` → `#786f61` (2.55:1 → 4.54:1)
  - `--ink3` tối `#736a5c` → `#948a79` (3.47:1 → 5.43:1)
  - nút primary tối: chữ trắng trên `#e0663f` = 3.42:1 → dùng biến `--accent-btn:#c2522e` (4.63:1)
  - `#storeMeter.warn #c98a2d` (2.56:1) → `--warn-strong` (`#8a5c0d` / `#d19a3d`)
  - **tên nhân vật trong bài Blogger đã xuất** `.msg b #d9534f` = 3.48:1 / 3.06:1
    → `#a8302a` (5.92:1 / 5.19:1). Có test khóa lại giá trị này.
- **Khung xem trước không bao giờ mở dưới 1280px** → hạ ngưỡng còn 1024px.
- **4 chỗ dùng `confirm()` gốc** (dễ mất dữ liệu, không theme được) → `confirmDialog()` /
  `choiceDialog()` tự vẽ. Riêng chỗ "GỘP hay THAY THẾ" backup nay là 2 nút đặt tên rõ,
  kèm xác nhận lần hai khi chọn thay toàn bộ.
- **Lỗ hổng `javascript:` trong `<img src>`**: `imageSrcOf()` trả về `src` đã lưu trong
  `block.images` mà không kiểm tra giao thức. Nay mọi src phải khớp `https?:` hoặc `data:image/`;
  token ảnh bị loại sẽ bị bỏ hẳn dòng thay vì rò URL ra dưới dạng chữ.
- `document.execCommand("bold"/"italic"/"insertText"/"insertHTML"/"copy")` (đã deprecated)
  → Range API (`src/lib/richText.js`) và `navigator.clipboard`.
- Lỗi không còn bị nuốt im lặng: `src/lib/diagnostics.js` ghi 200 mục gần nhất, có nút
  *Xuất báo cáo chẩn đoán* trong menu ⋯.
- Đồng bộ Drive: **phát hiện xung đột** — nếu Drive giữ bản mới hơn lần đẩy cuối của máy này
  thì hỏi trước khi ghi đè (trước đây ghi đè im lặng).
- `cloudPush` không còn chồng lượt khi đang đẩy dở.

### Layout
- Thanh thao tác cố định dưới màn hình cho mobile (≤920px) — trước đây phải với lên topbar.
- **Chế độ tập trung** (`F9`): ẩn thanh bên + khung xem trước, chỉ còn trang viết.
- **Kéo giãn khung xem trước** bằng chuột (>1280px), nhớ bề rộng đã chọn.
- Nâng sàn cỡ chữ nhãn nhỏ 10.5px → 11px; `.pv-msg .pv-name` 9.5px → 10.5px.
- Bong bóng thoại trong bài xuất: `max-width` 70% → 78%, chữ 14px → 15px.

### Tính năng mới
- **Undo/Redo cấp ứng dụng** (`Ctrl+Z` / `Ctrl+Shift+Z`) — snapshot danh sách chương,
  khôi phục được cả chương đã xóa, giữ nguyên ảnh theo id.
- **Tìm & thay thế toàn truyện** (`Ctrl+F`), có đánh dấu kết quả, tùy chọn phân biệt
  hoa thường / cả từ (đúng với tiếng Việt có dấu nhờ `\p{L}`).
- **Bảng lệnh** (`Ctrl+K`): mọi hành động + nhảy tới từng chương.
- **Kéo–thả sắp xếp chương** (ngoài nút ▲▼ có sẵn).
- **Dàn bài chương** trong thanh bên (tab *Chương*) kèm số ký tự mỗi chương.
- **Thanh thống kê**: số chương, ký tự, từ, phút đọc, số ảnh.
- **Thu gọn/mở rộng từng chương**.
- **Giao diện 3 chế độ**: sáng / tối / theo hệ thống (bản cũ chỉ bật-tắt).
- **Bộ chọn nhãn dán** thay vì gõ tay `(Nhãn dán: Tên)`, thêm nhãn dán riêng được.
- **Xuất Markdown (.md)** và **văn bản thô (.txt)**.
- **Lịch sử phiên bản**: tự sao lưu mỗi 5 phút vào IndexedDB, giữ 25 bản, khôi phục được.
- **Bảng phím tắt** (`?`).
- **Truyện mẫu** để người mới thấy ngay kết quả.

### Khả năng truy cập
- Modal có **focus trap** (Tab không thoát ra ngoài) và **trả focus** về nút đã mở.
- Thêm `aria-label` cho 7/11 nút icon-only còn thiếu; `aria-expanded` cho burger/menu/toggle;
  `aria-pressed` cho các nút bật-tắt; `role="tablist"/"tab"/"tabpanel"` cho hai ngăn thanh bên.
- Mọi `<label>` nay có `for` trỏ tới input (trước đây `grep -c 'for="'` = 0). Có test khóa lại.
- `role="status" aria-live="polite"` cho toast, trạng thái lưu và bộ đếm kết quả tìm kiếm.
- Ô `contenteditable` có `aria-label` + `aria-describedby`; thêm link "Bỏ qua, tới nội dung".
- Nút xóa chương/truyện đọc rõ đang xóa cái gì.

### Kiểm thử
100 test, gồm: parser, `editorToText`, sinh HTML Blogger (kèm test XSS và test tương phản),
dựng file .docx (CRC32/ZIP/OOXML), undo/redo, tìm & thay thế, xuất Markdown, in đậm/nghiêng
bằng Range API, và **test tương tác thật** (nạp `<body>` của `index.html` vào happy-dom rồi
bấm nút, gõ phím, kiểm tra localStorage).
