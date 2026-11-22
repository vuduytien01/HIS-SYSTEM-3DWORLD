# Persona Bác sĩ — Báo cáo vòng 2 (cross-examination)

*Mục tiêu hội đồng: chọn phương án điều phối ngoại trú đúng cho vai lễ tân trung tâm qua 3D world mà không phá ca khám của tôi. Vai tôi giữ nguyên. Tự tin vòng 1 là 0.8.*

## 1. Phản hồi từng vai

**Lễ tân.** Chấp nhận gần hết. Cô ấy chọn A với đúng lý do của tôi, và ba nỗi sợ của cô ấy (quên, thành tay gõ của cả khoa, chịu trách nhiệm về thời gian không hề biết) là chứng nhận độc lập cho tính bất đối xứng quan sát của tôi. Cô ấy đứng quầy, nhìn được tám cửa, tôi không nói đỡ được cho phương án B trước người đó. Chấp nhận override có audit, với một điều kiện ở mục 2a. Phản đối một chỗ. Nhấp nháy sau 20 phút cứng là hằng số, và hằng số sai ở hai đuôi phân phối. Suy luận có gốc kinh nghiệm roleplay. Phòng da liễu trung vị 5 phút thì 20 phút là 4 lần phiên, quá muộn, người kế đã bị xếp sai từ lâu. Phòng tâm lý trung vị 40 phút thì 20 phút là nửa phiên, nhấp nháy oan cho ca đang khám bình thường. Nhiễu lặp lại thì cô ấy làm ngơ cờ, cơ chế chết vì thuộc nhiễu.

**Bệnh nhân.** Chấp nhận zero-PII và kênh giấy, không chạm trực tiếp vai tôi. Một điểm bổ sung từ phía phòng khám. Kịch bản gọi không có mặt của cô ấy và nút ghép của tôi gặp nhau ở một chỗ. Bệnh nhân được gọi ba kênh rồi không vào, ô phòng tôi nhấp nháy, tôi không có gì để bấm ngoài nút xong khám, mà nút đó thuộc về ca trước. Lễ tân có recall và skip. Vậy ca vắng mặt thuộc về quầy, không thuộc về phòng khám, và tôi phản đối mọi thiết kế đẩy trách nhiệm gọi lại sang phía tôi. Suy luận từ vai.

**Admin.** Chấp nhận hai nút với timestamp server không ai sửa được. Đó là bản ghi sự kiện, không phải bản án. Chi tiết ở mục 2b.

**OPD-FHIR.** Chấp nhận transition bốn thay đổi trong một transaction. Đối chất ở mục 2c và 2e.

**Kiến trúc sư.** Chấp nhận world là phép chiếu, server là thẩm quyền, reject kèm lý do trong 300ms. Trả lời câu hỏi mở của anh ở mục 2d.

**Chính tôi, vòng 1.** Giữ nguyên mọi kết luận chính. Premortem 1.3 được mô hình opd-fhir hóa giải gần hết, chi tiết mục 2e.

## 2. Đối chất trực tiếp

**2a. Lễ tân. Cơ chế tha thứ khớp hay không.**
Khớp một nửa. Nút xong khám bấm được khi chưa mời là hàng rào dữ liệu, không phải cơ chế phát hiện quên. Nó xử lý ca lễ tân dẫn người vào ngoài hệ thống, và nó hợp lệ chỉ khi server suy thời điểm bắt đầu từ location entry active thay vì từ sự kiện mời. Khớp với mô hình opd-fhir, tôi chấp nhận.
Nhấp nháy im lặng là cơ chế phát hiện, và tôi đổi ý để hợp nhất hai đề xuất. Ngưỡng mới là max(1.5 lần trung vị phiên của phòng đó, 15 phút). Tỷ lệ chống trễ cho phòng chậm, sàn chống nhiễu cho phòng nhanh. Cả hai con số vẫn là suy luận, cần đo trên dữ liệu thật trước khi cố định, đúng như tôi đã ghi vòng 1.
Override có audit của cô ấy, tôi chấp nhận thêm một điều kiện. Override là đường ngoại lệ. Nếu tỷ lệ override vượt khoảng 5% lượt trong một buổi thì đó không phải bác sĩ lười bấm, đó là kênh của tôi hỏng, nút chết hoặc app lỗi, và admin phải điều tra hạ tầng chứ không phạt bác sĩ. Suy luận.

**2b. Admin. Dữ liệu của tôi dùng đánh giá năng lực.**
Câu trả lời là có, với bốn điều kiện. Một, đối soát loại ca từ HIS trước khi so người, hệ thống điều phối không biết ca nào khó nên so người thô là vô nghĩa. Hai, đo cấp phòng trước, cá nhân chỉ khi cùng phòng cùng cấu hình ca. Ba, số dùng để cảnh báo bất thường, kiểu phòng này hôm nay gấp đôi trung vị của chính nó, không gắn thưởng phạt cá nhân trực tiếp. Bốn, p50 và p90 cùng xuất hiện, đúng như admin đã cam kết.
Lý do không phải nhút nhát. Suy luận có gốc roleplay. Biên giới giữa hai lần khám là cái đuôi phiếu 30-90 giây, biên độ sai của biên dữ liệu có thể bằng cả khoảng cách giữa hai bác sĩ trung bình. Nếu số này cột lương thì tôi bấm nút sớm và chốt phiếu ngoài giờ. Dữ liệu sạch ở đầu, dối ở đuôi, không ai phát hiện. Điều kiện bốn là cam kết thể chế, vai admin trong hội đồng không tự bảo đảm được, ghi lại để synthesis cân nhắc.

