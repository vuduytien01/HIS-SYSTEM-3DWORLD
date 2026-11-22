# 12: Admin — cấu hình Phòng + tham số vận hành + config.changed

**What to build:** Màn cấu hình Admin: thêm/sửa Phòng (mã bất biến, tên hiển thị đổi được, Loại phòng, tọa độ/zone 3D, chuyên khoa, sức chứa, tiền tố STT, hàng chờ chung hay độc lập, lịch ca, Bác sĩ trực, trạng thái hoạt động) và tham số vận hành (thời gian tạm giữ, số lần gọi lại tối đa, ngưỡng phát hiện quên, ngưỡng SLA vàng đỏ). Mọi thay đổi phát config.changed kèm configVersion tăng dần; các client có nút tải lại cấu hình và áp dụng ngay; hành vi runtime đọc tham số mới từ lần giao dịch kế tiếp.

**Blocked by:** 05 — Lượt khám và gán phòng

**Status:** ready-for-agent

- [ ] Thêm Phòng mới: mã không trùng, không sửa được mã sau khi tạo; tên hiển thị đổi được
- [ ] Đặt tọa độ/zone 3D trong cấu hình; 3D World dựng phòng theo cấu hình (khớp ticket 08)
- [ ] Sửa tham số vận hành (tạm giữ, recall max, ngưỡng quên, SLA vàng đỏ) lưu được và runtime áp dụng từ giao dịch kế
- [ ] Mọi thay đổi phát config.changed kèm configVersion tăng dần; client khác nhận sự kiện và nút "tải lại cấu hình" hoạt động
- [ ] Lễ tân không có quyền định nghĩa Phòng (mã bất biến); lễ tân đổi được trạng thái vận hành phòng (disabled/alert) theo ma trận quyền
- [ ] Test qua đổi max recall 2→3 → giao thức ticket 04 áp dụng giá trị mới ngay
- [ ] Test: lễ tân gọi API định nghĩa phòng bị từ chối; admin gọi được
