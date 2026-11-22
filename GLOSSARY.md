# Điều phối khám bệnh

Hệ thống điều phối quy trình khám bệnh cho một bệnh viện ngoại trú (OPD). Ngôn ngữ dưới đây đã được chốt trong phiên grilling ngày 2026-11-22. Thuật ngữ trạng thái mượn từ vựng HL7 FHIR giữ nguyên tiếng Anh gốc để tương thích khi tích hợp thật.

## Language

**Bệnh nhân**:
Người đến hoặc đặt hẹn khám, được theo dõi qua các giai đoạn của một Lượt khám.
_Avoid_: Khách hàng, user

**Lễ tân**:
Vai trò điều phối trung tâm của hệ thống. Nhìn 3D World để biết tải từng phòng và tự tay xếp Bệnh nhân vào phòng.
_Avoid_: Reception (dùng cho địa điểm), điều phối viên

**Lượt khám**:
Tương tác khám chữa bệnh thực tế của một Bệnh nhân tại bệnh viện, đi qua các trạng thái và được ghi nhận diễn ra ở đâu. Đối ứng FHIR Encounter.
_Avoid_: Phiếu khám, hồ sơ khám

**Kế hoạch hẹn**:
Việc đặt thời gian khám trước khi Bệnh nhân đến. Chỉ ghi kế hoạch, không ghi điều thực tế. Đối ứng FHIR Appointment.
_Avoid_: Lịch khám khi nói về điều thực tế, booking

**Phòng**:
Địa điểm trong bệnh viện cung cấp dịch vụ khám hoặc cận lâm sàng, có Loại phòng riêng để 3D World dựng hình.
_Avoid_: Khu vực dùng chung, Location trong văn nói

**Loại phòng**:
Nhóm chức năng của Phòng quyết định hình dạng 3D và vật dụng, ví dụ quầy lễ tân, phòng khám chuyên khoa, X-quang, xét nghiệm, quầy thuốc.
_Avoid_: Chuyên khoa (là lĩnh vực y tế, không phải địa điểm)

**Tải phòng**:
Số Bệnh nhân đang trong một Phòng tại một thời điểm, gồm đang chờ và đang khám. Dữ liệu hiển thị trực tiếp trên 3D World.
_Avoid_: Độ đông, số lượng

**Trạng thái phòng**:
Bộ sáu trạng thái vận hành của một Phòng: trống, đã xếp (có bệnh nhân được chỉ định chưa vào), đang khám, dọn dẹp, ngừng hoạt động (phòng tĩnh mang lý do, không nhận thêm), cảnh báo (cần xử lý gấp, khóa xếp mới).
_Avoid_: Tình trạng chung chung, trạng thái đa nghĩa

**Điều phối manual**:
Hành vi cốt lõi của Lễ tân: tự quyết định Bệnh nhân nào vào Phòng nào và xử lý bằng tay. Hệ thống chỉ cung cấp thông tin Tải phòng, không tự gán.
_Avoid_: Auto-assign, tự động xếp phòng

**Hàng đợi và gọi số**

**Thẻ hàng đợi**:
Bản ghi chính của việc xếp hàng chờ trong ngày, chứa Số thứ tự, trạng thái chờ của bệnh nhân, nhóm ưu tiên và số lần đã gọi. Là nơi mọi thao tác gọi lại, bỏ lượt, tạm giữ, có mặt được ghi nhận.
_Avoid_: Token, phiếu lẻ

**Số thứ tự**:
Số in trên Thẻ hàng đợi cho một Lượt khám trong ngày, đếm lại mỗi sáng như bệnh viện thật.
_Avoid_: Token

**Tín hiệu phòng**:
Khoảng trạng thái giữa lúc gọi số và lúc Bệnh nhân bước vào Phòng: số đã được gọi, đang chờ vào. Hiển thị cùng lúc trên TV, loa và màn hình điều phối từ cùng một sự kiện.
_Avoid_: Đang gọi chung chung, trạng thái mơ hồ

**Làn cấp cứu**:
Dòng xử lý riêng cho Bệnh nhân nguy kịch tại khu chờ: một thao tác duy nhất kéo người khỏi mọi hàng chờ hiện có và đưa vào làn này.
_Avoid_: Ưu tiên thường, chen hàng

**Đoàn bệnh nhân**:
Nhóm nhiều Bệnh nhân đến cùng lúc với một chủ thể chung, ví dụ đoàn khám sức khỏe theo hợp đồng, được tiếp nhận như một khối và hiển thị trên 3D World thành cụm.
_Avoid_: Nhóm khách, danh sách tay

**Khu thu ngân**:
Địa điểm Bệnh nhân dừng thanh toán trước khi Lượt khám được đóng hoàn tất. Là một Phòng trên 3D World để Lễ tân thấy ai còn kẹt ở quầy tiền.
_Avoid_: Quầy tiền văn nói, billing khi nói địa điểm

**Bảng điều phối**:
Bảng danh sách bệnh nhân với phím tắt trên màn hình Lễ tân, là mặt sàn làm việc ở cao điểm, cùng 3D World tạo thành hai đường thao tác chính thức ghi cùng một dữ liệu.
_Avoid_: Dashboard chung chung, màn hình phụ

**3D World**:
Mô hình ba chiều của bệnh viện chạy trong trình duyệt bằng vanilla Three.js, hiển thị realtime vị trí Bệnh nhân theo trạng thái Lượt khám. Là công cụ quan sát hạng nhất và một trong hai đường thao tác chính thức của Lễ tân.
_Avoid_: Bản đồ 2D, dashboard khi nói về cảnh 3D
