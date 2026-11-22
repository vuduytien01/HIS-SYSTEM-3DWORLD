# Persona Chuyên gia OPD + FHIR — Báo cáo vòng 1 (premortem + position)

*Agent hội đồng. Tự tin 0.75. Đã đối chiếu nguyên văn FHIR R5 trong phiên. Nguyên tắc: Model the Domain (ba vòng đời tách bạch), Boundary Discipline (value set validate ở biên API).*

## 1. Premortem nghiệp vụ — 5 sai sót mô hình hóa dễ mắc

**1.1. Gộp Appointment và Visit thành một thực thể.** Vòng đời khác nhau cả chủ thể lẫn thời điểm. Appointment tồn tại trước ngày khám (proposed, pending, booked), FHIR R5 định nghĩa fulfilled là "planning stages complete, the encounter resource will exist and will track further status changes". Visit chỉ xuất hiện khi sự kiện y khoa bắt đầu. Bệnh nhân đặt hẹn 9h đến 8h50: đổi Appointment trong khi Visit chỉ planned. Bỏ hẹn là Appointment noshow, nếu Visit đã mở phải hủy riêng. Gộp một cột status thì mọi kịch bản đổi phòng, đi cận lâm sàng, bỏ lượt phải biểu diễn bằng boolean phụ.

**1.2. Coi diagnostics là bước bắt buộc tuyến tính.** Đa số lượt ngoại trú không có cận lâm sàng. FSM tuyến tính bắt mọi người đi qua từng nấc thì ca không chỉ định không bao giờ hoàn tất. Encounter.location là danh sách nhiều địa điểm tùy chọn và on-hold là trạng thái của Visit, không phải nấc cứng trên đường ray. Giữ đúng thiết kế đó, không thêm boolean isAtDiagnostics.

**1.3. Không model vòng lặp quay lại lấy kết quả lần hai.** Bệnh nhân đi X-quang, quay lại 103 đọc kết quả, lại được chỉ định xét nghiệm máu, lại đi và lại về. Có thể ba đợt on-hold trong một Visit. Model append-only của Encounter.location chịu được: mỗi đợt là entry planned → active → completed mới, Visit lặp on-hold → in-progress bao nhiêu lần cũng hợp lệ.

**1.4. Quên hủy hoặc đổi trạng thái nguồn khi chuyển phòng.** Chuyển 103 sang 104, chỉ thêm entry mới quên đổi entry cũ → 103 vẫn active, bệnh nhân đứng hai chỗ trên 3D. Quy tắc một transition duy nhất, một transaction. Entry cũ completed nếu không quay lại, hoặc reserved nếu dự định quay lại (giữ ghế khi đi X-quang). Entry mới planned, subjectStatus cập nhật cùng lúc.

**1.5. Không tách discharged khỏi completed.** Discharged là bệnh nhân đã rời cơ sở trước khi mọi việc đóng, completed là lượt khám đóng sạch. Bệnh nhân khám xong ra về nhưng chưa thanh toán, hoặc bỏ dở chưa đọc kết quả, đều phải discharged không được tính completed — vì quyết toán BHYT và báo cáo doanh thu cuối ngày cần biết ca nào còn nợ thủ tục. Discontinued dành cho chủ động dừng (chuyển tuyến). Gộp thì khi HIS thật đòi chuyển giao dữ liệu quyết toán phải viết migration sửa dữ liệu lịch sử.

## 2. Kiểm tra mô hình — 7 kịch bản

### Quy ước chốt trước khi chạy
- Appointment: proposed → pending → booked → arrived → checked-in → fulfilled (ngay khi Visit lần đầu in-progress). cancelled và noshow là terminal.
- Visit: planned → in-progress → on-hold ↔ in-progress (lặp mỗi đợt cận lâm sàng) → discharged → completed.
- subjectStatus: arrived → triaged → waiting → receiving-care → departed.
- Encounter.location: append-only, mỗi nơi một entry: planned → active → completed; reserved khi giữ chỗ có ý định quay lại.
- Walk-in: tạo Appointment tại quầy, booked + checked-in một bước. Model vẫn cho phép Visit tồn tại không cần Appointment.

