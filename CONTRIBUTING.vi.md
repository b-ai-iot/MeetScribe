# Hướng dẫn đóng góp cho MeetScribe

**Tiếng Việt** · [English](CONTRIBUTING.md)

Cảm ơn bạn đã quan tâm và muốn đóng góp cho dự án MeetScribe! Chúng tôi luôn hoan nghênh các đóng góp, báo cáo lỗi và cải tiến tài liệu bằng cả **tiếng Việt và tiếng Anh**.

---

## Nguyên tắc cốt lõi

1. **100% Cục bộ & Hoàn toàn không thu thập dữ liệu (Zero Telemetry):**
   MeetScribe tuyệt đối không thực hiện các kết nối mạng ra bên ngoài mà không có yêu cầu từ người dùng, không gọi API AI khi đang họp và không chèn mã theo dõi hay thống kê của bên thứ ba. Giữ luồng thu/journal cục bộ và mô tả rõ giới hạn của thư mục người dùng chọn cùng việc chia sẻ về sau; xem [quyền riêng tư](docs/vi/privacy.md).
2. **Không thư viện phụ thuộc chạy ngoài (Zero Runtime Dependencies):**
   Thư mục tiện ích chính thức (`extension/`) chạy bằng chuẩn ECMAScript Modules và các Web API gốc (Shadow DOM, MutationObserver, IndexedDB, File System Access API). Tuyệt đối không thêm thư viện npm vào mã nguồn tiện ích và không đưa vào quy trình đóng gói/biên dịch phức tạp cho phần chạy trong trình duyệt.
3. **Trung thực về giới hạn & Chính xác về tài liệu:**
   Luôn ghi chép đúng khả năng và giới hạn thực tế của tiện ích. Không đưa ra các cam kết vượt quá phạm vi kiểm thử tự động hay các kịch bản thực tế đã xác minh.
4. **Đồng bộ song ngữ:**
   Khi bổ sung tính năng, thay đổi nhãn giao diện hoặc cập nhật hướng dẫn, hãy luôn đảm bảo tính đồng bộ song song giữa hai phiên bản tài liệu tiếng Anh và tiếng Việt.

---

## Quy trình phát triển & Kiểm thử

### Yêu cầu môi trường
- Node.js 20 trở lên (hệ thống CI sử dụng Node.js 22)
- Python 3.9 trở lên
- Trình duyệt Google Chrome trên máy tính
- Playwright Chromium

### Cài đặt ban đầu
```bash
git clone https://github.com/b-ai-iot/MeetScribe.git
cd MeetScribe
npm ci
npx playwright install chromium
```

### Các lệnh kiểm tra trước khi gửi mã nguồn
Trước khi tạo Pull Request, vui lòng đảm bảo toàn bộ các bộ kiểm tra sau đều vượt qua:

```bash
# 1. Chạy bộ kiểm thử đơn vị
npm test

# 2. Chạy kiểm thử DOM trên trình duyệt Chrome thật
npm run test:browser

# 3. Chạy kiểm thử tiện ích nạp unpacked qua Playwright
npm run test:extension

# 4. Kiểm tra liên kết tài liệu và tính song ngữ
npm run docs:check

# 5. Kiểm tra quy trình đóng gói tệp ZIP
npm run package
```

*(Lưu ý trên Linux/Windows: hãy đặt biến môi trường `MEETSCRIBE_TEST_CHROME` trỏ đến tệp thực thi của Chrome hoặc Playwright Chromium trước khi chạy `npm run test:browser`).*

---

## Quy trình gửi Pull Request

1. Fork kho mã nguồn và tạo nhánh tính năng mới:
   ```bash
   git checkout -b feature/ten-tinh-nang
   ```
2. Tạo các commit rõ ràng, tập trung kèm thông điệp mô tả chi tiết.
3. Đảm bảo toàn bộ kiểm thử tự động đều đạt và bổ sung kiểm thử cho các tính năng mới.
4. Nếu thay đổi giao diện, hãy cập nhật nhãn tiếng Việt và phần dịch tiếng Anh tương ứng trong tài liệu.
5. Mở Pull Request trên GitHub. Bạn có thể viết phần mô tả PR bằng tiếng Việt hoặc tiếng Anh.

---

## Quy tắc ứng xử

Mọi thành viên tham gia đóng góp đều phải tuân thủ [Quy tắc ứng xử](CODE_OF_CONDUCT.vi.md) của dự án. Hãy luôn giao tiếp tôn trọng, kiên nhẫn và xây dựng.
