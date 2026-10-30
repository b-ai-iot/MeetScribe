# Verification — MeetScribe 1.2.0 Usability & Export Repair Pass

Ngày: 2026-10-30. Nhánh `feat/usability-export`.
Phiên sửa đổi giám sát cuối cùng (final supervised repair pass) đã giải quyết toàn bộ các phát hiện còn tồn đọng từ `docs/superpowers/supervisor-review.md`.

## 1. Kết quả kiểm thử tự động & Số lượng

| Bộ kiểm thử | Lệnh thực thi | Kết quả | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Unit tests** | `npm test` | **61/61 PASS** (0 fail) | Chạy qua `node --test tests/*.test.mjs` (Node v20.19.5). Bao gồm kiểm thử hồi quy cho generic live ancestor, opacity/reacquisition, truy vấn IDBKeyRange không fallback scan toàn DB, và cursor giới hạn dung lượng trước khi nén ZIP. |
| **Browser tests** | `npm run test:browser` | **22/22 PASS** (0 fail) | Chạy qua `node tests/browser.cjs` với Google Chrome thật. Bao gồm: OPFS handle thật, từ chối DataCloneError nguyên tử giữ nguyên thư mục cũ, khôi phục thư mục phiên cũ độc lập với Downloads, kiểm thử lỗi UI thư viện (export-zip, retry, Save As, rename, delete), và kiểm thử con trỏ IndexedDB giới hạn kích thước tệp khi xuất ZIP. |
| **Extension Smoke** | `npm run test:extension` | **PASS** (Meet + Zoom PWA + ZIP) | Tiện ích nạp thật (unpacked) trong Chromium. Bổ sung kiểm thử bền vững xuất tệp nhị phân 1MiB không nén giả và phụ đề tiếng Việt được giải nén/kiểm tra CRC bằng Python `zipfile`. |
| **Supervisor ZIP Check** | `node /private/tmp/meetscribe-supervisor-zip.cjs $PWD` | **PASS** | Môi trường unpacked độc lập với binary 1MiB, tiếng Việt UTF-8, kiểm tra tải xuống và xác thực Python `zipfile`. |
| **Supervisor Store Check** | `node /private/tmp/meetscribe-store-review.cjs $PWD` | **PASS** (3 scoped reads / stop-and-ZIP ok) | Xác nhận session-details chỉ thực hiện 3 lượt đọc đúng phạm vi (không scan toàn bộ lịch sử) và stop-and-ZIP cứu hộ thành công về Downloads khi thư mục tùy chỉnh bị mất handle. |
| **Reproduction Script** | `node /tmp/caption-review-repro.cjs` | **PASS** (3/3 checks) | 1. `outer grouping`: chọn đúng `#cap` (SPEECH), không nuốt private chat / mic status.<br>2. `rerender duplicates`: không nhân đôi cùng 1 đoạn text khi DOM re-render.<br>3. `opacity detector`: phát hiện opacity: 0 và thu nhận đúng caption mới trước khi dừng. |
| **Package** | `npm run package` | **PASS** | Tạo tệp đóng gói `dist/MeetScribe-1.2.0.zip` với manifest 1.2.0. |

## 2. Chi tiết các sửa đổi khắc phục cụ thể

### 2.1. Phụ đề (Captions & Collector)
- **Tách biệt vùng live chung và khung phụ đề**: Sửa logic phân nhóm widget trong `extension/captions.js`. Không bao giờ gom hoặc nâng cấp một ancestor có độ tin cậy thấp (generic `[aria-live="polite"]`, điểm < 70) thành phần tử đại diện cho widget phụ đề. Loại bỏ hoàn toàn khả năng nuốt các vùng chat hoặc thanh trạng thái lân cận (`isExclusionElement` kiểm tra querySelector chat/participant).
- **Chống trùng lặp khi re-render cùng nội dung**: Sửa `bind(resetLast)` trong `extension/content.js`. Khi re-render thay thế node DOM (như `outerHTML` re-render), hàm reacquire tự động giữ nguyên biến `last`, chỉ reset `last = ''` khi bắt đầu phiên mới hoặc chọn thủ công.
- **Đồng bộ vị từ hiển thị (Visibility Predicate) và thu nhận trước khi Dừng**: Cập nhật hàm `visible()` trong `content.js` để kiểm tra độ mờ `opacity: 0` trên cả phần tử và chuỗi tổ tiên, đồng bộ với `isElementVisible()` trong `captions.js`. Khi nhận lệnh `end`, collector tự động kiểm tra `reacquireIfNeeded()` để bắt kịp phần tử hiển thị mới nhất trước khi chụp `snapshot()` cuối và flush.

