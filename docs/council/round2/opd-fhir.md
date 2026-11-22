# Persona OPD + FHIR — Báo cáo vòng 2 (cross-examination)

*Agent hội đồng. Tự tin 0.80 (từ 0.75 của vòng 1). Giữ nguyên ba vòng đời tách bạch. Mục tiêu đề tài: hệ thống điều phối khám bệnh ngoại trú đủ giàu trạng thái để không vai nào phải dựng hệ thống giấy song song.*

## 1. Phản hồi từng vai

**Receptionist.** Chấp nhận toàn bộ 6 nút một cú bấm. Mỗi nút là một thay đổi trạng thái của QueueTicket, không phải boolean phụ (nguyên tắc Model the Domain). Nhận kịch bản 2 (cấp cứu ngất): đây là nút duy nhất phải ghi thay đổi trên hai vòng đời trong một transaction, chi tiết ở mục 2b. Nhận Park 3 phút và tự nhắc. Phản đối một điểm nhỏ: undo 60 giây của no-show không cần trường previousStatus lưu riêng — bảng sự kiện append-only đã chứa trạng thái trước đó, undo là append sự kiện đảo ngược (đối chiếu Provenance).

**Patient.** Chấp nhận nút "tôi có mặt" — đây là chỉnh sửa mô hình thật so với vòng 1 của tôi: present phải là trạng thái hạng nhất của ticket, không phải cờ (mục 2d). Chấp nhận zero-PII và làm rõ về FHIR (mục 2e). Hỏi lại sau lần gọi đầu hợp nhất thành auto-skip có thời hạn.

**Doctor.** Chấp nhận toàn bộ. Cái đuôi phiếu nằm trong dữ liệu của N khớp trực tiếp quy tắc append-only của tôi. Hai quy ước không xung đột thời điểm, chỉ cần tách transaction (mục 2c).

**Admin.** Chấp nhận bảng sự kiện append-only 12 tháng và điều kiện không ai được xóa. entered-in-error, system URI và bảng sự kiện là ba lớp khác nhau, bổ sung nhau, không thay thế nhau (mục 2f).

**Architect.** Chấp nhận bảng A ánh xạ subjectStatus. Bổ sung nghĩa vụ từ phía tôi: mọi trạng thái QueueTicket mới (present, parked, skipped) phải có hàng ánh xạ không gian — cả ba vẫn ngồi ghế khu chờ với badge khác nhau, không sinh agent, không teleport. Thiếu hàng là vi phạm đúng cách chết 1 của architect.

## 2. Đối chất

### (a) QueueTicket với 6 nút một cú bấm

Trường tối thiểu để phục vụ đủ 6 nút [suy luận từ usecase lễ tân, đối chiếu QĐ 1313 về nhóm ưu tiên]:

| Nút | Trường/trạng thái cần |
|---|---|
| recall | status called, callCount, lastCalledAt; tự khóa sau 2 lần |
| skip | status skipped, đá về cuối hàng, giữ nguyên ticketNumber |
| park | status parked + parkUntil bắt buộc, giữ vị trí gọi |
| no-show | status noshow terminal + noshowAt + actor (audit) |
| ưu tiên | priorityCode (v3 ActPriority: emergency, urgent, asap, routine) + changedAt + actor |
| cấp cứu | xóa khỏi mọi hàng + đổi Encounter, xem mục 2b |

Trả lời câu hỏi park: park là trạng thái hạng nhất của ticket, không phải cờ trên waiting. Khi parked, hàng gọi bỏ qua ticket nhưng bảng vẫn thấy nó với deadline. Parked khác skipped ở hành vi trả hàng: parked trả về vị trí gọi kế tiếp khi hết parkUntil hoặc bệnh nhân quay về; skipped trả về cuối hàng, không deadline. Tách hai trạng thái, không gộp.

Priority là thuộc tính điều khiển sắp xếp, không phải trạng thái. Nếu làm trạng thái thì hủy ưu tiên sẽ mất thứ tự cũ.

### (b) discharged vs completed với lượt treo in-progress

Đối chất premortem admin kịch bản 2: ai đóng lượt treo khi bệnh nhân ngất bị rút đi cấp cứu? Giữ discharged và completed tách bạch, thêm hai thứ [đối chiếu R5 Encounter.status: planned, in-progress, on-hold, discharged, completed, cancelled, discontinued, entered-in-error, unknown]:

