# 08: 3D World quan sát — vanilla Three.js, navmesh, 7 nhóm sự kiện realtime

**What to build:** Mô hình ba chiều của bệnh viện chạy trong trình duyệt bằng vanilla Three.js (không React Three Fiber): mặt bằng với các Phòng theo cấu hình, hình dạng và vật dụng theo Loại phòng (quầy lễ tân, phòng khám chuyên khoa, X-quang, xét nghiệm, quầy thuốc, Khu thu ngân, khu chờ). Agent Bệnh nhân đi bộ theo navmesh từ vị trí cũ sang vị trí mới theo sự kiện, không tween thẳng. World hiển thị realtime: Trạng thái phòng 6 cấp có hình hiệu ứng riêng, called-pending agent ngồi nguyên badge nhấp nháy, parked mờ kèm badge đồng hồ, ưu tiên viền, Đoàn bệnh nhân cụm marker màu nhóm, Tải phòng trên từng phòng. Tối đa 50 agent, instancing cho agent xa camera. Khoặc chú thích: nếu navmesh thật chưa kịp, agent đi theo đường gấp khúc tính từ bản đồ, nhưng phải là đường đi được không xuyên tường.

**Blocked by:** 05 — Lượt khám và gán phòng

**Status:** ready-for-agent

- [ ] World dựng Phòng theo cấu hình từ server; đổi cấu hình phòng (T12) cập nhật được world qua config.changed
- [ ] Mỗi Bệnh nhân là agent di chuyển qua navmesh/đường hợp lệ theo sự kiện (assignment, location, gọi số); gọi số không tự di chuyển agent
- [ ] Trạng thái phòng 6 cấp có hiệu ứng riêng (free sáng, reserved viền, occupied đầy, cleaning, disabled xám kèm lý do, alert đỏ)
- [ ] called-pending: agent ngồi nguyên, badge nhấp nháy; parked: mờ + badge đồng hồ; ưu tiên: viền; đoàn: cụm marker + màu nhóm; Khu thu ngân là một phòng hiển thị
- [ ] Mọi sự kiện 7 nhóm cập nhật world; mất kết nối hòa giải bằng snapshot; hai sự kiện cùng transactionId gom một frame
- [ ] Module projection thuần (sự kiện → trạng thái world) test trực tiếp được; tối đa 50 agent chạy không vỡ khung hình trên máy dev
- [ ] UI tiếng Việt trên nhãn phòng và tooltip
