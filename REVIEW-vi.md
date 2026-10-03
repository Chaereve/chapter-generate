# Chuseoz — Rà soát giao diện & hệ thống

> ## ✅ ĐÃ XỬ LÝ XONG trong bản 3.0.0 (2026-10-03)
>
> Toàn bộ mục **P0** và phần lớn **P1** trong tài liệu này đã được sửa. Chi tiết từng dòng
> nằm ở **`chapter-generate/CHANGELOG.md`**. Tóm tắt:
>
> | Vấn đề nêu bên dưới | Trạng thái | Bằng chứng |
> |---|---|---|
> | Hai codebase, `src/` React chết | ✅ Đã xóa React, tách `index.html` thành module ES | `npm run build` → *20 modules transformed*, 138.85 kB một file |
> | `#storyTitle:focus{background:#fff}` | ✅ → `var(--card)` | `src/styles/app.css:78` |
> | 5 cặp màu dưới chuẩn AA | ✅ Đã đổi + **có test khóa lại** | `test/output.test.js` (test tương phản) |
> | Preview không mở dưới 1280px | ✅ Ngưỡng còn 1024px | `src/app.js` — `init()` |
> | 4 chỗ `confirm()` gốc | ✅ → `confirmDialog` / `choiceDialog` | `grep -c "confirm(" src/app.js` = 0 |
> | A11y (aria, label, focus trap) | ✅ | `test/interaction.test.js` (2 test a11y) |
> | `document.execCommand` | ✅ → `src/lib/richText.js` (Range API) | 19 test |
> | Lỗ hổng `javascript:` trong `<img src>` | ✅ `imageSrcOf` lọc giao thức | `test/output.test.js` |
> | Đồng bộ Drive ghi đè im lặng | ✅ Phát hiện xung đột, hỏi trước | `checkCloudConflict()` |
> | Không test / lint / CI | ✅ 100 test + ESLint + GitHub Actions | `npm run check` |
> | Không README / CHANGELOG | ✅ Đã viết | `chapter-generate/README.md` |
> | Version hardcode | ✅ Đọc từ `package.json` qua Vite `define` | `src/lib/store.js` |
> | Thư mục tên có dấu cách | ✅ `chapter generate/` → `chapter-generate/` | `git status` |
> | Undo/Redo, tìm kiếm, kéo-thả, palette… | ✅ Đã thêm | `CHANGELOG.md` → *Tính năng mới* |
>
> **Còn để ngỏ (P2):** chuyển ảnh sang IndexedDB để bỏ hẳn trần 5MB (hiện IndexedDB mới chỉ
> dùng cho lịch sử phiên bản — cơ chế tự nén ảnh vẫn còn), PWA/service worker, i18n,
> xuất PDF/EPUB.
>
> ---
> *Phần dưới đây là bản rà soát gốc, giữ lại để đối chiếu.*


Ngày rà soát: 2026-10-03 · Nhánh: `arena/01a1016c-chapter-generate` · Commit gốc: `3efa7db`

Mọi số liệu bên dưới đều lấy từ lệnh đã chạy trên repo này (số dòng là số dòng thật trong
`chapter generate/index.html`).

---

## 0. Bối cảnh — phát hiện quan trọng nhất trước tiên

Repo đang chứa **hai ứng dụng**, và chỉ một trong hai được chạy:

| | Đường dẫn | Số dòng | Trạng thái |
|---|---|---|---|
| App thật | `chapter generate/index.html` | **2.348** (68 function toàn cục) | Đang được serve |
| App React | `chapter generate/src/**` | **1.957** (TS/React) | **Code chết — không được build** |

Bằng chứng:

```
$ grep -c 'id="root"' index.html      → 0        # index.html không có <div id="root">
$ grep -n "main.tsx" index.html       → (rỗng)   # không import src/main.tsx
$ npm run build
  ✓ 2 modules transformed.                        # chỉ 2 module, không phải ~15 file src/
  dist/index.html  116.71 kB │ gzip: 34.43 kB
$ grep -c "react-dom\|createRoot" dist/index.html → 0
$ npm run typecheck  → exit 0                     # nhưng tsconfig chỉ "include": ["src", "vite.config.ts"]
```

