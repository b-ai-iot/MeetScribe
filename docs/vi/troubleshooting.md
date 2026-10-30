# Xử lý sự cố & Câu hỏi thường gặp

**Tiếng Việt** · [English](../en/troubleshooting.md) · [Mục lục tài liệu](../README.md)

Tài liệu này cung cấp hướng dẫn chẩn đoán và khắc phục các vấn đề thường gặp liên quan đến nhận diện phụ đề, chụp ảnh màn hình chia sẻ, quyền thư mục và giao diện thanh điều khiển.

---

## 1. Nhận diện phụ đề & Nền tảng họp

### Vấn đề: Thanh nổi báo "Bật phụ đề cuộc họp, kiểm tra vùng caption rồi bắt đầu" và không ghi
- **Nguyên nhân:** Tính năng phụ đề trực tiếp của Google Meet hoặc Zoom chưa được bật, hoặc nền tảng họp đã thay đổi cấu trúc thẻ chứa phụ đề trong DOM.
- **Cách khắc phục:**
  1. Đảm bảo đã bật phụ đề trực tiếp trong giao diện cuộc họp:
     - **Google Meet:** Bấm vào biểu tượng phụ đề (**CC**) ở thanh điều khiển dưới cùng.
     - **Zoom Web:** Bấm vào nút **Phụ đề** (Captions / Show Captions).
  2. Nếu cuộc họp đã hiển thị phụ đề mà tiện ích chưa tự nhận được, hãy bấm nút **`Vùng caption`** trên thanh nổi. Rê chuột vào đúng khung chữ nhật chứa phụ đề, cuộn chuột lên để mở rộng sang khung cha nếu cần, rồi click chuột trái để khóa vùng chọn. (Bấm phím `Esc` nếu muốn hủy chọn).

### Vấn đề: `speaker` là null hoặc văn bản thiếu tên người nói
Bộ thu hiện luôn ghi `speaker: null`, không phân tích danh tính người nói thành trường riêng. Tên đang hiển thị trong vùng caption có thể nằm trong `text`. Chọn vùng thủ công rộng hơn vừa đủ có thể giữ tên nhìn thấy, nhưng không làm trường `speaker` có giá trị; tránh lấy cả chat và nút không liên quan.

### Vấn đề: Không thu thập được cuộc họp mở trên phần mềm Zoom desktop cài trên máy
- **Nguyên nhân:** Tiện ích mở rộng Chrome hoàn toàn không thể tương tác hay đọc dữ liệu từ các ứng dụng phần mềm độc lập ngoài hệ điều hành (`zoom.us.app` / `Zoom.exe`).
- **Cách khắc phục:** Tham gia cuộc họp thông qua phiên bản **Zoom Web Client** chạy trực tiếp trong Google Chrome (`https://app.zoom.us/wc`).

---

## 2. Chụp ảnh màn hình chia sẻ (`Vùng share`)

### Vấn đề: Giao diện báo "Chưa lấy được ảnh share" hoặc "Mất vùng share"
- **Nguyên nhân:** Người trình chiếu đã tắt chia sẻ màn hình, thu nhỏ cửa sổ trình chiếu, hoặc bạn đã từ chối hộp thoại xin quyền tab capture của Chrome.
- **Cách khắc phục:**
  1. Đồng ý cấp quyền tab capture khi trình duyệt Chrome hiển thị thông báo.
  2. Khi nội dung trình chiếu hiển thị trở lại, bấm nút **`Vùng share`** trên thanh nổi và click vào đúng vùng slide trình chiếu.
  3. **Lưu ý:** Dù mất ảnh slide tạm thời, việc thu nhận phụ đề vẫn diễn ra liên tục và an toàn.

### Vấn đề: Các slide lướt qua quá nhanh không được chụp lại
- **Giải thích:** Để tối ưu hóa hiệu năng CPU và tránh lãng phí dung lượng đĩa, MeetScribe lấy mẫu mỗi **15 giây** và áp dụng khoảng cách tối thiểu **30 giây** giữa hai lần tự động lưu ảnh (đánh dấu thủ công có thể bỏ qua khoảng chờ nhưng vẫn chịu kiểm tra trùng và hạn mức).
- **Cách khắc phục:** Chủ động bấm nút **`Đánh dấu`** trên thanh nổi bất cứ khi nào người trình chiếu chuyển sang một slide quan trọng để tiện ích thử lưu ảnh. Slide trùng hoặc hết hạn mức vẫn có thể khiến ảnh mới không được lưu.

