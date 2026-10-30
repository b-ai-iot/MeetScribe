# MeetScribe

Extension Chrome độc lập để thu caption và chọn ảnh chia sẻ trên Google Meet và Zoom web. Giao diện tiếng Việt, thanh điều khiển kính mờ nổi trên trang họp, không gọi AI trong quá trình thu.

Mã nguồn dự án: `/Users/baopham/Desktop/ENFARM/3.Software/MeetScribe`.
Không sửa Local Collector 0.1.2, skill ghi-meeting, dữ liệu hay cấu hình extension cũ. Đây là tiện ích mới với cơ sở dữ liệu riêng.

## Cài lần đầu

1. Mở `chrome://extensions`, bật **Developer mode**.
2. Chọn **Load unpacked** và trỏ đến thư mục **extension** bên trong dự án MeetScribe. Nếu dùng ZIP, giải nén rồi chọn thư mục chứa `manifest.json`.
3. Ghim **MeetScribe — Ghi chú cuộc họp** trên thanh tiện ích Chrome.
4. Trên tab Google Meet hoặc Zoom web, bật phụ đề rồi bấm biểu tượng MeetScribe để mở thanh nổi.

Bản này cài thành tiện ích mới, không dùng nút Reload của tiện ích Local Collector cũ. Khi thử, dừng phiên cũ trước để tránh hai bộ thu cùng hoạt động.

## Dùng khi họp

- **Bắt đầu ghi**: tự nhận khung có nhãn Phụ đề/Captions khi có thể. Nếu chưa nhận được, chọn **Vùng caption**, rê chuột vào đúng khung phụ đề và click. Cuộn để chọn khung cha, Esc để hủy. Sau đó bấm Bắt đầu.
- **Vùng share**: khi có nội dung trình chiếu, chọn đúng nội dung được chia sẻ, không chọn camera hay toàn trang. Bộ thu xin quyền lấy hình từ tab và bắt đầu lọc ảnh. Nếu không lấy được hình, caption vẫn tiếp tục và giao diện báo rõ.
- **Đánh dấu**: lưu mốc caption hiện tại và thử lưu ảnh share quan trọng. Nếu slide đã có ảnh, giữ ảnh cũ và ghi lại mốc thảo luận.
- Nút dấu trừ thu nhỏ thanh. Biểu tượng bốn hướng kéo di chuyển được; dùng Tab tới nút rồi phím mũi tên cũng di chuyển được.
- **Dừng và lưu**: lưu hết caption chờ, dừng luồng ảnh, chốt phiên và xuất file. Nếu tải thất bại, vào **Thư viện phiên họp → Thử xuất lại**. Trạng thái xuất và bản dự phòng được hiển thị riêng.
- Nếu mất kết nối tạm thời, dùng **Thử lưu và tiếp tục**. Nếu extension đã reload và ngữ cảnh bị vô hiệu hóa, dùng **Cứu caption đang chờ**, kiểm tra file tải xong, rồi tải lại tab Meet và mở phiên mới. File cứu là ngoại lệ tải qua trình duyệt, có thể hiện hộp lưu tùy Chrome.

Không cần giữ một trang bộ thu riêng. Giữ tab họp mở và máy thức; nguồn phụ đề, quyền tab và tình trạng máy quyết định phạm vi thu. Tự dừng dựa trên thông báo kết thúc rõ ràng qua hai lần kiểm tra; im lặng không được coi là hết họp. Đóng/đổi trang ghi là gián đoạn nguồn.

## Lưu ở đâu?

Mặc định, Chrome dùng Downloads:

```
Downloads/MeetScribe/2026-10-29/Tên cuộc họp--150627--a1b2c3d4/
  session.json
  captions/part-000001.jsonl
  captions/part-000002.jsonl
  images/screen-001-....png
  images/screen-001-....png.json
  events/....json
  session-final.json
  finished.json
```

Nếu anh đã đổi thư mục tải mặc định trong Chrome, thư mục MeetScribe nằm dưới vị trí đó. Tiện ích dùng đường dẫn tương đối của Chrome Downloads, không ép đường dẫn tuyệt đối của máy và không yêu cầu chọn thư mục mỗi lần. Tên được làm sạch, giữ tiếng Việt, thêm giờ/giây và mã phiên để tránh ghi đè cuộc họp khác.

Caption được gom tối đa 100 bản cập nhật/lô, thường xả mỗi 10 giây. Chỉ xóa lô khỏi hàng đợi sau khi giao dịch IndexedDB thành công. Các phần JSONL không thay đổi sau khi tạo; nối theo tên part để đọc toàn bộ dữ liệu thô. Snapshot chứa phần chồng và câu được sửa: không nối máy móc thành lời nói mới. Timestamp là lúc bộ thu nhìn thấy caption, không phải thời điểm âm thanh gốc. Chưa nhận dạng chắc người nói thì để `speaker: null`.

