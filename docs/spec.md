---
title: Spec — Hệ thống điều phối quy trình khám bệnh OPD
date: 2026-11-22
labels: [ready-for-agent]
sources:
  - docs/research/hospital-orchestration-research.md
  - GLOSSARY.md
  - docs/council/synthesis.md
---

## Problem Statement

Một phòng khám ngoại trú 300-500 lượt mỗi ngày điều phối bằng giấy và trí nhớ: lễ tân không biết phòng nào rảnh thật, bệnh nhân gọi hai lần không ai đứng dậy thì mất lượt, phòng hỏng máy không có chỗ ghi, đoàn 20 người đến cùng lúc khóa quầy, bác sĩ quên báo xong khám thì cả hàng đợi đứng yên, dữ liệu thời gian khám sai không sửa được sau. Vai lễ tân — người giữ quyền điều phối — phải dựng một hệ thống song song bằng tờ giấy để sống sót, và tờ giấy đó không có audit log.

## Solution

Một hệ thống web realtime gồm 3D World của bệnh viện chạy bằng vanilla Three.js trong trình duyệt, hiển thị vị trí và trạng thái Bệnh nhân theo từng Phòng trong thời gian thực, kèm Bảng điều phối với phím tắt. Lễ tân nhìn thấy Tải phòng và Trạng thái phòng, tự tay xếp Bệnh nhân vào Phòng (Điều phối manual), xử lý các ngoại lệ (gọi lại, tạm giữ, bỏ lượt, ưu tiên, Làn cấp cứu) bằng một cú bấm. Bác sĩ chỉ cần một thao tác duy nhất "xong khám" mỗi lượt. Bệnh nhân thấy số của mình và câu hành động trên TV công cộng và kênh web, không lộ thông tin cá nhân. Admin cấu hình Phòng, tham số vận hành và đọc kho sự kiện append-only cho báo cáo.

## User Stories