Hệ quả cần biết:

1. `npm run typecheck` **pass nhưng vô nghĩa** với app thật — 2.348 dòng đang chạy không được
   TypeScript kiểm tra dòng nào.
2. `src/utils/story.ts` (249 dòng) và `src/utils/docx.ts` (252 dòng) **trùng logic** với
   `parseSmartLine` / `sideOf` / `buildPart2` / hàm DOCX trong `index.html`. Hai bản parser
   tách rời → sửa một nơi, nơi kia lệch.
3. Toàn bộ `react`, `react-dom`, `tailwind-merge`, `clsx`, `@tailwindcss/vite` trong
   `package.json` là phụ thuộc không dùng tới.

**Việc số 1 nên làm: quyết định giữ bản nào.** Xem mục 2.1.

---

## 1. Giao diện (UI / UX)

### 1.1 Lỗi thật, nên sửa ngay (P0)

**a) Ô tiêu đề bị trắng chói ở chế độ tối**

```css
/* index.html:97 */
#storyTitle:focus{outline:none;border-color:var(--accent);background:#fff}
```

`#fff` hardcode. Tôi đã kiểm tra khối `:root[data-theme="dark"]` — **0** rule ghi đè
`#storyTitle`. Ở dark theme, `--ink` là `#ece5d8` (chữ gần trắng) → vừa click vào ô tiêu đề
là **chữ sáng trên nền trắng = mất chữ**.

Sửa: `background:var(--card)`.

**b) Tương phản không đạt WCAG AA (4.5:1 cho chữ thường)**

Đo bằng công thức WCAG relative luminance trên đúng các cặp màu trong `index.html`:

| Cặp màu | Tỉ lệ | Kết luận | Đang dùng ở đâu |
|---|---|---|---|
| `--ink3 #a39a8b` / `--paper #f7f5f1` (light) | **2.55:1** | ❌ FAIL | `.section-label` 10.5px, `.si-meta` 11.5px, `#saveStatus` |
| `--ink3 #736a5c` / `--paper #161311` (dark) | **3.47:1** | ⚠️ chỉ đạt AA-large | như trên |
| `#fff` / `--accent #e0663f` (nút primary, dark) | **3.42:1** | ⚠️ chỉ đạt AA-large | `.btn-primary` — chữ 13px |
| `.msg b #d9534f` / `.msg.left #f1f0f0` | **3.48:1** | ⚠️ | **tên nhân vật trong bài Blogger đã xuất**, 10px uppercase |
| `.msg b #d9534f` / `.msg.right #e2e2e2` | **3.06:1** | ⚠️ | như trên |

Điểm nghiêm trọng nhất là dòng cuối: đó là **sản phẩm cuối cùng độc giả đọc**, tên nhân vật
10px uppercase tương phản 3:1 trên bong bóng chat. Nên đổi `.msg b` sang ~`#b03a35` (nền trái)
và ~`#a8342f` (nền phải).

Nhóm `--ink3` dùng cho nhãn 10.5px — chữ vừa nhỏ vừa mờ, đây là tổ hợp tệ nhất cho khả năng đọc.

**c) Preview không bao giờ mở trên màn hình < 1280px**

```js
// index.html:2241
state.previewOpen = store.getItem(KEY_PREVIEW) === "1" && window.innerWidth >= 1280;
```

Người dùng laptop 1366×768 phóng to 125%, hoặc iPad, **không bao giờ** thấy khung xem trước
dù đã bật và đã được lưu vào localStorage — và không có thông báo nào giải thích. Nên hạ
ngưỡng xuống ~1024px, hoặc bỏ điều kiện và để CSS lo (đã có rule `@media (max-width:1280px)`
biến preview thành panel nổi ở dòng 357).

**d) Nút "GỘP hay THAY THẾ" dùng confirm OK/Cancel — dễ mất dữ liệu**

```js
// index.html:2106
const useReplace = !confirm("Chọn OK = GỘP: ... \nChọn Hủy = THAY THẾ TOÀN BỘ danh sách ...");
```

