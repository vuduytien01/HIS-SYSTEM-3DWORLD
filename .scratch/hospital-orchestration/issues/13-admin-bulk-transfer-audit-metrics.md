# 13: Admin — chuyển khối, kho sự kiện viewer, entered-in-error, metric giám sát

**What to build:** Phòng hỏng máy: chuyển khối N Bệnh nhân chờ khỏi Phòng hỏng sang phòng đích bằng bulk operation trên Thẻ hàng đợi, có preview số lượng và xác nhận. Kho sự kiện append-only đọc được bằng màn viewer (lọc theo phòng/bệnh nhân/ngày/thao tác), giữ tối thiểu 12 tháng. Bản ghi nhập nhầm đánh dấu entered-in-error: loại khỏi thống kê nhưng giữ trong hồ sơ pháp lý. Dashboard metric giám sát (tần suất đổi ưu tiên, tỷ lệ override, thời gian chờ p50/p90) hiển thị kèm cảnh báo — không ngưỡng cứng chặn thao tác.

**Blocked by:** 11 — Khu thu ngân và sweep; 12 — Cấu hình Admin

**Status:** ready-for-agent

- [ ] Chuyển khối: chọn phòng nguồn → đích, preview "N người sẽ chuyển", xác nhận rồi mới chạy; mỗi Thẻ hàng đợi nhận sự kiện riêng idempotent
- [ ] Phòng nguồn chuyển disabled kèm lý do + mốc mở lại; phòng đích không vượt sức chứa — vượt thì preview chặn trước
- [ ] Viewer kho sự kiện lọc được, hiện Provenance (ai, khi nào, thao tác nào); dữ liệu giữ tối thiểu 12 tháng
- [ ] Entered-in-error đánh dấu được trên Appointment/Visit; loại khỏi thống kê nhưng bản ghi còn nguyên
- [ ] Dashboard metric: tần suất đổi ưu tiên, tỷ lệ override, p50/p90 thời gian chờ; cảnh báo ngưỡng, không chặn thao tác
- [ ] Test: bulk 7 người phòng X-quang hỏng → sự kiện từng người, không rời rạc; entered-in-error loại khỏi thống kê; metric tính đúng từ kho sự kiện
