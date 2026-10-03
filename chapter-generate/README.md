# Chuseoz — Bộ soạn truyện chat cho Blogger

Viết truyện dạng hội thoại (mỗi dòng một lời thoại `Tên: nội dung`), xem trước bong bóng
chat theo thời gian thực, rồi xuất ra **một đoạn HTML** dán thẳng vào bài Blogspot — hoặc
xuất Word / Markdown / văn bản thô.

**Một file HTML duy nhất, không cần máy chủ, không cần cài đặt.** Tải `dist/index.html` về,
mở bằng trình duyệt là dùng được.

---

## Chạy thử

```bash
cd chapter-generate
npm install
npm run dev        # mở http://localhost:5173
```

## Build

```bash
npm run build      # → dist/index.html (một file duy nhất, đã inline CSS + JS)
```

`vite-plugin-singlefile` gộp toàn bộ CSS/JS vào `index.html`, nên sản phẩm cuối vẫn là
**một file** — giữ đúng đặc tính "tải về là chạy" của bản gốc.

## Kiểm tra

```bash
npm test           # vitest — 100 test
npm run lint       # eslint
npm run check      # lint + test + build (đúng thứ CI chạy)
```

Test quan trọng nhất là `test/app.smoke.test.js` và `test/interaction.test.js`: chúng nạp
**chính phần `<body>` của `index.html`** vào happy-dom rồi import `src/app.js` và bấm nút
thật. Nếu có phần tử nào bị đổi id mà code chưa cập nhật, test sẽ báo.

---

## Cấu trúc

```
chapter-generate/
├─ index.html              # vỏ HTML + script chọn theme chạy trước CSS (chống chớp trắng)
├─ src/
│  ├─ main.js              # entry: nạp CSS rồi khởi động app
│  ├─ app.js               # render + nối sự kiện (phần có trạng thái)
│  ├─ lib/                 # hàm thuần, không đụng DOM state → kiểm thử được
│  │  ├─ parser.js         #   nhận diện "Tên: thoại", (Nhãn dán: X), <b>/<i>
│  │  │                    #   (kèm contenteditable ⇄ văn bản: editorToText/textToEditorHtml)
│  │  ├─ images.js         #   token [[IMG:id]], nén ảnh, lọc src độc hại
│  │  ├─ blogHtml.js       #   sinh CSS + HTML bài Blogger
│  │  ├─ docx.js           #   tự dựng file .docx (CRC32 + ZIP + OOXML), không thư viện
│  │  ├─ markdown.js       #   xuất .md / .txt
│  │  ├─ store.js          #   localStorage an toàn (fallback bộ nhớ nếu bị chặn)
│  │  ├─ history.js        #   undo/redo cấp ứng dụng
│  │  ├─ search.js         #   tìm & thay thế (đúng cả tiếng Việt có dấu)
│  │  ├─ richText.js       #   in đậm/nghiêng bằng Range API (không dùng execCommand)
│  │  ├─ idb.js            #   IndexedDB cho lịch sử phiên bản
│  │  └─ diagnostics.js    #   nhật ký lỗi + xuất báo cáo chẩn đoán
│  ├─ ui/
│  │  ├─ modal.js          #   modal có focus trap + confirmDialog/choiceDialog
│  │  ├─ toast.js          #   thông báo + copy clipboard
│  │  └─ theme.js          #   sáng / tối / theo hệ thống
│  └─ styles/app.css
└─ test/                   # vitest
```

Nguyên tắc: **`lib/` không biết gì về trạng thái app** → mọi hàm ở đó đều test được mà
không cần dựng UI.

---

## Cú pháp truyện

| Gõ | Kết quả |
|---|---|
| `Tên: lời thoại` | Bong bóng chat. Tên có trong *Nhân vật bên phải* → bubble phải, còn lại → trái |
| `(Nhãn dán: Tên)` | Một dòng riêng cho sticker |
| Dòng trống | Khoảng cách giữa các đoạn |
| `<b>đậm</b>` `<i>nghiêng</i>` | Giữ nguyên khi xuất (Ctrl+B / Ctrl+I) |
| Ctrl+V / kéo–thả ảnh | Ảnh được nén rồi lưu **tách khỏi văn bản**, ô nội dung chỉ giữ token ngắn |

## Phím tắt

`Ctrl+K` bảng lệnh · `Ctrl+F` tìm & thay thế · `Ctrl+Enter` tạo mã HTML · `Ctrl+S` lưu ·
`Ctrl+Z` / `Ctrl+Shift+Z` hoàn tác · `F9` chế độ tập trung · `?` bảng phím tắt ·
`Ctrl+B` / `Ctrl+I` định dạng trong ô nội dung.

## Dữ liệu lưu ở đâu

| Thứ | Nơi lưu |
|---|---|
| Truyện, chương, ảnh (base64) | `localStorage` — khoá `chuseoz_saved_story_projects_v1` (~5MB) |
| Lịch sử phiên bản (25 bản) | `IndexedDB` — database `chuseoz` |
| Giao diện, tuỳ chọn | `localStorage`, các khoá `chuseoz_*` |

Không có gì được gửi đi đâu, trừ khi bạn tự bật đồng bộ Google Drive trong menu ⋯.
Khi gần đầy bộ nhớ, app **tự nén ảnh ngầm** (không hỏi). Muốn chủ động: menu ⋯ →
*Nén ảnh ngay*, hoặc *Tải backup (.json)*.

## Đồng bộ Google Drive

Menu ⋯ → *Cài đặt Drive…* → dán link Apps Script Web App + mã đồng bộ. Từ đó mọi thay đổi
tự đẩy lên Drive (debounce 1,8 giây). Nếu Drive đang giữ bản **mới hơn** lần đồng bộ cuối
của máy này (ví dụ bạn sửa ở máy khác), app sẽ **hỏi trước khi ghi đè** thay vì âm thầm
làm mất dữ liệu.
