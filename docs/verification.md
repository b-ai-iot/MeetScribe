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

## 1.3.0 language setting / Cài đặt ngôn ngữ

The VI/EN feature adds catalog/interpolation parity tests, preference migration/reset and rapid-change race tests, plus three focused browser/extension checks: `tests/language-ui.cjs`, `tests/language-toolbar.cjs` and `tests/language-extension.cjs`. The unpacked-extension test switches Settings/Library/toolbar while collecting, verifies the final caption batch and structured worker errors, reload/reset persistence, and English ZIP helper text with untouched Vietnamese raw captions. Native DOMException details and nested retained errors have separate regressions.

Tính năng VI/EN bổ sung test đối xứng khóa/biến nội suy, chuyển đổi/đặt lại cấu hình và đua đọc khi đổi nhanh, cùng ba kiểm tra UI/thanh nổi/tiện ích ở các tệp nêu trên. Bài unpacked chuyển ngôn ngữ trong lúc thu, xác minh lô caption cuối, mã lỗi worker, lưu qua tải lại/đặt lại và hướng dẫn ZIP tiếng Anh trong khi caption tiếng Việt giữ nguyên. Lỗi DOMException gốc và lỗi lồng nhau đã lưu có kiểm thử riêng.

Run / Chạy: `npm test`, `npm run test:browser`, `npm run test:extension`, `npm run test:language`, `npm run docs:check`, `npm run package`. Screenshots now include both UI languages; real-call/OS-picker boundaries above remain unchanged. / Ảnh có cả hai ngôn ngữ; giới hạn về cuộc họp thật/hộp chọn thư mục vẫn như trên.

Final local 1.3.0 result / Kết quả cục bộ cuối bản 1.3.0: **75 unit tests, 22 browser checks, legacy extension smoke checks and all three language suites passed**. Documentation validation checked 27 pages, 195 local links and 7 PNG images. Both native locale JSONs, shared catalogs and MIT license were verified in `dist/MeetScribe-1.3.0.zip`. Independent review confirmed native/nested error fixes and consistent invalid-language fallback; visual checks covered English/Vietnamese at desktop and narrow widths. / Rà soát độc lập xác nhận sửa lỗi gốc/lỗi lồng nhau và ngôn ngữ không hợp lệ thống nhất; bố cục được kiểm tra ở cả hai ngôn ngữ, cửa sổ rộng và hẹp.
