# Persona Lễ tân — Báo cáo vòng 1 (premortem + position)

*Agent hội đồng roleplay lễ tân kỳ cựu 10 năm khoa khám bệnh tuyến tỉnh, 300-500 lượt/ngày. Tự tin 0.7.*

## 1. Premortem

**Kịch bản 1. Đoàn 20 bệnh nhân công ty bảo hiểm đến cùng lúc.** Thứ Hai 7h20, đoàn 20 người cùng giờ hẹn, phía sau 30 người xếp hàng tự nhiên. Nếu tiếp nhận là biểu mẫu một bệnh nhân, lặp 20 lần, 40 giây một lượt là 13 phút quầy bị khóa. Không có thao tác theo đoàn → ghi 20 tên ra giấy, phân phòng bằng miệng, hẹn chiều nhập bù. Hậu quả: 3 giờ sau 3D cho thấy ít người hơn thực tế gần nửa quầy, STT không khớp dữ liệu, một người khiếu nại "bọn tôi đến trước" mà không có dữ liệu chứng minh. Tờ giấy thành nguồn sự thật chính, và tờ giấy không có audit log.

**Kịch bản 2. Bệnh nhân cấp cứu ngất tại khu chờ.** 9h40 cụ già ngã ghế, mặt tím, đưa đi trong 90 giây, không ai kịp chạm màn hình. Trạng thái trong máy vẫn in-progress, chiếm chỗ phòng cũ. Không có nút "kéo người này ra khỏi mọi hàng chờ, đưa vào làn cấp cứu" một cú bấm. Cuối ngày có một lượt treo in-progress, ai đó đoán cách đóng, đoán sai là dữ liệu bẩn vĩnh viễn. Ca cấp cứu thứ hai không kịp ghi nhớ thì bị bỏ quên tới tổng kết tháng.

**Kịch bản 3. Phòng X-quang hỏng máy giữa buổi.** 10h05 máy dò hỏng, chiều mới chạy lại, đã có 7 bệnh nhân được đưa sang đó. Ô phòng chỉ có một chỉ số là số người, không có trạng thái "phòng ngừng hoạt động", không gắn nhãn đỏ được. Dán giấy note, giữ trong đầu danh sách 7 người. Chuyển 7 người một lượt một chọn đích từng người trong khi phải trả lời "sao giờ này X-quang đóng" là vài phút ma sát và một cơ hội bỏ sót. Ít nhất một người bị bỏ quên ngồi mãi không được gọi, khiếu nại lên giám đốc. Kiểu thất bại này xảy ra ít nhất một lần mỗi tuần.

**Kịch bản 4. Bệnh nhân đi vệ sinh đúng lúc tới lượt.** Gọi số 45 không ai đứng dậy, Recall lần hai vẫn không có người. Không có "tạm giữ chỗ 3 phút". Park nằm sâu trong menu thì trong nhịp gọi liên tục không dùng nổi. Hét về hành lang và tự nhớ "45 còn đang về". Đánh no-show cho đỡ nghẽn thì tỉ lệ no-show bóp méo, bệnh nhân quay về mất chỗ và cãi vã. Skip thì người đó trôi khỏi danh sách, chỉ sống trong đầu tôi. Mỗi tuần vài lần người quay lại đúng lúc tôi đã quên, chờ lại từ đầu dù mới đi 4 phút.

**Kịch bản 5. Gia đình hỏi giúp bệnh nhân đang khám.** Cứ 15 phút một người nhà: "chồng tôi vào phòng 2 rồi, còn bao lâu nữa, khám xong đi đâu nộp tiền". Màn hình lễ tân thiết kế cho hành động, không cho tra cứu 5 giây. Biết chồng cô ấy đang đâu phải mở modal tìm theo tên giữa 300 lượt in-progress, mỗi câu hỏi ăn mất 20 giây tay khỏi hàng chờ. Trả lời bằng trí nhớ, phần lớn đúng, đôi lần sai. Quầy nghẽn, người nhà tự đi gõ cửa từng phòng. Sai một lần trong mười là đủ để một người nhà gõ nhầm cửa phòng đang có bệnh nhân khác.

Hình dạng chung: mỗi khi khoa có một trạng thái thật mà hệ thống không mô hình hóa (đoàn, cấp cứu, phòng hỏng, tạm vắng, người nhà), tôi phải dựng một hệ thống song song bằng giấy và trí nhớ. Hệ thống song song không đồng bộ, không audit, và ăn bộ nhớ làm việc của tôi.

