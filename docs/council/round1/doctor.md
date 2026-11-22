# Persona Bác sĩ đa khoa ngoại trú — Báo cáo vòng 1 (premortem + position)

*Agent hội đồng roleplay bác sĩ khám 25-35 bệnh nhân mỗi buổi, ghét phần mềm thêm bước. Tự tin 0.8. Ràng buộc: hệ thống điều phối KHÔNG phải HIS, xử trí y khoa và kê đơn nằm ở HIS khác.*

## 1. Premortem — 5 kịch bản hệ thống làm việc của tôi khó hơn

**1.1. Lễ tân đẩy người vào khi tôi đang khám dở.** Hệ thống nhìn 3D thấy phòng tôi chứa một người và hiểu là còn năng lực. Nhưng người đó là bệnh nhân tôi đang khám, hoặc chính là tôi lúc tôi ra hành lang lấy hồ sơ. Lễ tân bấm đưa tiếp, người kế bước vào lúc tôi đang nghe phổi hay ấn bụng. Suy luận: hệ thống sẽ hợp thức hóa chuyện này vì con số trên màn hình dường như khách quan hơn câu "chờ anh tí" của tôi. Hậu quả là mất dây chuyền suy luận lâm sàng, phải dựng lại việc đang dở, và bệnh nhân đang khám thấy mình bị chia sẻ với người khác.

**1.2. Thông báo và xác nhận giữa khám.** Nếu mỗi lần lễ tân đưa người vào phòng hệ thống ping tôi xác nhận "đã nhận bệnh nhân", tôi bị ngắt 25-35 lần mỗi buổi. Chi phí thật không phải hai giây bấm, mà là chi phí khôi phục ngữ cảnh. Đặc biệt khung 9-11h khi tay cầm bóp hạ áp và bốn người xếp hàng ngoài cửa. Bất kỳ modal bắt buộc bấm để tắt là sai thiết kế cho vai của tôi.

**1.3. Bệnh nhân sai phòng, sai hàng đợi.** Khám dở phát hiện cần da liễu, hoặc phải đi xét nghiệm rồi quay lại. Nếu tôi không có cách đưa trạng thái bệnh nhân ra khỏi phòng tôi, trạng thái trong hệ thống sẽ nói dối cả buổi. Bệnh nhân hiện "đang khám với tôi" trong lúc ngồi đợi kết quả, số đếm phòng tôi phình to, lễ tân đẩy người khác sang phòng bên, và bệnh nhân kế tiếp thật xếp sau một người đã đi khỏi lâu. Suy luận: phương án B làm tình trạng này nặng hơn vì chỉ lễ tân được sửa trạng thái. Đây là nguồn gốc nhu cầu nút thứ ba.

**1.4. Hai nút nào tôi quên.** Nút tôi quên là nút nằm ngoài màn hình tôi đang mở. Buổi sáng tôi sống trong HIS để kê đơn và ghi phiếu. Nếu nút "xong khám" nằm ở tab hoặc app khác, ước lượng từ kinh nghiệm roleplay, tôi quên cứ 4-5 lần một buổi. Hệ quả dây chuyền: 3D hiện phòng tôi bận, hàng đợi đứng yên, lễ tân phải bước sang phòng hỏi, và lời hỏi đó là một gián đoạn nữa. Biến thể nguy hiểm hơn ở nút ghép: bấm theo phản xạ ngay khi bệnh nhân đứng dậy thì bệnh nhân kế bước vào lúc tôi còn dở phiếu, biên giới giữa hai lần khám bị xóa cả trong thực tế lẫn dữ liệu.

**1.5. Bệnh nhân bỏ về giữa chừng.** Bệnh nhân có việc đột xuất bảo "chiều quay lại" rồi đi. Với bộ trạng thái chỉ có "đang khám" và "xong", không tồn tại trạng thái cho "phòng trống, dịch vụ chưa hoàn tất". Nếu hệ thống bắt tôi bấm "hủy" kèm dropdown lý do, tôi sẽ không bấm, và phòng hiện bận vĩnh viễn. Suy luận: lễ tân thấy phòng trống trên 3D rồi tự gắn nhãn "đã xong" với độ chính xác bịa đặt, hoặc không thấy trong 20 phút vì avatar còn được vẽ trong phòng. Bệnh nhân còn lùa ra khỏi phòng trong lúc tôi gõ phiếu mà tôi không để ý, cả hai phía đều có thể trễ.

