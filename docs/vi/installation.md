# Cài đặt & Thiết lập

**Tiếng Việt** · [English](../en/installation.md) · [Mục lục tài liệu](../README.md)

Tài liệu này hướng dẫn bạn cách cài đặt tiện ích MeetScribe từ mã nguồn, kiểm tra các quyền hạn trong manifest và chuẩn bị môi trường ghi chép cuộc họp.

---

## Yêu cầu môi trường

- **Trình duyệt:** Google Chrome trên máy tính (phiên bản 116 trở lên).
- **Hệ điều hành:** macOS, Windows hoặc Linux.
- **Nền tảng cuộc họp:** Phiên bản web chính thức của [Google Meet](https://meet.google.com) và [Zoom Web Client](https://app.zoom.us/wc).
- **Không hỗ trợ:** Ứng dụng Zoom desktop cài trên hệ điều hành (`zoom.us.app` / `Zoom.exe`) **không** được hỗ trợ do tiện ích Chrome không thể tương tác trực tiếp với ứng dụng máy tính bên ngoài.

---

## Cách 1: Nạp tiện ích chưa giải nén (Khuyên dùng)

Với bản ổn định đóng gói sẵn, tải ZIP tiện ích và `SHA256SUMS.txt` từ [GitHub Releases](https://github.com/b-ai-iot/MeetScribe/releases/latest), [kiểm tra SHA-256](releasing.md#kiểm-tra-file-tải-về) rồi giải nén. Tải thư mục `MeetScribe/` theo các bước Chrome bên dưới. Chưa có trên Chrome Web Store.

Để dùng mã nguồn:

1. **Sao chép kho mã nguồn:**
   ```bash
   git clone https://github.com/b-ai-iot/MeetScribe.git
   cd MeetScribe
   ```
   *(Hoặc tải tệp ZIP mã nguồn từ nhánh `main` trên GitHub và giải nén).*

2. **Mở trang quản lý Tiện ích của Chrome:**
   Trên trình duyệt Google Chrome, truy cập địa chỉ:
   ```text
   chrome://extensions/
   ```

3. **Bật Chế độ dành cho nhà phát triển:**
   Gạt bật công tắc **Chế độ dành cho nhà phát triển** (Developer mode) ở góc trên bên phải trang.

4. **Tải tiện ích đã giải nén:**
   - Bấm nút **Tải tiện ích đã giải nén** (Load unpacked) ở góc trên bên trái.
   - Trong cửa sổ chọn thư mục, tìm và chọn đúng thư mục `extension/` nằm trong thư mục `MeetScribe` vừa tải về (đảm bảo thư mục này chứa tệp `manifest.json`).

5. **Ghim tiện ích lên thanh công cụ:**
   - Bấm vào biểu tượng mảnh ghép (Tiện ích) trên thanh công cụ Chrome.
   - Tìm dòng **MeetScribe** (phần tên phụ theo ngôn ngữ Chrome) và bấm vào biểu tượng chiếc ghim để tiện ích luôn hiển thị.

---

## Cách 2: Đóng gói tệp ZIP cục bộ

Nếu bạn muốn tạo một gói nén ZIP chuẩn để lưu trữ hoặc chuyển sang máy khác:

1. Đảm bảo máy tính đã cài đặt Python 3.9 trở lên.
2. Chạy lệnh đóng gói từ thư mục gốc của dự án:
   ```bash
   npm run package
   ```
   *(Hoặc chạy trực tiếp: `python3 tools/package.py`)*
3. Kết quả đóng gói sẽ nằm tại:
   ```text
   dist/MeetScribe-1.3.0.zip
   ```
4. Giải nén tệp `MeetScribe-1.3.0.zip`, bạn sẽ nhận được thư mục `MeetScribe/` hoàn chỉnh chứa `manifest.json`.
5. Thực hiện theo các bước 2–5 ở trên và trỏ **Tải tiện ích đã giải nén** vào thư mục `MeetScribe/` vừa giải nén.

---

## Bảng giải trình quyền hạn (Permissions)

Khi nạp MeetScribe, Chrome sẽ đăng ký các quyền được khai báo trong [`extension/manifest.json`](../../extension/manifest.json). Bảng dưới mô tả cách sử dụng hiện tại:

| Quyền hạn | Mục đích kỹ thuật |
| :--- | :--- |
| `activeTab` | Chèn thanh điều khiển nổi vào đúng tab cuộc họp đang hoạt động khi bạn bấm vào biểu tượng tiện ích. |
| `scripting` | Thực thi các đoạn mã nội dung và bảng kiểu hiển thị thanh điều khiển trên trang họp. |
| `tabCapture` | Nhận luồng video toàn tab tạm trong RAM, rồi cắt vùng share đã xác nhận; không yêu cầu âm thanh. |
| `offscreen` | Chạy tài liệu ngầm (offscreen document) để xử lý cắt và lọc trùng ảnh trình chiếu mà không làm đơ trang họp. |
| `downloads` | Xuất nhật ký phiên, các tệp phụ đề JSONL, ảnh PNG và gói nén ZIP vào thư mục Downloads của Chrome. |
| `alarms` | Thử lại tệp xuất còn chờ mỗi phút. Bộ đếm xả caption mười giây chạy riêng trong content script. |
| `unlimitedStorage` | Yêu cầu dung lượng cục bộ mở rộng; không ngăn xóa thủ công, lỗi đĩa hoặc mọi dạng mất dữ liệu. |
| `storage` | Lưu giao diện bằng chrome.storage.local. Directory handle và mã nơi lưu đang chọn nằm trong IndexedDB. |

> **Lưu ý về Host Permissions:** Bản tiện ích chính thức dùng hàng ngày có **0 quyền host diện rộng** (không xin `<all_urls>`, `*://*/*` hay wildcard tên miền). Chỉ riêng bản sao kiểm thử tự động (smoke test) mới tạm thêm quyền host cụ thể của Meet/Zoom rồi định tuyến URL về trang mô phỏng cho Playwright.

---

## Kiểm tra sau khi cài đặt

1. Mở một tab mới và tham gia một cuộc họp trên [Google Meet](https://meet.google.com) hoặc [Zoom Web](https://app.zoom.us/wc).
2. Bật tính năng phụ đề trực tiếp trong cuộc họp:
   - **Google Meet:** Bấm vào biểu tượng **CC** ở thanh điều khiển phía dưới.
   - **Zoom Web:** Bấm vào nút **Phụ đề** (Captions / Show Captions).
3. Bấm vào biểu tượng **MeetScribe** trên thanh tiện ích Chrome.
4. Thanh điều khiển kính mờ nổi sẽ xuất hiện ở góc trên bên trái của tab với huy hiệu `LOCAL · PRIVATE` và nút bấm chính mang nhãn `Bắt đầu ghi`.

Xem tiếp [Hướng dẫn sử dụng](usage.md) để biết chi tiết thao tác từng nút bấm và quy trình thu nhận. Nếu gặp vấn đề khi cài đặt, tham khảo mục [Xử lý sự cố](troubleshooting.md).
