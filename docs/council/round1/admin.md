# Persona Admin — Báo cáo vòng 1 (premortem + position)

*Agent hội đồng roleplay admin vận hành. Tự tin 0.7.*

## 1. Premortem

**Kịch bản 1. Đổi tên phòng nhưng bản đồ 3D hiện tên cũ.** Sửa tên trong cấu hình, Postgres ghi đúng, nhưng server không có kênh sự kiện riêng cho thay đổi cấu hình. Các client mở từ trước không nhận tên mới. Màn hình gọi số hiện tên mới, 3D hiện tên cũ, bệnh nhân đi phòng sai 40 phút cao điểm. Bài học: tên hiển thị phải đi qua kênh sự kiện cấu hình riêng, client phải có nút tải lại cấu hình thay vì tin snapshot lúc mở app.

**Kịch bản 2. Bác sĩ nghỉ đột xuất buổi sáng.** Bác sĩ Nội tổng quát nghỉ, 38 số đang chờ. Không có thao tác chuyển khối, chuyển từng số mất hơn 40 thao tác lúc đông. Ghế bác sĩ trong 3D vẫn màu xanh "đang hoạt động". Thời gian chờ khoa tăng gần gấp đôi, không ghi được nguyên nhân vào log.

**Kịch bản 3. Lãnh đạo đòi báo cáo quý theo chuyên khoa.** Hệ thống chỉ lưu thời điểm giai đoạn hiện tại, ghi đè mỗi lần chuyển bước, không có bảng sự kiện lịch sử. Giữa quý gộp giai đoạn làm chuỗi số đứt gãy. Không trả lời được "con số này đáng tin đến đâu".

**Kịch bản 4. Outage giữa giờ cao điểm không ai biết.** Container khởi động lại vì thiếu bộ nhớ, không có healthcheck và alert. Dấu hiệu duy nhất là lễ tân báo "bấm gọi số không chạy". Socket.io mất kết nối, client không tự phục hồi, quy trình giấy quay lại 12 phút, số liệu hôm đó lệch.

**Kịch bản 5. Lễ tân bị khóa tài khoản lúc đông khách.** Sai mật khẩu lần thứ năm sau đổi mật khẩu cuối tuần. Chính sách khóa không tự mở, chỉ admin mở được, admin mất 15 phút quay về máy trạm. Quầy đứng im với 25 số trong hàng.

## 2. Một ngày vận hành

- **6:45.** Cấu hình trước giờ bệnh nhân: ánh xạ phòng bác sĩ khớp lịch trực, bật trạng thái hoạt động ca sáng, rà thời gian trung bình mỗi giai đoạn, xác nhận ngưỡng SLA (vàng 15 phút, đỏ 25 phút, số tham chiếu roleplay).
- **7:00.** Một dashboard duy nhất nhìn xuyên ngày: hàng chờ sống theo quầy, chờ p50 p90 theo phòng, SLA vi phạm trong ngày, sức khỏe hệ thống (uptime, độ trễ socket, kết nối treo), tần suất gọi theo giờ.
- **9:15.** p90 Răng Hàm Mặt vượt 40 phút. Mở phòng cùng chức năng + chuyển khối 9 số — hai cú bấm.
- **10:40-11:00.** Xử lý outage: pause quầy lỗi, chuyển khối sang quầy lân cận, ghi sự cố vào log kèm mốc thời gian chết.
- **12:30.** Cảnh báo SLA đẩy kênh chat nội bộ thay vì nhìn màn hình liên tục.
- **15:00.** Gắn mức ưu tiên từ xa cho bệnh nhân 87 tuổi, hệ thống tự ghi log ai đổi và khi nào.
- **17:00-17:30.** Chốt số cuối ngày: tổng lượt theo khoa, chờ trung bình và p90 từng khoa, thời gian phục vụ trung bình từng phòng, no-show (định nghĩa: gọi quá 3 phút không có mặt), SLA vi phạm, sự cố và thời gian chết, thao tác can thiệp kèm lý do. Xuất CSV lưu kho quý.

## 3. Usecase tối thiểu

### (a) Cấu hình hàng ngày — để một phòng mới chạy được trong 3D world

- Nhận dạng: mã phòng (duy nhất, không bao giờ đổi, dùng trong DB và mọi event), tên hiển thị (đổi bất kỳ lúc nào, lan tới 3D qua event cấu hình), tòa lầu khu.
- Vị trí 3D: tọa độ x y hoặc zone id, hướng nhìn, màu trạng thái. Không nhập tọa độ thì tự xếp vào zone theo chức năng, phòng không được vô hình.
- Chức năng: chuyên khoa, nhóm chức năng tương đương (cho chuyển khối giảm tải), các giai đoạn luồng phòng này phục vụ, ánh xạ quầy lễ tân đầu vào.
- Vận hành: thời gian trung bình mỗi giai đoạn, sức chứa song song, lịch hoạt động theo ca, trạng thái hoạt động tạm dừng ẩn.
- Nhân sự: bác sĩ trực theo ca, nhóm dự phòng, quyền tiếp nhận.
- Hàng đợi: tiền tố STT, ngưỡng SLA vàng đỏ, hàng chờ chuyên khoa chung hay độc lập.
- Điểm chết người: gộp mã phòng và tên hiển thị thành một trường — mỗi lần đổi tên phá ánh xạ dữ liệu lịch sử.

### (b) Vận hành sự cố — mỗi hành động một cú bấm kèm xác nhận hiển thị số lượng ảnh hưởng