---

## 3. Lưu trữ, Thư mục & Sự cố xuất file

### Vấn đề: Giao diện báo "Lỗi xuất file · bản dự phòng còn nguyên"
- **Giải thích:** Đã xảy ra lỗi trong quá trình ghi tệp ra đĩa (ví dụ: bị hủy lượt tải, ổ đĩa đầy hoặc thư mục bị mất quyền truy cập). **Phần dữ liệu đã ghi vào journal còn trong bản dự phòng để thử lại; không bảo đảm chống mất hồ sơ, lỗi đĩa hoặc mất cập nhật chưa ghi.**
- **Cách khắc phục:**
  1. Mở Thư viện phiên họp bằng cách bấm vào biểu tượng thư mục ở chân thanh nổi hoặc truy cập trang `library.html`.
  2. Tìm đến phiên họp bị lỗi.
  3. Bấm **`Thử xuất lại`** để tiếp tục ghi tệp ra đĩa, hoặc bấm **`Tải ZIP cho AI`** / **`Lưu ZIP (Save As...)`** để xuất toàn bộ phiên thành một tệp nén ZIP độc lập.

### Vấn đề: Thư mục cục bộ tùy chọn bị mất quyền ghi sau khi khởi động lại Chrome
- **Giải thích:** Chrome có thể yêu cầu cấp quyền lại sau khi khởi động lại hoặc khi quyền thay đổi. Tiện ích kiểm tra trạng thái hiện tại; handle đã lưu không bảo đảm quyền ghi luôn còn.
- **Cách khắc phục:**
  1. Trong Thư viện phiên họp (`library.html`), bấm **`Cấp lại quyền thư mục`** trên thẻ phiên họp.
  2. Hoặc mở trang Cài đặt (`settings.html`) và bấm **`Cấp lại quyền ghi cho thư mục này`**.
  3. Chrome sẽ hiện hộp thoại xác nhận quyền ghi; hãy bấm đồng ý.

### Vấn đề: Tiện ích bị tải lại giữa cuộc họp ("Cứu caption đang chờ")
- **Nguyên nhân:** Tiện ích vô tình bị bấm Reload hoặc cập nhật trong `chrome://extensions` khi tab cuộc họp vẫn đang chạy.
- **Cách khắc phục:**
  1. Bấm nút cứu hộ khẩn cấp **`Cứu caption đang chờ`** trên thanh nổi. Chrome sẽ lập tức kích hoạt lượt tải tệp chứa toàn bộ phụ đề đang chờ trong RAM.
  2. Kiểm tra tệp tải về đã hoàn tất.
  3. Tải lại (F5) tab cuộc họp và mở lại phiên ghi chép mới.

---

## 4. Giao diện thanh nổi & Hiển thị

### Vấn đề: Thanh nổi bị kéo ra ngoài màn hình, bị ẩn hoặc biến mất
- **Cách khắc phục:**
  1. Vào trang Quản lý tiện ích (`chrome://extensions`), tìm MeetScribe và bấm **Chi tiết**.
  2. Chọn **Tùy chọn tiện ích** để mở trang `settings.html`.
  3. Bấm nút **`Đặt lại mặc định`**.
  4. Thanh nổi sẽ lập tức trở về góc trên bên trái màn hình, độ mờ nền được khôi phục về **96%** và cỡ chữ về **14px**.

### Vấn đề: Không kéo được thanh nổi bằng chuột
- **Cách khắc phục:** Sử dụng phím điều hướng trên bàn phím. Nhấn phím `Tab` cho đến khi tiêu điểm chuyển đến biểu tượng di chuyển (`Di chuyển thanh điều khiển`), sau đó dùng các phím mũi tên (`Lên`, `Xuống`, `Trái`, `Phải`) để điều chỉnh vị trí thanh nổi đến vị trí mong muốn.