Bản dự phòng vẫn nằm trong hồ sơ Chrome sau khi xuất. Lượt tải chỉ được đánh dấu thành công sau khi Chrome báo complete; khi bị lỗi, dữ liệu chưa xuất vẫn được giữ để thử lại. **Không gỡ tiện ích/xóa hồ sơ khi chưa kiểm tra dữ liệu đã xuất.** Thư viện hiện chưa có chức năng xóa bản dự phòng.

## Ảnh share

- Lấy mẫu 15 giây, thông thường cách ít nhất 30 giây giữa các ảnh.
- So sánh dHash64, sai khác màu RGB và vùng 8×8; loại ảnh gần trùng, trỏ lại ảnh cũ khi slide lặp lại.
- Chờ thêm một mẫu để giữ thay đổi nhỏ nhưng ổn định; không suy luận nội dung chữ bằng AI/OCR.
- Giới hạn 30 ảnh trong một giờ, 120 ảnh/phiên, 100 MiB ảnh; được kiểm tra thêm trong giao dịch lưu để không vượt khi bật/tắt luồng ảnh.
- Lưu timestamp, vùng ảnh, caption gần đó và lý do giữ ảnh trong file JSON bên cạnh PNG.
- Dùng luồng video tab tạm trong bộ nhớ; không xin âm thanh, không lưu tệp video.
- Mất/ẩn/thay khung share → giao diện yêu cầu chọn lại; không tiếp tục khẳng định đang lưu ảnh từ vùng cũ.

## Báo cáo Word

Dừng chỉ lưu dữ liệu. Khi cần, yêu cầu tổng hợp thư mục phiên thành meeting note/Word. Cung cấp cả `captions/`, `images/`, `events/` và metadata. Việc tổng hợp bằng mô hình chỉ bắt đầu khi anh yêu cầu; tiện ích không tự gọi agent hoặc gửi dữ liệu đi.

## Phát triển và kiểm thử

Chrome 116+, Node.js 20+, Python3 để đóng gói. Tiện ích không có thư viện chạy ngoài, không cần build khi Load unpacked.

```
npm install
npm test
npx playwright install chromium
npm run test:browser
npm run test:extension
python3 tools/package.py
```

Nếu dùng thư viện Playwright có sẵn của Codex, đặt NODE_PATH tới thư mục node_modules của runtime. Kiểm thử DOM mặc định dùng Google Chrome tại `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; có thể đặt `MEETSCRIBE_TEST_CHROME`. Smoke test dùng Chrome for Testing riêng. Chạy test không dùng hồ sơ Chrome cá nhân.

Smoke test tạo bản sao test-only thêm quyền host Meet để inject trang Meet mô phỏng mà không bấm thanh công cụ Chrome; gói sản phẩm chỉ có activeTab. Vì vậy smoke test không thay thế thử quyền từ thao tác bấm extension trong một Google Meet thật.

Xem `docs/verification.md` để biết chính xác các kiểm thử đã chạy và phần cần thử thực tế.

## Giới hạn của bản đầu

Google Meet và Zoom bản web trên Chrome; không hỗ trợ ứng dụng Zoom desktop. Chọn vùng hiện dùng chuột, trong khi các nút điều khiển/di chuyển hỗ trợ bàn phím. Không thể phục hồi caption chưa từng xuất hiện trong DOM hoặc chưa được thu trước khi tab bị đóng/máy tắt. Chrome hoặc chính sách doanh nghiệp có thể chặn tải hoặc tab capture; tiện ích phải hiển thị lỗi và giữ bản dự phòng.

## Cập nhật 1.1.0 — Zoom web (2026-10-30)

- Hỗ trợ app.zoom.us, các miền con chính thức zoom.us/zoom.com ở đường dẫn họp web.
- Zoom PWA thường có khung webclient bên trong trang ngoài. Tiện ích tìm khung có meeting-app, gắn thanh và bộ thu ở đó; lưu frameId để gửi lệnh đúng nơi sau khi service worker thức lại.
- Nhận diện một số khung live captions/transcript thông dụng; vẫn cho chọn Vùng caption bằng tay nếu Zoom đổi giao diện. Bật **Show Captions** trong Zoom; nếu không có, kiểm tra quyền/tính năng do host cung cấp. Tiện ích không tự yêu cầu host hay mở ghi âm.
- Ảnh share trong Zoom PWA được quy đổi từ tọa độ khung con sang toàn tab trước khi crop; không đo được vị trí thì báo chưa chụp được, caption vẫn lưu.
- Cập nhật tại thư mục cài hiện tại rồi bấm **Reload** trên thẻ MeetScribe trong chrome://extensions. Sau đó bấm biểu tượng MeetScribe trên tab Zoom. Không cần reload/rời trang Zoom nếu chưa có bộ thu chạy trong đó.
- Kiểm thử mới: 18 unit tests,14 browser checks,2 đường đi extension thật (Meet và Zoom iframe mô phỏng). Không dùng cuộc họp thật hay dữ liệu người dùng cho smoke test.
