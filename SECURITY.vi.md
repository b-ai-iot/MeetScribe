# Chính sách bảo mật

[English](SECURITY.md) · [Quyền riêng tư và quyền truy cập](docs/vi/privacy.md)

## Mã được duy trì

Việc duy trì tập trung vào `main` mới nhất (hiện là bản 1.3.0), theo khả năng của người duy trì. Chưa có cam kết thời gian phản hồi. Cập nhật trước khi báo lỗi và ghi commit/phiên bản, phiên bản Chrome, hệ điều hành.

## Báo cáo riêng tư

Nếu mục **Security → Report a vulnerability** có trong [repository](https://github.com/b-ai-iot/MeetScribe/security/advisories), dùng tính năng báo cáo lỗ hổng riêng tư của GitHub. Chính sách này không mặc định tính năng đó đã bật.

Nếu không dùng được, mở issue công khai chỉ để xin kênh liên hệ riêng với người duy trì. Không đưa mã khai thác, chi tiết tái hiện nhạy cảm, URL cuộc họp, caption, slide hoặc dữ liệu cá nhân vào yêu cầu công khai đó. Dự án chưa công bố email bảo mật riêng; dùng các kênh nêu trên.

Với lỗi thông thường không nhạy cảm, dùng [biểu mẫu song ngữ](https://github.com/b-ai-iot/MeetScribe/issues/new/choose) với dữ liệu giả lập.

## Ranh giới

Tiện ích không tải dữ liệu thu được lên máy chủ hoặc dùng thông tin xác thực API AI. Sản phẩm dùng truy cập tab được kích hoạt thay cho quyền host diện rộng và không yêu cầu âm thanh trong luồng video tab tùy chọn. Điều này giảm một số nguy cơ, không loại bỏ rủi ro từ thiết bị, trình duyệt, trang họp hoặc việc chia sẻ bản xuất.

Shadow DOM cách ly kiểu hiển thị, không phải ranh giới bảo mật chống lại trang họp. Caption đến từ DOM và không phải bằng chứng được xác thực. Bản dự phòng là dữ liệu trình duyệt cục bộ, không phải kho mã hóa cấp ứng dụng. Thư mục người dùng chọn có thể được đồng bộ đám mây. Xem hướng dẫn riêng tư về luồng toàn tab trong RAM, khung so sánh được giữ và hành vi xóa.

Dùng hồ sơ tạm và nội dung giả lập khi điều tra. Không đăng bí mật hoặc dữ liệu họp thật trong issue, log, ảnh hoặc pull request công khai.
