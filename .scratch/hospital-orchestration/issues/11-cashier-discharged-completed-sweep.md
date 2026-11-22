# 11: Khu thu ngân — discharged → completed sau thanh toán + sweep cuối ngày

**What to build:** Sau nút xong khám, Bệnh nhân rời phòng thành discharged và dừng ở Khu thu ngân (hiển thị trên bảng và 3D để Lễ tân thấy ai còn kẹt ở quầy tiền). Đóng tiền tại quầy (thao tác của vai Lễ tân trong v1, dành chỗ cho vai thu ngân riêng sau) chuyển completed — cổng vào completed chỉ mở bằng tín hiệu Bác sĩ đã có trên lượt, cộng với việc đóng tiền. Sweep cuối ngày: lượt in-progress treo chuyển discharged kèm nhãn autoClosed, không bao giờ tự completed; lượt discharged chưa thanh toán giữ nguyên để đối soát sau.

**Blocked by:** 05 — Lượt khám và gán phòng

**Status:** ready-for-agent

- [ ] Nút xong khám chuyển discharged; Bệnh nhân hiện ở Khu thu ngân trên bảng và 3D
- [ ] Thao tác đóng tiền (vai Lễ tân) chuyển discharged → completed; chỉ lượt đã có tín hiệu xong khám của Bác sĩ mới được completed qua đường chính
- [ ] Sweep cuối ngày chuyển in-progress treo → discharged + nhãn autoClosed; không lượt nào tự completed thiếu thanh toán
- [ ] Quy ước discharged trước, completed sau thanh toán được test khẳng định; đối soát "lượt chưa thanh toán" truy được từ kho sự kiện
- [ ] Lượt on-hold đi cận lâm sàng không bị sweep nhầm; sweep không đụng lượt đang receiving-care
- [ ] Test qua seam server: complete → discharged; đóng tiền → completed; sweep cuối ngày → autoClosed; on-hold không bị đụng
