# 04: Giao thức gọi không có mặt — tạm giữ, gọi lại, bỏ lượt khôi phục được, vắng mặt

**What to build:** Bệnh nhân không có mặt khi tới lượt không mất số: gọi xong tự mở thời gian tạm giữ (tham số, mặc định 3 phút) kèm câu hỏi "bạn có mặt không" trên kênh web; xác nhận có mặt ghi presence marker (từ web, thẻ giấy tại quầy, hay báo Lễ tân — cùng một marker). Gọi lại tối đa số lần theo tham số (mặc định 2). Bỏ lượt thành skipped khôi phục được với undo 60 giây; no-show chỉ chốt khi sweep cuối phiên, không bao giờ chốt ngay tay. Bệnh nhân quay lại xếp vào cuối hàng giữ số gốc.

**Blocked by:** 03 — Hàng đợi realtime và gọi số

**Status:** ready-for-agent

- [x] Nút tạm giữ một cú bấm mở parked với parkUntil bắt buộc; badge đồng hồ đếm ngược hiển thị cho Lễ tân — `POST /api/tickets/:id/park` chỉ từ called, parkUntil do server tính theo cấu hình (client có thể chỉ định); badge interval đếm ngược mỗi giây
- [x] Câu hỏi có mặt xuất hiện trên kênh web Bệnh nhân trong thời gian tạm giữ; xác nhận từ web, nút tại quầy, hay thao tác Lễ tân đều ghi cùng một presence marker — `/track` hiện câu hỏi khi called/parked, `POST /api/public/track/:code/confirm` + `POST /api/tickets/:id/present` cùng ghi `presencedAt`, event phân biệt reason `present-web`/`present-desk` với actor `patient-web`/`user` (test khẳng định)
- [x] Gọi lại một cú bấm, callAttempts tăng; sau tối đa số lần theo cấu hình, gọi lại bị từ chối kèm lý do — `POST /api/tickets/:id/recall` CAS + `maxRecalls` từ bảng Config; test default 2 (lần 3 từ chối "đã gọi lại đủ") và test cấu hình maxRecalls=1 (lần 2 từ chối)
- [x] Skip một cú bấm → skipped; undo trong 60 giây đưa về waiting; sau cửa sổ undo, khôi phục vẫn được nhưng là thao tác có chủ đích — một route `rejoin`, reason `undo`/`restore` theo cửa sổ `undoWindowMs` đọc từ Config; test undoWindowMs=0 → `restore`
- [x] Sweep cuối phiên chuyển skipped quá hạn thành no-show; không đường tay nào chốt no-show ngay lập tức — `POST /api/sweep` là con đường duy nhất đến no-show (chỉ có route này ghi `to: 'no-show'`)
- [x] Bệnh nhân quay lại sau skip/no-show: xếp cuối hàng, giữ số gốc — `rejoin` giữ number gốc (test khẳng định `r2.number === ticket.number`), event reason `rejoin` từ no-show
- [x] Test qua seam server đủ giao thức: park → hết hạn → recall ×2 → skip → undo → no-show cuối phiên; mọi ngưỡng đọc từ cấu hình, không hardcode — test 16/16 seam, suite 20/20; ngưỡng qua bảng Config + `getConfigParam` (mặc định hội đồng khi thiếu)