## 2. Một buổi khám với hệ thống

- **7h15 mở phòng.** Tôi mở HIS trước, đó là nơi tôi ghi phiếu và kê đơn cả buổi. Hệ thống điều phối phải ở trạng thái sẵn sàng không cần tôi chạm, hoặc tối đa một tab giữ phiên đăng nhập từ hôm trước. Nếu phải đăng nhập lại mỗi buổi, sẽ có buổi tôi quên, và cả buổi sáng hệ thống nhìn thấy một bác sĩ không tồn tại.
- **Bệnh nhân đầu tiên đến theo cách vật lý đã tồn tại** (lễ tân gọi, dẫn, hoặc loa). Trước khi cô ấy bước vào, tôi muốn thấy trên một mẩu hiển thị thụ động (màn hình phụ hoặc góc màn hình không cần click) bốn dòng: STT và tên, loại hẹn mới hay tái khám, một dòng lý do nếu lễ tân ghi lúc đón, cờ "có kết quả cận lâm sàng chờ đọc". Tôi KHÔNG muốn bấm "chấp nhận bệnh nhân". Suy luận: thời điểm bắt đầu khám có thể suy từ lúc bệnh nhân bước qua cửa, sai số nhỏ và chấp nhận được, vì đó là sự kiện quan sát được từ bên ngoài.
- **Lúc đang khám:** tay tôi làm việc khác gần như suốt buổi (nghe tim phổi, sờ bụng, đo huyết áp, giữ đứa trẻ nằm yên, gõ phiếu vào HIS, cầm điện thoại). Tôi KHÔNG muốn hệ thống làm gì trong lúc khám. Không âm thanh, không popup, không hỏi xác nhận, không bắt chuyển app. Chấp nhận duy nhất: một dòng chữ thay đổi trên màn hình thụ động cho biết có ai xếp kế tiếp, để tôi tự giữ nhịp.
- **Kết thúc khám:** bệnh nhân đứng dậy đi ra, sau đó luôn có cái đuôi 30-90 giây — tôi đóng phiếu trong HIS, đọc nốt kết quả cũ, rửa tay. Kinh nghiệm roleplay: cái đuôi này xuất hiện gần như lần nào cũng vậy. Đây là thời điểm duy nhất trong cả quy trình mà tay tôi rảnh và đầu tôi còn chắc chắn bệnh nhân này vừa xong. Một nút ở đây là hợp lý.
- **Bệnh nhân kế tiếp đến theo hai cách đều được.** Lễ tân đẩy vào như hiện trạng, hoặc tôi chủ động mời khi muốn kiểm soát nhịp (cần hai phút đọc kết quả cũ của người kế). Kinh nghiệm roleplay: đa số thời điểm tôi không cần nút mời, lễ tân điều phối tốt hơn tôi vì cô ấy thấy tổng thể cả sảnh. Nút mời là công cụ giữ nhịp, dùng lác đác vài lần một buổi, không phải thao tác lặp.

## 3. Usecase tối thiểu

**Nút tôi chấp nhận bấm là một nút: "xong khám"**, đúng mô hình Nahdi. Lý do phải là nút đó: trong toàn bộ chuỗi sự kiện, đây là sự kiện duy nhất chỉ tôi biết chắc. Bắt đầu có thể suy từ bệnh nhân bước qua cửa, lễ tân thấy được. Kết thúc thì không. Bệnh nhân có thể ra về trong lúc tôi gõ dở phiếu, phòng có thể trông trống trong khi tôi vẫn chốt hồ sơ. Nút nằm ở thời điểm cái đuôi sau khi bệnh nhân rời phòng, và nằm ngay trong không gian làm việc tôi đã mở, không phải app thứ hai.