Mở phòng mới (kích hoạt + gắn hàng chờ + phát lên 3D trong một thao tác), chuyển khối bệnh nhân (chọn nguồn quầy + trạng thái đang chờ + từ thời điểm T, chọn đích cùng nhóm chức năng, preview "sẽ chuyển 9 số" rồi xác nhận), pause dịch vụ (SLA dừng tính, resume tự xếp lại hàng), đổi priority từ xa (ghi log người đổi), mở khóa tài khoản một nút, đẩy số kẹt về bước trước (rollback có log).

### (c) Báo cáo

- Hàng ngày (admin + trưởng ca): tổng lượt theo khoa, chờ trung bình và p90 theo phòng, SLA vi phạm, no-show.
- Hàng tuần (lãnh đạo): chờ trung bình theo chuyên khoa, thời gian phục vụ theo phòng và theo bác sĩ, tỷ lệ no-show theo khoa, bản đồ nhiệt giờ cao điểm, sự cố kèm thời gian chết.
- Hàng tháng quý: xu hướng tuần, xếp hạng phòng chậm nhất, so sánh chuyên khoa, xuất CSV và PDF.
- Mọi báo cáo phải có p50 và p90, trung bình che đuôi phân phối. Điều kiện sống còn: bảng sự kiện giai đoạn chỉ ghi thêm giữ tối thiểu 12 tháng, cấu hình đổi có phiên bản.

### (d) Tài khoản và quyền — ma trận

| Quyền | Bệnh nhân | Lễ tân | Bác sĩ | Admin |
|---|---|---|---|---|
| Xem số của mình và vị trí hàng chờ | Có | Có | Không cần | Có |
| Tạo bệnh nhân, check-in, gọi số, chuyển quầy, no-show | Không | Có | Không | Có |
| Bắt đầu và kết thúc khám trên hàng chờ của mình | Không | Không | Có | Có |
| Sửa cấu hình phòng, luồng, thời gian trung bình | Không | Không | Không | Chỉ admin |
| Mở khóa tài khoản, cấp vai | Không | Không | Không | Chỉ admin |
| Đổi priority, pause service, chuyển khối | Không | Trong phạm vi quầy mình, có log | Không | Toàn hệ thống |
| Đọc log hệ thống | Không | Không | Không | Có |
| Xóa log hoặc sự kiện lịch sử | Không | Không | Không | Không ai được xóa |

Tuyệt đối không giao: lễ tân không sửa luồng khám hay thời gian trung bình (số so sánh tuần mất gốc), không tự mở khóa cấp quyền. Bác sĩ không đổi priority người khác hay pause quầy. Bệnh nhân không thấy dữ liệu người khác. Admin cũng không xóa vĩnh viễn sự kiện lịch sử, chỉ lưu trữ.

## 4. Về dữ liệu đo

Với 2 nút của bác sĩ, đo được thật: thời điểm cấp số, gọi, bắt đầu, kết thúc → thời gian chờ thật (cấp số → bắt đầu), thời gian phục vụ (bắt đầu → kết thúc), thông lượng từng phòng, bản đồ nhiệt giờ cao điểm. No-show chỉ đo được nếu có nút đánh dấu riêng hoặc timeout ghi loại rõ ràng.

Thiếu: thời gian từng giai đoạn trung gian (xét nghiệm, chụp phim), lý do ca kéo dài, phân biệt gọi không có mặt với no-show thật, chỉ số chất lượng lâm sàng.

Nếu bỏ giao diện bác sĩ: thời gian phục vụ ước từ khoảng cách hai lần gọi kế tiếp, nhiễu bởi độ trễ lễ tân; hiệu suất bác sĩ biến mất chỉ còn hiệu suất phòng; no-show thành số hết hạn không tin cậy; chờ theo giai đoạn thu còn một đoạn từ check-in đến phòng đầu tiên; chỉ bản đồ nhiệt giờ cao điểm giữ độ tin cậy (đo từ cấp số).

"Giữ 2 nút của bác sĩ như hợp đồng tối thiểu bắt buộc, timestamp do server ghi và không ai sửa được; nút bỏ qua ca là mong muốn chứ không phải điều kiện."

## 5. Lập trường

Nguồn sự thật của admin nằm ở bảng sự kiện và bảng cấu hình có phiên bản, không phải 3D world. 3D là lớp trình bày. Mọi hành động vận hành phải làm được từ bảng điều khiển phẳng hoạt động cả khi 3D chết. Mọi đổi cấu hình phải phát idempotent tới mọi client qua kênh sự kiện cấu hình riêng.

Nhượng bộ 1: chấp nhận giai đoạn đầu chỉ 2 nút của bác sĩ, không đòi sự kiện từng giai đoạn trung gian. Đổi lại: 2 sự kiện đó do server ghi timestamp, chỉ ghi thêm, không ai sửa được. Nhượng bộ độ mịn dữ liệu, không nhượng bộ tính toàn vẹn.

Nhượng bộ 2: chấp nhận lễ tân tự chuyển quầy và đổi priority trong giới hạn (tối đa 5 lần mỗi giờ mỗi quầy, vượt ngưỡng tự báo admin). Người đứng ở sảnh thấy vấn đề trước admin nhiều phút.

Tự tin 0.7. Tin nhất: sự kiện chỉ ghi thêm và ma trận quyền. Thiếu tự tin nhất: giới hạn 5 lần/giờ và chính sách khóa tài khoản, phụ thuộc văn hóa vận hành chưa có số đo thật.
