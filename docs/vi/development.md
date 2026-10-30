# Phát triển & Kiểm thử

**Tiếng Việt** · [English](../en/development.md) · [Mục lục tài liệu](../README.md)

Tài liệu này hướng dẫn cách thiết lập môi trường phát triển cục bộ, thực thi các bộ kiểm thử tự động, tạo tài nguyên ảnh chụp và đóng gói tiện ích.

---

## Yêu cầu môi trường

- **Node.js:** Phiên bản 20.x trở lên (hệ thống CI trên GitHub Actions chạy trên Node.js 22).
- **Python:** Phiên bản 3.9 trở lên (dùng cho công cụ đóng gói và kiểm tra liên kết tài liệu).
- **Google Chrome:** Bản cài đặt Chrome trên máy tính.
  - **macOS:** Mặc định tự động nhận diện tại `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
  - **Linux / Windows:** Cần đặt biến môi trường `MEETSCRIBE_TEST_CHROME` trỏ đến tệp thực thi của Chrome hoặc tệp Chromium do Playwright quản lý.
- **Playwright:** Trình duyệt Chromium phục vụ việc chạy các bài kiểm thử tích hợp không đầu.

---

## Thiết lập môi trường ban đầu

1. **Sao chép kho mã nguồn:**
   ```bash
   git clone https://github.com/b-ai-iot/MeetScribe.git
   cd MeetScribe
   ```

2. **Cài đặt các gói phụ thuộc phát triển:**
   ```bash
   npm ci
   ```

3. **Cài đặt trình duyệt Playwright Chromium:**
   ```bash
   npx playwright install chromium
   ```
   *(Trên hệ điều hành Linux, cần cài thêm các thư viện hệ thống: `npx playwright install --with-deps chromium`).*

---

## Thực thi các bộ kiểm thử tự động

MeetScribe duy trì quy trình kiểm thử nhiều tầng gồm: unit test thuật toán, tích hợp DOM trong Chrome thật, vòng đời worker tiện ích unpacked và xác thực tệp nhị phân ZIP.

### 1. Kiểm thử đơn vị (`npm test`)
Sử dụng bộ chạy kiểm thử tích hợp sẵn của Node.js cho toàn bộ các tệp `tests/*.test.mjs`:
```bash
npm test
```
- **Phạm vi (75 bài kiểm thử tại mốc ngày 2026-10-30):** Thuật toán chấm điểm ứng viên phụ đề, bộ lọc loại trừ (chat, danh sách người họp, thanh công cụ), gom cụm widget, kiểm tra độ mờ (opacity) và chuỗi tổ tiên hiển thị, truy vấn phân vùng IndexedDB không quét toàn bộ cơ sở dữ liệu, và giới hạn kích thước con trỏ đóng gói ZIP.

### 2. Kiểm thử trình duyệt tích hợp (`npm run test:browser`)
Khởi tạo một phiên Google Chrome thật hoàn toàn độc lập để chạy kịch bản DOM tự động trong `tests/browser.cjs`:
```bash
npm run test:browser
```
- **Phạm vi (22 bài kiểm thử tại mốc ngày 2026-10-30):** Thao tác trên handle OPFS thật, hủy giao dịch nguyên tử khi gặp lỗi `DataCloneError`, hiển thị lỗi giao diện thư viện, định tuyến lưu Save As, và cấp lại quyền cho thư mục cục bộ của phiên cũ.
- **Thiết lập đường dẫn Chrome (Linux / Windows / CI):**
  ```bash
  export MEETSCRIBE_TEST_CHROME="$(node -e 'const { chromium } = require("playwright"); console.log(chromium.executablePath())')"
  npm run test:browser
  ```

### 3. Kiểm thử tiện ích thực tế (`npm run test:extension`)
Mở Playwright với tiện ích unpacked được nạp thật qua cờ `--load-extension=extension/`:
```bash
npm run test:extension
```
- **Phạm vi:** Nạp trang mô phỏng Google Meet và iframe Zoom PWA, kiểm tra chèn thanh nổi, thử tải gói nhị phân 1 MiB không nén giả, và dùng module `zipfile` của Python để giải nén kiểm tra mã CRC và hiển thị tiếng Việt UTF-8.

### 4. Kiểm tra liên kết tài liệu (`npm run docs:check`)
Kiểm tra tính toàn vẹn của toàn bộ liên kết tương đối trong tài liệu, đường dẫn ảnh và tính tương đồng giữa hai ngôn ngữ:
```bash
npm run docs:check
```

### 5. Tạo ảnh chụp giao diện chuẩn hóa (`npm run docs:screenshots`)
Tự động tạo các ảnh chụp giao diện với dữ liệu mô phỏng đồng nhất phục vụ tài liệu:
```bash
npm run docs:screenshots
```

---

## Đóng gói tiện ích (`npm run package`)

Để tạo gói phân phối chuẩn cho tiện ích:
```bash
npm run package
```
Tập lệnh (`tools/package.py`) sẽ kiểm tra tính hợp lệ của manifest và tạo tệp:
```text
dist/MeetScribe-1.3.0.zip
```
Bên trong tệp nén là thư mục `MeetScribe/` độc lập chứa đầy đủ `manifest.json`, worker nền, các tệp script giao diện và thư mục biểu tượng `icons/`.

---

## Tiêu chuẩn kỹ thuật & Triết lý mã nguồn

1. **Không sử dụng thư viện chạy ngoài (Zero Runtime Dependencies):**
   - Bản tiện ích sử dụng không có **bất kỳ** thư viện bên ngoài nào (`node_modules` chỉ phục vụ kiểm thử và phát triển).
   - Toàn bộ tính năng được viết bằng ECMAScript Modules (`.mjs`) thuần, các Web API hiện đại (Shadow DOM, MutationObserver, IndexedDB, File System Access API) và biểu tượng SVG nội tuyến.

2. **Không qua bước biên dịch / đóng gói mã:**
   - Mã nguồn trong thư mục `extension/` chạy trực tiếp trên Chrome mà không cần Webpack, Vite hay Babel. Khi sửa đổi mã, bạn chỉ cần bấm Tải lại trên trang `chrome://extensions`.

3. **Tính trung thực của môi trường kiểm thử:**
   - Các bài kiểm thử tự động sử dụng trang HTML mô phỏng và handle OPFS chuẩn.
   - Hộp thoại chọn thư mục gốc của hệ điều hành (`window.showDirectoryPicker()`) và các thay đổi DOM trong cuộc họp thực tế vẫn cần được kiểm tra trực tiếp khi sử dụng.

## Windows PowerShell và kiểm tra thủ công

Các ví dụ `export` phía trên dùng shell POSIX. Với PowerShell:

```powershell
$env:MEETSCRIBE_TEST_CHROME = node -p "require('playwright').chromium.executablePath()"
npm run test:browser
```

Trước khi khẳng định thay đổi hoạt động trong thực tế, cần kiểm tra thủ công cuộc họp Meet/Zoom web đã bật phụ đề; bật/tắt/thay khung caption; cắt đúng vùng share thủ công; hủy hộp chọn thư mục mà vẫn giữ cấu hình cũ; chọn thư mục tùy ý; cấp lại quyền sau khi khởi động lại toàn bộ Chrome; và cứu ZIP sau lỗi xuất thông thường. Dùng nội dung giả lập và hồ sơ tạm. Ghi rõ đã kiểm tra gì, không chỉ tổng số test.

ZIP phân phối phần mềm có [giấy phép MIT](../../LICENSE) chuẩn. `private: true` trong package.json ngăn vô tình phát hành lên npm; không làm mã nguồn GitHub thành riêng tư.

## Kiểm thử ngôn ngữ

```sh
npm run test:language
```

Lệnh chạy kiểm tra UI/thanh nổi cùng bài chuyển VI/EN trên tiện ích unpacked. Trên Linux/Windows, đặt `MEETSCRIBE_TEST_CHROME` như trên. Unit test đối chiếu khóa VI/EN và các biến nội suy của bộ dịch.