## 2. Một ngày làm việc

- **6h55.** Đăng nhập. Màn hình chính là bảng danh sách chờ bên trái, băng tóm tắt phòng phía trên, 3D chiếm nửa dưới hoặc màn hình thứ hai. STT tự reset từ 0h. Liếc 3D một lần để xác nhận các phòng hôm nay "sáng", có bác sĩ trực và trạng thái mở. Nếu bản đồ không phân biệt phòng trống vì chưa có bác sĩ với phòng trống sẵn sàng nhận, đó là lỗi thiết kế đầu tiên của ngày.
- **7h02.** Bệnh nhân đầu tiên: cụ bà 78 tuổi có vé hẹn trước, trạng thái booked. Gõ 4 số cuối điện thoại, hồ sơ hiện ra, bấm tiếp nhận. Một màn hình, không modal lồng. Với bệnh nhân đã có thông tin phải là một cú bấm sau một ô tìm kiếm. Bắt nhập lại ngày sinh CCCD là mất thêm nhiều phút cho vài trăm lượt gõ.
- **Xếp phòng lúc 7h02:** tất cả phòng đều 0, bản đồ không giúp chọn ai. Sự thật cần là phòng nào có bác sĩ hôm nay và phòng nào gần lối vào (cụ đi khó). Nếu bản đồ chỉ vẽ số người mà không vẽ trạng thái mở và vị trí tương đối, nó chỉ là hình minh họa.
- **7h30-9h00 cao điểm 100-150 người.** Làm việc chủ yếu trên bảng danh sách, không nhìn 3D cho từng bệnh nhân. Gõ vài chữ đầu tên, Enter nhận gợi ý phòng ít người nhất, Enter xác nhận. Nhìn 3D theo chu kỳ 5-10 phút để biết sức ép nằm ở dãy phòng nào. Nếu bắt kéo thả từng người trên 3D ở cao điểm: 400 lượt × 4 giây là thêm nửa giờ tay không sản xuất, và mắt rời khỏi khu chờ trong từng giây đó. Mắt rời khỏi khu chờ nghĩa là một cụ ngã mà không ai thấy.
- **Ba lúc 3D thật sự cứu tôi.** Một, hàng nghẽn cục bộ: phòng 2 có 9 người chờ, phòng 6 và 7 rỗng, liếc bản đồ chọn hướng chuyển. Hai, bệnh nhân ưu tiên (thai phụ, khuyết tật) cần phòng gần lối vào hoặc tầng trệt, sự thật không gian chỉ bản đồ có. Ba, số liệu lạ: phòng 3 hiển thị 5 người chờ mà bác sĩ nói không ai vào, dùng bản đồ phát hiện lệch trạng thái trước khi bệnh nhân phát hiện.
- **10h30 nghẽn lệch.** Chuyển 5 người từ phòng 4 (chậm) sang phòng 1 (nhanh) bằng chuyển không cấp vé mới, đúng thiết kế là 2 cú click mỗi người từ dòng trong bảng. Phải mở modal tìm bệnh nhân lại chọn lý do từ danh sách 6 mục là tôi chuyển được 2 người rồi bỏ cuộc và nói miệng với điều dưỡng.
- **11h40 dọn hàng.** Quét các lượt gọi hai lần không thấy người, bấm no-show từng dòng. Nút no-show phải nằm ngay trên dòng và phải có undo trong một phút, vì 11h45 là giờ tôi mệt nhất và nhầm nhiều nhất.
- **11h55 bàn giao ca 2 trong 2 phút** bằng chính màn hình, chỉ vào các ô đang đỏ. Sự kiện sống ngoài hệ thống (tờ giấy "X-quang hỏng") là thứ rơi mất lúc bàn giao. Lý do kịch bản 3 phải giải bằng trạng thái dữ liệu, không bằng lời nói.

Bốn chỗ thiết kế sai quyết định yêu hay ghét hệ thống sau tuần đầu: check-in bắt nhập lại dữ liệu đã có, xếp phòng bắt buộc đi qua 3D, chuyển phòng nhiều bước, no-show không undo.

## 3. Usecase tối thiểu — tần suất theo ngày 300-500 lượt