**Nút ghép complete-and-call-next phù hợp hơn cả nút đơn**, với một điều kiện về dữ liệu. Bệnh nhân kế bước vào lúc tôi còn dở phiếu là chuyện bình thường của phòng khám đông — họ ngồi xuống chào, tôi gõ nốt 30 giây rồi ngẩng lên. Nút ghép mô phỏng đúng thực tế đó. Điều kiện: giờ phục vụ không được chạy từ nút này sang nút kia, khi đó cái đuôi phiếu bị loại khỏi phép tính và thời gian khám bị lùn đi một cách hệ thống. Cách đúng: đồng hồ của bệnh nhân N bắt đầu lúc N vào phòng thật và kết thúc lúc tôi bấm nút ghép, để cái đuôi nằm trong dữ liệu của N, đồng hồ của N+1 bắt đầu lúc N+1 thực sự bước vào.

**Trước khi bệnh nhân kế bước vào, tôi muốn biết bốn thứ dạng chữ không cần click:** loại hẹn, cờ kết quả cận lâm sàng chờ đọc (nó đổi luôn hai phút đầu của lần khám), một dòng lý do do lễ tân ghi, cờ ưu tiên (người già hoặc cấp tính nhẹ). Hồ sơ đầy đủ là việc của HIS, tôi tự mở.

**Nút thứ ba tôi cần, và nó không phá nguyên tắc hai nút.** Hai tình huống: chuyển phòng khi chẩn đoán cần chuyên khoa khác; yêu cầu đưa bệnh nhân đi cận lâm sàng rồi quay lại hàng đợi. Tần suất 2-5 lần trên 30 lượt, tức ngoại lệ. Nguyên tắc hai nút nên hiểu là hai nút cho trường hợp bình thường, ngoại lệ nằm trong một bề mặt ẩn như menu mở rộng hoặc giữ lâu, không đòi form lý do, bấm xong là xong. Điều không thể chấp nhận là vì giữ nguyên "hai nút" mà chuyển phòng phải bằng cách đi bộ sang lễ tân hoặc hét qua cửa — trạng thái trong hệ thống chết cho tới khi ai đó khác sửa, và đó chính là dạng lỗi 90 phút mà hệ thống được dựng lên để tránh. Cùng menu đó phải chứa trạng thái "bỏ về giữa chừng", ai thấy trước thì ai đặt, không cần ai xác nhận lại.

**Ranh giới cuối cùng.** Mọi thứ tôi chấp nhận đều là điều khiển dòng người, không phải y khoa. Kê đơn và chỉ định vẫn ở HIS. Giao diện này là chuông cửa và công tắc đèn, không phải bệnh án. Vậy nên nó phải mỏng.

## 4. Về phương án B (bỏ giao diện bác sĩ)

**Sai sót thường gặp nếu lễ tân nhìn 3D tự đánh dấu tôi xong khám** (suy luận có gốc từ kinh nghiệm roleplay):

1. **Sai lệch cái đuôi.** Đánh dấu khi bệnh nhân bước ra cửa, bỏ qua 30-90 giây tôi chốt hồ sơ. Dữ liệu thời gian phục vụ thấp đi một cách hệ thống, mọi tính toán năng lực dựng trên nó lạc hướng, mà không ai phát hiện vì mỗi lần chỉ sai vài chục giây.
2. **Trễ avatar.** 3D còn vẽ người trong phòng thêm 30-60 giây sau khi ra, phòng hiện bận khi tôi đang trống, người kế chờ vô cớ.
3. **Nhầm người trong phòng.** Tôi thỉnh thoảng bước ra cùng bệnh nhân để chỉ đường, hoặc bệnh nhân chờ trong phòng khi tôi sang phòng bên lấy dụng cụ. 3D phân biệt được mấy người đứng trong phòng, không phân biệt được đang khám hay không, nên lễ tân buộc phải đoán. Đoán theo quan sát bên ngoài chính là thế giới trước khi có hệ thống.
4. **Quên một lần giữa cao điểm.** Lỗi của phương án B không nằm ở trung bình mà ở đuôi phân phối. Lễ tân lúc 10h30 đang xử lý thu ngân, điện thoại, trả hồ sơ, và quên đánh dấu một bệnh nhân của tôi. Phòng tôi bận trên 3D, cả buổi còn lại lệch nhịp. Sự cố 90 phút của hội đồng thuộc đúng dạng này. Cao điểm là lúc việc sổ sách đầu tiên bị bỏ.
5. **Một trên năm mươi.** Lễ tân nghỉ, người thay chưa quen thao tác, cả buổi sáng trạng thái toàn cũ. Phương án B biến một người duy nhất thành mắt xích bắt buộc của toàn bộ dữ liệu.

