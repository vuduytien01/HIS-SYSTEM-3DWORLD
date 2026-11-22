# Persona Kiến trúc sư realtime 3D — Báo cáo vòng 2 (cross-examination)

*Agent hội đồng. Tự tin 0.78, từ 0.7. Quan điểm giữ: world là phép chiếu, không phải nguồn sự thật. Hai nguyên tắc định hình vòng này là Model the Domain (QueueTicket bind vào slot, đoàn là đối tượng dữ liệu) và Boundary Discipline (server là trọng tài, TV chỉ tiêu sự kiện ở biên).*

## 1. Phản hồi từng vai

**Lễ tân.** Chấp nhận gần như toàn bộ. Ba lớp thiết kế đổi theo cô ấy. Kéo thả 3D từ con đường biến đổi duy nhất xuống còn đường tắt tùy chọn, bảng danh sách là mặt sàn. Mật độ thông tin liếc một nhìn thành chỉ số chính, phòng phải đọc được từ ba mét trong hai giây. Hotspot thu về vai trò phụ. Phản đối một điểm nhỏ. Cô ấy nói 3D chỉ để nhìn tổng thể theo chu kỳ 5-10 phút. Kinh nghiệm roleplay của tôi là cơ chế phòng im lặng quá lâu mà chính cô ấy đề xuất đòi một kênh chủ động kêu. Kênh kêu là bảng danh sách, còn 3D là nơi nhìn thấy hình dạng nghẽn khi đã kêu. Cô ấy đóng được câu hỏi mở của tôi vòng 1, chi tiết ở mục 3.

**Bệnh nhân.** Chấp nhận zero-PII và ba kênh cùng một sự kiện. Sửa một lầm lẫn ranh giới, TV và loa không phải client của world, chúng tiêu cùng luồng sự kiện backend. World đóng góp cho TV một tín hiệu duy nhất, xem mục 2d.

**Bác sĩ.** Chấp nhận nút ghép complete-and-call-next và cái đuôi phiếu. Điều kiện dữ liệu của ông ấy khớp mô hình sự kiện của tôi, bắt đầu là encounter.location.active do server ghi, kết thúc là sự kiện do server ghi, không ai tự đo. Nút thứ ba trong menu ẩn thì chuyển phòng phát assignment.revoked và assignment.created trong một transaction, renderer diễn như một cú chuyển. Đề xuất drop của ông ấy xử lý ở mục 3.

**Admin.** Chấp nhận kênh sự kiện cấu hình và cấu hình có phiên bản. Tôi đã thiếu cái này ở vòng 1, kịch bản đổi tên phòng hiện tên cũ là lỗi thật của thiết kế tôi. Xử lý ở mục 2c.

**OPD-FHIR.** Chấp nhận QueueTicket làm thực thể hạng nhất. Hàng đợi slot thuần của tôi vòng 1 là thiếu, slot không có nhận dạng thì không vẽ được badge ưu tiên U, không vẽ được lượt gọi thứ mấy, không render được park và skip. Bind ở mục 2e. Chấp nhận quy ước discharged trước completed, quầy thu ngân thành Location trên 3D.

## 2. Đối chất trực tiếp

**(a) World thành công cụ quan sát.** Chấp nhận. Đổi ba lớp. Mật độ thông tin, badge mỗi phòng mang bốn dữ liệu cố định gồm màu trạng thái, số đang khám, số chờ đầu phòng, icon cảnh báo, chữ số lớn đủ đọc từ xa, xếp hạng tải mới nằm tooltip. Badge giữ hai loại đếm tách màu. Hotspot thu còn hai, click phòng mở danh sách chờ và kéo thả vào phòng. Kéo thả giữ lại vì phục vụ đúng ba tình huống lễ tân liệt kê, gồm nghẽn cục bộ, ưu tiên cần phòng gần, chuyển loạt. Nếu 3D đòi tương tác mới có ích thì ở cao điểm nó là màn hình chết. Giá trị của nó là nhìn thấy nghẽn hình thành trước khi bảng số kịp phản ánh. Suy luận, chưa đo.

