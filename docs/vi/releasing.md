# Phát hành

[English](../en/releasing.md) · [Quản trị](governance.md)

Dùng SemVer ổn định `vMAJOR.MINOR.PATCH`: patch cho sửa lỗi tương thích, minor cho tính năng tương thích, major cho thay đổi không tương thích. `v1.3.0` là GitHub release đóng gói đầu tiên; các mục changelog cũ mô tả lịch sử mã nguồn.

1. Tạo `chore/release-X.Y.Z` từ main mới nhất. Cập nhật `package.json`, hai vị trí phiên bản trong `package-lock.json`, `extension/manifest.json`, `extension/model.mjs`, ví dụ phiên bản và changelog hai ngôn ngữ. Có thể dùng `npm install --package-lock-only` để cập nhật lockfile. Ghi ngày và nội dung phát hành EN/VI.
2. Chạy `npm ci`, `npm run docs:check`, `npm test`, `python3 -m unittest discover -s tests -p 'test_release.py'`, các bộ browser/extension/language rồi `npm run package`. Workflow CI có lệnh cài trình duyệt. Kiểm tra bằng `python3 tools/release.py --tag vX.Y.Z --notes release-notes.md` (file ghi chú tạm không cần commit).
3. Mở PR vào main, review kết quả và đợi `verify` đạt. Squash merge; chủ repo có thể dùng ngoại lệ review khi chỉ có một maintainer. Không bỏ qua PR hoặc CI.
4. Fetch main và chọn commit phát hành đã kiểm chứng. Admin tạo và push tag có chú thích:
   ```sh
   git fetch origin main --tags
   git switch main
   git pull --ff-only origin main
   git tag -a vX.Y.Z -m "MeetScribe vX.Y.Z"
   git push origin vX.Y.Z
   ```
5. Workflow Release kiểm tra phiên bản đồng nhất và commit thuộc main, chạy lại toàn bộ CI, tải artifact ZIP/checksum, kiểm tra SHA-256 và tạo ghi chú song ngữ. Tải file lên bản nháp trước khi công bố. Chỉ job publish có `contents: write`; PR từ fork không nhận thông tin đăng nhập phát hành.
6. Kiểm tra workflow, trang release và file tải về. Cần có `MeetScribe-X.Y.Z.zip`, `SHA256SUMS.txt`; GitHub còn cung cấp archive mã nguồn. Giải nén ZIP và tải thư mục `MeetScribe/` vào Chrome. Xác nhận release đã công bố là immutable.

Thời gian và quyền của các entry ZIP được cố định: cùng mã nguồn và cùng Python/zlib tạo cùng byte khi đóng gói lại. Phiên bản công cụ nén khác nhau có thể cho byte khác nhau. Checksum phát hiện file tải bị đổi; không phải chữ ký của maintainer.

## Kiểm tra file tải về

Tải cả hai file từ [cùng release](https://github.com/b-ai-iot/MeetScribe/releases/latest), mở terminal tại thư mục đó:

```sh
# Linux
sha256sum --check SHA256SUMS.txt
# macOS
shasum -a 256 -c SHA256SUMS.txt
```

Windows PowerShell: chạy `Get-FileHash .\MeetScribe-1.3.0.zip -Algorithm SHA256` rồi so hash với `SHA256SUMS.txt`.

## Khôi phục

Lỗi trước công bố có thể để lại draft. Khắc phục lỗi hạ tầng tạm thời và chạy lại workflow; workflow có thể thay file của draft rồi công bố. Chạy lại sẽ giữ nguyên release đã công bố. Kiểm tra draft và file trước khi thử lại. Lỗi code cần PR, phiên bản và tag mới; không ghi đè tag được bảo vệ hoặc tài sản đã phát hành immutable. Không xóa/tạo lại release đã công bố để sửa lỗi.

Bộ kiểm tra phiên bản chủ động từ chối tag prerelease. Cần chính sách prerelease được review trước khi thêm release candidate. Chưa cấu hình xuất bản Chrome Web Store hoặc khóa ký.