### 2.2. Tính toàn vẹn lưu trữ & Loại bỏ Fallback giả lập (Store Integrity)
- **Loại bỏ hoàn toàn `mockHandlesMap` và cờ `isMock`**: Đã xóa `mockHandlesMap` và nhánh bắt `DataCloneError` trong `extension/store.mjs`. Toàn bộ mã nguồn sản phẩm chỉ lưu trữ và trả về `FileSystemDirectoryHandle` hợp lệ của trình duyệt.
- **Từ chối nguyên tử (Atomic Rejection)**: Khi lưu handle không thể tuần tự hóa (ném `DataCloneError`), giao dịch IndexedDB lập tức bị hủy (`tx.abort()`) và Promise reject. Bản ghi `active` và thư mục đã chọn trước đó được giữ nguyên vẹn 100%.
- **Kiểm thử OPFS thực tế**: Cập nhật `tests/browser.cjs` để sử dụng platform `FileSystemDirectoryHandle` thật từ `navigator.storage.getDirectory()`, không tuần tự hóa hàm giả lập. Bổ sung kiểm thử khẳng định `DataCloneError` reject và bảo toàn active ID trước đó.

### 2.3. Báo lỗi UI Thư viện, Tiến trình ZIP & Tùy chọn Save As
- **Hợp đồng ném lỗi của `command()`**: Sửa `library.js` để `command(type, data)` ném ngoại lệ khi thao tác thất bại (`!answer?.ok`), không âm thầm nuốt lỗi và trả về `{ok: false}`. Các khối xử lý gọi lệnh bắt lỗi và hiển thị thông báo lỗi trực tiếp trên thẻ phiên họp (`.card-error`, `.zip-status`) cũng như biểu ngữ trang (`#message`).
- **Trạng thái xuất ZIP & Nút Thử lại**: Thêm trạng thái hiển thị rõ ràng:
  - Đang nén/lưu: hiển thị `Đang đóng gói và lưu ZIP...` (class `.in-progress`).
  - Thành công: hiển thị `Đã lưu ZIP thành công: <tên tệp>` (class `.success`).
  - Thất bại: hiển thị `Lỗi xuất ZIP: <thông báo lỗi>` (class `.error-text`) và hiển thị nút `Thử lại xuất ZIP` (`.zip-retry-btn`) đã được kích hoạt.
- **Tùy chọn Save As và Lựa chọn Vị trí lưu**: Cung cấp thẻ chọn vị trí lưu (`.zip-dest-select`) và nút `Lưu ZIP (Save As...)` (`.zip-save-as-btn`) kích hoạt hộp thoại lưu của hệ điều hành thông qua `{ saveAs: true, destination: 'downloads' }`.

### 2.4. Khôi phục quyền thư mục phiên cũ độc lập với cấu hình Downloads
- **Mục phục hồi riêng biệt trong Cài đặt**: Thêm thẻ `#sessionRepairSection` độc lập trong `extension/settings.html`.
- **Hiển thị khi có `?destinationId=`**: Khi người dùng mở trang cài đặt từ một phiên cũ cần cấp lại quyền, mục phục hồi này luôn hiển thị tên thư mục và trạng thái quyền của phiên đó, bất kể cấu hình vị trí lưu toàn cục cho các phiên sau đang là Downloads hay Thư mục cục bộ.
- **Không ghi đè cấu hình toàn cục**: Nút `Cấp lại quyền ghi cho thư mục này` (`#reauthorizeSessionDirBtn`) chỉ cập nhật quyền cho handle của phiên đó mà không thay đổi thư mục active hay chuyển cấu hình toàn cục sang customDirectory.

## 3. Bằng chứng lưu trữ thư mục cục bộ (Directory-Write Evidence)

