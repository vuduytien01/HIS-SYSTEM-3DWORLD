# 03: Hàng đợi realtime — gọi số ba kênh, TV công cộng zero-PII, kênh web Bệnh nhân

**What to build:** Lễ tân bấm gọi một STT, một sự kiện call phát ra ba kênh cùng lúc (loa, TV, web) không lệch nhau. TV công cộng chỉ hiện Số thứ tự, Phòng, câu hành động và ký hiệu ưu tiên — không bao giờ hiện tên hay thông tin cá nhân. Kênh web Bệnh nhân thấy trạng thái realtime của mình. Mất kết nối thì hòa giải lại bằng snapshot.

**Blocked by:** 02 — Bệnh nhân và Số thứ tự

**Status:** ready-for-agent

- [x] Bấm gọi → sự kiện call.issued phát ba kênh (TV, web, điểm neo loa nhận cùng sự kiện) từ một lần phát duy nhất; Tín hiệu phòng hiển thị đồng bộ — `broadcastCall` một emit 3 room (`public`, `track:{code}`, `role:RECEPTIONIST`); test khẳng định 3 socket client nhận cùng payload
- [x] Endpoint công cộng trả projection tự định nghĩa (STT, Phòng, câu hành động, ký hiệu "ưu tiên: có") — test khẳng định phản hồi không chứa tên, CCCD, BHYT, SĐT hay resource nguyên bản — `server/queue-projection.js` + test zero-PII không chứa key PII; roomName sẽ có từ ticket 05, action mặc định "Xin chờ xếp phòng"
- [x] Trang TV hiện lượt đang gọi + các lượt kế tiếp; khi phòng được xếp, câu hành động đổi theo — `/tv` render từ snapshot REST + socket; `tvAction()` sẵn nhánh `roomName` (đổ dữ liệu ở ticket 05)
- [x] Kênh web Bệnh nhân theo dõi được trạng thái realtime của mình (waiting, called, present, discharged, completed) — `/track` với mã trên phiếu STT (trackingCode unique), socket room `track:{code}`; discharged/completed là trạng thái Visit — projection mở rộng khi Visit có (ticket 05/11)
- [x] Client mất kết nối rồi reconnect nhận queue:snapshot hòa giải đúng trạng thái hiện tại — server emit `queue:snapshot` ngay sau `hello` cho mọi connection; test reconnect khớp DB
- [x] Test qua seam server: gọi số → cả ba kênh nhận cùng payload; reconnect → snapshot khớp DB — 3 test socket mới; suite 17/17 pass + smoke server thật (check-in STT 1 → gọi → TV/track khớp)