1. Là Bệnh nhân, tôi muốn đặt Kế hoạch hẹn online với thông tin của tôi (họ tên, ngày sinh, giới tính, CCCD, mã bệnh nhân nội bộ, BHYT tùy chọn, số điện thoại), để không phải đến quầy sớm chỉ để đăng ký.
2. Là Bệnh nhân, tôi muốn nhận Số thứ tự khi check-in (kể cả walk-in tại quầy), để biết thứ tự của mình trong ngày.
3. Là Bệnh nhân, tôi muốn thấy trạng thái realtime của mình trên kênh web (đang chờ, đã gọi, đang khám, đi cận lâm sàng, hoàn tất), để không phải đứng gần quầy nghe tên.
4. Là Bệnh nhân, tôi muốn nghe và thấy trên TV số của mình được gọi kèm Phòng và câu hành động, để biết đi đâu ngay cả khi không nhìn màn hình web.
5. Là Bệnh nhân bị gọi khi đang vắng mặt, tôi muốn được hỏi "bạn có mặt không" và được giữ chỗ trong khoảng tạm giữ trước khi bị bỏ lượt, để một lần ra ngoài không xóa số của tôi.
6. Là Bệnh nhân bỏ lượt rồi quay lại, tôi muốn được xếp vào cuối hàng nhưng giữ được số gốc, để không phải mất vị trí chỉ vì đi vệ sinh.
7. Là Bệnh nhân thuộc nhóm ưu tiên (cao tuổi, khuyết tật, thai phụ, cấp cứu nhẹ), tôi muốn được xử lý nhanh hơn mà không phải giải thích nhóm của mình cho cả sảnh, để giữ riêng tư về tình trạng y tế.
8. Là Bệnh nhân nguy kịch tại khu chờ, tôi muốn một cú thao tác duy nhất của Lễ tân đưa tôi vào Làn cấp cứu và đóng mọi hàng chờ cũ, để không ai phải nhớ tôi đang ở đâu.
9. Là Bệnh nhân đi cận lâm sàng (X-quang, xét nghiệm), tôi muốn Lượt khám của tôi ghi được mình đang ở đâu và giữ chỗ khi quay lại đọc kết quả, để tôi không bị xếp lại từ đầu.
10. Là Bệnh nhân trong Đoàn bệnh nhân (khám sức khỏe hợp đồng), tôi muốn được tiếp nhận như một khối với số riêng theo đoàn, để cả 20 người không phải xếp 20 lần.
11. Là Bệnh nhân khám xong, tôi muốn dừng ở Khu thu ngân và Lượt khám chỉ hoàn tất sau thanh toán, để tôi biết chính xác việc nào còn nợ.
12. Là Lễ tân, tôi muốn Bảng điều phối làm mặt sàn làm việc với phím tắt và sáu nút một cú bấm trên dòng bệnh nhân (gọi lại, bỏ lượt, tạm giữ, vắng mặt, ưu tiên, cấp cứu), để cao điểm không mất tay khỏi quầy.
13. Là Lễ tân, tôi muốn tiếp nhận một Bệnh nhân trong một màn hình (một ô tìm kiếm + một nút xác nhận), không nhập lại dữ liệu đã có, để 300-450 lượt tiếp nhận mỗi ngày là khả thi.
14. Là Lễ tân, tôi muốn gợi ý xếp phòng tự động theo Tải phòng mà vẫn giữ quyền override tay, để trong sóng 20 người tôi chọn mặc định sống sót, phần còn lại của ngày chọn tay.
15. Là Lễ tân, tôi muốn nhìn 3D World để biết nghẽn cục bộ ở dãy phòng nào, bệnh nhân ưu tiên nào cần phòng gần lối vào, và phát hiện Phòng hiển thị lệch với thực tế, để chọn hướng chuyển hàng trước khi bệnh nhân khiếu nại.
16. Là Lễ tân, tôi muốn kéo thả trên 3D World là một đường thao tác chính thức, drag chỉ là đề xuất và server là thẩm quyền, để xếp phòng từ 3D không khác xếp từ bảng về dữ liệu.
17. Là Lễ tân vừa xếp phòng vào Phòng vừa đầy, tôi muốn thao tác bị server từ chối kèm lý do, bệnh nhân quay về hàng chờ tại chỗ và một băng nhỏ không chặn cho tôi nút xếp lại, để không có trạng thái "lạc giữa hai màn hình".
18. Là Lễ tân xếp nhầm phòng, tôi muốn hoàn tác ba mức (vài giây đầu một cú click, sau khi gọi đã phát thì chuyển thành chuyển phòng, mọi hoàn tác ghi audit), để sửa sai không phá dữ liệu.
19. Là Lễ tân, tôi muốn gọi số phát ra ba kênh cùng lúc (loa, TV, web) từ cùng một sự kiện, để Tín hiệu phòng không lệch nhau giữa các màn hình.
20. Là Lễ tân, tôi muốn gọi lại tối đa hai lần rồi bệnh nhân vào trạng thái bị bỏ lượt có thể khôi phục, với undo trong 60 giây, để nhầm nút cuối ca không thành dữ liệu bẩn.
21. Là Lễ tân, tôi muốn chuyển 7 bệnh nhân khỏi Phòng hỏng máy một lượt bằng thao tác khối với preview số lượng và xác nhận, để không dán giấy note và không bỏ sót ai.
22. Là Lễ tân, tôi muốn gắn trạng thái ngừng hoạt động kèm lý do và mốc mở lại cho một Phòng, để trạng thái đó sống trong dữ liệu, không sống trong đầu tôi.
23. Là Lễ tân, tôi muốn xem nhanh "bệnh nhân X đang ở đâu, còn bao lâu" trong vài giây khi người nhà hỏi, để trả lời bằng dữ liệu thay vì trí nhớ.
24. Là Lễ tân, tôi muốn được cờ lên màn hình khi một Phòng ghi "đang khám" vượt ngưỡng quá lâu mà chưa có tín hiệu xong khám, để tôi đi kiểm tra thay vì đoán.
25. Là Lễ tân, tôi muốn bàn giao ca trong hai phút bằng chính màn hình (chỉ vào các ô đỏ), để sự kiện ngoài hệ thống không rơi mất lúc bàn giao.
26. Là Bác sĩ, tôi muốn một nút duy nhất "xong khám" (khuyến nghị dạng nút ghép hoàn tất và mời tiếp), nằm trong bề mặt tôi đã mở cả ngày, để đóng một lượt tốn đúng một cú bấm vào cái đuôi 30-90 giây sau khi bệnh nhân rời phòng.
27. Là Bác sĩ, tôi muốn bốn dòng chữ thụ động trước khi Bệnh nhân kế vào (STT và tên, loại hẹn, lý do Lễ tân ghi, cờ kết quả cận lâm sàng chờ đọc), để chuẩn bị tinh thần mà không bấm gì.
28. Là Bác sĩ, tôi muốn không có popup, âm thanh hay bắt bấm xác nhận khi đang khám, để dây chuyền suy luận lâm sàng không bị ngắt 25-35 lần mỗi buổi.
29. Là Bác sĩ, tôi muốn nút ngoại lệ trong menu ẩn (chuyển phòng, yêu cầu cận lâm sàng, bỏ về giữa chừng) không đòi form lý do, để ngoại lệ 2-5 lần trên 30 lượt không thành gánh nặng.
30. Là Bác sĩ, tôi muốn có bản ghi chứng minh tôi xong khám lúc nào do chính tôi ghi, để khi bị hỏi "sao để bệnh nhân chờ lâu" tôi không đứng trước số liệu tôi không được phép chạm.
31. Là Admin, tôi muốn cấu hình Phòng (mã bất biến, tên hiển thị đổi được, Loại phòng, vị trí 3D, chuyên khoa, sức chứa, tiền tố STT, hàng chờ chung hay độc lập), để thêm một Phòng không cần đụng code.
32. Là Admin, tôi muốn chỉnh tham số vận hành (thời gian tạm giữ, số lần gọi lại, ngưỡng phát hiện quên, ngưỡng SLA vàng đỏ) từ màn cấu hình, để luật chạy theo kinh nghiệm địa phương thay vì hardcode.
33. Là Admin, tôi muốn đọc kho sự kiện append-only với Provenance (ai, khi nào, bằng thao tác nào) và giữ tối thiểu 12 tháng, để đối soát khiếu nại và dựng báo cáo không phải đoán.
34. Là Admin, tôi muốn đánh dấu một bản ghi là nhập nhầm (entered-in-error) thay vì xóa, để thống kê sạch mà hồ sơ pháp lý còn nguyên.
35. Là Admin, tôi muốn thấy metric giám sát thay vì ngưỡng cứng chặn thao tác (tần suất đổi ưu tiên, tỷ lệ override), để phát hiện bất thường mà không ghì tay người làm việc.
36. Là Admin, tôi muốn thấy tỷ lệ override vượt ngưỡng là tín hiệu hạ tầng hỏng (mà không phải lỗi cá nhân), để sửa hệ thống thay vì trách người.
37. Là người công cộng đứng ngoài sảnh, tôi muốn màn TV và URL công cộng chỉ hiện Số thứ tự, Phòng và câu hành động, không bao giờ hiện tên hay thông tin cá nhân, để bệnh viện không lộ PII.
38. Là Chủ dự án, tôi muốn mọi quyết định xếp phòng phân xử qua server với timestamp server ghi một lần không sửa, để dữ liệu thời gian tin được dùng cho đo hiệu quả.
39. Là Chủ dự án, tôi muốn bộ tên trạng thái mượn từ vựng FHIR R5 giữ nguyên tiếng Anh gốc, để tích hợp HIS sau này gần như đổi tên thay vì chuyển ngữ nghĩa.
40. Là Chủ dự án, tôi muốn deploy bằng Docker Compose với custom Node server + Socket.io (không serverless), để WebSocket hoạt động thật khi lên production.

