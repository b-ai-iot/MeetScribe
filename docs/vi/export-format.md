# Định dạng xuất và chuyển dữ liệu cho AI

[English](../en/export-format.md) · [Tài liệu](../README.md)

Trang này mô tả tệp do bản 1.2.0 tạo ra. Ví dụ chỉ gồm một số trường minh họa có trong [journal](../../extension/store.mjs), [luồng ảnh](../../extension/offscreen.js) và [bộ đóng gói](../../extension/archive.mjs).

## Thư mục phiên

Xuất vào Downloads và thư mục tùy chọn có cùng cấu trúc tương đối. Ngày/giờ trong tên thư mục theo múi giờ máy; timestamp trong metadata dùng ISO 8601.

```text
<thư mục gốc>/MeetScribe/YYYY-MM-DD/<tiêu đề>--<HHMMSS>--<mã ngắn>/
  session.json
  captions/part-000001.jsonl
  images/screen-001-1793352300000.png
  images/screen-001-1793352300000.png.json
  events/<epoch-ms>-<mã ngắn>.json
  events/finished.json
  session-final.json
  finished.json
```

Tiêu đề giữ Unicode và tiếng Việt, thay các ký tự tên tệp bị cấm. Mã phiên giúp giảm trùng tên. Đổi tên trong thư viện chỉ đổi tên hiển thị, không chuyển đường dẫn đã lưu trên đĩa.

## Metadata phiên

`session.json` là snapshot ban đầu: mã phiên, tiêu đề, URL cuộc họp, nền tảng, thời điểm tạo, phiên bản và nơi lưu. `session-final.json` là snapshot lúc chốt: trạng thái, thời điểm kết thúc, số lượng và lý do gián đoạn. Các trường tiến độ xuất trong snapshot không phải xác nhận liên tục cho những lần ghi đĩa về sau.

## Caption JSONL

Mỗi dòng trong `captions/part-*.jsonl` là một snapshot DOM quan sát được:

```json
{"sequence":1,"timestamp":"2026-10-30T09:15:42.500Z","text":"Lan: Chúng ta sẽ kiểm tra bản thử nghiệm.","speaker":null}
```

Bộ thu hiện luôn ghi `speaker: null`; tên hiển thị trong vùng chọn có thể nằm trong `text`. Bản ghi caption không có trường `id` hoặc `raw` riêng. `sequence` sắp thứ tự cập nhật trong phiên. `timestamp` là lúc quan sát, không phải thời điểm âm thanh gốc. Thông thường một part được ghi vào journal sau 10 giây hoặc 100 cập nhật chờ; giới hạn kích thước có thể tách lô sớm hơn.

Đọc part theo thứ tự số. Snapshot liên tiếp có thể chồng lặp hoặc sửa chữ trước đó. Không coi mỗi snapshot là một lượt nói mới và không nối máy móc thành bản gỡ băng nguyên văn.

## Ảnh và tệp đi kèm

PNG là ảnh cắt từ vùng share đã chọn. Tên ảnh có số thứ tự và timestamp epoch dạng số. Tệp JSON đi kèm lưu bằng chứng lúc chụp; một phần minh họa:

```json
{
  "capturedAt":"2026-10-30T09:25:00.000Z",
  "rect":{"x":0.25,"y":0.15,"w":0.65,"h":0.6,"key":"DIV:960:540","confirmedBy":"user-selection"},
  "captionAt":"2026-10-30T09:24:58.000Z",
  "captionContext":"Lan: Đây là nội dung minh họa.",
  "importantBy":"user-mark",
  "image":"images/screen-001-1793352300000.png",
  "bytes":42318
}
```