### Kết quả từng kịch bản
- **(a) Đặt hẹn online, đến sớm, check-in, xếp phòng 103:** Appointment booked → arrived → checked-in → fulfilled; Visit planned → in-progress; subjectStatus arrived → waiting → receiving-care; location entry 103 planned → active. Chịu được hoàn toàn.
- **(b) Walk-in lấy số, xếp phòng ít người:** Appointment tạo tại quầy booked + checked-in cùng bước. Slot không bắt buộc cho walk-in. Chịu được. Rủi ro: tạo Appointment cho walk-in phải nhất quán trong code, không thì thống kê noshow nhiễu.
- **(c) Chỉ định X-quang, quay lại 103 đọc kết quả:** Appointment fulfilled giữ nguyên. Visit in-progress → on-hold → in-progress. Location [103: active → reserved] + [X-quang: planned → active → completed] + [103: reserved → active]. Đây chính là lý do chuẩn FHIR có reserved trong location.status. Kịch bản chứng minh giá trị append-only.
- **(d) Khẩn chen trước 3 người:** Appointment.priority R5 có sẵn CodeableConcept v3 ActPriority (emergency, urgent, asap, routine). Nhưng thứ tự gọi trong hàng chờ một Location không có thực thể nào. Vận hành được nhờ lễ tân manual, nhưng không ghi được "chen trước ai, lúc nào". Cần QueueTicket nội bộ.
- **(e) Gọi không có mặt, gọi lại 2 lần, bỏ lượt, quay lại:** Khi bỏ lượt không nên chuyển noshow ngay (định nghĩa noshow là "did not appear", chốt cuối phiên). Khi quay lại subjectStatus về waiting vào cuối hàng. Cuối ngày không quay lại: Visit cancelled, Appointment noshow. Lỗ hổng: số lần gọi và thời điểm gọi không có trường; lượt bỏ rồi quay lại không có marker. Cần extension callAttempts trên QueueTicket + trạng thái skipped. Đây là lỗ hổng lớn nhất của mô hình trong phần lớp hàng đợi.
- **(f) Đổi phòng giữa chừng 103 hết giờ:** Đang in-progress: [103: active → completed] + [104: planned → active], Visit vẫn in-progress. Đang on-hold: [103: reserved → completed] + [104: planned]. Đang chờ: entry 103 planned → cancelled, entry 104 planned. Chịu được mọi nhánh, chỉ cần chặt quy tắc một transaction.
- **(g) Khám xong đi thanh toán rồi hoàn tất:** Visit in-progress → discharged (rời phòng khám, có thể chưa thanh toán) → completed (thu ngân đóng tiền). Khuyến nghị model khu thu ngân là Location trên 3D để lễ tân nhìn thấy bệnh nhân còn kẹt ở quầy tiền. Ranh giới phải chốt: discharged trước, completed sau thanh toán.

**Kết luận:** 6 trên 7 kịch bản đi qua không cần thêm thực thể. Kịch bản (d) và (e) lộ một thiếu sót duy nhất nhưng hệ trọng: lớp hàng đợi STT với ưu tiên và lượt gọi không tồn tại trong mô hình, dù là bệ đỡ toàn bộ điều phối lễ tân.

## 3. So sánh với chuẩn

**Đã đối chiếu nguyên văn FHIR R5 trong phiên:** Encounter.status đề xuất trùng khớp R5 trừ entered-in-error và unknown. Encounter.location.status trùng khớp tuyệt đối. subjectStatus là element thật của Encounter R5 (CodeableConcept 0..1, core không ràng buộc value set cứng) — bộ 5 giá trị là lựa chọn hệ thống hợp lệ. Appointment.status là R5 trừ waitlist và entered-in-error. Schedule.active boolean chuẩn, Location.partOf chuẩn, Slot.status free/busy là tập con hợp lệ.

**Độ lệch chấp nhận được:** thu hẹp value set cho miền bài toán. Slot chỉ free/busy, nên thêm busy-unavailable cho giờ bảo trì. Walk-in bằng Appointment tạo tại quầy booked + checked-in cùng bước (suy luận practice).

**Độ lệch phải sửa trước khi tích hợp HIS thật:**
1. Khai báo system URI cho value set subjectStatus — công việc một ngày, để trễ dữ liệu lịch sử mang chuỗi không định danh.
2. Bổ sung entered-in-error cho Appointment và Encounter — đối soát y tế bắt buộc có cơ chế đánh dấu bản ghi nhập sai để loại khỏi thống kê nhưng giữ trong hồ sơ pháp lý.
3. Mapping vai trò: lễ tân = participant type ADM (v3 RoleCode) + Scheduler ứng dụng; bác sĩ = PPRF hoặc ATND; thu ngân là điểm yếu, v3 ParticipationType không có code billing, tích hợp phải dùng Claim/Account/extension (suy luận).
4. Audit trail cho mọi thao tác lễ tân — TT 38/2024/TT-BYT đòi dữ liệu truy vết, FHIR có Provenance, phải định trong contract từ đầu.