**Về trách nhiệm của tôi khi dữ liệu sai.** Cái nặng nhất không phải biên bản, mà là mặt đối diện. Bệnh nhân chờ 40 phút quay sang hỏi "sao để tôi chờ lâu vậy". Tôi không có bản ghi nào chứng minh tôi xong lúc 10h12, hệ thống ghi khác. Người không có kênh nhập dữ liệu nhưng bị hỏi "sao không báo" là vị trí bất lợi nhất. Phương án B trao cho tôi trách nhiệm về một số liệu mà tay tôi không được phép chạm. Cấu trúc không bền.

**B chấp nhận được khi nào.** Hai trường hợp: phòng khám một bác sĩ, nơi lễ tân và bác sĩ cách nhau một tiếng hét, 3D lúc đó gần hơn là công cụ phối hợp; và B là chế độ dự phòng khi kênh của tôi không khả dụng (máy hỏng, bác sĩ trực không có tài khoản). Để B là con đường thoái lui thì ổn. Để B là thiết kế gốc của phòng khám 4-8 bác sĩ là tái dựng sự cố sổ khám bị quên bằng pixel.

## 5. Lập trường

Giữ phương án A ở dạng mỏng nhất. Một đầu vào bắt buộc duy nhất từ bác sĩ là "xong khám", khuyến nghị dùng dạng nút ghép complete-and-call-next, với giờ bắt đầu tính từ lúc bệnh nhân thật sự bước vào phòng. Giao diện phải sống trong bề mặt tôi đã mở cả ngày hoặc là lớp phủ trên đó, không phải app thứ hai. Hiển thị thụ động, không âm thanh, không popup. Lễ tân giữ quyền điều phối và quyền sửa mọi trạng thái, tôi chỉ giữ quyền khai sự kiện kết thúc. Phương án B là chế độ thoái lui khi kênh của tôi hỏng, không phải mặc định của phòng khám đa bác sĩ.

**Nhượng bộ 1:** chấp nhận không có nút "bắt đầu khám". Hệ thống suy thời điểm bắt đầu từ lúc bệnh nhân vào phòng hoặc từ thao tác đưa vào phòng của lễ tân, sai số ở biên đầu thuộc về tôi chịu, dù nó làm số liệu của tôi đẹp lên một chút. Đây là thương lượng thật: bắt đầu là sự kiện quan sát được, còn kết thúc không.

**Nhượng bộ 2:** chấp nhận cơ chế phát hiện quên. Nếu phòng tôi ghi "đang khám" vượt quá khoảng gấp rưỡi trung vị phiên, hệ thống cờ lên màn hình lễ tân chứ không bấm chuông vào phòng tôi, và lễ tân tùy tình huống hỏi một câu hoặc tự sửa trạng thái bằng một cú click. Tôi chấp nhận bị hỏi thăm như thế, với điều kiện đó là đường ngoại lệ chứ không thành thói quen.

Tự tin 0.8. Chắc nhất: tính bất đối xứng quan sát — bắt đầu thấy được từ bên ngoài, kết thúc chỉ chủ thể trong phòng biết, ổn định qua mọi phòng khám roleplay và khớp nghiên cứu hội đồng đã dẫn. Nút ghép cũng chắc, khớp cái đuôi phiếu là thói quen thật. Kém chắc: văn hóa nhịp khám (lễ tân đẩy là chủ đạo hay bác sĩ mời là chủ đạo) chỉ có kinh nghiệm roleplay của một vai; ngưỡng gấp rưỡi trung vị cho cơ chế phát hiện quên là suy luận, cần thử nghiệm trên dữ liệu thật trước khi cố định.