1. **Persistent Handle Storage**:
   - Sử dụng object store `destination_handles` trong `meetscribe-local-v1` (phiên bản 2) lưu trữ `FileSystemDirectoryHandle` chuẩn của Chromium.
   - Thư mục được ghim theo `destinationId` bất biến cho từng phiên.
2. **Kiểm thử tích hợp OPFS thực tế**:
   - Kiểm thử trong `tests/browser.cjs` sử dụng platform OPFS handle thật (`navigator.storage.getDirectory()`).
   - Kiểm thử trong `tests/extension-smoke.cjs` và supervisor script chạy trực tiếp trên worker unpacked nạp thật của Chrome.
3. **Phân định rõ ràng giới hạn kiểm thử**:
   - Kiểm thử tự động headless sử dụng platform OPFS `FileSystemDirectoryHandle`.
   - Tiện ích không giả mạo hộp thoại hệ điều hành (OS picker) trong môi trường tự động; trên môi trường người dùng thật, việc chọn thư mục ngoài hệ điều hành được kích hoạt qua cử chỉ người dùng (`showDirectoryPicker`) trên trang Cài đặt `settings.html`.

## 4. Danh sách ảnh chụp màn hình UI trong `artifacts/`

- `artifacts/library-desktop.png`: Giao diện thư viện cuộc họp (tìm kiếm, đổi tên, tùy chọn Save As, trích đoạn caption, ảnh thu nhỏ, dung lượng dự phòng).
- `artifacts/library-375px.png`: Giao diện thư viện responsive trên màn hình 375px.
- `artifacts/settings-desktop.png`: Trang Cài đặt trên máy tính (độ mờ 40–100%, cỡ chữ 12–18px, khung xem trước, mục cấp lại quyền thư mục phiên cũ).
- `artifacts/settings-375px.png`: Trang Cài đặt responsive trên màn hình 375px.
- `artifacts/toolbar-desktop.png`: Thanh điều khiển nổi MeetScribe trên màn hình máy tính.
- `artifacts/toolbar-narrow.png`: Thanh điều khiển nổi MeetScribe ở chế độ co hẹp.
- `artifacts/toolbar-live.png`: Thanh điều khiển nổi MeetScribe khi đang ghi nhận caption thực tế.
- `artifacts/extension-real-smoke.png`: Ảnh chụp thực tế từ smoke test tiện ích nạp unpacked trên Chrome với trang Google Meet mô phỏng.
- `artifacts/zoom-iframe-smoke.png`: Ảnh chụp thực tế từ smoke test tiện ích nạp unpacked trên Chrome với Zoom PWA iframe.

## 5. Giới hạn thực tế còn lại (Honest Remaining Limits)

1. **Giới hạn môi trường kiểm thử (Test Fixtures vs. Live Meetings)**:
   - Toàn bộ kiểm thử tự động được thực hiện trên các trang mô phỏng HTML/DOM fixtures và iframe PWA chuẩn của Google Meet và Zoom. Tiện ích chưa từng được khẳng định đã kết nối vào cuộc gọi Meet/Zoom trực tiếp trên internet trong bộ kiểm thử tự động không đầu.
2. **Giới hạn về bộ chọn thư mục ngoài hệ điều hành (OPFS vs. Real OS Picker)**:
   - Các bài kiểm thử tự động trong trình duyệt không đầu sử dụng platform OPFS handles (`navigator.storage.getDirectory()`) vì Chromium headless không cho phép tự động hóa hộp thoại file picker gốc của hệ điều hành (`window.showDirectoryPicker()`).
   - Trong môi trường thực tế, việc chọn thư mục ngoài yêu cầu tương tác trực tiếp của người dùng trên trang `settings.html`.
3. **Phụ thuộc hoàn toàn vào phụ đề chữ hiển thị (Native Captions Only)**:
   - Tiện ích chỉ trích xuất phụ đề khi cuộc họp có bật phụ đề và phụ đề xuất hiện trên DOM. Không ghi âm âm thanh micro và không thu nhận tiếng nói nếu không có phụ đề chữ.
4. **Không gọi API AI bên thứ ba trực tiếp**:
   - Tiện ích hoạt động 100% offline và cục bộ trong trình duyệt; việc tích hợp AI được thực hiện bằng cách xuất tệp ZIP độc lập và cung cấp cho người dùng mang sang các mô hình AI theo nhu cầu.