| Thao tác | Tần suất/ngày | Yêu cầu |
|---|---|---|
| Tiếp nhận + cấp số (walk-in + booked) | 300-450 | Một màn hình, một ô tìm kiếm + một nút xác nhận |
| Xếp phòng (gợi ý tự động, override tay) | Bằng số tiếp nhận | Enter gợi ý, Enter xác nhận, KHÔNG bắt kéo thả trên 3D |
| Cờ ưu tiên theo QĐ 1313/QĐ-BYT | 30-60 | Một cú bấm trên dòng, không biểu mẫu lý do |
| Recall (tự khóa sau 2 lần) | 40-80 | Một cú bấm |
| Skip | 20-40 | Một cú bấm |
| Park tạm giữ | 10-20 | Một cú bấm, tự nhắc sau 3 phút |
| Chuyển phòng không cấp vé mới | 20-40 | Tối đa 2 cú click từ dòng bệnh nhân |
| No-show (tập trung cuối buổi sáng) | 15-30 | Một cú bấm, undo trong 60 giây |
| Note nhanh | 20-50 | Gõ thoải mái, không bắt buộc |
| Kéo vào làn cấp cứu | 2-5, rủi ro cao nhất | Một cú bấm duy nhất, kéo người ra khỏi mọi hàng chờ và tự đóng chỗ cũ |

Sáu nút bắt buộc một cú bấm nằm ngay trên dòng bệnh nhân, hiển thị cùng lúc, không nằm trong menu: recall, skip, park, no-show, ưu tiên, cấp cứu. Tiếp nhận không thể một cú bấm vì phải nhập dữ liệu, nhưng phải là một màn hình.

**Kéo thả 3D — ba tầng phải xảy ra ngay.** Tầng 1 phản hồi tức thì: người biến khỏi hàng chờ và hiện vào hàng phòng, ô phòng nhảy số trong cùng khung hình. Tầng 2 dữ liệu: server ghi xếp phòng, đẩy qua Socket.io tới màn hình phòng khám. Tầng 3 mặc định: kéo chỉ xếp phòng, KHÔNG tự gọi số. Gọi số là hành động riêng của phòng. Kéo xong tự phát gọi là sinh loạt gọi ngoài ý muốn khi chỉ muốn dồn trước.

**Conflict khi phòng vừa bị lấy mất chỗ.** Server là trọng tài, không phải client. UI lạc quan phải được thu hồi có hình: người vừa kéo quay về hàng chờ tại chỗ với viền đỏ. Băng nhỏ không chặn "phòng 3 vừa đầy, bệnh nhân A đã về hàng chờ" kèm nút một click đưa vào phòng gợi ý kế tiếp. Không dùng hộp thoại chặn, vì tôi đang giữ chuột và đầu đang ở bệnh nhân tiếp theo. Dữ liệu: thao tác xếp phòng mang id lượt chờ và phiên bản trạng thái, server từ chối xếp trùng và trả lời quyết đoán, ai thắng ai thua hiện trên cả hai màn hình.

**Hoàn tác nhầm phòng — ba mức theo thời gian.** Vài giây đầu: Ctrl+Z hoặc nút đưa về chờ, một cú click, không hỏi lý do. Khi bác sĩ đã bấm mời: hoàn tác tự chuyển thành chuyển phòng, hệ thống chặn rút người đang in-progress để không xóa một cuộc khám đang chạy. Mọi hoàn tác ghi audit log. Override có audit bảo vệ tôi khi có tranh chấp, không phải để giám sát tôi.

## 4. Tín hiệu từ phòng khám

**A (bác sĩ 2 nút) vs B (bỏ giao diện, lễ tân tự đánh dấu).**

A nhẹ việc hơn, không do dự. Với A, nhịp của tám phòng tự chạy theo nhịp của tám bác sĩ, tôi chỉ nhìn tổng thể để dồn hàng. Việc của tôi thu về đầu vào: tiếp nhận, xếp phòng, ưu tiên, ngoại lệ. Nút mời tiếp theo nằm ở phía bác sĩ cũng đúng về thẩm quyền, bác sĩ tự quyết khi nào phòng sẵn sàng, tôi không phải đoán và không chịu trách nhiệm khi gọi sớm làm đông phòng.

B làm dữ liệu sai. Tôi đứng tại quầy, không quan sát được tám cửa cùng lúc. Chỉ đánh dấu xong khi thấy bệnh nhân bước ra, trễ hơn kết thúc thật vài phút (mặc áo, gấp giấy, hỏi thêm ngoài hành lang). Mọi dấu thời gian trôi đều và không ai biết trôi bao nhiêu. Tệ hơn là sai không có hướng: người bệnh ở lại phòng nói chuyện thêm 10 phút thì ô phòng vẫn đỏ, tôi xếp người mới vào phòng khác dù phòng đó rảnh. Dữ liệu loại này không sửa được sau.