Đây là quyết định phá huỷ dữ liệu nhưng giao diện là hộp thoại native với 2 nút
"OK"/"Cancel" không mô tả gì. Cần thay bằng modal tự vẽ (đã có sẵn `openModal()` ở dòng 1637)
với 2 nút đặt tên rõ: **"Gộp vào danh sách hiện có"** / **"Xoá hết và thay bằng file"**.

Tổng cộng 4 chỗ dùng `confirm()` gốc: dòng **1696, 1971, 2106, 2327** — tất cả đều lệch tông
với hệ thống modal/toast đã tự vẽ, và không theme được theo dark mode.

### 1.2 Khả năng truy cập (P1)

Đếm được trên toàn file: **10** thuộc tính `aria-*`, **2** `role`, **0** thẻ `<label for="...">`.

- **7/11 nút icon-only không có `aria-label`**, chỉ có `title`: `#railToggle`, và các nút
  `data-a="dup"/"del"` (rail), `data-t="up"/"down"/"dup"/"del"` (card chương). `title` là
  fallback yếu (không hiện trên cảm ứng, screen reader đọc không ổn định).
- **`<label>` không liên kết input** (`grep -c 'for="'` → 0). Nhãn "Nhân vật bên trái" /
  "Nhân vật bên phải" trong `chapterCard()` không trỏ vào input nào.
- **Ô soạn thảo `contenteditable`** có `role="textbox" aria-multiline="true"` nhưng **không có
  tên** (`aria-label`) → screen reader chỉ đọc "text box".
- **Modal** (`openModal`, dòng 1637): có `role="dialog" aria-modal="true"` và bắt phím Escape,
  nhưng **không focus trap** (Tab thoát ra ngoài modal) và **không trả focus** về nút đã mở.
- Không có `aria-live` cho vùng toast → thông báo "Đã tự lưu" không được đọc.
- Nút "Xem trước" (`#previewToggle`) đổi trạng thái bật/tắt nhưng không có `aria-pressed`.

### 1.3 Trải nghiệm soạn thảo (P1 → P2)

Những thứ một công cụ viết truyện dài cần mà hiện chưa có (đã grep xác nhận là chưa có):

| Thiếu | Bằng chứng | Đề xuất |
|---|---|---|
| **Undo/Redo cấp ứng dụng** | `renderChapters()` (dòng 1726) xoá `box.innerHTML = ""` rồi dựng lại **toàn bộ** card mỗi lần đổi cấu trúc → mất selection và mất undo stack của contenteditable | Stack undo riêng (snapshot blocks, Ctrl+Z/Ctrl+Shift+Z) |
| **Tìm & thay thế trong truyện** | `grep -n "Tìm\|search\|Ctrl+F"` → 0 kết quả | Ctrl+F toàn truyện, highlight + nhảy giữa các kết quả |
| **Kéo-thả sắp xếp chương** | chỉ có nút ▲▼ (`data-t="up"/"down"`) | Drag handle; truyện 30 chương hiện phải bấm ~30 lần để dời 1 chương lên đầu |
| **Bảng phím tắt / command palette** | phím tắt có (Ctrl+Enter, Ctrl+S, Ctrl+B, Ctrl+I) nhưng **không có chỗ nào liệt kê** | Ctrl+K palette + overlay `?` |
| **Lịch sử phiên bản** | chỉ có 1 bản ghi trong localStorage | Snapshot 10–20 bản gần nhất, khôi phục được |
| **Focus mode** | rail + preview luôn chiếm chỗ | Ẩn hết, chỉ còn cột soạn (đã có sẵn cơ chế collapse rail) |
| **Bộ chọn nhãn dán (sticker)** | phải gõ tay `(Nhãn dán: Tên)` | Picker có ảnh xem trước |
| **Theme "tự động"** | chỉ toggle sáng/tối (dòng 2205) | 3 lựa chọn: Sáng / Tối / Theo hệ thống |

Chi tiết nhỏ đáng sửa:

- **Phân cấp nút ở topbar chưa rõ**: "Xuất Word" dùng `.btn-ink` (nền `var(--ink)`) và
  "Tạo mã HTML" dùng `.btn-primary` — hai nút kề nhau đều đậm ngang nhau, không rõ đâu là
  hành động chính.
