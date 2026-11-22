# Persona Bệnh nhân — Báo cáo vòng 1 (premortem + position)

*Agent hội đồng roleplay bệnh nhân ngoại trú + con của người già 75 tuổi không dùng smartphone. Tự tin 0.7.*

## 1. Premortem

**Kịch bản 1. Đặt lịch online xong vẫn xếp hàng như thường.** Đặt lịch 9h qua web, tới quầy lễ tân nói "đặt lịch chỉ để báo trước, muốn khám thì xếp như walk-in". Mất thêm 40 phút đứng, từ lần thứ hai bỏ luôn trang web. Đặt lịch mà không đổi được thứ tự lấy số là tính năng lừa dối. Giờ đặt lịch phải thành giờ ưu tiên thật trên hàng đợi.

**Kịch bản 2. Số nhảy lộn xộn, không ai giải thích.** TV nhảy từ 45 lên 52 rồi về 47. Bệnh nhân ưu tiên chen giữa dòng thường, loa hô lệch với TV, không dòng nào đánh dấu nguyên nhân. Không ước lượng được còn chờ bao lâu, không dám rời ghế mua nước. Nếu TV không gắn ký hiệu riêng cho bệnh nhân ưu tiên, bệnh nhân thường gọi đây là lỗi hệ thống chứ không phải sự công bằng.

**Kịch bản 3. Loa rè, chữ nhỏ, không kênh nào cho người nghe kém.** Loa hô "Mời bệnh nhân... phòng 205", chỉ nghe được hai từ, không nghe con số. Ông cụ 75 tuổi nghe kém dải tần cao, phải đứng cạnh TV suốt buổi, mất chỗ ngồi. Không một kênh nào trong phòng chờ dành cho người nghe kém và nhìn kém.

**Kịch bản 4. Tới lượt lúc đang ở toilet, mất lượt không biết.** Số 46 được gọi, loa hô một lần, TV chuyển 47, không có cửa sổ nào quay lại. Trên web không có nút "tôi có mặt" để cứu lượt. Nếu TV không giữ dòng trạng thái "đã gọi, đang chờ vào", không ai biết số mình còn được chờ hay đã chết. Người già bị gọi lúc không nghe loa thì mất lượt mà không hề hay biết.

**Kịch bản 5. Ông cụ không có smartphone, kênh dự phòng duy nhất cũng chết.** Con mở link trạng thái dõi hộ, trang hiện số cũ của hôm trước hoặc trắng vì server vừa restart (nếu Socket.io không tự reconnect và không có fallback truy vấn định kỳ, màn hình đứng hình với số cuối, tưởng là số hiện tại). Ông chờ tới giờ nghỉ trưa rồi về trong cảm giác bị bỏ rơi. Cảm giác đó là thứ khiến người già bỏ khám, không phải bệnh nặng.

## 2. Hành trình

- **Tối trước:** đặt lịch 10h tối, SMS xác nhận. SMS quan trọng hơn thông báo app vì không cài app bệnh viện. Ông cụ: không làm gì trên điện thoại, lưu thông tin bằng tờ giấy viết tay, coi đó là bằng chứng đáng tin duy nhất.
- **Sáng:** tới sớm 15 phút, vẫn phải tới quầy để lễ tân xác nhận (hệ thống chỉ xếp phòng khi lễ tân xác nhận). Chấp nhận bước này nếu thật sự rút ngắn thời gian so với xếp hàng lấy số. Mọi quy trình đòi quét QR hoặc dùng app để lấy số đều loại ông cụ khỏi hàng đợi chính thức.
- **Trong lúc chờ:** cần biết 3 thứ — đang gọi tới số nào, còn bao nhiêu số trước mình, tới lượt thì phòng nào. Kênh: TV cho số đang gọi, điện thoại cho thông báo riêng, loa cho cả phòng. Câu hỏi thật của tôi trong lúc chờ: rời chỗ vài phút có sao không, và giá của việc đó là gì.
- **Sau khám:** nhận toa, thanh toán, muốn SMS nhắc tái khám. Ông cụ cần tờ giấy in ghi rõ ngày giờ tái khám và phòng, chữ in to hơn chữ viết tay. Khác biệt then chốt: tôi lưu trong điện thoại, ông lưu trong tờ giấy. Hệ thống phải in được mọi thứ quan trọng ra giấy.

## 3. Usecase tối thiểu