**(b) Trạng thái hạng nhất cho đoàn, phòng hỏng, cấp cứu.** Bảng B vòng 1 chưa đủ. Chấp nhận đề xuất của lễ tân, thêm trạng thái phòng thứ sáu disabled, lấy tên của cô ấy thay cho out-of-service của tôi. Disabled là ngừng có kế hoạch, tĩnh, màu xám icon khóa, mang lý do và mốc mở lại, khóa drop. Alert giữ nghĩa cấp tính đang xử lý, đỏ nhấp nháy, không ETA. Tờ giấy note của lễ tân phải thành dữ liệu, đúng lập trường của cô ấy. Đoàn 20 người thì không spawn 20 agent cùng lúc, vi phạm cap 50. Đoàn là đối tượng dữ liệu có groupId, phát một sự kiện group.created, world render cụm marker với badge "đoàn 20" tại quầy, thành viên spawn so le mang cùng màu nhóm, ai được xếp phòng rời cụm như thường. Cấp cứu không thêm subjectStatus mới, ưu tiên là chiều trực giao, viền đỏ nhấp nháy trên agent, đi navmesh riêng không qua hàng, các hàng khác tự dồn. Suy luận thiết kế, chưa chạy thử.

**(c) Kênh sự kiện cấu hình thứ sáu.** Không phá ngân sách. Toán thô như sau. Với 300-500 lượt/ngày, cao điểm một phút khoảng 20-30 sự kiện trạng thái, ngân sách 50/giây dư ba mươi lần. Đổi tên phòng vài lần mỗi tuần, đổi cấu hình giờ hoạt động mỗi sáng, cộng lại dưới 1 sự kiện/giây trung bình. Nhóm config.changed mang configVersion, mã phòng không bao giờ đổi, danh sách trường đổi. Idempotent, client chỉ đổi label, không cần snapshot lại. Tổng 7 nhóm sự kiện thay vì 5.

**(d) Dữ liệu world cho TV.** Dòng "đã gọi, đang chờ vào" và loa phát lại 2-3 lần chạy từ sự kiện queue.ticket.called, không chạy từ 3D. World cho một tín hiệu, agent bước qua cửa phát encounter.location.active, TV gạch dòng gọi, bộ hẹn loa hủy phần phát lại chưa chạy. Không có tín hiệu này thì TV đo bằng timer mù, người đã vào phòng vẫn bị hô tiếp. Trạng thái called-pending ở mục 3 chính là dòng TV hiển thị. Payload TV chỉ có số, phòng và một câu hành động, zero-PII giữ nguyên, biên API không có trường tên để lộ.

**(e) Bind QueueTicket vào hàng đợi world.** Có, bind. Slot trong world tham chiếu ticketId. Lợi ích cụ thể là badge ưu tiên U vẽ trên đúng người, lượt gọi thứ mấy, park, skip, no-show render được, hoàn tác gán thì ghost thẻ cửa đổi đúng vé. queue.ticket.changed phát cho called, recalled, skipped, parked, no-show, tần suất thấp hơn nhiều so với patient.status.changed. Đây là đền nợ cho lỗ hổng lớn nhất opd-fhir chỉ ra. Hàng đợi không có nhận dạng thì world chỉ vẽ hình, không vẽ nghĩa.

**(f) Hai sự kiện liền nhau của nút ghép.** Xử lý bằng transactionId. Server ghi một transaction và phát gói sự kiện cùng transactionId, gồm encounter.location.completed của N rồi assignment.created hoặc queue.ticket.called của N+1, kèm seq tăng dần và cờ batch-complete. Renderer gom mọi sự kiện cùng transactionId vào một frame, tính trạng thái đích rồi animate một lần, N đi ra, N+1 đi vào, phòng chuyển occupied, reserved, occupied liền mạch, không nhấp đỏ giữa chừng. Không có transactionId thì phòng chớp ba màu trong 200ms và lễ tân nhìn thấy trạng thái ma. Tối đa một batch trong cửa sổ 500ms, quá thì snapshot hòa giải, đúng ràng buộc reconnect vòng 1.

