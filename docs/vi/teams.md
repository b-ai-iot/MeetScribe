# Microsoft Teams trên trình duyệt

[English](../en/teams.md) · [Hướng dẫn sử dụng](usage.md)

MeetScribe 1.6.0 bổ sung Teams web trong Chrome máy tính. Tiện ích đọc phụ đề do Teams hiển thị nên cần bật phụ đề trước khi ghi. Tiện ích không bật ghi hình Teams, không thu âm, không gọi Microsoft Graph và không vượt chính sách tenant.

## Bắt đầu ghi cuộc họp

1. Mở Teams tại `https://teams.microsoft.com`, `https://teams.cloud.microsoft` hoặc `https://teams.live.com` trong Chrome rồi tham gia cuộc họp bằng trình duyệt.
2. Trên thanh họp, mở **More → Language and speech → Show live captions** hoặc **Turn on live captions**. Tên nút có thể khác theo phiên bản và ngôn ngữ Teams. Chọn ngôn ngữ đang nói trong Teams.
3. Bấm biểu tượng MeetScribe đã ghim, mở capsule nổi và chọn **Bắt đầu ghi**.
4. MeetScribe tìm toàn bộ khung caption Teams. Nếu chưa nhận được, chọn **Vùng caption** rồi chọn phần phụ đề đang hiển thị, gồm tên người nói nếu có; tránh chọn chat hoặc danh sách người tham gia.
5. Nếu cần ảnh trình chiếu, chọn **Vùng share** rồi chọn đúng vùng slide. Bấm **Đánh dấu** ở mốc quan trọng. Ảnh được lấy mẫu và lọc trùng nên có thể bỏ lỡ slide chuyển quá nhanh.
6. Chọn **Dừng và lưu**, kiểm tra phiên trong **Thư viện** rồi tải ZIP. Metadata ghi `platform: "teams"`; caption và timestamp quan sát giữ định dạng hiện có.

## Phạm vi và giới hạn

- Chỉ nhận chính xác ba host ở trên. Tên miền giả mạo, trang đăng nhập và host nhúng tùy chỉnh bị từ chối. Host riêng cho khối chính phủ chưa thuộc phạm vi bản này.
- Giữ cuộc họp và caption trong cùng tab trình duyệt. Chưa hỗ trợ Teams desktop, di động, cửa sổ caption tách riêng hoặc vùng share trong iframe lồng sâu/không đo được. Khi không quy đổi được vùng ảnh, tiện ích báo lỗi thay vì chụp sai; caption có thể tiếp tục.
- Tổ chức hoặc chủ cuộc họp có thể giới hạn caption và sao chép. Tuân thủ chính sách đó; khi phụ đề không có hoặc không được render, tiện ích không thể thu. Không có cơ chế vượt chính sách.
- Các DOM hook nội bộ Teams có thể thay đổi. Tự nhận dựa trên `data-tid="closed-caption-renderer-wrapper"` và `data-tid="closed-caption-renderer"`; chọn vùng thủ công là phương án dự phòng.
- Kiểm thử tự động dùng DOM mô phỏng Teams tại URL chính thức trong hồ sơ trình duyệt tạm. Đã kiểm tra luồng tiện ích thật, lưu trữ, Downloads, ZIP, VI/EN, thay khung caption và tọa độ frame. Bản sao tiện ích thử nghiệm cấp quyền host cho fixture và được nạp qua test harness; thao tác bấm icon/cấp activeTab và luồng chụp màn hình thật vẫn cần kiểm tra thủ công. Đây không phải bằng chứng cho mọi tenant/phiên bản đang họp thật. Nên thử một phiên ngắn được phép trước khi dùng chính thức.

## Nguồn tham khảo

[Hướng dẫn Live captions của Microsoft](https://support.microsoft.com/en-us/teams/meetings/use-live-captions-in-microsoft-teams-meetings) · [Yêu cầu Teams for Web](https://learn.microsoft.com/en-us/microsoftteams/teams-client-web).

Nguồn DOM đã xem ngày 16 tháng 11 năm 2026: [mã thu caption Teams upstream](https://github.com/royyandzakiy/msteams-live-caption-capture/blob/main/capture.js) sử dụng hook renderer-wrapper và caption-text. MeetScribe giữ cơ chế snapshot/observer/xuất riêng; không sao chép thuật toán thu của dự án khác.
