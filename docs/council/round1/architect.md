# Persona Kiến trúc sư realtime 3D — Báo cáo vòng 1 (premortem + position)

*Agent hội đồng. Tự tin 0.7. Quan điểm: world là phép chiếu, không phải nguồn sự thật.*

## 1. Premortem kỹ thuật

**Cách chết 1. Trạng thái nghiệp vụ không có địa chỉ không gian.** Thêm trạng thái "chờ kết quả xét nghiệm" mà không nói bệnh nhân đứng đâu → agent đóng băng giữa hành lang hoặc teleport. Quy tắc chặn: bảng ánh xạ phải là hàm tổng, mọi cặp subjectStatus với zone mặt bằng v1 đều có hàng. Trạng thái mới bắt buộc khai báo roomId hoặc zoneId, thiếu thì renderer đẩy về khu chờ với màu cảnh báo. Fallback là lưới an toàn, không phải chỗ nghiệp vụ né trách nhiệm.

**Cách chết 2. Nhầm mọi dữ liệu thành thời gian thực.** Server stream vị trí cho hàng chục agent qua Socket.io là chết socket. Tách hai luồng: vị trí là mô phỏng phía client (navmesh nội suy giữa điểm hiện tại và target), server không bao giờ phát vị trí. Server chỉ phát 5 nhóm sự kiện: patient.status.changed, assignment.created, assignment.revoked, encounter.location.changed, room.state.changed. Badge số đếm không cần realtime, cần đúng tại thời điểm sự kiện.

**Cách chết 3. Quá nhiều đối tượng chuyển động cùng lúc.** Humanoid có animation xương + crowd pathfinding lúc 60 người giờ cao điểm → frame rớt đúng lúc lễ tân cần nhìn nhất. Ba tầng fidelity: ngoài phòng là agent đi bộ navmesh; trong phòng khám là marker tại giường đổi pose, không chạy crowd; ở trạm phụ là hàng đợi agent gọn hoặc badge đếm.

**Cách chết 4. Kéo thả trong lúc dữ liệu đổi dưới tay.** Lễ tân A kéo vào phòng 3, lễ tân B vừa gán phòng đó, hoặc phòng vừa chuyển cleaning. Drop rơi lặng vào phòng đã đổi, world hiện bệnh nhân ma. Cách đúng: drag là đề xuất, server là thẩm quyền. Highlight target cập nhật realtime trong khi kéo. Server trả ack hoặc reject kèm lý do, client diễn hoạt động trở lại nếu reject.

**Cách chết 5. Sắp lại hàng theo ưu tiên trong lúc hàng đang đứng.** VIP chèn lên đầu hàng quầy thuốc, cả hàng shuffle vị trí, chi phí pathfinding tăng vọt, thế giới nhìn vô lý. Hàng có vật lý, không phải danh sách xáo lại được. Ưu tiên hiển thị bằng màu và badge trên agent, không phải vị trí trong hàng. Muốn chèn thật thì chấp nhận chi phí re-form và animation cả hàng.

## 2. Bản đồ trạng thái ra vị trí

Quy ước sự kiện đề xuất: `patient.status.changed`, `assignment.created`, `assignment.revoked`, `encounter.location.changed`, `room.state.changed`.

### Bảng A. subjectStatus ra đại diện 3D

| subjectStatus | Vị trí | Biểu diễn | Sự kiện vào | Sự kiện ra |
|---|---|---|---|---|
| arrived | Spawn tại cửa sảnh | Navmesh đi tới hàng đợi quầy, pose đứng | `patient.arrived` | `patient.triaged` |
| triaged | Ghế khu chờ | Navmesh từ quầy về ghế, pose ngồi, badge màu chuyên khoa | `patient.triaged` | `patient.waiting` khi lễ tân gán phòng |
| waiting | Ghế khu chờ hoặc hàng đợi đầu phòng đã gán | Badge tên phòng nhấp nháy chậm, ghost thẻ trên cửa phòng; được gọi thì navmesh đi tới phòng | `assignment.created` kèm `room.state.changed(reserved)` | `encounter.location.active` khi bước qua cửa |
| receiving-care | Anchor giường hoặc bàn khám trong phòng | Snap tới anchor, không navmesh trong phòng, pose nằm hoặc ngồi, phòng sáng lên, occupancy +1 | `encounter.location.active` kèm `room.state.changed(occupied)` | `encounter.location.completed` |
| departed | Từ phòng ra cửa sảnh | Navmesh ra exit rồi fade-out despawn | `patient.departed` | Agent bị remove, còn trong thống kê |