1. **Discontinued cho kết thúc sớm có chủ đích.** Nút cấp cứu chuyển Encounter cũ in-progress → discontinued, tạo Encounter mới class EMER (v3 ActCode), nối bằng Encounter.partOf. Định nghĩa R5 discontinued là "the encounter has ended prematurely", chính xác ca này.
2. **Quy tắc sweep cuối ngày.** Mọi Visit còn in-progress sau giờ đóng ca tự chuyển discharged kèm cờ autoClosed, lên báo cáo ngoại lệ cho admin. Không bao giờ tự completed. Hệ thống đóng hộp với dấu vết, không để ai đoán.

Phân biệt hai nhánh của nút cấp cứu: Visit còn planned → cancelled; đã in-progress → discontinued. Một nút, hai nhánh trạng thái, một transaction. Kịch bản bỏ về giữa chừng của doctor rơi vào discharged (bệnh nhân rời cơ sở); nếu quên, sweep bắt.

### (c) Transition 4 thay đổi vs cái đuôi của doctor

Hai quy ước nằm ở hai đầu chuỗi, không va nhau về thời điểm. Hợp nhất thành hai transaction:

- **T1 (nút ghép của bác sĩ): đóng N.** Entry location N active → completed, Encounter N in-progress → discharged, subjectStatus N receiving-care → departed (hoặc waiting nếu còn cận lâm sàng), ticket N ghi servedAt. Cái đuôi 30-90 giây nằm giữa lúc bệnh nhân bước ra và nút ghép, do nút ghép ghi, thuộc dữ liệu N — đúng đề nghị của doctor.
- **T2 (N+1 vào phòng thật): mở N+1.** Entry planned → active, Encounter N+1 planned → in-progress, subjectStatus receiving-care, Appointment → fulfilled. Đây chính là transition 4 thay đổi một transaction của vòng 1, giữ nguyên.

Xung đột tiềm tàng duy nhất: nếu hệ thống suy T2 ngay từ T1 thì đồng hồ N+1 tính sớm từ lúc nút ghép. Khuyến nghị: T2 ưu tiên sự kiện vật lý vào phòng (màn hình phụ, nút cửa), fallback là T1 cộng suy — doctor đã chấp nhận sai số này thuộc về mình. Nút đơn "xong khám" không mời người: chỉ chạy phần đóng N của T1.

### (d) Chuỗi trạng thái chuẩn gọi-lại-2-lần-bỏ-lượt-quay-lại

Chuỗi đầy đủ [suy luận, hợp nhất usecase lễ tân, bệnh nhân, admin]:

waiting → called (callCount 1, phát đồng bộ loa, TV, điện thoại) → trong T_giữ 3 phút: bệnh nhân bấm "tôi có mặt" → present, giữ ưu tiên gọi kế tiếp ngay sau bệnh nhân đang khám; hết T_giữ → hệ thống hỏi lại (web, thẻ giấy, loa) → có phản hồi → present, không phản hồi → auto-skip → recall lễ tân (callCount 2, khóa) → skip hoặc auto-skip → skipped, đá cuối hàng, giữ ticketNumber → quay lại → nút "tôi có mặt" → skipped → waiting cuối hàng, cờ returnedAfterSkip → cuối phiên: chưa served → noshow terminal; đã served → served.

Hai điểm đổi ý so vòng 1: (1) thêm trạng thái present — nút "tôi có mặt" của patient là sự kiện hạng nhất; (2) no-show không chốt ngay lúc bỏ lượt mà chốt cuối phiên, nhưng giờ có quy tắc rõ: người quay lại sau noshow được cấp ticket mới, Appointment giữ noshow để thống kê đúng [đối chiếu định nghĩa R5 noshow = "did not appear"]. Hai vòng đời làm việc này gọn: skip, present, return thuộc ticket; noshow thuộc Appointment.

### (e) Zero-PII và FHIR

Khớp, với một điều kiện [đối chiếu spec]: API công khai không trả resource Appointment hay Encounter nguyên bản. PII trong Appointment: participant (tham chiếu Patient có display name), description, comment, patientInstruction. Trong Encounter: subject, participant, và mọi extension. Biên công khai trả projection tự định nghĩa: ticketNumber, locationDisplay, actionText, priorityFlag. Đây là Boundary Discipline: mỗi biên một shape. FHIR không bắt buộc mọi consumer đọc resource đầy đủ.

