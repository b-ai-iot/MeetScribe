# Verification — MeetScribe 1.1.0 Usability & Export Update

Ngày: 2026-10-30. Nhánh `feat/usability-export`.
Toàn bộ 5 nhiệm vụ theo bản thiết kế `docs/superpowers/specs/2026-10-30-usability-export-design.md` và kế hoạch `docs/superpowers/plans/2026-10-30-usability-export.md` đã hoàn thành và được kiểm thử tự động.

## 1. Kết quả kiểm thử tự động & Số lượng

| Bộ kiểm thử | Lệnh thực thi | Kết quả | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Unit tests** | `npm test` | **56/56 PASS** (0 fail) | Chạy qua `node --test tests/*.test.mjs` (Node v20.19.5). Bao gồm archive, settings, destination, captions, commands, visual, model, zoom, library-store. |
| **Browser tests** | `npm run test:browser` | **21/21 PASS** (0 fail) | Chạy qua `node tests/browser.cjs` với Google Chrome thật. Bao gồm OPFS directory handle, ZIP export + Python verify, Meet & Zoom caption discovery/reacquisition/chat exclusion, settings UI responsive, font scaling 12/18px, library search/rename/preview/deletion/XSS. |
| **Extension Smoke** | `npm run test:extension` | **PASS** (Meet + Zoom PWA + ZIP) | Tiện ích nạp thật (unpacked) trong persistent context của Chrome. Kiểm chứng đầy đủ: content script -> service worker -> IndexedDB -> Downloads thực -> Thư viện -> Tải ZIP cho AI được xác nhận bằng Python zipfile. |
| **Supervisor ZIP Check** | `/private/tmp/meetscribe-supervisor-zip.cjs` | **PASS** | Môi trường unpacked thật với binary 1MiB không nén giả, phụ đề tiếng Việt UTF-8, kiểm tra CRC và giải nén Python `zipfile`. |
| **Package** | `npm run package` | **PASS** | Tạo tệp `dist/MeetScribe-1.1.0.zip` với đầy đủ các tệp manifest và mã nguồn cần thiết. |

## 2. Bằng chứng lưu trữ thư mục cục bộ (Directory-Write Evidence)

1. **Persistent Handle Storage**:
   - Nâng cấp lược đồ IndexedDB `meetscribe-local-v1` lên phiên bản 2, bổ sung object store `destination_handles` lưu trữ `FileSystemDirectoryHandle`.
   - Ghim `destinationId` bất biến cho từng phiên họp tại thời điểm `createSession`. Khi người dùng đổi thư mục cho các phiên sau, phiên cũ vẫn lưu đúng thư mục đã ghim ban đầu.
2. **Kiểm thử tích hợp OPFS Handle thực tế**:
   - Trong `tests/browser.cjs`, kiểm thử tích hợp sử dụng `navigator.storage.getDirectory()` lấy platform `FileSystemDirectoryHandle` thật, lưu vào IndexedDB qua `store.saveDirectoryHandle`, ghi tệp văn bản và tệp nhị phân base64 PNG bằng `exportFileToDirectory`, xác thực dữ liệu giải mã khớp từng byte.
   - Phân biệt rõ ràng: Kiểm thử tự động không đầu (headless) dùng platform OPFS handle; trên giao diện thực tế của người dùng, việc chọn thư mục ngoài hệ điều hành được kích hoạt qua cử chỉ người dùng (`showDirectoryPicker`) trên trang Cài đặt `settings.html`.
3. **Bảo vệ khi quyền bị từ chối / thu hồi**:
   - Khi quyền truy cập thư mục bị từ chối hoặc hết hạn, tiện ích không âm thầm đẩy dữ liệu sang Downloads mà giữ nguyên bản dự phòng trong IndexedDB và hiển thị hướng dẫn cấp lại quyền.
   - Trang Cài đặt hỗ trợ tham số `?destinationId=` cho phép cấp lại quyền riêng cho thư mục của một phiên cũ ngay cả khi cấu hình mặc định toàn cục đang là Downloads.

## 3. Danh sách ảnh chụp màn hình UI trong `artifacts/`

Tất cả ảnh chụp màn hình được lưu trong thư mục `artifacts/`:
- `artifacts/library-desktop.png`: Giao diện thư viện cuộc họp trên máy tính (tìm kiếm theo từ khóa/ngày, đổi tên hiển thị, trích đoạn caption, ảnh thu nhỏ, dung lượng dự phòng, trạng thái xuất và xóa phiên có xác nhận).
- `artifacts/library-375px.png`: Giao diện thư viện co giãn responsive trên màn hình hẹp 375px.
- `artifacts/settings-desktop.png`: Trang Cài đặt trên máy tính (độ mờ 40–100%, cỡ chữ 12–18px, khung xem trước thời gian thực, chọn thư mục lưu và trạng thái quyền).
- `artifacts/settings-375px.png`: Trang Cài đặt responsive trên màn hình hẹp 375px.
- `artifacts/toolbar-desktop.png`: Thanh điều khiển nổi MeetScribe trên màn hình máy tính.
- `artifacts/toolbar-narrow.png`: Thanh điều khiển nổi MeetScribe ở chế độ thu nhỏ / co hẹp.
- `artifacts/toolbar-live.png`: Thanh điều khiển nổi MeetScribe khi đang ghi nhận caption thực tế.
- `artifacts/extension-real-smoke.png`: Ảnh chụp thực tế từ smoke test tiện ích nạp unpacked trên Chrome với trang Google Meet mô phỏng.
- `artifacts/zoom-iframe-smoke.png`: Ảnh chụp thực tế từ smoke test tiện ích nạp unpacked trên Chrome với Zoom PWA iframe.

## 4. Các giới hạn thực tế còn lại (Honest Remaining Limits)

1. **Phụ thuộc vào kích hoạt của người dùng khi chọn thư mục**:
   - Do mô hình bảo mật của File System Access API trong Chrome, việc cấp quyền đọc/ghi vào thư mục ngoài chỉ có thể kích hoạt thông qua cử chỉ bấm chuột của người dùng trên trang mở rộng (`settings.html`). Không thể tự động mở hộp thoại chọn thư mục trong Service Worker.
2. **Không dùng Dynamic Import trong Service Worker**:
   - Quy chuẩn HTML và Chrome Service Worker cấm `import()` động trên `ServiceWorkerGlobalScope`. Tất cả các mô-đun (`archive.mjs`, `destination.mjs`) đều được import tĩnh ở đầu tệp `background.js`.
3. **Phụ thuộc vào nguồn phụ đề gốc**:
   - Tiện ích dựa vào phụ đề có sẵn (native captions) của Google Meet và Zoom web. Nếu cuộc họp không bật phụ đề hoặc máy chủ cuộc họp không cung cấp phụ đề, tiện ích sẽ giữ trạng thái "Chờ caption" mà không bị lỗi hoặc báo mất vùng sai; tuy nhiên sẽ không có dữ liệu lời thoại nếu không có chữ nào xuất hiện trên màn hình.
4. **Không thu âm thanh / Không gọi AI ngoài luồng**:
   - Tiện ích thuần túy chạy cục bộ trên trình duyệt, không ghi âm mic, không truyền dữ liệu ra máy chủ bên thứ ba và không tự ý gọi mô hình AI trong lúc đang họp. Việc xử lý bằng AI được thực hiện bằng cách xuất tệp ZIP cầm tay sang mô hình AI sau khi phiên kết thúc.
