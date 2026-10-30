# MeetScribe Documentation · Tài liệu MeetScribe

Welcome to the MeetScribe documentation repository. All guides are maintained in parallel in English (`docs/en/`) and Vietnamese (`docs/vi/`).

Chào mừng bạn đến với trung tâm tài liệu của MeetScribe. Toàn bộ tài liệu được duy trì song song bằng tiếng Anh (`docs/en/`) và tiếng Việt (`docs/vi/`).

---

## Documentation Index · Mục lục tài liệu

| Guide · Hướng dẫn | English | Tiếng Việt | Summary · Tóm tắt nội dung |
| :--- | :--- | :--- | :--- |
| **1. Installation**<br>Cài đặt | [English Guide](en/installation.md) | [Hướng dẫn tiếng Việt](vi/installation.md) | Loading unpacked extension, Chrome requirements, permissions, and packaging.<br>Nạp tiện ích chưa giải nén, yêu cầu Chrome, quyền hạn và đóng gói. |
| **2. Usage Guide**<br>Hướng dẫn sử dụng | [English Guide](en/usage.md) | [Hướng dẫn tiếng Việt](vi/usage.md) | Floating toolbar controls, caption/share pickers, session library, and settings.<br>Thao tác thanh nổi, chọn vùng phụ đề/ảnh trình chiếu, thư viện và cài đặt. |
| **3. Export Format**<br>Cấu trúc file xuất | [English Guide](en/export-format.md) | [Hướng dẫn tiếng Việt](vi/export-format.md) | Directory layouts, JSONL schemas, slide metadata, and portable AI ZIP bundles.<br>Cấu trúc thư mục, định dạng JSONL, metadata ảnh và gói nén ZIP cho AI. |
| **4. Privacy & Permissions**<br>Quyền riêng tư & Bảo mật | [English Guide](en/privacy.md) | [Hướng dẫn tiếng Việt](vi/privacy.md) | Local-first guarantees, zero AI network calls, manifest permission justifications.<br>Cam kết cục bộ, không gọi AI mạng, giải trình quyền trong manifest. |
| **5. Development & Testing**<br>Phát triển & Kiểm thử | [English Guide](en/development.md) | [Hướng dẫn tiếng Việt](vi/development.md) | Node/Python requirements, Playwright test suites, verification, and packaging.<br>Yêu cầu Node/Python, bộ kiểm thử Playwright, xác minh và quy trình đóng gói. |
| **6. Troubleshooting**<br>Xử lý sự cố | [English Guide](en/troubleshooting.md) | [Hướng dẫn tiếng Việt](vi/troubleshooting.md) | Resolving missing captions, reauthorizing directories, rescuing data, and UI resets.<br>Khắc phục mất phụ đề, cấp lại quyền thư mục, cứu dữ liệu và đặt lại giao diện. |
| **7. Architecture**<br>Kiến trúc hệ thống | [English Guide](en/architecture.md) | [Hướng dẫn tiếng Việt](vi/architecture.md) | Service worker, Shadow DOM toolbar, heuristic detector, and IndexedDB pipeline.<br>Service worker, thanh nổi Shadow DOM, bộ nhận diện phụ đề và đường ống IndexedDB. |

---

## Community & Project Policies · Quy định cộng đồng & Dự án

- **Contributing Guide · Hướng dẫn đóng góp:** [CONTRIBUTING.md](../CONTRIBUTING.md) · [CONTRIBUTING.vi.md](../CONTRIBUTING.vi.md)
- **Code of Conduct · Quy tắc ứng xử:** [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) · [CODE_OF_CONDUCT.vi.md](../CODE_OF_CONDUCT.vi.md)
- **Security Policy · Chính sách bảo mật:** [SECURITY.md](../SECURITY.md) · [SECURITY.vi.md](../SECURITY.vi.md)
- **Changelog · Nhật ký thay đổi:** [CHANGELOG.md](../CHANGELOG.md) · [CHANGELOG.vi.md](../CHANGELOG.vi.md)
- **License · Giấy phép:** [MIT License](../LICENSE)

---

## Media & Screenshots · Hình ảnh & Ảnh chụp màn hình

Images used throughout the documentation are located in [`docs/images/`](images/) (referenced as relative paths):
- `toolbar.png` — Floating toolbar overlay on synthetic Google Meet captions.
- `library.png` — Session library with search, backup size, and ZIP export actions.
- `settings.png` — Settings page with opacity, font size preview, and directory configuration.
- `library-mobile.png` — Responsive library layout on compact screens.

All screenshots depict synthetic demonstration data to protect privacy.
Toàn bộ ảnh chụp giao diện sử dụng dữ liệu mô phỏng nhằm bảo đảm tính riêng tư.
