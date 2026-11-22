# Synthesis — Decision landscape hội đồng nghiệp vụ

*Hội đồng 6 vai roleplay: lễ tân, bệnh nhân, bác sĩ, admin, chuyên gia OPD+FHIR, kiến trúc realtime 3D. Hai vòng: vòng 1 premortem + position (docs/council/round1/), vòng 2 cross-examination (docs/council/round2/). File này tổng hợp cho bước /to-spec. Ngày: 2026-11-22.*

## 1. Diagnostics hội tụ

| Vai | Tự tin vòng 1 | Tự tin vòng 2 | Di chuyển |
|---|---|---|---|
| Bác sĩ | 0.80 | 0.85 | Tăng — lễ tân xác nhận độc lập bất đối xứng quan sát, timestamp server bảo vệ bác sĩ |
| Bệnh nhân | 0.70 | 0.85 | Tăng — năm đối chất khép lại không gãy lập trường gốc |
| Lễ tân | 0.70 | 0.80 | Tăng — ba vai độc lập hội tụ cùng hướng |
| OPD-FHIR | 0.75 | 0.80 | Tăng — QueueTicket được xác nhận chéo ba vai |
| Admin | 0.70 | 0.80 | Tăng — bốn vai hội tụ về ba lập trường cốt lõi |
| Kiến trúc 3D | 0.70 | 0.78 | Tăng — projection sống sót qua cả 5 vai, hai lỗ hổng đã vá |

Mẫu hình: tự tin trung bình tăng, độ phân tán hẹp, không có vai nào cứng hóa lập trường. Kết luận hội đồng: hội tụ thật, không phải consensus giả.

## 2. Shared risks — những cách chết mọi vai đều công nhận

1. **Trạng thái hiển thị tách khỏi trạng thái dữ liệu.** Năm premortem của admin và nhiều kịch bản của các vai khác đều chết ở chỗ server không có kênh sự kiện riêng cho cấu hình, hoặc client tin snapshot lúc mở app. Giải pháp hội tụ: 7 nhóm sự kiện + configVersion + nút tải lại cấu hình.
2. **Trạng thái thật nằm ở phòng khám, người ghi lại đứng ở quầy.** Sự cố 90 phút sổ khám bị quên. Giải pháp: chỉ chủ thể trong phòng mới phát tín hiệu kết thúc khám.
3. **Tờ giấy và trí nhớ trở thành nguồn sự thật khi nghiệp vụ có trạng thái mà hệ thống không mô hình hóa.** Đoàn, phòng hỏng, tạm vắng, người nhà hỏi, bệnh nhân đi vệ sinh. Giải pháp: các trạng thái này là dữ liệu hạng nhất.
4. **Dữ liệu đo bị nhiễu không có hướng.** Timestamp ước lượng từ quan sát bên ngoài không sửa được sau. Giải pháp: timestamp server ghi, chỉ ghi thêm, không ai sửa.
5. **UI lạc quan không được thu hồi có hình khi conflict.** Giải pháp: server là trọng tài, reject kèm lý do, băng nhỏ không chặn, hoàn tác ba mức.

## 3. Shared concerns — quy ước hội đồng đã hội tụ

### 3.1 Q8 — Usecase người khám (đáp án hội đồng cho câu hỏi còn mở)