**2c. OPD-FHIR. Server ghi bắt đầu lúc nào.**
Transition bốn thay đổi trong một transaction là đúng và sạch. Nhưng hai thứ chưa khớp hoàn toàn. Quy ước của anh ghi chủ thể là bác sĩ bắt đầu khám. Phương án A mỏng của tôi không có nút bắt đầu, vậy không ai phát ra sự kiện đó. Tính bất đối xứng của tôi nói bắt đầu suy được từ bệnh nhân bước qua cửa. Máy không có cảm biến cửa, suy như vậy không ghi được.
Chốt từ vai tôi. Thời điểm server ghi bắt đầu là thời điểm thao tác đưa vào phòng được xác nhận, tức lễ tân xếp và phát gọi, hoặc nút ghép của tôi mời. Sai lệch với bước qua cửa thật là khoảng đi bộ từ ghế tới cửa, vài chục giây, và sai số biên đầu thuộc về tôi chịu theo nhượng bộ 1 vòng 1. Bất đối xứng vẫn đứng nguyên, chỉ neo lại. Phía kết thúc không có sự kiện tương đương để neo, đó là lý do nút xong khám không thể bỏ.
Một chi tiết tôi duyệt. Appointment fulfilled ngay khi Visit lần đầu in-progress là đúng, vì lần đầu in-progress là lần vào phòng khám chính, không phải đợt xét nghiệm sau đó.

**2d. Kiến trúc sư. Cần bước gọi riêng không.**
Cần phân hai sự kiện, không cần hai thao tác cho trường hợp bình thường. Quy tắc theo trạng thái phòng đích. Drop vào phòng free thì phát gọi luôn, bệnh nhân navmesh đi tới, vì đa số ca xếp phòng tức là mời ngay. Drop vào phòng occupied hoặc reserved thì chỉ xếp vào hàng đầu phòng, không gọi, vì đó là dồn trước, đúng nỗi loạt gọi ngoài ý muốn của lễ tân. Máy đọc được quy tắc này, không cần chế độ bật tắt tay. Nút ghép của tôi gọi người đầu hàng chờ đã gán phòng tôi. Nếu hàng trống, nút chỉ đóng ca và đẩy một dòng chữ lên băng lễ tân rằng phòng vừa trống. Tôi không kéo người từ phòng khác sang, thẩm quyền điều phối vẫn thuộc về cô ấy.

**2e. OPD-FHIR. Sai phòng và đi xét nghiệm.**
Premortem 1.3 của tôi khớp ba tình huống. Chuyển hẳn sang chuyên khoa khác là kịch bản (f), entry cũ completed, entry mới planned rồi active, Visit không cần chết. Bỏ về giữa chừng là discharged tách khỏi completed, đúng như anh chốt. Đi xét nghiệm rồi quay lại là kịch bản (c), on-hold với location reserved, dữ liệu chịu được.
Nhưng reserved chưa đủ hết. Lỗ nằm ở subjectStatus. Bộ năm giá trị không có chỗ cho bệnh nhân đang được làm kỹ thuật ở trạm phụ. Không phải departed, không phải receiving-care của Encounter khám, không hẳn waiting vì cô ấy không ngồi ghế đầu phòng 103. Bảng ánh xạ của kiến trúc sư lộ cùng lỗ, năm dòng không có hàng thật cho trạm phụ. Suy luận kỹ thuật từ vai. Đề xuất chốt một trong hai. Thêm giá trị thứ sáu kiểu referred-ancillary cho subjectStatus, hoặc quy ước vị trí 3D trong lúc on-hold đọc từ location entry active gần nhất, không đọc từ subjectStatus. Chọn cách nào cũng được, nhưng phải chọn trước khi dựng Bảng A, vì fallback của anh là lưới an toàn chứ không phải chỗ nghiệp vụ né trách nhiệm.

## 3. Position cập nhật

Giữ nguyên. Phương án A ở dạng mỏng nhất, một nút bắt buộc xong khám, khuyến nghị nút ghép, không nút bắt đầu, hiển thị thụ động không popup, B chỉ là fallback khi kênh của tôi hỏng.

Đổi hoặc nhận thêm. Ngưỡng phát hiện quên hợp nhất thành max(1.5 lần trung vị phòng, 15 phút). Chấp nhận dữ liệu hiệu suất của mình được đo với bốn điều kiện. Neo thời điểm bắt đầu vào thao tác đưa vào phòng thay vì bước qua cửa. Đưa quy tắc drop theo trạng thái phòng đích cho kiến trúc sư. Đòi xử lý subjectStatus cho trạm phụ trước khi dựng bảng ánh xạ.

Tự tin mới 0.85, từ 0.8. Nâng vì ba thứ. Lễ tân xác nhận độc lập bất đối xứng của tôi bằng chính ba nỗi sợ của cô ấy. Timestamp server không sửa được của admin là đúng thứ tôi cần để trả lời câu hỏi sao máy ghi khác. Mô hình opd-fhir chịu được cả ba tình huống của premortem 1.3. Chưa lên 0.9 vì hai thứ. Chủ thể phát sự kiện bắt đầu trong phương án A còn phụ thuộc thao tác lễ tân cho phần ca tôi không chủ động mời. Và điều kiện dùng số liệu đánh giá cá nhân là cam kết thể chế, hội đồng không thể bảo đảm thay bệnh viện.
