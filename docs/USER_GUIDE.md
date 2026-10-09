# Hướng dẫn sử dụng

## 1. Tạo đề

1. Mở CP Test Studio và bấm **Dự án mới**.
2. Đặt tên dự án. Đề, mã C++ và testcase được lưu tự động trên máy.
3. Vào **Biên soạn đề**, nhập đề bằng Markdown. Có thể dùng bảng, danh sách, khối code và công thức LaTeX.
4. Để đọc ảnh, chọn PNG/JPG/WebP tối đa 10 MB. Ảnh gốc được giữ trong dự án; bấm **Đọc ảnh bằng AI** để đưa bản trích xuất vào ô đề rồi rà soát.
5. Có thể nhập ý tưởng và bấm **Soạn đề bằng AI**. Kết quả được đưa vào ô đề để chỉnh sửa.

## 2. Lập Test Plan

1. Vào **Test Plan**; điền summary, input/output, ràng buộc và nhóm testcase.
2. Chọn mode `random`, `boundary`, `constructive` hoặc `stress`, số lượng và params `key=value`.
3. Khi vào Test Plan, AI tự phân tích nếu đặc tả còn trống hoặc đề đã đổi. Có thể bấm **AI phân tích đề** hoặc **Quick: plan + generator** để chạy lại; rà soát kết quả trước khi dùng.
4. Đề thay đổi sẽ làm Test Plan báo chưa đồng bộ. Bấm đồng bộ hoặc phân tích lại.

## 3. Tạo generator và validator

1. Vào **Sinh testcase**; nếu chưa có generator dùng được, AI tự tạo bản nháp dựa trên Test Plan và đề. Có thể sửa `generator.cpp` bằng Monaco hoặc yêu cầu AI lại. Editor và `testlib.h` đã được đóng gói offline.
2. Generator là chương trình C++17 sinh đúng một input mỗi lần chạy. App truyền seed ở `argv[1]`, cùng named options như `--testIndex=...`, `--mode=...` và các params của nhóm.
3. In input ra `stdout`; không in giải thích vào đó. Biên dịch trước khi sinh testcase.
4. Validator là tùy chọn trong **Advanced**. Thêm kiểm tra định dạng/ràng buộc cho bài cụ thể; template mặc định chỉ là điểm bắt đầu.
5. Chọn seed và bấm **Sinh testcase**. App kiểm tra validator, hash SHA-256, thử sinh bù tối đa 8 lần và báo tiến độ/thống kê.
6. Sinh testcase lại không xóa bản ghi cũ; testcase mới được thêm, test trùng được đánh dấu. Mã AI cần được đọc và sửa trước khi chạy.

## 4. Chạy lời giải

1. Vào **Lời giải**; nếu chưa có lời giải dùng được, AI tự tạo bản nháp từ đề và Test Plan. Rà soát hoặc sửa lời giải C++17 trước khi chạy.
2. Có thể bấm **Biên dịch** để xem diagnostics hoặc nhập input mẫu rồi bấm **Biên dịch & chạy**.
3. Vào **Chạy & kiểm tra** để chạy toàn bộ testcase hoặc một nhóm; có thể chạy lại mà không sinh input lại.
4. Output thành công có trạng thái `GENERATED`, nghĩa là chưa kiểm chứng độc lập. Có thể thêm lời giải oracle trong **Advanced**; output khớp theo token thành `VERIFIED`.
5. Nếu lần chạy mới thất bại, output cũ được giữ nhưng đánh dấu cũ. Sửa lời giải sẽ yêu cầu chạy lại.

## 5. Duyệt và xuất

1. Mở testcase để xem input/output, nhóm, seed, params và SHA-256. Có thể sinh lại một test hoặc xóa bản ghi.
2. Vào **Xuất bộ đề**, xem danh sách input/output đủ điều kiện. Test lỗi, trùng, thiếu output hoặc đã cũ bị bỏ qua.
3. Xác nhận hộp thoại nếu có output chưa được oracle xác minh; sau đó chọn thư mục lưu ZIP.
4. Tên input/output và tiền tố thư mục testcase chỉnh trong **Cài đặt → Tên file Themis**.
5. Thư mục xuất có đề Markdown, PDF, DOCX, file lời giải `<tên đề>_solution.cpp` và ZIP testcase Themis. Công thức toán được chuyển sang định dạng tài liệu tương ứng.

## 5. Cài AI, compiler và giao diện

- **Cài đặt → Trợ lý AI**: chọn OpenAI/Gemini, model và lưu/xóa key. Bước Test Plan, Generator và Lời giải tự gọi AI khi nội dung còn thiếu; nếu chưa có key, ứng dụng hỏi key trước khi gửi request.
- **Cài đặt → Compiler C++**: xem trạng thái tự tìm `g++` hoặc chọn `g++.exe`.
- **Cài đặt → Tên file Themis**: đổi tên file input/output và prefix thư mục testcase.
- **Xuất tài liệu**: Pandoc, Typst và Roboto đã đi kèm ứng dụng, không cần cấu hình thêm.
- Dùng biểu tượng mặt trăng/mặt trời trên thanh trên cùng để đổi sáng/tối.

## Lưu ý an toàn

Runner có timeout và giới hạn lượng output nhưng chưa phải sandbox bảo mật và chưa giới hạn RAM. Không chạy generator/lời giải tải từ nguồn không tin cậy. Đừng coi nội dung do AI tạo là lời giải đúng nếu chưa kiểm chứng.