Phương án A mỏng nhất, hội tụ tuyệt đối 6/6 vai, không vai nào phản đối:
- Một đầu vào bắt buộc duy nhất từ bác sĩ: "xong khám". Bắt đầu khám là sự kiện quan sát được từ bên ngoài, suy từ lúc bệnh nhân bước qua cửa (T2), kết thúc chỉ chủ thể trong phòng biết.
- Khuyến nghị dùng nút ghép complete-and-call-next. Điều kiện dữ liệu: đồng hồ của bệnh nhân N bắt đầu lúc N vào phòng thật, kết thúc lúc nút ghép được bấm, cái đuôi 30-90 giây thuộc dữ liệu của N. Tách T1 (nút ghép đóng lượt N) khỏi T2 (N+1 vào phòng thật, fallback suy từ T1).
- Giao diện sống trong bề mặt bác sĩ đã mở cả ngày hoặc lớp phủ, không phải app thứ hai. Hiển thị thụ động 4 dòng: STT và tên, loại hẹn, lý do lễ tân ghi, cờ kết quả CLS chờ đọc.
- Nút thứ ba cho ngoại lệ (chuyển phòng, yêu cầu CLS, bỏ về giữa chừng) nằm trong menu ẩn, 2-5 lần trên 30 lượt, không form lý do.
- Phát hiện quên: phòng ghi "đang khám" vượt max(1.5×trung vị phòng, 15 phút) thì cờ lên màn lễ tân, không bấm chuông vào phòng.
- Phương án B (bỏ giao diện) chỉ là chế độ thoái lui: phòng khám một bác sĩ, hoặc kênh bác sĩ hỏng. Không phải mặc định đa bác sĩ.
- Đánh giá năng lực cá nhân từ dữ liệu điều phối cần 4 điều kiện trước khi chấp nhận (đối soát loại ca từ HIS, đo cấp phòng trước, chỉ cảnh báo bất thường, p50+p90).

### 3.2 Mô hình dữ liệu — ba vòng đời tách bạch + QueueTicket hạng nhất

- Appointment (kế hoạch) / Visit (thực tế, đối ứng Encounter) / subjectStatus (vị trí) giữ tách bạch, hợp nhất tên từ vựng FHIR R5.
- Quy ước chốt: discharged trước, completed sau thanh toán. Sweep cuối ngày: lượt in-progress treo chuyển discharged + nhãn autoClosed, không bao giờ tự completed. Discontinued cho kết thúc sớm có chủ đích.
- **QueueTicket nâng lên thực thể hạng nhất v1** (báo cáo round1 đề xuất extension, round2 thu hồi sau khi ba vai xác nhận chéo). Trạng thái: waiting, called, present, parked (parkUntil bắt buộc), skipped (khôi phục được), no-show chốt cuối phiên. Trường: callAttempts, nhóm ưu tiên theo QĐ 1313/QĐ-BYT.
- Nhóm ưu tiên không hiện cụ thể trên màn công cộng, chỉ ký hiệu "ưu tiên: có" (nhóm tiết lộ tình trạng y tế).
- Appointment.priority dùng v3 ActPriority có sẵn R5 (emergency, urgent, asap, routine).
- Ghi Provenance từ kho sự kiện, không giữ hai kho. Bổ sung entered-in-error và khai báo system URI cho value set trước khi tích hợp HIS.

### 3.3 Trạng thái phòng — 6 cấp

free, reserved, occupied, cleaning, **disabled (mới, tách khỏi alert: tĩnh, xám, mang lý do và mốc mở lại, khóa drop)**, alert. Nguồn gộp BedBoard + FHIR + đề xuất lễ tân.

### 3.4 Bảng sự kiện — 7 nhóm, append-only

patient.status.changed, assignment.created, assignment.revoked, encounter.location.changed, room.state.changed, queue.ticket.changed, **config.changed (mới cho yêu cầu admin)**. Mỗi nhóm mang configVersion hoặc id riêng để idempotent. Kho sự kiện là nguồn duy nhất, Provenance và báo cáo là projection.

### 3.5 3D world — vai trò và ràng buộc cập nhật