**Hai thao tác cụ thể:** lễ tân gán phòng = PATCH Encounter tạo entry location planned + subjectStatus. Bác sĩ bắt đầu khám = một transition duy nhất 4 thay đổi trong một transaction: Encounter.status planned → in-progress, entry planned → active, subjectStatus waiting → receiving-care, Appointment → fulfilled.

## 4. Điểm nghiệp vụ còn thiếu, xếp theo quan trọng

1. **STT, hàng chờ, lượt gọi số — VÀO v1, bắt buộc.** Xương sống vai lễ tân. Không thực thể nào ghi thứ tự chờ tại phòng, thời điểm gọi, số lần gọi, lượt bị bỏ. FHIR core không có resource hàng đợi STT. QĐ 1313/QĐ-BYT bắt buộc ưu tiên đối tượng → QueueTicket phải có nhóm ưu tiên, Appointment gắn priority có sẵn R5.
2. **Triage và sinh hiệu — vào v1 ở mức bước, dữ liệu để chỗ.** V1 chỉ cần thời điểm triage và người triage trên Visit; vitals là Observation FHIR nối vào Encounter, để chỗ trong schema, không bắt nhập trong v1.
3. **Đơn thuốc và quầy thuốc — ra ngoài v1, model để chỗ.** Location quầy thuốc trong cây partOf + cờ bước prescribing trên Visit để 3D không sai khi chạy luồng thuốc thật.
4. **Tái khám — nên vào v1, chi phí thấp.** Appointment mới proposed/pending cùng Patient + trường nguồn đặt hẹn (bác sĩ đặt tại bedside hay bệnh nhân tự đặt).
5. **BHYT quyết toán — ra ngoài v1, model để chỗ.** Patient và Visit phải có trường đối tượng bảo hiểm từ đầu. FHIR Coverage và Account làm điểm neo. Phân biệt chưa thanh toán bằng quy ước discharged trước completed.
6. **Bệnh nhân nội trú đi ngang qua — ra ngoài v1, để chỗ từ đầu.** Encounter.class theo v3 ActCode (AMB ngoại trú, IMP nội trú) và Encounter.partOf. Thêm class sau là migration làm méo thống kê.

## 5. Lập trường

Giữ nghiêm ba vòng đời tách bạch. Appointment chỉ là kế hoạch, chết khi encounter bắt đầu. Visit là sự kiện y tế, chủ nhân mọi vòng lặp cận lâm sàng. subjectStatus là vị trí vật lý trên 3D. Encounter.location là nhật ký append-only với quy tắc đổi nơi gói một transaction. Gộp bất kỳ cặp nào cũng sinh kẻ đánh cắp trạng thái. Ba kịch bản (c) và (f) khó nhất trở thành dữ liệu thường thay vì logic ngoại lệ.

Nhượng bộ 1 cho kỹ thuật: QueueTicket, callAttempts, trạng thái skipped được làm extension nội bộ, không chờ IG chuẩn. Điều kiện: khai báo system URI + Provenance cho mỗi thay đổi. Đòi chuẩn tuyệt đối ngay v1 sẽ đẩy cả khối hàng đợi ra ngoài, mà hàng đợi chính là sản phẩm. Nhượng bộ 2 cho lễ tân: không thêm bước phê duyệt cho đổi phòng, bỏ lượt, chen ưu tiên. Quyết định vận hành thuộc về lễ tân, hệ thống chỉ ghi actor và thời điểm. Mỗi bước phê duyệt thêm là một cái ghế trống trong ca đêm.

Tự tin 0.75. Cộng: đối chiếu nguyên văn spec R5 trong phiên, 6/7 kịch bản chịu được. Trừ: lớp hàng đợi STT chưa tồn tại trong mô hình; ranh giới discharged vs completed là quy ước đề xuất, không phải định nghĩa cứng spec; QĐ 1313, TT 38/2024, luồng Jordan Nam Phi kế thừa độ tin của brief chưa đối chiếu nguyên văn.

Nguồn đọc trực tiếp trong phiên: hl7.org/fhir/R5/encounter.html, hl7.org/fhir/R5/appointment.html, hl7.org/fhir/R5/appointment-definitions.html, hl7.org/fhir/R5/valueset-appointmentstatus.html.