QueueTicket thuận lợi cho projection: công khai chỉ cần status, location, câu hành động. Chốt thêm với patient: màn công khai chỉ hiện "ưu tiên: có" bằng ký hiệu, không hiện nhóm cụ thể theo QĐ 1313 — nhóm ưu tiên tiết lộ tình trạng y tế trên màn hình chung [suy luận pháp chế, cần đối chiếu như patient đã ghi].

### (f) entered-in-error vs bảng sự kiện 12 tháng

Khác nhau ở ba lớp, cần cả ba:

1. **System URI là ngữ nghĩa.** Định danh mã cho từng giá trị trạng thái. Bảng sự kiện sống quá 12 tháng chỉ đọc được nếu code có định danh. Công việc cấu hình một ngày.
2. **Entered-in-error là trạng thái sửa sai trên resource.** Bản ghi nhập sai bị đánh dấu, giữ trong hồ sơ pháp lý, loại khỏi thống kê [đối chiếu R5 value set].
3. **Bảng sự kiện append-only là chính sách lưu giữ**, nguồn p50 và p90 của admin.

Ba lớp ghép vào nhau: sửa sai không xóa dòng sự kiện — append correcting event tham chiếu sự kiện sai, resource hiện trạng đánh dấu entered-in-error. Đúng điều kiện của admin.

## 3. Chỉnh sửa mô hình dữ liệu cho synthesis

1. Thêm thực thể QueueTicket vào v1: ticketNumber, appointmentRef 0..1, patientRef, locationRef, status, priorityCode, callCount, lastCalledAt, parkUntil, returnCount, servedAt, noshowAt, issuedAt, actorId, version (phân xung đột, idempotency).
2. Trạng thái ticket: waiting → called → present | parked | skipped | served | noshow. Terminal cuối phiên: served, noshow.
3. Quy tắc: parkUntil bắt buộc khi parked; recall tối đa 2 lần; auto-skip sau hỏi lại; noshow chốt cuối phiên trên Appointment; quay lại sau noshow → ticket mới nối Appointment cũ.
4. Encounter.status dùng discontinued cho kết thúc sớm có chủ đích; nút cấp cứu một cú bấm = một transaction: ticket → emergency lane, Encounter cũ discontinued (hoặc cancelled nếu planned), Encounter mới class EMER.
5. Sweep cuối ngày: in-progress treo → discharged + autoClosed + báo cáo ngoại lệ. Không bao giờ tự completed.
6. Tách transition: T1 nút ghép đóng N, T2 N+1 vào phòng thật. Fallback T2 suy từ T1.
7. Projection công khai zero-PII, không trả resource FHIR nguyên bản; ưu tiên chỉ ký hiệu generic.
8. Correcting event thay vì sửa hoặc xóa sự kiện; system URI bắt buộc khai báo từ ngày đầu.

## 4. Position tổng

Giữ: ba vòng đời tách bạch; Encounter.location append-only với reserved; một transaction mỗi chuyển đổi nơi; discharged vs completed tách bạch; thu ngân giữ quyền completed. Không vai nào phản đối các nền tảng này qua hai vòng.

Đổi: QueueTicket lên hạng nhất v1, không còn là nhượng bộ extension chờ IG chuẩn; thêm trạng thái present, parked, skipped; thêm discontinued và quy tắc sweep; tách transition bắt đầu khám thành hai transaction khi có nút ghép; projection công khai định nghĩa shape riêng.

Tự tin 0.80. Lên từ 0.75 vì: nhu cầu QueueTicket được xác nhận chéo độc lập từ ba vai (lễ tân 6 nút, doctor nút thứ ba, patient present); các quy tắc mới đều có usecase gốc và chữ R5 đối chiếu. Chưa lên cao hơn vì: ngưỡng T_giữ 3 phút, T_hỏi và recall tối đa 2 lần là suy luận chưa đo; ranh giới projection công khai chưa đối chiếu pháp chế; chuỗi trạng thái ticket chưa chạy qua đối kháng kịch bản máy tính.