- Vai trò: **công cụ quan sát hạng nhất với đường tắt thao tác**, không bắt buộc mỗi lượt đi qua 3D. Bảng danh sách với phím tắt là mặt sàn làm việc cao điểm. 3D trả lời: nghẽn cục bộ, vị trí không gian, hình dạng nghẽn — những cái bảng chữ không thay thế được.
- Kéo thả: một trong hai đường thao tác chính thức, cùng ghi sự kiện qua server. Drag là đề xuất, server là thẩm quyền. Drop mặc định chỉ reserved; auto-call qua cờ callNow ghép cùng transactionId, không bật mặc định (đề xuất doctor, architect chấp nhận ở lớp sự kiện).
- called-pending vào Bảng A: agent ngồi nguyên, badge nhấp nháy — trùng dòng "đã gọi, đang chờ vào" trên TV. Gọi số không tự di chuyển agent.
- Nút ghép hai sự kiện liền nhau xử lý bằng transactionId, renderer gom một frame, cửa sổ 500ms rồi snapshot hòa giải.
- Thêm ràng buộc: hàng đợi world bind ticketId; đoàn bệnh nhân = cụm marker + groupId + spawn so le + màu nhóm; làn cấp cứu = một transaction hai vòng đời (Visit discontinued + Visit mới hoặc chuyển làn); ưu tiên trực giao bằng viền (U, đỏ cấp cứu); park mờ + badge đồng hồ.
- 7 nhóm sự kiện trong ngân sách đã kiểm tra: config dưới 1/giây trung bình so với 50/giây.

### 3.6 Giao thức gọi không có mặt (hợp nhất bệnh nhân + lễ tân + FHIR)

call.issued phát 3 kênh (loa, TV, web cùng sự kiện) → đồng thời mở park 3 phút + câu hỏi "bạn có mặt không" → recall tối đa 2 lần → skipped khôi phục được (undo 60 giây) → no-show chốt cuối phiên theo định nghĩa FHIR "did not appear". presence marker trên ticket khi bệnh nhân xác nhận (nút web, thẻ giấy tại quầy, báo lễ tân). Bệnh nhân quay lại vào cuối hàng, chấp nhận bỏ giữ chỗ cũ.

### 3.7 Zero-PII

Ràng buộc lớp trình bày công khai: TV và URL công khai chỉ hiện STT, phòng, câu hành động. Endpoint công khai trả projection tự định nghĩa, không trả resource FHIR nguyên bản (PII nằm ở participant, description, comment, subject, extension). Ưu tiên chỉ ký hiệu. Không xung đột với báo cáo admin hay tra cứu nội bộ lễ tân.

### 3.8 Quyền và giám sát

- Ma trận quyền round1 của admin giữ, điều chỉnh theo cross-exam: lễ tân đổi trạng thái vận hành phòng được, đổi định nghĩa phòng không (mã phòng bất biến, tên hiển thị đổi được qua config.changed).
- Bỏ hạn chế cứng 5 lần đổi priority/giờ, đổi thành metric giám sát kèm cảnh báo; phát hiện bất thường thay ngưỡng cứng (đề xuất lễ tân được admin chấp nhận).
- Override của lễ tân phải chọn lý do từ danh sách, không gõ tự do.
- Cổng vào completed chỉ mở bằng tín hiệu của bác sĩ, đường override bắt buộc ghi lý do vào audit log. Tỷ lệ override vượt 5% lượt là tín hiệu hạ tầng hỏng, không phải lỗi bác sĩ.

### 3.9 Cấu hình phòng (khung dữ liệu cho admin + 3D)

Mã phòng bất biến, tên hiển thị đổi được, tọa độ/zone 3D (thiếu tự xếp zone theo chức năng), chuyên khoa + nhóm chức năng tương đương (cho chuyển khối), giai đoạn luồng phục vụ, thời gian trung bình mỗi giai đoạn, sức chứa, lịch ca, trạng thái hoạt động, bác sĩ trực, tiền tố STT, ngưỡng SLA vàng đỏ, hàng chờ chung hay độc lập. Chuyển khối là bulk operation trên QueueTicket với preview số lượng và xác nhận.

## 4. Remaining disagreements — chưa khép được

