# Verification snapshot / Kết quả xác minh

[Documentation / Tài liệu](README.md) · [Development](en/development.md) · [Phát triển](vi/development.md)

## English

Release 1.2.0 was checked on 2026-10-30 with Node.js 20.19.5, Python 3.9, desktop Google Chrome and Playwright Chromium in isolated test profiles. The baseline results below are a dated snapshot, not a promise that future test counts remain fixed.

| Check | Command | Observed baseline |
| --- | --- | --- |
| Unit suite | `npm test` | 61 passed |
| Browser/DOM suite | `npm run test:browser` | 22 checks passed |
| Unpacked extension | `npm run test:extension` | Meet fixture, Zoom iframe fixture, production worker ZIP export passed |
| Package | `npm run package` | ZIP created and checked with Python |

The production ZIP flow was tested with 1 MiB of binary data and Vietnamese text. Python `zipfile` verified entry names, CRCs and exact extracted content. Storage checks covered real OPFS directory handles surviving page reload, rejected unserializable handles preserving the prior destination, session-scoped reads, bounded export reads and ZIP recovery when the ordinary destination fails. Caption checks covered generic live-region exclusion, hidden/replaced nodes, manual selection and final-buffer drain.

No automated result proves behavior in a live Meet/Zoom call, the native OS folder picker or permission persistence across a full Chrome restart. These require the manual checks in the development guide. Shared-content images are selected samples, not a complete video record.

The open-source documentation additionally has local-link, EN/VI parity and image checks via `npm run docs:check`. Screenshots can be regenerated with `npm run docs:screenshots`; [image provenance](images/README.md) explains the synthetic data. CI definitions are in [ci.yml](../.github/workflows/ci.yml). A configured workflow is not evidence that a remote run has completed; inspect the GitHub Actions run for its result.

## Tiếng Việt

Bản 1.2.0 được kiểm tra ngày 2026-10-30 bằng Node.js 20.19.5, Python 3.9, Google Chrome máy tính và Playwright Chromium trong các hồ sơ thử riêng. Kết quả dưới đây là mốc xác minh theo thời điểm, không phải cam kết số lượng test của mọi bản sau.

| Kiểm tra | Lệnh | Kết quả nền đã ghi nhận |
| --- | --- | --- |
| Unit | `npm test` | 61 test đạt |
| Trình duyệt/DOM | `npm run test:browser` | 22 kiểm tra đạt |
| Tiện ích unpacked | `npm run test:extension` | Trang Meet giả lập, iframe Zoom giả lập, xuất ZIP qua worker sản phẩm đều đạt |
| Đóng gói | `npm run package` | Tạo ZIP và kiểm tra bằng Python |

Luồng ZIP sản phẩm được kiểm tra với dữ liệu nhị phân 1 MiB và văn bản tiếng Việt. Python `zipfile` xác minh tên tệp, CRC và nội dung giải nén nguyên vẹn. Kiểm tra lưu trữ bao gồm directory handle OPFS thật còn sau khi tải lại trang, từ chối handle không tuần tự hóa được mà giữ nơi lưu cũ, đọc đúng phiên, giới hạn dữ liệu xuất và cứu ZIP khi nơi lưu thông thường lỗi. Kiểm tra caption bao gồm loại vùng live chung, khung bị ẩn/thay thế, lựa chọn thủ công và xả hết bộ đệm khi dừng.

Kết quả tự động không xác nhận hành vi trong cuộc gọi Meet/Zoom thật, hộp chọn thư mục của hệ điều hành hoặc quyền truy cập còn sau khi khởi động lại toàn bộ Chrome. Cần thực hiện checklist thủ công trong hướng dẫn phát triển. Ảnh nội dung chia sẻ là các mẫu được chọn, không phải bản ghi video đầy đủ.

Tài liệu mã nguồn mở có kiểm tra liên kết nội bộ, đối xứng EN/VI và ảnh bằng `npm run docs:check`. Tạo lại ảnh bằng `npm run docs:screenshots`; [nguồn ảnh](images/README.md) giải thích dữ liệu demo. Cấu hình CI nằm trong [ci.yml](../.github/workflows/ci.yml). Có workflow không đồng nghĩa một lần chạy từ xa đã thành công; xem kết quả tại GitHub Actions.