- **Preview không resize được** — `--preview-w` cố định 380/340/420px theo breakpoint.
- **Cỡ chữ**: body 14px nhưng rất nhiều nhãn 10.5px uppercase + `letter-spacing:1.4px`
  → nên nâng sàn lên 11.5–12px và giảm letter-spacing.
- **Empty state** (`#emptyState`) chỉ giải thích cú pháp — nên thêm 1 nút "Nạp truyện mẫu"
  để người mới thấy ngay kết quả.
- **Onboarding**: không có hướng dẫn lần đầu cho Drive/backup.

---

## 2. Hệ thống / Kiến trúc

### 2.1 P0 — Dọn hai-codebase

Chọn **một**:

- **(A) Xoá React.** Nếu quyết định giữ kiến trúc "một file, không phụ thuộc": xoá `src/`,
  gỡ `react`, `react-dom`, `@vitejs/plugin-react`, `@types/react*`, `tailwindcss`,
  `@tailwindcss/vite`, `clsx`, `tailwind-merge`, `vite-plugin-singlefile` khỏi
  `package.json` (giảm ~2.563 dòng `package-lock.json`). App thành HTML thuần, không cần build.
- **(B) Chuyển hẳn sang React/TS.** Vite + `vite-plugin-singlefile` **đã có sẵn** trong
  devDependencies → vẫn xuất ra **một file HTML duy nhất**, không mất đặc tính "tải về là chạy".
  Đổi lại được typecheck thật, component hoá, và `src/utils/docx.ts` (đã viết sẵn, 252 dòng)
  dùng lại được ngay.

Đề xuất: **(B)**, vì `src/utils/docx.ts` và `src/utils/story.ts` đã viết khá hoàn chỉnh —
công sức đã bỏ ra rồi, chỉ cần port phần UI.

Dù chọn hướng nào: **đừng giữ cả hai**, vì hai bản parser sẽ tiếp tục trôi ra xa nhau.

### 2.2 P0 — Tách module `index.html`

2.348 dòng / 68 function toàn cục / 1 scope. Ranh giới module đã có sẵn trong comment của
chính file đó, chỉ cần cắt theo:

```
core/parser.ts        parseLine, parseSmartLine, sideOf, escInline, inlineRunParts   (~dòng 882–950)
core/editor.ts        editorToText, textToEditorHtml, pasteHtmlToClean               (~dòng 953–990)
core/storage.ts       store, KEY_*, readProjects, writeProjects, persistNow          (~dòng 506–530, 1405–1480)
core/images.ts        compressImageSrc, collectStoredImages, maybeAutoShrink         (~dòng 606–880)
export/blogHtml.ts    buildPart1, buildPart2                                         (~dòng 994–1090)
export/docx.ts        crc32, zipStore, wRun, wPara, imageParagraph                   (~dòng 1093–1370)
cloud/drive.ts        cloudCfg, queueCloudPush, cloudPush, ingestBackupData           (~dòng 1484–1635)
ui/*                  renderRail, renderChapters, chapterCard, renderPreview, modal, toast
```

`core/parser.ts`, `export/blogHtml.ts`, `export/docx.ts` là **pure function** → tách ra là
test được ngay, không cần DOM.

### 2.3 P0 — Kiểm thử & CI (hiện hoàn toàn chưa có)

`package.json` scripts chỉ có: `dev`, `build`, `preview`, `typecheck`. **Không có test, không
có lint, không có format, không có GitHub Actions.**

Ưu tiên test (đều là pure function, viết rất nhanh):

- `parseSmartLine` — `"Wine: chào"`, `"(Nhãn dán: Lal)"`, dòng có `:` trong lời thoại,
  dòng không có tên, tên có dấu cách.
- `sideOf` — tên nằm/không nằm trong `rightChars`, phân biệt hoa thường, khoảng trắng.
- `editorToText` — `<b>`/`<i>` lồng nhau, `<br>`, ảnh `[[IMG:...]]`, `<div>` lồng.
- `buildPart2` — snapshot HTML đầu ra (chống hồi quy khi đổi CSS Blogger).
- **Test hồi quy XSS**: `<img src=x onerror=...>`, `<script>`, `javascript:` — hiện `escInline()`
  (dòng 926) escape rồi mới unescape `<b>`/`<i>` theo whitelist, nên **có vẻ an toàn**, nhưng
  chưa có test nào khoá hành vi đó lại.