Ghi chú: planned và reserved đều vẽ ghost thẻ cửa, planned mờ, reserved đậm. Decision còn mở cho nghiệp vụ: drop thành công có đưa bệnh nhân đi tới ngay hay cần bước "gọi bệnh nhân" riêng, cả hai dựng được, chọn cái nào chỉ là lời gọi sự kiện.

### Bảng B. Trạng thái phòng ra biểu hiện 3D

| Trạng thái phòng | Nguồn | Biểu hiện | Bệnh nhân ở đâu | Sự kiện vào | Sự kiện ra |
|---|---|---|---|---|---|
| free | BedBoard | Khung cửa xanh nhạt, đèn mờ, badge 0 | Không có | `room.state.changed(free)` | `reserved` hoặc `occupied` |
| reserved | FHIR + BedBoard mở rộng | Khung cửa xanh dương nhấp nháy chậm, ghost thẻ tên trên cửa | Còn ngồi khu chờ, badge nhấp nháy | `assignment.created` | `occupied` |
| occupied | FHIR active | Khung cửa xanh lá đậm, phòng sáng, badge đếm đầy màu | Tại anchor giường | `encounter.location.active` | `encounter.location.completed` |
| completed | FHIR completed | Giữ màu occupied lúc bệnh nhân bước ra, rồi cleaning hoặc free | Navmesh ra khỏi phòng tới trạm tiếp theo hoặc sảnh | `encounter.location.completed` | `cleaning` hoặc `free` |
| cleaning | BedBoard | Khung cửa tím, NPC vệ sinh bên trong, khóa drop | Không nhận bệnh nhân mới | `room.state.changed(cleaning)` | `free` |
| alert | BedBoard | Khung cửa đỏ nhấp nháy, icon trần, badge đỏ, khóa drop | Bệnh nhân hiện có giữ nguyên | `room.state.changed(alert)` | `free` sau xử lý |

Ghi chú: BedBoard gốc có free/occupied/cleaning/alert, thiếu reserved — FHIR bổ sung. Badge tải thấp nhất là mũi tên nổi trên phòng có tải thấp, chỉ thông tin đúng bối cảnh đã chốt.

## 3. Hỏi đáp nghiệp vụ với kỹ thuật

