# Persona Bệnh nhân — Phản hồi cross-examination vòng 2

*Agent hội đồng roleplay bệnh nhân ngoại trú + con của ông cụ 75 tuổi không dùng smartphone. Tự tin 0.85 (từ 0.7 ở round1).*

## 1. Phản hồi từng vai

### Lễ tân
Chấp nhận: ba nguyên tắc của cô — màn hình làm việc, ngoại lệ là trạng thái hạng nhất, một nguồn sự thật. Park 3 phút và no-show undo 60 giây giải đúng nỗi sợ kịch bản 4 của tôi. Kéo thả không tự gọi số cũng bảo vệ tôi, tránh loạt loa hô ngoài ý muốn khi chỉ dồn hàng. Kinh nghiệm roleplay: cụ già nhà tôi từng bị gọi lệch vì quầy nhớ bằng trí nhớ, đúng dạng rủi ro cô mô tả.
Phản đối: không có điểm dữ liệu nào cần phản đối.
Đổi ý: tôi bỏ ngầm yêu cầu "quay lại giữ chỗ cũ". Quay lại vào cuối hàng là mặc định công bằng, opd-fhir cũng chốt vậy. Cái tôi đòi là cửa sổ 3 phút và kênh báo có mặt, không phải giữ ưu tiên cũ.

### Bác sĩ
Chấp nhận: mô hình mỏng, một nút xong khám dạng ghép complete-and-call-next, giờ bắt đầu tính lúc bệnh nhân bước vào phòng. Không ảnh hưởng kênh thông tin của tôi.
Phản đối: không có.
Đổi ý nhỏ: ước lượng "còn 2 số trước mình" của tôi phụ thuộc thời gian phục vụ đáng tin. Nút ghép giữ cái đuôi phiếu trong dữ liệu của bệnh nhân N, khiến ước lượng chờ của tôi chính xác hơn. Suy luận: tôi hưởng lợi từ thiết kế của bác sĩ chứ không trả chi phí.

### Admin
Chấp nhận: bảng sự kiện chỉ ghi thêm, cấu hình có phiên bản, không ai xóa lịch sử. Nhượng bộ 1 của admin về timestamp server là điều kiện cho mọi báo cáo tôi tin được.
Phản đối: một chỗ. Định nghĩa no-show "gọi quá 3 phút không có mặt" xung đột với "noshow chốt cuối phiên" của opd-fhir. 3 phút phải là ngưỡng skip tại quầy, noshow là nhãn phân loại cuối phiên. Hai tầng khác nhau, gộp một nhãn là thống kê bẩn.
Đổi ý: không.

### OPD-FHIR
Chấp nhận: ba vòng đời tách bạch, Encounter.location append-only, discharged trước completed, QueueTicket làm extension nội bộ.
Phản đối: không phản đối mô hình, đòi bổ sung một trường. Extension callAttempts phải chứa cả dấu vết presence — thời điểm bệnh nhân trả lời "có mặt". Đó là bằng chứng phân biệt no-show thật với bỏ sót. Admin mục 4 than thiếu chính sự phân biệt này, dữ liệu của tôi lấp đúng chỗ trống của admin.
Đổi ý: không đổi, chỉ cụ thể hóa ở mục 2e.

### Kiến trúc sư
Chấp nhận: world là phép chiếu, không stream vị trí, snapshot khi reconnect, kéo thả là đề xuất và server là trọng tài. Các kênh của tôi không cần vị trí liên tục, chỉ cần sự kiện rời rạc.
Phản đối: 5 nhóm sự kiện chưa đủ cho ba kênh của tôi, xem mục 2d.
Đổi ý: chấp nhận nén thời gian và cap agent. Các cap đó thuộc lớp trình bày 3D, không chạm kênh số-phòng-hành động của tôi.

## 2. Đối chất chủ đề nóng