CI đề xuất (`.github/workflows/ci.yml`): `npm ci` → `lint` → `typecheck` → `test` → `build`,
chạy trên mỗi PR. Chỉ có ý nghĩa **sau khi** làm 2.1/2.2.

### 2.4 P1 — Trần 5MB của localStorage (giới hạn lớn nhất của hệ thống)

```js
// index.html:715
const AUTO_SHRINK_AT = 3300000;   // vượt mức này là tự nén ngầm (~5MB là trần)
```

Toàn bộ ảnh đang nằm **base64 trong chuỗi `content`**, và mọi thứ nhét vào `localStorage`
(trần thực tế ~5MB). Hệ thống `maybeAutoShrink` + `SHRINK_LEVELS` (~200 dòng, dòng 712–880)
tồn tại chỉ để lách trần này — và chính comment trong code thừa nhận nhược điểm:

> *"mở lại trang không nén lại, không thông báo gì (nén lại chỉ làm ảnh mờ thêm)"*

Nghĩa là: người dùng càng viết nhiều, ảnh **càng mờ dần và không hồi phục được**.

Đề xuất, xếp theo độ lợi:

1. **Chuyển ảnh sang IndexedDB / Blob** (trần thực tế hàng trăm MB), `content` chỉ giữ
   `[[IMG:id]]` token → **xoá được gần như toàn bộ cơ chế auto-shrink**, ảnh giữ nguyên chất
   lượng gốc. Đây là thay đổi có tỉ lệ lợi/chi phí cao nhất trong cả tài liệu này.
2. Hoặc: tự upload ảnh (Blogger API / imgbb / Cloudflare R2) và chỉ giữ URL — nhưng cần
   backend và mất tính offline.
3. Nếu vẫn giữ localStorage: cho người dùng **xem trước + xác nhận** trước khi nén, và giữ
   bản gốc trong IndexedDB để "hoàn tác nén".

Kèm theo: `storageUsedBytes()` (dòng 681) và `JSON.stringify(toàn bộ projects gồm ảnh)` chạy
mỗi 400ms qua `saveProjects = debounce(..., 400)` → truyện nhiều ảnh sẽ giật khi gõ. Đo dung
lượng thưa hơn (ví dụ mỗi 5s) và lưu bất đồng bộ.

### 2.5 P1 — `document.execCommand` đã deprecated

5 chỗ đang dùng: dòng **588** (`copy`), **1806** (`bold`), **1807** (`italic`), **1848**
(`insertText`), **1863** (`insertHTML`).

Thay: `navigator.clipboard.writeText()` cho copy; với bold/italic thì tự bọc `<b>`/`<i>` qua
Range API (đã có sẵn `inlineRunParts` để làm việc với run). Chrome/Firefox vẫn còn hỗ trợ
`execCommand` nhưng có thể bỏ bất cứ lúc nào — đây là rủi ro "app tự nhiên hỏng".

### 2.6 P1 — Đồng bộ Drive: `no-cors` và xung đột

```js
// index.html ~1526
await fetch(U, { method: "POST", mode: "no-cors", body: new URLSearchParams({...}) });
```

- `mode:"no-cors"` → response là **opaque**, không đọc được. Code phải poll `action=status`
  3 lần (500/1000/1500ms) để đoán xem đã lưu chưa, và cuối cùng vẫn rơi vào nhánh
  `"Đã gửi · Drive chưa xác nhận"`. Nếu Apps Script cho phép CORS thì bỏ `no-cors` sẽ đơn
  giản hoá cả đoạn này.
- **Không có phát hiện xung đột**: 2 máy cùng ghi → bản ghi sau đè mất bản trước, im lặng.
  Cần thêm `updatedAt`/version vector và cảnh báo "Drive có bản mới hơn".
- **Không có retry khi offline** — mất mạng là lượt đẩy đó mất.
- `KEY_CLOUD_KEY` lưu plaintext trong localStorage. Nếu nội dung riêng tư: cân nhắc mã hoá
  AES-GCM phía client trước khi đẩy (khoá do người dùng đặt).

