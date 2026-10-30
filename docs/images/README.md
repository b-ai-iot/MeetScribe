# Documentation screenshots / Ảnh minh họa

These PNGs are generated from the actual unpacked MeetScribe extension. The meeting page, captions, names, shared slide and session records are synthetic fixtures. They do not contain private meeting data, and do not demonstrate validation in a live Meet/Zoom call. The extension interface is currently Vietnamese.

Các ảnh PNG được chụp từ tiện ích MeetScribe nạp unpacked thật. Trang họp, phụ đề, tên, slide chia sẻ và các phiên là dữ liệu demo giả lập. Ảnh không chứa dữ liệu cuộc họp cá nhân và không chứng minh tiện ích đã được thử trong cuộc gọi Meet/Zoom trực tiếp. Giao diện tiện ích hiện dùng tiếng Việt.

## Regenerate / Tạo lại

From the repository root / Từ thư mục gốc repository:

```sh
npm ci
npx playwright install chromium
npm run docs:screenshots
```

The script uses a disposable Chrome profile and a throwaway extension copy with a fixture-only host grant; neither personal profiles nor the product manifest are changed.

Script dùng hồ sơ Chrome tạm và bản sao tiện ích với quyền host chỉ dành cho trang giả lập; không sửa hồ sơ cá nhân hoặc manifest sản phẩm.

| Image / Ảnh | Content / Nội dung |
| --- | --- |
| `toolbar.png` | Toolbar over a synthetic meeting / Thanh nổi trên trang họp demo |
| `library.png` | Session library and ZIP controls / Thư viện phiên và nút xuất ZIP |
| `settings.png` | Appearance and destination settings / Cài đặt giao diện và nơi lưu |
| `library-mobile.png` | Narrow library layout, not mobile-browser support / Bố cục thư viện hẹp, không phải hỗ trợ trình duyệt di động |