1. **Số hiệu năng 3D chưa đo.** 50 agent navmesh, 300ms P95, 7 nhóm sự kiện là ước lượng roleplay, chưa đo trên stack Node + Socket.io + Three.js thật. Architect giữ tự tin 0.78 vì lý do này.
2. **Chủ thể phát sự kiện bắt đầu khám.** Doctor neo vào thao tác đưa vào phòng của lễ tân hoặc nút ghép của mình; opd-fhir quy định T2 fallback suy từ T1. Cần chốt trong spec: lúc nào ghi timestamp "bắt đầu" khi lễ tân xếp phòng mà chưa gọi.
3. **Đánh giá năng lực cá nhân từ dữ liệu điều phối.** Doctor đòi 4 điều kiện, admin chưa chốt. Cam kết thể chế, hội đồng không tự bảo đảm được.
4. **Độ trễ loa TTS và hành vi thẻ giấy người già** — cần thử nghiệm tại quầy thật.
5. **Văn hóa nhịp khám** (lễ tân đẩy chủ đạo hay bác sĩ mời chủ đạo) — chỉ có roleplay một vai mỗi phía, cần kiểm chứng với người thật trước khi bóc giao diện.
6. **Ngưỡng park 3 phút, recall 2 lần, T hỏi lại** — suy luận chưa đo, cần tham số hóa để admin chỉnh được thay vì cố định.

## 5. Assumptions per position

- **Lễ tân**: thiết kế giữ được tốc độ 300-500 lượt/ngày với 6 nút một cú bấm và Enter gợi ý; khoa có đủ lễ tân dự phòng cho kịch bản một trên năm mươi.
- **Bệnh nhân**: bệnh viện chịu đầu tư màn hình TV + loa + kênh giấy; quầy chấp nhận một bước hành chính đăng ký người thân nhận hộ.
- **Bác sĩ**: giao diện sống trong HIS hoặc lớp phủ sẵn có; hệ thống không đòi thao tác y khoa.
- **Admin**: kho sự kiện append-only đủ cho mọi báo cáo; cấu hình có phiên bản; có người dự phòng có quyền mở khóa.
- **OPD-FHIR**: quy ước discharged/completed/sweep được chốt thành spec; QueueTicket là extension nội bộ có system URI.
- **Kiến trúc 3D**: mật độ giờ cao điểm và kích thước mặt bằng đủ nhỏ cho 50 agent; hiệu năng đo được trước khi ghi SLA.

## 6. Principal's path — lộ trình khuyến nghị cho chủ dự án

1. **Chốt Q8 theo hội đồng**: bác sĩ hai nút mỏng nhất (nút ghép complete-and-call-next khuyến nghị), lễ tân giữ toàn bộ điều phối, B chỉ là chế độ thoái lui. Dẫn chứng: hội tụ 6/6 vai, khớp chuẩn ngành Nahdi/Sys-Metrics/Entry2Exit từ nghiên cứu phần 6.
2. **Chốt Q12 theo hội đồng**: dùng bộ từ vựng FHIR R5 xuyên suốt với các quy ước discharged/completed/sweep/discontinued, QueueTicket hạng nhất.
3. **Câu hỏi còn chờ chủ dự án**: Q11 auth production (Postgres + Docker, ma trận quyền hội đồng đã trình bày).
4. **Cần tham số hóa thay vì cố định**: park 3 phút, recall 2 lần, ngưỡng phát hiện quên, SLA vàng đỏ — để admin chỉnh.
5. **Đo trước khi ghi SLA**: các con số hiệu năng 3D và độ trễ thông báo phải đo trên stack thật trong giai đoạn implement.
6. **Kiểm chứng người thật**: văn hóa nhịp khám và thẻ giấy người già cần thử với bác sĩ và lễ tân thật trước khi bóc giao diện.

## 7. Nguồn

12 báo cáo hội đồng: docs/council/round1/{receptionist,patient,doctor,admin,opd-fhir,architect}.md, docs/council/round2/{receptionist,patient,doctor,admin,opd-fhir,architect}.md. Nghiên cứu nền: docs/research/hospital-orchestration-research.md (6 phần). GLOSSARY.md.
