# 09: Kéo thả trên 3D World — drag là đề xuất, server là thẩm quyền

**What to build:** Kéo agent từ hàng chờ thả vào Phòng là đường thao tác chính thức thứ hai, ghi cùng một dữ liệu với bảng: cùng sự kiện assignment, cùng luật từ chối, cùng hoàn tác. Drop mặc định chỉ reserved; auto-call chỉ khi bật cờ callNow và luôn ghép cùng transactionId. Thả vào phòng khóa bị server từ chối → agent quay về chỗ cũ với viền đỏ + băng nhỏ nút xếp vào phòng gợi ý kế tiếp, không hộp thoại chặn. Phản hồi tức thì, mục tiêu 300ms P95 cho drop — đo trên stack thật, ghi kết quả, không cam kết SLA trước khi đo.

**Blocked by:** 08 — 3D World quan sát

**Status:** ready-for-agent

- [ ] Thả vào phòng hợp lệ tạo assignment giống hệt thao tác từ bảng (cùng sự kiện, cùng kiểm quyền, cùng Provenance)
- [ ] Thả vào phòng occupied-full/alert/disabled bị từ chối kèm lý do; agent quay về chỗ cũ viền đỏ + băng nhỏ nút xếp lại
- [ ] Drop mặc định chỉ reserved; callNow bật được qua cờ, phát call trong cùng transactionId với assignment
- [ ] Two events cùng transactionId gom một frame, cửa sổ 500ms rồi snapshot hòa giải
- [ ] Hoàn tác ba mức dùng chung logic với ticket 06 (không làm đôi)
- [ ] Đo P95 thời gian drop trên máy dev, ghi kết quả; nếu vượt mục tiêu 300ms, ghi nguyên nhân trong tài liệu thay vì sửa số mục tiêu
- [ ] Test qua seam server: drop client → server quyết; từ chối → event thu hồi mà client phải xử lý đúng hình
