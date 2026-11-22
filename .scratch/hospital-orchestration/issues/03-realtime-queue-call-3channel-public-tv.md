# 03: Hàng đợi realtime — gọi số ba kênh, TV công cộng zero-PII, kênh web Bệnh nhân

**What to build:** Lễ tân bấm gọi một STT, một sự kiện call phát ra ba kênh cùng lúc (loa, TV, web) không lệch nhau. TV công cộng chỉ hiện Số thứ tự, Phòng, câu hành động và ký hiệu ưu tiên — không bao giờ hiện tên hay thông tin cá nhân. Kênh web Bệnh nhân thấy trạng thái realtime của mình. Mất kết nối thì hòa giải lại bằng snapshot.

**Blocked by:** 02 — Bệnh nhân và Số thứ tự

**Status:** ready-for-agent

- [ ] Bấm gọi → sự kiện call.issued phát ba kênh (TV, web, điểm neo loa nhận cùng sự kiện) từ một lần phát duy nhất; Tín hiệu phòng hiển thị đồng bộ
- [ ] Endpoint công cộng trả projection tự định nghĩa (STT, Phòng, câu hành động, ký hiệu "ưu tiên: có") — test khẳng định phản hồi không chứa tên, CCCD, BHYT, SĐT hay resource nguyên bản
- [ ] Trang TV hiện lượt đang gọi + các lượt kế tiếp; khi phòng được xếp, câu hành động đổi theo
- [ ] Kênh web Bệnh nhân theo dõi được trạng thái realtime của mình (waiting, called, present, discharged, completed)
- [ ] Client mất kết nối rồi reconnect nhận queue:snapshot hòa giải đúng trạng thái hiện tại
- [ ] Test qua seam server: gọi số → cả ba kênh nhận cùng payload; reconnect → snapshot khớp DB