## Implementation Decisions

**Stack (chốt bởi grill):**
- Frontend: HTML5 thuần, vanilla Three.js (không React Three Fiber), JS ES modules + Vite cho dev. UI tiếng Việt toàn bộ.
- Backend: Node.js custom server + Socket.io (App Router không host được WebSocket; self-host, không Vercel).
- CSDL: Postgres qua Prisma. Deploy: Docker Compose.
- Auth: session cookie httpOnly + bcrypt; ba vai trong app (Lễ tân, Bác sĩ, Admin) + kênh công cộng không đăng nhập.

**Ba vòng đời tách bạch (mượn từ vựng FHIR R5, giữ tên tiếng Anh):**
- Appointment = Kế hoạch hẹn: proposed, pending, booked, arrived, checked-in, fulfilled, cancelled, noshow, entered-in-error. Giản lược: bỏ waitlist.
- Visit (đối ứng Encounter) = Lượt khám: planned, in-progress, on-hold, discharged, completed, cancelled, discontinued, entered-in-error, unknown. Quy ước: discharged khi Bệnh nhân rời Phòng, completed sau Khu thu ngân đóng tiền. Sweep cuối ngày: lượt in-progress treo chuyển discharged + nhãn autoClosed, không bao giờ tự completed. Discontinued cho kết thúc sớm có chủ đích.
- subjectStatus = vị trí Bệnh nhân: arrived, triaged, waiting, receiving-care, departed.
- Encounter.location append-only, mỗi entry planned → active → completed, reserved khi giữ chỗ có ý định quay lại. Đổi nơi gói một transaction duy nhất.
- Walk-in: tạo Appointment tại quầy, booked + checked-in một bước. Slot giản lược free/busy (+busy-unavailable cho bảo trì).
- Appointment.priority dùng v3 ActPriority (emergency, urgent, asap, routine).

