# Quyền riêng tư và quyền truy cập

[English](../en/privacy.md) · [Tài liệu](../README.md) · [Chính sách bảo mật](../../SECURITY.vi.md)

MeetScribe lưu dữ liệu thu được tại máy, không tích hợp telemetry, analytics, API AI hoặc máy chủ nhận dữ liệu. Đây là mô tả hành vi của tiện ích, không phải hoạt động mạng của Chrome, nền tảng họp, thư mục đồng bộ hoặc công cụ bạn dùng để xử lý dữ liệu xuất về sau.

## Dữ liệu được thu

- Snapshot văn bản trong khung phụ đề gốc do bạn chọn hoặc tiện ích nhận diện, kèm thời điểm quan sát. Tên người nói hiển thị có thể nằm trong văn bản thô; trường `speaker` có cấu trúc hiện luôn là `null`.
- Tiêu đề, URL cuộc họp, nền tảng, thời gian phiên, trạng thái và sự kiện vận hành.
- Nếu bạn chủ động bật ảnh nội dung chia sẻ: PNG vùng chọn, tọa độ cắt, dữ liệu so sánh và caption gần thời điểm chụp.
- Cài đặt giao diện và directory handle được bạn cấp để lưu thư mục tùy chọn.

Caption, slide, tên và URL có thể là thông tin nhạy cảm. Trang nguồn kiểm soát DOM; nhận diện tự động dựa trên quy tắc và chọn thủ công quá rộng có thể lấy cả chữ không liên quan. Kiểm tra vùng nguồn và dữ liệu xuất.

## Ranh giới âm thanh, video và mạng

MeetScribe không yêu cầu âm thanh từ micro/loa và không lưu bản ghi âm. Tiện ích dùng phụ đề do Meet/Zoom tạo; các dịch vụ đó có cách xử lý và hoạt động mạng riêng.

Chụp ảnh tùy chọn nhận **luồng video toàn tab đang dùng trong bộ nhớ**, với `audio:false`, sau đó cắt vùng share do người dùng xác nhận trong offscreen document. Tiện ích lưu PNG được chọn, không lưu tệp video. Các khung so sánh nhỏ được giữ trong RAM để loại trùng cho đến khi dừng hẳn. Không hiểu điều này thành cam kết pixel ngoài vùng chọn không bao giờ đi qua bộ nhớ.

Tiện ích tải tài nguyên đóng gói của chính nó và không gửi nội dung thu được tới dịch vụ bên ngoài. Chọn thư mục mạng/đồng bộ đám mây, chia sẻ ZIP hoặc dùng AI ngoài có thể đưa dữ liệu ra khỏi máy độc lập với MeetScribe. Kiểm tra cấu hình và chính sách của các hệ thống đó.

## Quyền Chrome

[Manifest sản phẩm](../../extension/manifest.json) không yêu cầu quyền host diện rộng.

| Quyền | Cách MeetScribe dùng |
| --- | --- |
| `activeTab` | Truy cập tạm sau khi người dùng gọi tiện ích trên tab họp được hỗ trợ |
| `scripting` | Inject bộ thu/nhận diện và kiểm tra frame họp được hỗ trợ |
| `tabCapture` | Lấy luồng video tab tạm để chụp ảnh vùng chọn khi bật tùy chọn này |
| `offscreen` | Chạy phát luồng, canvas cắt và so sánh ngoài trang nhìn thấy |
| `downloads` | Bắt đầu và kiểm tra hoàn tất lượt tải journal/ZIP; mở thư mục của tệp đã xuất |
| `alarms` | Thử lại tệp chờ bằng alarm nền mỗi phút; xả caption dùng bộ đếm mười giây riêng ở content |
| `unlimitedStorage` | Yêu cầu dung lượng mở rộng cho tiện ích; không ngăn người dùng xóa, lỗi đĩa hoặc mọi dạng mất dữ liệu |
| `storage` | Lưu giao diện bằng `chrome.storage.local`; directory handle và mã của chúng nằm trong IndexedDB |

Smoke test thêm quyền host cụ thể của Meet/Zoom vào bản sao tiện ích tạm, rồi định tuyến URL sang trang demo. Không thêm các quyền này vào manifest sản phẩm.

## Lưu trữ, giữ dữ liệu và xóa

Bản dự phòng cục bộ nằm trong IndexedDB `meetscribe-local-v1` của hồ sơ Chrome. Tệp JSONL/JSON/PNG/ZIP được xuất vào Downloads, thư mục tùy chọn hoặc vị trí Save As. Cài đặt Chrome và chính sách doanh nghiệp có thể ảnh hưởng thao tác.

Journal được ghi trước xuất thông thường. Xuất lỗi giữ các tệp đã ghi journal để thử lại; cập nhật còn trong RAM chưa được xác nhận vẫn có thể mất khi đóng tab/tiến trình. Lưu cục bộ không phải mã hóa hoặc bảo đảm chống mất thiết bị/hồ sơ. Không gỡ tiện ích hoặc xóa hồ sơ trước khi kiểm tra bản xuất.

Xóa phiên đã dừng trong thư viện sẽ xóa journal dự phòng cục bộ. Không xóa bản đã xuất ra đĩa hoặc đã gửi nơi khác. MeetScribe không có dịch vụ xóa từ xa tự động. Quyền thư mục tùy chọn có thể cần cấp lại; tiện ích kiểm tra quyền hiện tại và cung cấp thao tác sửa.

## Trước khi chia sẻ

Thông báo cho người tham gia về dữ liệu bạn thu và tuân thủ quy định cuộc họp, chính sách tổ chức áp dụng. Kiểm tra/che thông tin trước khi báo lỗi công khai hoặc gửi sang dịch vụ khác. Dùng [chính sách bảo mật](../../SECURITY.vi.md) cho báo cáo nhạy cảm; dùng dữ liệu giả lập cho ảnh công khai. MIT áp dụng cho phần mềm và tài liệu dự án, không yêu cầu bạn công bố tệp cuộc họp.
