# Quản trị và nhánh

[English](../en/governance.md)

MeetScribe dùng GitHub Flow. `main` là nhánh mặc định và nhánh dài hạn duy nhất. Tạo nhánh ngắn hạn `feat/<chủ-đề>`, `fix/<chủ-đề>`, `docs/<chủ-đề>` hoặc `chore/<chủ-đề>` từ main mới nhất; sửa khẩn dùng `hotfix/<chủ-đề>` và vẫn tuân thủ cùng kiểm tra. Mở PR vào main, chờ CI đạt, giải quyết thảo luận rồi squash merge. Nhánh làm việc trên remote được tự xóa sau merge. Không cần nhánh mẫu hoặc develop/release dài hạn. Phát hành ổn định dùng tag có chú thích `vX.Y.Z`.

## Quyền truy cập

| Vai trò | Quyền |
| --- | --- |
| Người đóng góp công khai | Đọc, fork, tạo issue và PR; không có quyền push |
| Maintainer tin cậy khi được bổ nhiệm | Ghi nhánh làm việc, review/merge PR đủ điều kiện; không bỏ qua kiểm tra main |
| Chủ repo `@b-ai-iot` | Quản trị và tạo tag ổn định; ngoại lệ review qua PR bên dưới |
| GitHub Actions | Mặc định chỉ đọc; chỉ job phát hành được ghi nội dung; không được tự duyệt PR |

Không tự thêm cộng tác viên. Repo thuộc tài khoản cá nhân không có team/custom role của tổ chức; chủ repo cấp quyền tối thiểu cho từng người. CODEOWNERS hiện chuyển mọi thay đổi tới `@b-ai-iot`; cập nhật khi có thêm maintainer.

## Quy tắc thực thi

Ruleset bảo vệ main **không có người được bỏ qua**: bắt buộc PR, check `verify` từ GitHub Actions đạt trên main mới nhất, giải quyết thảo luận, lịch sử tuyến tính, cấm force push và xóa nhánh. Chỉ bật squash merge.

Ruleset review riêng yêu cầu một phê duyệt, review của CODEOWNER và hủy phê duyệt cũ khi có commit mới. Admin chỉ được bỏ qua **ruleset review và chỉ thông qua PR**, giúp chủ repo duy nhất merge PR của mình sau khi CI đạt. Không được bỏ qua các kiểm tra bắt buộc của main. Ngoại lệ này không thay thế review độc lập của con người; nên thu hẹp khi có maintainer thứ hai. Admin vẫn có thể chỉnh chính sách repo, như mọi repo do chủ sở hữu quản lý.

Quy tắc tag chỉ cho admin tạo `v*`, cấm sửa/xóa tag và không có ngoại lệ sửa/xóa. Immutable release còn khóa tài sản và tag đã phát hành. Không tái sử dụng phiên bản đã công bố; sửa lỗi bằng bản vá mới.

Xem [quy trình phát hành](releasing.md), [đóng góp](../../CONTRIBUTING.vi.md) và [GitHub rulesets](https://github.com/b-ai-iot/MeetScribe/settings/rules). Cấu hình GitHub là nguồn xác thực; các quy tắc được áp dụng qua API, không tự cài chỉ bằng việc clone repo.

Định nghĩa ruleset nằm trong [`.github/rulesets/`](../../.github/rulesets/). Thay đổi các file này cần admin cập nhật riêng qua API hoặc Settings.
