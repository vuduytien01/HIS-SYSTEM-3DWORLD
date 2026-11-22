# 10: Doctor console mỏng — nút ghép complete-and-call-next + menu ngoại lệ

**What to build:** Bề mặt Bác sĩ giữ một đầu vào bắt buộc duy nhất: nút "xong khám", khuyến nghị dạng nút ghép complete-and-call-next ghi hai sự kiện (đóng lượt N, gọi N+1) bằng một transactionId. Trước khi Bệnh nhân kế vào, hiển thị thụ động bốn dòng (STT và tên, loại hẹn, lý do Lễ tân ghi, cờ kết quả cận lâm sàng chờ đọc) — không popup, không âm thanh. Ngoại lệ (chuyển phòng, yêu cầu cận lâm sàng, loại hành động bỏ về giữa chừng, discontinued) nằm trong menu ẩn, không form lý do. Phòng ghi "đang khám" vượt ngưỡng max(1.5×trung vị phòng, 15 phút) — tham số hóa — thì cờ lên màn Lễ tân, không bấm chuông vào phòng.

**Blocked by:** 04 — Giao thức gọi không có mặt; 05 — Lượt khám và gán phòng

**Status:** ready-for-agent

- [ ] Nút ghép một cú bấm: đóng lượt N (in-progress → discharged) và gọi lượt kế trong cùng transactionId; hai sự kiện trên 3D gom một frame
- [ ] Đồng hồ lượt N bắt đầu khi N vào phòng thật, kết thúc khi nút ghép bấm; cái đuôi 30-90 giây thuộc dữ liệu của N
- [ ] Hiển thị thụ động 4 dòng cho lượt hiện tại và lượt kế; không popup, không âm thanh, không bắt xác nhận
- [ ] Menu ẩn ngoại lệ: chuyển phòng (giữ chỗ quay lại), yêu cầu cận lâm sàng (on-hold + location mới), bỏ về giữa chừng (discontinued) — không form lý do
- [ ] Phát hiện quên: cờ lên màn Lễ tân khi vượt ngưỡng max(1.5×trung vị phòng, 15 phút) đọc từ cấu hình, không hardcode
- [ ] Bác sĩ không sửa được trạng thái phòng khác và không rút được Bệnh nhân của phòng khác
- [ ] Test qua seam server: nút ghép → hai sự kiện một transaction; từng loại ngoại lệ → vòng đời đúng; cờ quên đúng ngưỡng