### (a) Zero-PII xung đột với ai
Không xung đột với báo cáo admin. Suy luận: mọi báo cáo admin liệt kê là tổng hợp — tổng lượt, p50 p90, SLA, no-show, thời gian phục vụ. Không cái nào cần tên bệnh nhân. Audit log "ai đổi priority lúc nào" là màn hình nội bộ có identity, không nằm trên TV hay URL công khai. Zero-PII là ràng buộc của lớp trình bày công khai, không phải của mô hình dữ liệu. Ranh giới chốt: backend giữ đầy đủ, endpoint công khai chiếu ra chỉ số, phòng, một câu hành động.
Với lễ tân: không làm cô khó trả lời người nhà. Kịch bản 5 của cô là tra cứu trên màn hình của cô, màn hình đó có tên vì cô được xác thực. Zero-PII còn bảo vệ cô: TV không tên nghĩa là người nhà đứng chờ không đọc được tên người khác. Ít một dòng cãi vã về riêng tư tại quầy. Kinh nghiệm roleplay: quầy đông, người nhà đứng cạnh TV càng lâu càng hỏi nhiều.

### (b) Đặt lịch thành ưu tiên gì trên hàng đợi
Tôi rút lại một nửa lập trường round1. QĐ 1313 ưu tiên đối tượng pháp lý: người già, khuyết tật, thai phụ. Đặt lịch online không nằm trong đó. Booked chen trước người già walk-in là phạm nguyên tắc công bằng mà chính tôi, con của đối tượng ưu tiên, đòi giữ. Định nghĩa mới tôi chấp nhận: đặt lịch chốt thứ tự trong nhóm cùng mức ưu tiên. Trong nhóm thường, người booked 9h đứng trước walk-in 9h05. Người ưu tiên pháp lý vẫn đứng trước cả nhóm thường. Cơ chế khớp sẵn: cờ ưu tiên một cú bấm của lễ tân gắn nhóm pháp lý theo QĐ 1313, QueueTicket của opd-fhir ghi nhóm và thứ tự. Thứ tự gọi do server tính từ ticket, không do lễ tân nhớ. TV phải vẽ kết quả kèm ký hiệu giải thích (chữ U), đúng premortem kịch bản 2 của tôi — số nhảy không nhãn là lỗi hệ thống trong mắt bệnh nhân thường. Suy luận: ưu tiên hiển thị bằng badge màu theo architect, vị trí trong hàng không xáo lại.

### (c) "Bạn có mặt không" khớp với park 3 phút và noshow cuối phiên
Khớp, và ba cơ chế ghép thành một giao thức thay vì ba thứ rời rạc. Tầng 1: gọi số thì hệ thống tự đẩy câu hỏi "bạn có mặt không" lên web và SMS, đồng thời mở cửa sổ park 3 phút của lễ tân. Một sự kiện call.issued sinh cả hai, không thêm thao tác tay — bảng của cô đã có 40-80 recall mỗi ngày, không nhét thêm việc tay. Tầng 2: bệnh nhân bấm nút web, đưa thẻ cho y tá, hoặc báo quầy, tất cả ghi cùng một marker presence trên ticket. Im lặng hết 3 phút thì lễ tân quyết skip, undo 60 giây cứu lỗi tay cô lúc mệt. Tầng 3: cuối phiên mới đóng nhãn noshow theo opd-fhir (e); quay lại thì subjectStatus về waiting vào cuối hàng. Đổi ý của tôi: bỏ cụm "hỏi lại" mơ hồ ở round1, nhận giao thức này nguyên văn. Điều kiện duy nhất: marker presence phải có chỗ trong extension callAttempts, vì nó là dữ liệu phân biệt no-show thật với bỏ sót.