**Ba nỗi sợ nhất nếu phải tự đánh dấu.** Một, quên. Cao điểm có thể 20 phút không chạm màn hình, tám phòng nhân 40 lượt, một lần quên là bản đồ nói dối và tôi tự xếp người mới vào phòng đầy. Hai, trở thành tay gõ của cả khoa, cảm biến của 320 lượt mỗi ngày, tay tôi phải dành cho quầy. Ba, chịu trách nhiệm về thời gian tôi không hề biết. "Tôi khám xong từ 9h, sao máy ghi 9h50" là câu hỏi không có cách trả lời, thành khiếu nại vào đúng người đứng quầy.

**Lưu ý công bằng cho A.** Bác sĩ quên bấm là thật, đặc biệt lúc bận. Hai nút là đúng mức chịu đựng, nhưng máy phải tha thứ. Kết thúc khám phải bấm được cả khi chưa bấm mời. Ô phòng phải nhấp nháy mềm sau 20 phút im lặng để tôi đi kiểm tra thay vì tự đoán. Phòng im lặng quá lâu gắn nhãn "không phản hồi", không đổ lỗi ai bấm sai.

Kết luận: chọn A. B làm tôi thêm việc và biến tôi thành nguồn sai số của toàn bộ dữ liệu thời gian. Tôi sẽ nhận ra ngay tuần đầu và ngừng dùng dữ liệu hệ thống, và khi tôi ngừng dùng thì mọi con số báo cáo của bệnh viện thiếu dữ liệu từ quầy của tôi.

## 5. Lập trường

Ba nguyên tắc. Một, màn hình của tôi là bàn làm việc chính, không phải màn trình diễn. Bảng danh sách với phím tắt là mặt sàn làm việc, 3D chỉ để nhìn tổng thể theo chu kỳ. Hai, mọi ngoại lệ của khoa phải là trạng thái hạng nhất của dữ liệu: đoàn, cấp cứu, phòng ngừng hoạt động, tạm vắng, người nhà. Mỗi tờ giấy trong premortem là một trạng thái thiếu. Ba, một nguồn sự thật duy nhất. Hai lễ tân, các phòng và báo cáo cuối ngày đọc cùng một dữ liệu, override được ghi như một quyết định có chủ, không phải hành vi gian lận bị bắt quả tang.

Nhượng bộ 1 cho bác sĩ và dữ liệu: cổng vào trạng thái completed chỉ mở bằng tín hiệu của bác sĩ, tôi không có nút tự đóng lượt khám của phòng khác, trừ đường override bắt buộc ghi lý do vào audit log. Tôi mất tốc độ khi bác sĩ quên bấm, chấp nhận, vì dữ liệu sạch là lợi ích của cả bệnh viện và của chính tôi khi bị hỏi. Nhượng bộ 2 cho hệ thống tự động: gợi ý xếp phòng tự động là mặc định, tôi giữ override nhưng không đòi hệ thống bất động tới khi tôi ra lệnh. Trong sóng 20 người tôi nhận mặc định để sống sót, phần còn lại của ngày chọn tay.

Tự tin 0.7. Nâng: premortem từ tình huống lặp hằng tuần trong nghề, bảng tần suất khớp quy mô đề bài, lập trường nhất quán với fc-ams và hospital-ecosystem. Hạ: không chắc về hành vi phía bác sĩ, hai nút là suy luận của vai chưa từng làm bác sĩ, văn hóa phòng khám bệnh viện khác có thể khác. Phần 4 nên kiểm chứng bằng thử với bác sĩ thật trước khi bóc giao diện của họ.

Đóng gói: 4 điểm đổi thiết kế — sáu nút một cú bấm trên dòng bệnh nhân; kéo thả 3D là tùy chọn không bắt buộc; đoàn, phòng hỏng, tạm vắng trở thành trạng thái dữ liệu hạng nhất; hoàn tác ba mức có audit. Quy về một quyết định mô hình: trạng thái lượt khám và trạng thái phòng phải đủ giàu để không còn vai nào cần tờ giấy, mọi thao tác xếp phòng phải phân xử qua server, không qua UI.