## 3. Ba ghi chú mới được đóng hoặc làm rõ

Một, nghĩa của drop, lễ tân đóng câu hỏi mở của tôi. Chấp nhận làm mặc định, drop chỉ reserved, bệnh nhân đi tới chỉ khi gọi số. Ghost thẻ cửa đậm, agent còn ngồi ghế. Hai, đề xuất của bác sĩ, drop vào phòng free tự phát gọi, drop vào phòng occupied chỉ xếp hàng đầu phòng. Chấp nhận ở lớp sự kiện, không ở lớp mặc định. assignment.created mang cờ callNow, cờ true chỉ bật bằng thao tác rõ ràng ví dụ giữ modifier khi thả, server ghép queue.ticket.called vào cùng transactionId như mục 2f. Lý do giữ mặc định tắt là lời cảnh báo của lễ tân, kéo xếp trước hàng loạt mà tự gọi là sinh loạt gọi ngoài ý muốn. Cả hai nghiệp vụ cùng sống được vì bản đồ sự kiện diễn đạt được cả hai. Ba, called-pending vào Bảng A, agent vẫn ngồi tại slot, badge nhấp nháy, ghost thẻ cửa trên phòng nhấp nhanh hơn, kết thúc bằng encounter.location.active hoặc hết hạn gọi. Đây cũng là dòng "đã gọi, đang chờ vào" mà TV và loa phát.

## 4. Position tổng

Giữ, world là phép chiếu, server không stream vị trí, drag là đề xuất server là thẩm quyền, ba tầng fidelity, mọi trạng thái nghiệp vụ phải có địa chỉ không gian. Đổi, world thành công cụ quan sát hạng nhất với đường tắt thao tác, bảng danh sách là mặt sàn điều phối.

Sửa bảng ánh xạ. Bảng B thêm hàng disabled, tách khỏi alert. Bảng A thêm chiều ưu tiên trực giao gồm viền U và viền đỏ cấp cứu, cách diễn đạt park là mờ với badge đồng hồ, cách diễn đạt đoàn là cụm marker với spawn so le, và trạng thái called-pending. Bản đồ sự kiện từ 5 lên 7 nhóm, thêm queue.ticket.changed và config.changed.

Sửa ràng buộc. Ràng buộc 1 thành "50 sự kiện/giây cho 7 nhóm, nhóm config dưới 1/giây trung bình". Ràng buộc mới một, mọi hành động ghép phát gói transactionId, renderer gom một frame. Ràng buộc mới hai, drop mặc định chỉ reserved, auto-call chỉ qua cờ callNow rõ ràng. Các ràng buộc còn lại giữ nguyên.

Tự tin 0.78, từ 0.7. Lên vì bốn chỗ. Lập trường projection sống sót qua cả năm vai không ai chạm được. Vai lễ tân đoán đúng cách dùng thật, liếc chu kỳ, làm trên bảng, thiết kế theo đó bền hơn. Hai lỗ hổng vòng 1 đã bị đối chất và vá, gồm kênh cấu hình và hàng đợi không nhận dạng. Hai câu hỏi mở của tôi vòng 1 được đóng, nghĩa của drop và cơ chế auto-call của bác sĩ, ít trạng thái mơ hồ hơn để dựng. Chưa lên hơn vì con số hiệu năng vẫn chưa đo trên stack Node với Socket.io với Three.js, render đoàn 20 người và batch transactionId là suy luận thiết kế chưa chạy thử, mật độ giờ cao điểm và kích thước mặt bằng vẫn là hai biến chưa chốt các cap.