### A. Bệnh nhân đặt hẹn trước
Cần thấy: lịch hẹn xác nhận chưa, số thứ tự của mình, số đang gọi và số còn trước mình, phòng khi được gọi.
Không được hiện: danh sách bệnh nhân khác kèm tên, chẩn đoán, dữ liệu bệnh nhân khác trong cùng phòng.

### B. Bệnh nhân walk-in
Cần thấy: cách lấy số ngay khi mở trang không cần tạo tài khoản, số của mình và số đang gọi, đường về quầy in số giấy nếu không có smartphone. Kênh giấy phải luôn tồn tại.
Không được hiện: yêu cầu tạo tài khoản hay OTP trước khi cấp số, bảng tổng số chờ kèm thông tin cá nhân.

### C. Người thân thay người già
Cần thấy: trạng thái của người bệnh mình phụ trách (đã lấy số, đang chờ, đã được gọi, phòng nào) sau khi lễ tân ghi quyền người thân; thông tin đủ để báo một câu "gọi phòng 5 rồi, quay lại đi".
Không được hiện: chẩn đoán, mã hồ sơ, viện phí, địa chỉ nhà khi chưa được cấp quyền; bất kỳ dữ liệu bệnh của người khác qua link công khai lẫn màn hình chung.

### Nguyên tắc zero-PII cho màn hình công cộng
TV và mọi URL công khai chỉ hiển thị 3 thứ: số thứ tự, phòng, một câu hành động "Mời số 46 vào phòng 5". Không tên đầy đủ, CCCD, tuổi, bệnh, viện phí, không giải thích lý do ưu tiên cá nhân. Ưu tiên chỉ hiển thị bằng ký hiệu (chữ U), không gắn người cụ thể. Cách làm ở API: endpoint công khai trả cấu trúc chỉ có số và phòng, không có trường tên để lộ. Frontend không thể hiện thứ không tồn tại.

## 4. Thông báo gọi

- **Trước khi tới lượt:** cảnh báo khi còn khoảng 2 số trước mình (mỗi ca 5-10 phút, 2 ca là 10-20 phút, đủ để đi vệ sinh, mua nước). Còn 1 lượt là hơi gấp, còn 5 lượt là vô nghĩa.
- **Khi tới lượt:** phát đồng thời cả ba kênh loa, TV, điện thoại. Loa bắt buộc vì không phải ai cũng có điện thoại.
- **Điều khiến tin:** ba kênh nói cùng một số, một phòng, cùng một phút; TV giữ dòng "đã gọi, đang chờ vào" ít nhất một phút; loa phát lại 2-3 lần cách nhau ~10 giây. Gọi một lần rồi thôi là gốc của nửa số cãi nhau ở quầy.
- **Điều khiến không tin:** điện thoại báo muộn hơn loa; TV hiện số cũ sau khi loa hô; số bị bỏ qua mà màn hình không ghi dòng "đã bỏ qua". Hệ thống im lặng về việc bỏ sót là dạy người dùng đừng rời mắt khỏi TV.
- **Người già không có điện thoại:** quầy cấp thẻ giấy nhỏ hoặc nút nhấn tại chỗ chờ. Khi loa hô, bấm nút hoặc đưa thẻ cho y tá ghi có mặt. Song song lễ tân đăng ký số điện thoại người thân nhận hộ thông báo. SMS không cần app đủ dùng cho người thân, loa vẫn là kênh chính của người già.

## 5. Lập trường

Một nguồn sự thật duy nhất cho mọi kênh. Số được gọi trên loa, TV, web phải sinh từ cùng một sự kiện backend. Hệ thống không được coi smartphone là điều kiện tham gia hàng đợi. Mọi thông tin cần cho việc chờ phải tồn tại ở kênh không cần smartphone: TV, loa, tờ giấy. Nhóm bỏ chạy nhiều nhất là người già.

Nhượng bộ 1: chấp nhận thêm một bước hành chính tại quầy, đăng ký người thân nhận thông báo hộ kèm xác thực quan hệ, đổi lấy thông báo chuẩn cho người già. Nhượng bộ 2: chấp nhận hệ thống hỏi lại "bạn có mặt không" sau lần gọi đầu (nút web, thẻ giấy, báo lễ tân) trước khi chuyển số sau, đổi lấy hàng đợi chính xác và ít lượt bị bỏ.

Tự tin 0.7. Premortem ghép từ kinh nghiệm roleplay tuyến tỉnh, tin cao. Nhịp khám và thời gian chờ là suy luận, cần đo lại. Zero-PII là suy luận kỹ thuật, cần đối chiếu pháp chế và vận hành quầy.