### (d) Ba kênh với 5 nhóm sự kiện của architect
Đủ 80%, thiếu một họ sự kiện. Suy luận từ bảng sự kiện của architect: xếp phòng là assignment.created, nhưng lễ tân chốt rõ "kéo chỉ xếp phòng, KHÔNG tự gọi số". Gọi số là sự kiện riêng và không thuộc 5 nhóm nào. Loa hô, dòng TV "đã gọi, đang chờ vào", thông báo điện thoại đều phải sinh từ sự kiện gọi. Thiếu nó thì ba kênh của tôi không có nguồn chung, kịch bản "loa hô lệch TV" trở lại. Đề xuất nhóm thứ 6: queue.ticket.changed gồm call.issued, call.recall, call.skipped, presence.confirmed, position.changed cho cảnh báo còn 2 số. Tần suất thấp, vài sự kiện mỗi phòng mỗi 10 phút, không phá ngân sách 50 sự kiện mỗi giây, không vi phạm "không stream vị trí". Phần còn lại của yêu cầu round1 không cần thêm backend: giữ dòng "đã gọi" một phút và hô lại 2-3 lần cách 10 giây là hành vi trình bày phía client trên cùng một sự kiện. Reconnect của TV dùng snapshot — cần biến thể snapshot công khai zero-PII, không phải snapshot world đầy đủ.

### (e) Nút "tôi có mặt" nằm ở trạng thái nào của FHIR
Không đổi trạng thái core nào, và đó là câu trả lời đúng. Thời điểm nút xuất hiện, bệnh nhân đã checked-in: subjectStatus là waiting, Appointment đã arrived. Bấm nút không kéo subjectStatus sang receiving-care vì người còn ngồi ghế. Nút ghi marker presence lên QueueTicket và đặt lại bộ đếm. Khi người bước vào phòng thì transaction 4 thay đổi của opd-fhir chạy như bình thường: Encounter in-progress, entry active, subjectStatus receiving-care, Appointment fulfilled. Trường hợp biên: bấm trước khi tiếp nhận thì từ chối và hướng về quầy. Điều đó bảo vệ vai tiếp nhận của lễ tân, tránh Appointment.arrived tự phong không qua quầy. Ông cụ của tôi không bấm được nút nào: thẻ giấy đưa y tá cũng phát đúng event presence.confirmed, cùng cấu trúc dữ liệu.

## 3. Position tổng cập nhật

Giữ: zero-PII, giờ chốt là ràng buộc trình bày công khai, tra cứu nội bộ giữ nguyên; kênh giấy và loa là điều kiện tham gia hàng đợi; ba kênh một sự kiện; không coi smartphone là điều kiện vào hàng đợi.

Đổi bốn điểm. Một, ưu tiên của đặt lịch từ "giờ ưu tiên thật" thành "thứ tự trong nhóm cùng mức, nhóm pháp lý vẫn trên". Hai, "hỏi lại có mặt" thành giao thức park 3 phút cộng marker presence cộng undo 60 giây cộng noshow cuối phiên. Ba, quay lại vào cuối hàng, không giữ chỗ. Bốn, hạ yêu cầu "ba kênh cùng một phút" xuống "loa và TV cùng sự kiện trong vài giây, điện thoại best-effort" — SMS không bảo đảm độ trễ, kênh realtime của người có web là push qua socket, SMS chỉ làm kênh dự phòng cho người thân của người già.

Yêu cầu mới ba mục: họ sự kiện hàng đợi thứ 6 queue.ticket.changed; biến thể snapshot công khai zero-PII cho TV và web reconnect; trường presence trong extension callAttempts.

Tự tin 0.85. Lý do nâng: cả năm đối chất khép lại mà không gãy lập trường gốc; xung đột pháp lý về ưu tiên được làm rõ theo hướng công bằng; lỗ hổng hàng đợi của opd-fhir nhận đúng dữ liệu tôi đòi hỏi. Phần còn lại chưa chắc: độ trễ loa TTS từ sự kiện tới loa là hạ tầng chưa đo, suy luận; hành vi người già với thẻ giấy dựa trên kinh nghiệm roleplay một gia đình, cần thử tại quầy thật trước khi chốt.