### 2.7 P2 — Dọn dẹp khác

| Vấn đề | Bằng chứng | Đề xuất |
|---|---|---|
| Tên thư mục có **dấu cách** | `chapter generate/` | đổi thành `chapter-generate/` — dấu cách gây lỗi trong script/CI/import |
| Metadata package sai | `"name": "react-vite-tailwind"`, `"version": "0.0.0"` | đặt `chuseoz-story-editor` + version thật |
| Version hardcode | `const CZ_VERSION = "2026-10-03 · bản 3";` (dòng 504) | inject từ `package.json` qua Vite `define` / `import.meta.env` |
| Không README / CHANGELOG | repo không có file nào | README: ảnh chụp, cách chạy, cách deploy Apps Script |
| Lỗi bị nuốt im lặng | `grep -c "catch (e) {}"` → **10** (trên tổng 26 `catch`) | tối thiểu `console.warn`; thêm nút "Xuất log chẩn đoán" trong menu ⋯ |
| Chưa phải PWA | đã là 1 file HTML | thêm `manifest.json` + service worker → cài được, chạy offline |
| `#storageWarn` chỉ hiện khi bị chặn storage | dòng 2229 | nên hiện cả khi dung lượng > 80% |

---

## 3. Thứ tự nên làm

**P0 — tuần này (rẻ, lợi cao)**

1. Sửa `#storyTitle:focus{background:#fff}` → `var(--card)` *(1 dòng, sửa bug mất chữ ở dark mode)*
2. Nâng `--ink3` và đổi màu `.msg b` trong `buildPart1()` *(sửa 5 cặp contrast không đạt AA)*
3. Thay `confirm()` ở dòng 2106 bằng modal 2 nút đặt tên rõ *(chống mất dữ liệu)*
4. Hạ ngưỡng preview `window.innerWidth >= 1280` xuống ~1024
5. Quyết định số phận `src/` — xoá hoặc port (mục 2.1)

**P1 — 2–4 tuần**

6. Tách `index.html` thành module theo mục 2.2
7. Vitest cho `parseSmartLine` / `sideOf` / `editorToText` / `buildPart2` + test XSS
8. GitHub Actions: lint + typecheck + test + build
9. Chuyển ảnh sang IndexedDB → gỡ cơ chế auto-shrink (mục 2.4)
10. Undo/Redo + Tìm kiếm + kéo-thả sắp xếp chương
11. Bổ sung `aria-label`, `label for`, focus trap cho modal

**P2 — khi rảnh**

12. Bỏ `document.execCommand` · 13. Command palette (Ctrl+K) · 14. Lịch sử phiên bản ·
15. PWA + manifest · 16. Xuất Markdown/PDF/EPUB · 17. Xung đột Drive + mã hoá ·
18. README + CHANGELOG

---

## Phụ lục — lệnh đã chạy để lấy số liệu

```bash
cd "chapter generate"
wc -l index.html                                   # 2348
find src -name '*.ts*' | xargs wc -l | tail -1     # 1957
grep -c 'id="root"' index.html                     # 0
grep -c "react-dom\|createRoot" dist/index.html    # 0
npm run build                                      # ✓ 2 modules transformed, 116.71 kB
npm run typecheck                                  # exit 0
grep -c "aria-" index.html                         # 10
grep -c 'for="' index.html                         # 0
grep -c "catch (e) {}" index.html                  # 10
grep -n "confirm(" index.html                      # 1696, 1971, 2106, 2327
grep -n "execCommand" index.html                   # 588, 1806, 1807, 1848, 1863
grep -n "AUTO_SHRINK_AT = " index.html             # 715  (3300000)
grep -n "innerWidth >= 1280" index.html            # 2241   (lưu ý: innerWidth viết hoa chữ W)
grep -o 'class="iconbtn"' index.html | wc -l       # 11
grep -o 'class="iconbtn"[^>]*aria-label' index.html | wc -l   # 4  → 7 nút thiếu aria-label
grep -c 'role=' index.html                         # 2  (dialog + textbox)
```

Contrast ratio tính theo công thức WCAG 2.1 relative luminance trên đúng mã màu khai báo
trong `index.html`.
