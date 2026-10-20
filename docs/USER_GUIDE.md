# Hướng dẫn sử dụng CP Test Studio

CP Test Studio giúp soạn đề, tạo testcase bằng generator C++17, kiểm tra lời giải và xuất bộ đề ngay trên máy.

Phát triển bởi **Nguyễn Hoàng Kiệt - THK9 - Trường THPT Chuyên Nguyên Quang Diêu, tỉnh Đồng Tháp**.

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
- Khi AI tạo đề từ ý tưởng hoặc ảnh, AI đề xuất tên file Input và Output. Tiền tố testcase khi xuất Themis luôn là `TEST` (ví dụ `TEST01`).

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

- **Cài đặt → Trợ lý AI**: chọn OpenAI hoặc Gemini, model và lưu API key.
- **Cài đặt → Compiler C++**: xem trạng thái compiler hoặc chọn `g++.exe` khác.
- Dùng nút ở sidebar để thu gọn/mở rộng sidebar và chuyển giữa giao diện sáng/tối.
