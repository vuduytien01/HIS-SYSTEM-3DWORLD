# 02: Bệnh nhân, Kế hoạch hẹn online, walk-in tại quầy, cấp Số thứ tự

**What to build:** Lễ tân tìm Bệnh nhân theo vài chữ trong một ô, hồ sơ hiện ra, một cú bấm tiếp nhận — không nhập lại dữ liệu đã có. Bệnh nhân đặt Kế hoạch hẹn online từ kênh web. Check-in tại quầy (booked hay walk-in) cấp Số thứ tự theo ngày, đếm lại mỗi sáng. Bảng điều phối hiện danh sách hôm nay. Kho sự kiện append-only bắt đầu ghi (patient.status.changed, queue.ticket.changed) với timestamp server và actor.

**Blocked by:** 01 — Khung dự án

**Status:** ready-for-agent

- [x] Tìm kiếm gõ vài chữ đầu tên/số điện thoại → hồ sơ hiện gợi ý; bệnh nhân mới đăng ký được với đầy đủ trường chuẩn (họ tên, ngày sinh, giới tính, CCCD, mã nội bộ, BHYT tùy chọn, SĐT) — `GET /api/patients/search` + `POST /api/patients`, test seam pass; màn lễ tân có ô search debounced
- [x] Tiếp nhận một Bệnh nhân trong một màn hình, không modal lồng, không nhập lại dữ liệu đã có — `client/src/pages/reception.js`: search → chọn hồ sơ → 1 nút "Tiếp nhận", form hồ sơ mới inline trong `<details>`
- [x] Đặt Kế hoạch hẹn online lưu được Appointment (status booked), hiện trong danh sách ngày hẹn — `POST /api/public/appointments` (khớp hồ sơ theo CCCD), trang `/book` công cộng; test seam pass
- [x] Check-in tại quầy cấp Thẻ hàng đợi với Số thứ tự; STT reset mỗi sáng theo ngày; walk-in tạo Appointment booked + checked-in một bước — 2 route check-in trong transaction; test chứng minh STT=1 sau fixture 3 số hôm qua
- [x] Mọi thao tác ghi sự kiện append-only (patient.status.changed, queue.ticket.changed) có timestamp server và actor — `recordEvent` trong cùng transaction với state change
- [x] Test qua seam server: tiếp nhận → STT đúng thứ tự trong ngày; hai ngày khác nhau → STT đếm lại — `tests/queue-seam.test.js` 10/10 pass; full suite 14/14 pass
