# 07: Nhóm ưu tiên + Làn cấp cứu + Đoàn bệnh nhân

**What to build:** Cờ ưu tiên theo QĐ 1313/QĐ-BYT (cao tuổi, khuyết tật, thai phụ, cấp cứu nhẹ) gắn bằng một cú bấm trên dòng bệnh nhân, không biểu mẫu lý do; mặt công cộng chỉ ký hiệu "ưu tiên: có". Làn cấp cứu: một cú bấm duy nhất kéo Bệnh nhân nguy kịch khỏi mọi hàng chờ hiện có và mở lượt mới trong một transaction hai vòng đời — không ai phải nhớ bệnh nhân đó đang ở đâu. Đoàn bệnh nhân (khám sức khỏe hợp đồng) tiếp nhận như một khối: một thao tác tạo nhiều Thẻ hàng đợi với groupId, STT liền nhau, xử lý trên bảng như một khối.

**Blocked by:** 05 — Lượt khám và gán phòng

**Status:** ready-for-agent

- [ ] Cờ ưu tiên một cú bấm lưu nhóm theo danh mục QĐ 1313; đặt Appointment.priority theo v3 ActPriority tương ứng
- [ ] Mặt công cộng (TV, endpoint công cộng) chỉ hiện ký hiệu "ưu tiên: có", không hiện nhóm cụ thể
- [ ] Làn cấp cứu một transaction: đóng mọi hàng chờ cũ (kể cả called/parked), mở lượt mới; Bệnh nhân cũ ở phòng khám nếu có được xử lý đúng quy ước
- [ ] Tiếp nhận đoàn: một thao tác tạo N Thẻ hàng đợi với groupId chung, STT liền nhau theo thứ tự danh sách, hiện thành một khối trên Bảng điều phối
- [ ] Xử lý từng thành viên đoàn vẫn riêng được (gọi, xếp phòng) nhưng hiển thị gắn khối cho Lễ tân thấy
- [ ] Test qua seam server: cấp cứu từ trạng thái called và parked; đoàn 20 người — 20 ticket, một groupId, STT liền, không giao dịch rời rạc