- **Tải phòng đếm cái gì**: hai loại tách màu trên cùng badge. Đang khám từ Encounter.location active (chấm đặc), đang chờ từ reserved + hàng đợi đầu phòng (vòng viền). Badge tải thấp xếp hạng theo đang khám trước rồi mới đến số chờ.
- **Một phòng chứa mấy đại diện**: tối đa 3 agent trong một phòng khám (bệnh nhân, người nhà, nhân viên), vượt 3 gộp badge +n. Khu chờ giữ 12 agent trên ghế. Giới hạn tổng scene 50 navmesh agent.
- **Conflict UX khi thả vào phòng đã đầy**: 3 lớp. Trong khi kéo, target đổi đỏ và badge hiện FULL. Server vẫn nhận drop nhưng trả reject kèm reason ROOM_FULL, số hiện tại, roomId gợi ý thay thế. Client diễn ghost đi về ghế cũ, phòng nhấp đỏ một lần. Không tự gán lại phòng thay lễ tân. Ngân sách phản hồi 300ms.
- **Hoàn tác gán phòng**: bản ghi assignment có assignmentId, encounterId, roomId, trạng thái trước/sau, actor, thời điểm. Hoàn tác phát `assignment.revoked`, đưa bệnh nhân về ghế bằng requestMoveTarget mới, không tua lại vị trí. assignmentId là idempotency key, undo hai lần không trừ hai lần occupancy. Receiving-care đã bắt đầu thì undo biến thành gán lại, nghiệp vụ phải chốt có cho phép không.
- **Có cần thấy hàng đợi quầy thuốc và X-quang**: cần, fidelity thấp hơn phòng khám. Nếu không hiện thì các phòng trông trống trong khi người còn trong viện, lễ tân đọc sai năng lực. V1 hiện đầy đủ agent xếp hàng ở cả ba trạm phụ; ngân sách frame chật thì hạ quầy thuốc và xét nghiệm thành badge trước.
- **Thông tin bảng chữ không thay thế được (lý do tồn tại của 3D world)**: 1. Cụm không gian (phòng nào kề phòng nào, vùng quá tải gần xa mục tiêu). 2. Tắc nghẽn hành lang. 3. Vị trí vật lý của hàng đợi, có chặn doorway không. 4. Bộ nhớ không gian, học mặt bằng một lần rồi tìm phòng bằng vị trí. 5. Chuyển động tức thời, bảng là ảnh chụp, world là luồng ai đang đi tới đâu. Bảng trả lời bao nhiêu, 3D trả lời ở đâu và cái gì đang chắn đường.

## 4. Ràng buộc cho thiết kế nghiệp vụ

1. Server chỉ phát sự kiện trạng thái, không stream vị trí, khoảng 50 sự kiện/giây, mỗi badge phòng tối đa 2 lần cập nhật/giây.
2. Kéo thả nhận ack hoặc reject trong 300ms P95, quá 500ms UI hiện trạng thái đang xử lý.
3. Mọi sự kiện mutation mang id riêng, replay không nhân đôi số đếm hay spawn trùng agent.
4. Reconnect: client xin snapshot toàn bộ world (phòng, bệnh nhân, hàng đợi) rồi dựng lại trong 2 giây, không replay từng sự kiện lỡ.
5. Hàng đợi cap cứng: 8 slot quầy lễ tân, 4 slot đầu mỗi phòng, 8 slot quầy thuốc. Slot chỉ cấp khi agent tới cuối hàng, hàng không xếp trong doorway, phần tràn đứng vùng dự phòng.
6. Tối đa 50 agent navmesh đồng thời, marker trong phòng không tính.
7. Tốc độ đi bộ nén 2-4 lần thời gian thực để world đọc được dòng nghiệp vụ.
8. Một phòng hiển thị tối đa 3 agent, phần còn lại badge +n.

## 5. Lập trường

World là phép chiếu, không phải nguồn sự thật. Nguồn sự thật là Postgres qua Prisma, Socket.io phát sự kiện, renderer không chứa logic nghiệp vụ và luôn dựng lại được từ snapshot cộng sự kiện. Kéo thả manual là con đường biến đổi duy nhất, badge chỉ đọc. Mọi trạng thái nghiệp vụ mới phải có địa chỉ không gian, hoặc kèm một lý do viết ra để không có.

Nhượng bộ 1: chấp nhận nén thời gian và pose đơn giản, không animation xương đầy đủ, đổi lấy world đọc được dòng nghiệp vụ trong vài giây. Nhượng bộ 2: chấp nhận receiving-care hiện marker tại giường thay vì agent đi lại trong phòng, đổi lấy đủ ngân sách cho agent ngoài phòng và ba trạm phụ.

Tự tin 0.7. Bảng ánh xạ chắc nhất. Các con số hiệu năng là ước lượng chưa đo trên stack Node + Socket.io + Three.js này. Hai biến chưa chốt quyết định các cap: mật độ bệnh nhân giờ cao điểm và kích thước thật mặt bằng.
