# Hướng dẫn sử dụng CP Test Studio

CP Test Studio giúp soạn đề, tạo testcase bằng generator C++17, kiểm tra lời giải và xuất bộ đề ngay trên máy.

Phát triển bởi **Nguyễn Hoàng Kiệt - THK9 - Trường THPT Chuyên Nguyên Quang Diêu, tỉnh Đồng Tháp**.

## Mã nguồn mở

Mã nguồn CP Test Studio được công khai trên [GitHub](https://github.com/kietdev123/cp_gen_test). Bạn có thể clone repository về để tự phát triển hoặc tùy chỉnh ứng dụng.

Mở **Hướng dẫn sử dụng** hoặc **Ghi chú phát hành** trong mục **Trợ giúp** ở sidebar để xem tài liệu trong panel chính.

## Bắt đầu

- Chọn **Bài thi** ở sidebar. Bấm **Bài thi mới**, đặt tên rồi mở bài thi trong bảng.
- Nội dung được lưu tự động trên máy.
- Nút ở bottom bar đưa bạn sang bước tiếp theo. Thanh bước bên trái cho biết tiến độ.
- Bước Lời giải tạo đồng thời mã tham khảo C++ và Editorial; bạn có thể chỉnh Markdown, xem trước, rồi xuất vào bốn thư mục `DeBai`, `HuongDan`, `LoiGiai`, `BoTest`. Đề bài và hướng dẫn giải có đủ Markdown, PDF, DOCX; phần hướng dẫn bao gồm Editorial và mã Reference Solution. Tên file xuất lấy từ tên Input trong phần Tên file Themis.
- Bước 6 hiển thị cấu trúc file xuất theo cây thư mục; bấm tên thư mục để thu gọn hoặc mở danh sách file bên trong.
- Khi vào bước 6, ứng dụng tự mở hộp thoại lưu và đóng gói toàn bộ cấu trúc thành `CP_Test_Studio_<Tên file Themis>_<Timestamp>.zip`.

## 1. Biên soạn đề

- Soạn đề trực tiếp bằng Markdown, hoặc nhập ý tưởng và chọn **Soạn đề bằng AI**.
- Có thể chọn ảnh đề rồi bấm **Đọc ảnh bằng AI** để trích nội dung.
- Chọn cách nhập/xuất dữ liệu cho từng bài: **Standard Input / Standard Output (stdin/stdout)** hoặc **File Input / File Output**. Khi AI tạo đề từ ý tưởng hoặc đọc đề từ ảnh, AI suy luận chế độ từ nội dung và tự cập nhật lựa chọn này; nếu đề không nói rõ, mặc định là stdin/stdout. Bạn vẫn có thể đổi thủ công sau đó. AI tạo lời giải sẽ theo chế độ đang chọn.
- Với File Input / File Output, lời giải do AI tạo dùng tên file Input/Output đã đặt bên dưới; khi kiểm tra, ứng dụng ghi input vào file và lấy output từ file tương ứng.
- Khi AI tạo đề từ ý tưởng hoặc ảnh, AI trả về chế độ I/O đã suy luận cùng đề và đề xuất tên file Input/Output. Với File Input / File Output, tên file trong đề khớp với các trường Themis. Tiền tố testcase khi xuất Themis luôn là `TEST` (ví dụ `TEST01`); cấu trúc ZIP Themis luôn có cả cặp file input/output trong từng testcase, bất kể chế độ nhập/xuất của lời giải.

## 2. Test Plan

- Kiểm tra đặc tả, nhóm testcase, mode, số lượng và các tham số `key=value`.
- AI tự phân tích khi Test Plan còn thiếu hoặc không còn đồng bộ với đề. Hãy rà soát kết quả trước khi tiếp tục.

## 3. Generator

- Tạo hoặc chỉnh sửa generator C++17. Generator cần in đúng một input ra `stdout` cho mỗi testcase.
- AI có thể tạo generator khi nội dung còn thiếu. Biên dịch trước, sau đó chọn **Sinh testcase**.
- Chỉnh seed, mode và tham số ở Test Plan để điều khiển các nhóm dữ liệu.

## 4. Lời giải

- Tạo hoặc chỉnh sửa lời giải chuẩn. AI có thể tạo bản nháp khi nội dung còn thiếu.
- Biên dịch và chạy thử trên input mẫu trước khi chuyển sang kiểm tra toàn bộ.

## 5. Kiểm tra

- Chạy lời giải trên từng testcase hoặc cả bộ. Xem input, output, trạng thái và lỗi biên dịch tại đây.
- Nếu sửa lời giải, chạy lại để cập nhật output.

## 6. Xuất bộ đề

- Kiểm tra danh sách testcase đủ điều kiện rồi chọn xuất bộ đề.
- Gói xuất gồm đề, file lời giải `.cpp` và ZIP testcase theo cấu trúc Themis. Tên file Themis lấy từ các trường đã đặt ở bước 1.
- Sau khi xuất, chọn **Mở thư mục đã lưu** để mở thư mục chứa các tệp; chọn **Xuất lại** nếu muốn tạo lại bộ đề.

## Cài đặt và giao diện

- **Cài đặt → Trợ lý AI**: lưu API key Google Gemini và nhập model mặc định. Bấm một nhãn gợi ý để điền model vào ô; chọn **+N model xem thêm** để mở danh sách đầy đủ.
- API key miễn phí có thể gặp giới hạn quota hoặc độ ổn định thay đổi; model mới hay đang có nhiều người dùng có thể quá tải, phản hồi chậm hoặc từ chối yêu cầu. Hãy kiểm tra nội dung AI và lưu lại trước khi sử dụng chính thức.
- Khi Gemini gặp lỗi, ứng dụng hiển thị hướng dẫn tiếng Việt: lỗi `503` thường là dịch vụ đang quá tải/tạm gián đoạn, hãy đợi rồi thử lại hoặc đổi model; lỗi `429` thường là chạm giới hạn/quota, hãy đợi quota làm mới hoặc kiểm tra Google AI Studio; lỗi API key, quyền truy cập, model không tồn tại và timeout cũng có hướng khắc phục tương ứng. Tham khảo [mã lỗi Gemini API](https://ai.google.dev/gemini-api/docs/generate-content/api-errors?hl=vi) và [hướng dẫn khắc phục sự cố](https://ai.google.dev/gemini-api/docs/troubleshooting?hl=vi).
- **Cài đặt → Compiler C++**: xem trạng thái compiler hoặc chọn `g++.exe` khác.
- Dùng nút ở sidebar để thu gọn/mở rộng sidebar và chuyển giữa giao diện sáng/tối.
