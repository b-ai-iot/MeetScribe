# Nhật ký thay đổi

[English](CHANGELOG.md) · [README](README.vi.md)

## 1.5.0 — 2026-11-06

- Xây lại thư viện thành danh sách cuộc họp có tìm kiếm và khung nội dung phiên được chọn, có vùng caption/ảnh, phục hồi theo ngữ cảnh và một cụm xuất dữ liệu.
- Bố trí lại cài đặt thành các nhóm tùy chọn gọn bên cạnh sân khấu xem trước, với trạng thái lưu rõ ràng và thao tác Lưu tường minh.
- Ghép nút nổi thành capsule indigo/violet thống nhất và menu neo gọn; cải thiện chọn vùng cùng dọn trạng thái khi context tiện ích mất hiệu lực.
- Điều chỉnh các mẫu workspace, điều hướng, disclosure, menu và phản hồi lưu từ Lucian UX/UI Prompt; kèm thông báo MIT gốc trong gói phân phối.
- Thêm kiểm tra đua chọn phiên, thao tác theo phiên, điều hướng di động và cài đặt/điều khiển; cập nhật tài liệu song ngữ cùng ảnh UI thực tế.

## 1.4.0 — 2026-11-05

- Thiết kế lại điều khiển cuộc họp bằng nút nổi lấy cảm hứng từ AssistiveTouch và bảng thao tác gọn; hỗ trợ kéo/phím, giữ tùy chọn và hiển thị trạng thái ghi/lỗi.
- Thêm biểu tượng bong bóng caption riêng và giao diện nền ngà/xanh ngọc đồng bộ cho thư viện và cài đặt.
- Cải thiện điều hướng responsive, thứ bậc nội dung/thao tác và xem trước giao diện; giữ chức năng thu, dự phòng cục bộ, xuất, sửa quyền thư mục và VI/EN trực tiếp.
- Thêm kiểm thử nút nổi và không gian quản lý; cập nhật hướng dẫn cùng ảnh chụp song ngữ.

## 1.3.1 — 2026-11-02

- Chặn callback thanh điều khiển giữ bộ dịch bị thiếu hoặc khởi tạo dở dang (lỗi `t` / `applyTranslations`).
- Nạp bộ ngôn ngữ trước danh mục bản dịch, kiểm tra sẵn sàng trong đúng frame cuộc họp rồi mới cài callback thu caption.
- Nhận diện instance v1.3.0 còn lưu trước khi mở, yêu cầu tải lại tab sau khi dừng/lưu; không thay bộ thu hoặc loại bỏ caption đang chờ. Bắt buộc nhận xác nhận mở thành công.
- Thêm kiểm thử thiếu dependency, giữ nguyên instance cũ và mở lại nhiều lần, gồm thu caption VI/EN với tiện ích unpacked thật.

## 1.3.0 — 2026-10-30

- GitHub release đóng gói đầu tiên, có ZIP ổn định, checksum SHA-256 và workflow phát hành song ngữ.
- Áp dụng GitHub Flow, CODEOWNERS, mẫu PR và chính sách nhánh/tag với ngoại lệ review cho maintainer duy nhất.
- Thêm MIT theo lựa chọn của người dùng và đưa giấy phép vào ZIP phân phối tiện ích.
- Thêm bộ hướng dẫn Anh/Việt, quy định đóng góp/bảo mật/ứng xử và biểu mẫu issue.
- Thêm ảnh tiện ích thật với dữ liệu cuộc họp giả lập và lệnh tạo lại ảnh.
- Thêm kiểm tra tài liệu cục bộ và workflow xác minh GitHub Actions.
- Cho bộ test trình duyệt tự tạo thư mục kết quả trong checkout mới. Các thay đổi tài liệu không đổi hành vi runtime.

- Thêm lựa chọn giao diện VI/EN lưu bền trong Cài đặt, cập nhật trang đang mở và thanh nổi đang thu.
- Dịch UI tĩnh/động, nhãn hỗ trợ tiếp cận, thông báo lỗi/phục hồi và phần hướng dẫn sinh khi xuất; không đổi dữ liệu đã thu.
- Thêm metadata ngôn ngữ gốc của Chrome, chuyển đổi cấu hình/đặt lại và kiểm thử việc thu đang chạy, tải lại, chi tiết lỗi gốc cùng đua đọc cấu hình.

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


`v1.3.0` là GitHub release đóng gói đầu tiên. Các mục cũ mô tả lịch sử mã nguồn. Chưa phân phối qua Chrome Web Store.