**Thẻ hàng đợi là thực thể hạng nhất v1:**
- Trạng thái: waiting, called, present, parked (parkUntil bắt buộc), skipped (khôi phục được), no-show chốt cuối phiên.
- Trường: Số thứ tự cấp theo ngày reset mỗi sáng (tiền tố STT theo cấu hình), callAttempts, nhóm ưu tiên theo QĐ 1313/QĐ-BYT, presence marker khi Bệnh nhân xác nhận có mặt (web, thẻ giấy tại quầy, báo Lễ tân).
- Nhóm ưu tiên không hiện cụ thể trên mặt công cộng, chỉ ký hiệu "ưu tiên: có".
- Giao thức gọi không có mặt: gọi số phát 3 kênh → mở tạm giữ (tham số, mặc định 3 phút) + hỏi có mặt → gọi lại tối đa (tham số, mặc định 2 lần) → skipped khôi phục được (undo 60 giây) → no-show chốt cuối phiên. Bệnh nhân quay lại vào cuối hàng.

**Trạng thái Phòng 6 cấp:** free, reserved, occupied, cleaning, disabled (tĩnh, xám, mang lý do và mốc mở lại, khóa drop), alert (cần xử lý gấp, khóa xếp mới).

**Bảng sự kiện append-only, 7 nhóm:** patient.status.changed, assignment.created, assignment.revoked, encounter.location.changed, room.state.changed, queue.ticket.changed, config.changed. Mỗi sự kiện mang configVersion hoặc id riêng để idempotent. Kho sự kiện là nguồn sự thật duy nhất; Provenance và báo cáo là projection. Timestamp server, chỉ ghi thêm, không ai sửa.

**3D World:**
- Vai trò: công cụ quan sát hạng nhất với đường tắt thao tác. Bảng điều phối là mặt sàn cao điểm. Hai đường thao tác chính thức ghi cùng một dữ liệu qua server.
- Kéo thả: drag là đề xuất, server là thẩm quyền. Drop mặc định chỉ reserved; auto-call qua cờ callNow ghép cùng transactionId, không bật mặc định. Ngưỡng mục tiêu 300ms P95 cho drop — đo trên stack thật trước khi ghi SLA.
- called-pending: agent ngồi nguyên tại chỗ, badge nhấp nháy. Gọi số không tự di chuyển agent.
- Nút ghép hai sự kiện liền nhau xử lý bằng transactionId, renderer gom một frame, cửa sổ 500ms rồi snapshot hòa giải.
- Ràng buộc hiển thị: hàng đợi bind ticketId; Đoàn bệnh nhân = cụm marker + groupId + spawn so le + màu nhóm; Làn cấp cứu = một transaction hai vòng đời; ưu tiên trực giao bằng viền; parked mờ + badge đồng hồ; tối đa 50 agent navmesh; đi bộ qua navmesh crowd (recast-navigation-js), không tween thẳng; instancing cho agent xa camera.
- Khu thu ngân là một Phòng trên 3D để Lễ tân thấy ai còn kẹt ở quầy tiền.

**Bác sĩ (phương án A mỏng nhất):**
- Một đầu vào bắt buộc duy nhất: "xong khám". Khuyến nghị nút ghép complete-and-call-next. Đồng hồ lượt N bắt đầu khi N vào phòng thật, kết thúc khi nút ghép bấm; cái đuôi 30-90 giây thuộc dữ liệu của N.
- Giao diện sống trong bề mặt Bác sĩ đã mở cả ngày hoặc lớp phủ. Hiển thị thụ động 4 dòng. Ngoại lệ trong menu ẩn, không form lý do.
- Phương án B (không giao diện Bác sĩ, Lễ tân tự đánh dấu) chỉ là chế độ thoái lui cho phòng một Bác sĩ hoặc kênh hỏng.
- Phát hiện quên: phòng "đang khám" vượt max(1.5×trung vị phòng, 15 phút) — tham số hóa — thì cờ lên màn Lễ tân, không bấm chuông vào phòng.

**Zero-PII:** TV và URL công cộng chỉ hiện Số thứ tự, Phòng, câu hành động. Endpoint công cộng trả projection tự định nghĩa, không trả resource FHIR nguyên bản.

