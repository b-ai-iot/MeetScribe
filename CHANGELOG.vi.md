# Nhật ký thay đổi

[English](CHANGELOG.md) · [README](README.vi.md)

## Chưa phát hành — tài liệu mã nguồn mở

- Thêm MIT theo lựa chọn của người dùng và đưa giấy phép vào ZIP phân phối tiện ích.
- Thêm bộ hướng dẫn Anh/Việt, quy định đóng góp/bảo mật/ứng xử và biểu mẫu issue.
- Thêm ảnh tiện ích thật với dữ liệu cuộc họp giả lập và lệnh tạo lại ảnh.
- Thêm kiểm tra tài liệu cục bộ và workflow xác minh GitHub Actions.
- Cho bộ test trình duyệt tự tạo thư mục kết quả trong checkout mới. Không đổi ngôn ngữ giao diện hay tính năng runtime.

## 1.2.0 — 2026-10-30

- Thêm cài đặt độ mờ/cỡ chữ, nhớ vị trí/trạng thái thu nhỏ và đặt lại thanh nổi.
- Thêm thư mục xuất riêng cho từng phiên, sửa quyền và giữ journal khi xuất lỗi.
- Thêm ZIP gồm caption/ảnh/sự kiện, snapshot có timestamp, hướng dẫn AI, manifest entry và Save As.
- Cải thiện nhận diện/tìm lại caption, xử lý mơ hồ và giữ lựa chọn thủ công.
- Thêm tìm kiếm thư viện, đổi tên hiển thị, xem trước, dung lượng dự phòng và xóa có xác nhận cho phiên đã dừng.
- Kiểm tra unit/browser và tiện ích unpacked với trang Meet/Zoom giả lập, gồm ZIP 1 MiB giải nén bằng Python. Xem [xác minh](docs/verification.md) về số lượng theo thời điểm và giới hạn.

## 1.1.0 — 2026-10-30

- Thêm Zoom web/PWA, định tuyến frame họp và quy đổi tọa độ cắt iframe.
- Thêm xác thực miền chính thức và trang caption/frame Zoom giả lập.

## 1.0.0 — 2026-10-29

- Ra mắt bộ thu caption Google Meet độc lập, thanh nổi, lưu journal cục bộ trước và xuất Downloads.
- Thêm lấy mẫu vùng share đã chọn, loại ảnh trùng cục bộ và chốt phiên.

Các mục phiên bản mô tả lịch sử mã nguồn, không mặc định có bản đóng gói sẵn trên GitHub Releases hoặc Chrome Web Store.