Tọa độ `rect` là tỷ lệ của viewport tab đang lấy hình (`x`, `y`, `w`, `h`), không phải pixel. Hình học iframe Zoom được quy đổi trước khi cắt. `importantBy` có thể là `null`, `user-mark` hoặc `persistent-local-change`; có thể kèm `metrics` so sánh. Caption gần ảnh chỉ là ngữ cảnh quan sát, không bảo đảm khớp âm thanh/hình. Slide tái sử dụng và khoảng hụt lấy mẫu có thể được ghi thành sự kiện thay vì ảnh mới.

## Sự kiện và chốt phiên

Sự kiện là JSON có `timestamp`, `type` và các trường riêng đặt trực tiếp trong đối tượng. Ví dụ mốc đánh dấu gồm `captionAt` và `captionContext`:

```json
{"timestamp":"2026-10-30T09:25:00.000Z","type":"user-mark","captionAt":"2026-10-30T09:24:58.000Z","captionContext":"Lan: Đây là nội dung minh họa."}
```

`finished.json` được ghi nguyên tử cùng metadata cuối trong journal, trước những lần thử xuất thông thường:

```json
{"id":"demo-session","endedAt":"2026-10-30T09:30:00.000Z","reason":"user-stop","status":"completed","captionUpdates":18,"images":2,"reportStatus":"awaiting-user-request"}
```

Marker này cho biết phiên cục bộ đã được chốt, **không** chứng minh mọi tệp đã ghi ra đĩa thành công. Luồng xuất thông thường cố ghi marker sau cùng; cần xem trạng thái chờ/lỗi trong thư viện và tệp thực tế. Phiên `interrupted` có thể thiếu nội dung. Bản dự phòng còn cho đến khi chủ động xóa hoặc dữ liệu trình duyệt bị xóa.

## ZIP di động

ZIP của phiên đã dừng gồm mọi tệp journal, cả đã xuất và còn chờ, với đường dẫn tương đối tính từ thư mục phiên. Gói bổ sung:

| Tệp | Ý nghĩa |
| --- | --- |
| `transcript.md` | Snapshot `text` theo timestamp để đọc; không tự tách người nói hay khử trùng lặp |
| `README-for-AI.md` | Hướng dẫn và prompt yêu cầu mô hình bên ngoài dựa vào bằng chứng, không tự đặt người phụ trách/thời hạn, nêu rõ chỗ thiếu |
| `manifest.json` | Metadata định dạng/phiên và danh sách đường dẫn, số byte; không liệt kê chính nó |

Manifest **không** có băm SHA-256. Mỗi entry ZIP có CRC-32 tiêu chuẩn, không phải xác thực mật mã. Giới hạn 500 MiB áp dụng lên dữ liệu đầu vào/nội dung sinh thêm trước đóng gói; không bảo đảm mức RAM đỉnh hoặc đúng kích thước ZIP sau nén. Hạn mức ảnh: 30/giờ, 120/phiên và 100 MiB/phiên. Lấy mẫu tự động mỗi 15 giây, thường cách 30 giây giữa các ảnh lưu; đánh dấu thủ công có thể bỏ qua khoảng chờ này nhưng vẫn kiểm tra ảnh trùng và hạn mức.

Chọn nơi lưu của phiên, Downloads hoặc Save As trong thư viện. Không cần xuất thông thường thành công trước khi cứu ZIP về Downloads. Khi lỗi, journal cục bộ được giữ để thử lại. Xem [khắc phục sự cố](troubleshooting.md).

## Chuyển cho AI

Tiện ích không gọi dịch vụ AI. Xuất ZIP, đọc `README-for-AI.md` rồi chủ động cung cấp tệp cho công cụ bạn chọn. Kiểm tra khả năng nhận tệp và điều khoản riêng tư của công cụ đó. Đối chiếu kết quả với caption thô, timestamp, JSON đi kèm ảnh và trạng thái gián đoạn. Không mặc định biên bản sinh ra là đầy đủ hoặc chính xác. Chia sẻ dữ liệu xuất là quyết định của bạn, độc lập với việc công khai mã nguồn dự án này.
