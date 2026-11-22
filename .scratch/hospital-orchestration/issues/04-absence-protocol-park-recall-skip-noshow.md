# 04: Giao thức gọi không có mặt — tạm giữ, gọi lại, bỏ lượt khôi phục được, vắng mặt

**What to build:** Bệnh nhân không có mặt khi tới lượt không mất số: gọi xong tự mở thời gian tạm giữ (tham số, mặc định 3 phút) kèm câu hỏi "bạn có mặt không" trên kênh web; xác nhận có mặt ghi presence marker (từ web, thẻ giấy tại quầy, hay báo Lễ tân — cùng một marker). Gọi lại tối đa số lần theo tham số (mặc định 2). Bỏ lượt thành skipped khôi phục được với undo 60 giây; no-show chỉ chốt khi sweep cuối phiên, không bao giờ chốt ngay tay. Bệnh nhân quay lại xếp vào cuối hàng giữ số gốc.

**Blocked by:** 03 — Hàng đợi realtime và gọi số

**Status:** ready-for-agent

- [ ] Nút tạm giữ một cú bấm mở parked với parkUntil bắt buộc; badge đồng hồ đếm ngược hiển thị cho Lễ tân
- [ ] Câu hỏi có mặt xuất hiện trên kênh web Bệnh nhân trong thời gian tạm giữ; xác nhận từ web, nút tại quầy, hay thao tác Lễ tân đều ghi cùng một presence marker
- [ ] Gọi lại một cú bấm, callAttempts tăng; sau tối đa số lần theo cấu hình, gọi lại bị từ chối kèm lý do
- [ ] Skip một cú bấm → skipped; undo trong 60 giây đưa về waiting; sau cửa sổ undo, khôi phục vẫn được nhưng là thao tác có chủ đích
- [ ] Sweep cuối phiên chuyển skipped quá hạn thành no-show; không đường tay nào chốt no-show ngay lập tức
- [ ] Bệnh nhân quay lại sau skip/no-show: xếp cuối hàng, giữ số gốc
- [ ] Test qua seam server đủ giao thức: park → hết hạn → recall ×2 → skip → undo → no-show cuối phiên; mọi ngưỡng đọc từ cấu hình, không hardcode