**Quyền:** Ma trận — Lễ tân đổi trạng thái vận hành Phòng được, đổi định nghĩa Phòng không (mã Phòng bất biến, tên hiển thị đổi được qua config.changed). Override của Lễ tân bắt buộc chọn lý do từ danh sách. Cổng vào completed chỉ mở bằng tín hiệu Bác sĩ; đường override ghi audit. Không ngưỡng cứng chặn thao tác; dùng metric giám sát kèm cảnh báo.

**Cấu hình Phòng:** mã bất biến, tên hiển thị, tọa độ/zone 3D, Loại phòng, chuyên khoa, giai đoạn luồng phục vụ, thời gian trung bình mỗi giai đoạn, sức chứa, lịch ca, trạng thái hoạt động, Bác sĩ trực, tiền tố STT, ngưỡng SLA vàng đỏ, hàng chờ chung hay độc lập. Chuyển khối là bulk operation trên Thẻ hàng đợi với preview số lượng và xác nhận. Mọi thay đổi cấu hình phát config.changed kèm configVersion; client có nút tải lại cấu hình.

**Seam kiểm thử:** một seam chính là ranh giới server (REST + sự kiện Socket.io). Module state machine thuần (bảng chuyển Visit/Thẻ hàng đợi/Phòng) test trực tiếp cho nhanh; test tích hợp chạy qua seam server.

## Testing Decisions

- Test chỉ khẳng định hành vi bên ngoài quan sát được: qua REST, qua sự kiện Socket.io, qua snapshot hòa giải. Không test cấu trúc nội bộ của client.
- Module state machine là seam phụ duy nhất cho tốc độ: bảng chuyển trạng thái và các luật (một transaction đổi nơi, sweep cuối ngày, no-show chốt cuối phiên) là hàm thuần, test đơn vị trực tiếp.
- Kịch bản ưu tiên từ hội đồng: đoàn 20 người, gọi không có mặt rồi quay lại, Phòng hỏng giữa buổi với chuyển khối, đổi phòng giữa on-hold giữ chỗ, xung đột xếp phòng hai màn hình, sweep cuối ngày không tự completed, zero-PII trên endpoint công cộng.
- Chưa có prior art trong codebase (codebase mới); mỗi ticket implement sẽ dựng test theo đúng seam này để các ticket sau tái dùng mẫu.
- Hiệu năng 3D (50 agent, 300ms P95) đo bằng benchmark thật ở giai đoạn implement trước khi cam kết, không viết test khẳng định số chưa đo.

## Out of Scope

- Tích hợp HIS thật, kê đơn, xử trí y khoa, e-prescription — hệ thống chỉ ghi cờ "có kết quả cận lâm sàng chờ đọc", không chứa dữ liệu lâm sàng.
- Quyết toán BHYT, hóa đơn điện tử — chỉ phân biệt discharged/completed cho đối soát sau này.
- Nội trú (Encounter.class IMP), Encounter.partOf — để chỗ trong model, không dựng luồng.
- Auto-assign bệnh nhân vào phòng — Điều phối manual là quyết định sản phẩm của chủ dự án; gợi ý tự động chỉ là đề xuất Lễ tân giữ quyền từ chối.
- Đánh giá năng lực cá nhân Bác sĩ từ dữ liệu điều phối — hội đồng đòi 4 điều kiện chưa khép.
- TTS loa thật và hành vi thẻ giấy người già — cần thử nghiệm tại quầy thật, v1 phát sự kiện cho kênh hiển thị và để chỗ kênh loa.
- Nhiều cơ sở, multi-tenant, i18n ngoài tiếng Việt.

## Further Notes

- Q8/Q11/Q12 chốt bằng mặc định hội đồng vì user trả lời "continue" (ghi rõ trong research doc, mục Quyết định vòng 4); user đổi được sau và các ticket liên quan sẽ khoanh vùng để đổi không đắt.
- Các tham số (tạm giữ 3 phút, gọi lại 2 lần, ngưỡng quên, SLA vàng đỏ) là cấu hình admin qua config.changed, không hardcode.
- Các con số hiệu năng 3D và độ trễ thông báo phải đo trên stack thật ở giai đoạn implement rồi mới ghi SLA (remaining disagreement số 1 của hội đồng).
- Văn hóa nhịp khám (lễ tân đẩy chủ đạo hay Bác sĩ mời chủ đạo) cần kiểm chứng với người thật trước khi bóc giao diện Bác sĩ — thiết kế hiện giữ phương án A mỏng nhất để hai hướng đều chạy được.
- Chưa có issue tracker (workspace chưa phải git repo); spec này đóng vai artifact tracker với nhãn ready-for-agent. Khi user khởi tạo repo, spec migrate sang tracker và giữ nhãn.
