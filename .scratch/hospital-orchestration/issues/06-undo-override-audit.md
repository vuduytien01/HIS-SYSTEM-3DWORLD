# 06: Hoàn tác ba mức + override bắt lý do + audit Provenance

**What to build:** Xếp nhầm phòng sửa được không phá dữ liệu. Vài giây đầu: hoàn tác một cú click đưa Bệnh nhân về hàng chờ. Sau khi tín hiệu vào phòng đã phát: hoàn tác tự chuyển thành chuyển phòng, và hệ thống chặn rút Bệnh nhân đang receiving-care. Mọi đường override của Lễ tân (kể tục đóng lượt của phòng khác) bắt buộc chọn lý do từ danh sách, không gõ tự do. Mọi hoàn tác và override ghi Provenance: ai, khi nào, thao tác nào.

**Blocked by:** 05 — Lượt khám và gán phòng

**Status:** ready-for-agent

- [ ] Hoàn tác sớm (trước khi tín hiệu vào phòng) một cú click, không hỏi lý do, đưa về hàng chờ và revoke assignment
- [ ] Hoàn tác sau khi đã vào phòng tự chuyển thành chuyển phòng; rút Bệnh nhân đang receiving-care bị chặn kèm lý do
- [ ] Override (kể cả đóng completed của phòng khác) bắt buộc chọn lý do từ danh sách cấu hình được; không chọn không ghi được
- [ ] Mọi hoàn tác và override ghi Provenance (actor, timestamp server, thao tác, lý do nếu có) vào kho sự kiện
- [ ] Test qua seam server: ba mức hoàn tác; override thiếu lý do bị từ chối; bản ghi Provenance truy được sau thao tác
