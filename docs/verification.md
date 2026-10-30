# Verification — MeetScribe 1.0.0

2026-10-29. Mã nguồn mới độc lập; không thay extension/skill cũ.

## Đã kiểm tra

- 13 Node unit tests: đường dẫn theo ngày địa phương, Unicode/tên nguy hiểm, kiểm tra batch có thứ tự; hàng đợi Start/Stop; ảnh đầu tiên, ảnh trùng/con trỏ, đổi màu, vùng đổi nhỏ, cooldown, giới hạn, slide quay lại, thay đổi nhỏ ổn định, không coi im lặng là hết họp.
- 13 browser checks với Chrome riêng: IndexedDB thật và DOM/MutationObserver thật; giao tiếp extension được mô phỏng ở nhóm này. Bao gồm lưu bền/gửi lặp; reload không mất journal; tải gián đoạn và thử lại; 30 ảnh/giờ; ghi final thất bại rollback toàn bộ; chốt phiên idempotent; bấm Start lặp và Stop xả lô; thu nhỏ/cửa sổ hẹp; lỗi truyền tạm thời và tiếp tục; vùng share mất; context invalidated không có uncaught error; Stop khi getUserMedia chưa trả về; video tổng hợp thật crop đúng nửa xanh, timestamp/caption context, ảnh trùng không lưu thêm, tracks được dừng.
- Smoke test extension unpacked thật trong Chrome for Testing/hồ sơ riêng: synthetic Meet page → content script → service worker → IndexedDB → Chrome Downloads → file trên đĩa → thư viện. `finished.json`, `session-final.json`, caption JSONL và sự kiện tải hoàn tất, không còn file chờ, không page/worker errors. File JSONL đã kiểm tra chứa caption cuối lúc Stop.
- Visual QA: thanh nổi trên nền tối tại 1440,768,375px, giao diện thư viện desktop. Không tràn thanh ở viewport hẹp. Dùng system font, SVG nội bộ, không tải font từ mạng; reduced-motion có quy tắc riêng.

## Rà soát độc lập và sửa

Một reviewer độc lập đã đọc mã. Đã sửa: Stop bị bỏ qua khi Start đang chạy; luồng ảnh bật muộn sau Stop; caption lỗi tạm thời không có đường tiếp tục; final status/metadata/marker ghi rời rạc; trạng thái share cũ khi vùng biến mất; giới hạn giờ bị reset khi bật lại capture. Có regression coverage cho các hành vi tương ứng. Thông báo thành công dùng trạng thái thông tin và nút thu nhỏ đủ 44px.

## Phạm vi chưa kiểm chứng trực tiếp

Chưa chạy trong cuộc họp Google Meet thật của người dùng. Smoke harness thêm host permission trong bản sao test-only để inject trang Meet mô phỏng; bản phát hành chỉ activeTab. Vì vậy cần thử thao tác bấm biểu tượng extension, DOM caption hiện hành và quyền tabCapture trên Chrome thực tế. Không tuyên bố ảnh từ cuộc họp thật đã được chụp.

Chọn vùng hiện dùng con trỏ chuột (hạn chế còn lại); thanh điều khiển và di chuyển có bàn phím. Không có chức năng xóa backup trong giao diện; có thể tăng dữ liệu hồ sơ nếu dùng lâu. Không tự kết nối AI/agent hoặc tổng hợp Word.


# Zoom update 1.1.0 — 2026-10-30

Đã đọc giao diện tab Zoom thật trước khi thay mã: app.zoom.us PWA có iframe #webclient và #meeting-app trong khung con; tại thời điểm đọc chưa thấy vùng caption đang mở. Không bật ghi âm hoặc gửi yêu cầu tới host. Sau đó tab Zoom ban đầu không còn trong danh sách tab; không xác nhận phiên thật đã thu caption/ảnh.

Đã bổ sung kiểm thử domain Zoom chính thức và chống lookalike, chọn khung họp, quy đổi tọa độ iframe. Zoom DOM fixture kiểm tra nhận caption và Stop drain. Smoke extension mới dùng Zoom PWA wrapper cùng một iframe nguồn ngoài không có quyền: cài bộ thu vào đúng frame, start/stop qua IPC thật, file JSONL tải thật chứa caption cuối, không chứa nội dung iframe không liên quan.

Số kiểm thử toàn bộ bản 1.1.0: 18 unit +14 browser checks +2 đường đi unpacked extension (Meet và Zoom PWA mô phỏng). File package không thêm host permissions; host grant chỉ tồn tại trong bản sao test. Quyền lấy ảnh khi bấm extension và caption thực tế vẫn cần thử trên Zoom thật sau Reload.

Nguồn hướng dẫn phụ đề chính thức: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0059762

Tiếp tục kiểm tra trực tiếp ngày2026-10-30: đã thấy tab Zoom mở lại với ID mới, bật Show Captions qua menu Zoom và đọc được phụ đề tiếng Việt thực tế; có sharee-container cùng live-transcription-subtitle__box, .live-transcription-subtitle__content và #live-transcription-subtitle. Selector hiện tại lấy khung box bên ngoài, giữ được nhiều dòng và người nói thô. Đã lưu ảnh xác minh bật captions trong outputs của chat. Chưa bấm Start MeetScribe, chưa tuyên bố đã lưu caption/ảnh cuộc họp thực. Đã yêu cầu người dùng Reload tiện ích và mở thanh nổi để kiểm tra tiếp, không reload/rời cuộc họp.
