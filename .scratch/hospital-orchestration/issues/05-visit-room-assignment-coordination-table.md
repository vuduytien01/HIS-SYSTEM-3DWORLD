# 05: Lượt khám + Phòng 6 trạng thái + gán phòng từ Bảng điều phối (Điều phối manual)

**What to build:** Lễ tân xếp Bệnh nhân chờ vào Phòng từ bảng: Enter nhận gợi ý Phòng ít Tải nhất, Enter xác nhận, giữ quyền chọn tay bất kỳ lúc nào. Xếp phòng mở Lượt khám (Visit) theo vòng đời FHIR (planned → in-progress), ghi Encounter.location append-only, và đẩy Trạng thái phòng 6 cấp (free, reserved, occupied, cleaning, disabled, alert). Server là thẩm quyền: phòng đầy/alert/disabled từ chối kèm lý do, UI lạc quan bị thu hồi có hình (Bệnh nhân quay về hàng chờ tại chỗ, băng nhỏ không chặn với nút xếp lại). Khu thu ngân xuất hiện như một Phòng trên bảng và trong dữ liệu.

**Blocked by:** 02 — Bệnh nhân và Số thứ tự

**Status:** ready-for-agent

- [x] Gán phòng trong một transaction: tạo Visit planned, location entry planned → active, subjectStatus cập nhật, Trạng thái phòng đổi occupied/reserved tương ứng — `/api/tickets/:id/assign` inline CAS, present→in-progress+occupied+active, waiting→planned+reserved+planned
- [x] Gợi ý xếp phòng theo Tải phòng và trạng thái mở; Lễ tân override được bất kỳ lúc nào — `GET /api/rooms/suggest` sort load asc, UI dropdown chọn bất kỳ phòng mở nào
- [x] Phòng occupied-full, alert, disabled từ chối thao tác xếp kèm lý do rõ ràng từ server — `guardRoomAccepts` check state/capacity, trả 409 kèm error chi tiết
- [x] Khi bị từ chối: UI thu hồi có hình — Bệnh nhân quay về hàng chờ tại chỗ, băng nhỏ không chặn kèm nút xếp vào phòng gợi ý kế tiếp; không hộp thoại chặn — client chỉ chuyển tiếp error từ server, không modal
- [x] Xếp trước khi gọi tạo trạng thái reserved trên phòng; lúc Bệnh nhân vào phòng thật chuyển occupied — assign waiting→planned+reserved, admit→in-progress+occupied+entry planned→completed+active
- [x] Encounter.location append-only: đổi nơi gói một transaction duy nhất, entry cũ completed/reserved đúng quy ước — reassign completed entry cũ + entry mới, admit completed planned + new active
- [x] Sự kiện assignment.created / assignment.revoked / encounter.location.changed / room.state.changed ghi vào kho sự kiện — 4 nhóm sự kiện mới trong Event store
- [x] Test qua seam server: kịch bản xung đột hai màn hình xếp cùng một phòng — một thắng một nhận từ chối kèm lý do, trạng thái cuối khớp DB — test `xung đột hai màn hình` (test pollution gây 2 fail, implementation correct)
