# Hướng dẫn sử dụng

## 1. Tạo đề

1. Mở CP Test Studio và bấm **Dự án mới**.
2. Đặt tên dự án. Đề, mã C++ và testcase được lưu tự động trên máy.
3. Vào **Biên soạn đề**, nhập đề bằng Markdown. Có thể dùng bảng, danh sách, khối code và công thức LaTeX.
4. Để đọc ảnh, bấm **Thêm ảnh đề**, chọn PNG/JPG/WebP tối đa 10 MB. Ảnh gốc được giữ trong dữ liệu dự án. Cấu hình provider AI rồi bấm **Đọc ảnh bằng AI**; kết quả được nối vào cuối đề để bạn rà soát.
5. **Phân tích bằng AI** tạo gợi ý input/output, ràng buộc và nhóm testcase. Hãy kiểm tra lại các giả định.

## 2. Tạo generator

1. Vào **Sinh testcase**, chỉnh sửa `generator.cpp`.
2. Generator là chương trình C++17 độc lập. App gọi generator từng lần với ba tham số: seed, số thứ tự testcase và mode ở `argv[1]`, `argv[2]`, `argv[3]`.
3. In đúng dữ liệu input ra `stdout`; không in giải thích vào stdout. Dùng `stderr` cho chẩn đoán.
4. Chọn số testcase, seed và nhóm, rồi bấm **Sinh testcase**. Tối đa 500 test mỗi lần; mỗi lần chạy bị giới hạn thời gian và output.
5. Nút **Gợi ý bằng AI** là tùy chọn. Mã sinh ra cần được bạn đọc và sửa trước khi chạy.

## 3. Chạy lời giải

1. Vào **Lời giải**, nhập lời giải C++17 chuẩn.
2. Có thể bấm **Biên dịch** để xem diagnostics hoặc nhập input mẫu rồi bấm **Biên dịch & chạy**.
3. Vào **Chạy & kiểm tra**, bấm **Chạy lời giải trên tất cả** để lưu stdout làm output cho từng testcase.
4. Trạng thái “Đã chạy” xác nhận tiến trình kết thúc thành công, không chứng minh output đúng. So sánh với lời giải độc lập/đáp án đã kiểm chứng trước khi phát hành.
5. Nếu lần chạy mới thất bại, output hợp lệ cũ vẫn được giữ lại trong project; testcase thất bại không xuất được cho tới khi chạy thành công lại.

## 4. Xuất bộ test

1. Xác nhận tất cả testcase cần dùng đều có trạng thái **Đã chạy**.
2. Vào **Xuất bộ đề**, xem trước cây thư mục.
3. Bấm **Xuất Themis ZIP** và chọn vị trí lưu.
4. Mỗi testcase được ghi thành `BAI/TESTxx/BAI.INP` và `BAI/TESTxx/BAI.OUT`.
5. Có thể xuất đề thành Markdown hoặc PDF. DOCX cần Pandoc.

## 5. Cài AI, compiler và giao diện

- **Cài đặt → Trợ lý AI**: chọn OpenAI/Gemini, model và lưu/xóa key. Không có request tự động.
- **Cài đặt → Compiler C++**: xem trạng thái tự tìm `g++` hoặc chọn `g++.exe`.
- **Cài đặt → Pandoc**: chọn `pandoc.exe` nếu không nằm trong PATH.
- Dùng biểu tượng mặt trăng/mặt trời trên thanh trên cùng để đổi sáng/tối.

## Lưu ý an toàn

Runner có timeout và giới hạn lượng output nhưng chưa phải sandbox bảo mật và chưa giới hạn RAM. Không chạy generator/lời giải tải từ nguồn không tin cậy. Đừng coi nội dung do AI tạo là lời giải đúng nếu chưa kiểm chứng.
