# 05: Lượt khám + Phòng 6 trạng thái + gán phòng từ Bảng điều phối (Điều phối manual)

**What to build:** Lễ tân xếp Bệnh nhân chờ vào Phòng từ bảng: Enter nhận gợi ý Phòng ít Tải nhất, Enter xác nhận, giữ quyền chọn tay bất kỳ lúc nào. Xếp phòng mở Lượt khám (Visit) theo vòng đời FHIR (planned → in-progress), ghi Encounter.location append-only, và đẩy Trạng thái phòng 6 cấp (free, reserved, occupied, cleaning, disabled, alert). Server là thẩm quyền: phòng đầy/alert/disabled từ chối kèm lý do, UI lạc quan bị thu hồi có hình (Bệnh nhân quay về hàng chờ tại chỗ, băng nhỏ không chặn với nút xếp lại). Khu thu ngân xuất hiện như một Phòng trên bảng và trong dữ liệu.

**Blocked by:** 02 — Bệnh nhân và Số thứ tự

**Status:** ready-for-agent

- [ ] Gán phòng trong một transaction: tạo Visit planned, location entry planned → active, subjectStatus cập nhật, Trạng thái phòng đổi occupied/reserved tương ứng
- [ ] Gợi ý xếp phòng theo Tải phòng và trạng thái mở; Lễ tân override được bất kỳ lúc nào
- [ ] Phòng occupied-full, alert, disabled từ chối thao tác xếp kèm lý do rõ ràng từ server
- [ ] Khi bị từ chối: UI thu hồi có hình — Bệnh nhân quay về hàng chờ tại chỗ, băng nhỏ không chặn kèm nút xếp vào phòng gợi ý kế tiếp; không hộp thoại chặn
- [ ] Xếp trước khi gọi tạo trạng thái reserved trên phòng; lúc Bệnh nhân vào phòng thật chuyển occupied
- [ ] Encounter.location append-only: đổi nơi gói một transaction duy nhất, entry cũ completed/reserved đúng quy ước
- [ ] Sự kiện assignment.created / assignment.revoked / encounter.location.changed / room.state.changed ghi vào kho sự kiện
- [ ] Test qua seam server: kịch bản xung đột hai màn hình xếp cùng một phòng — một thắng một nhận từ chối kèm lý do, trạng thái cuối khớp DB
