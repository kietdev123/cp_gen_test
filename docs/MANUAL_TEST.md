# Checklist kiểm tra thủ công

Các bước dưới đây dành cho người dùng sau khi build. Không tự động gọi API hoặc thực thi mã bài mẫu khi build.

## Mở app và dự án

- [ ] Mở app lần đầu, thấy lời chào và có thể **Bỏ qua, dùng không cần AI**.
- [ ] Tạo dự án, nhập tên tiếng Việt có dấu; tên hiện đầy đủ ở sidebar.
- [ ] Đóng/mở lại app; dự án, đề và mã nguồn vẫn còn.
- [ ] Sửa đề; đợi nhãn lưu cập nhật; bấm **Lưu**; mở thư mục để xem JSON/Markdown.
- [ ] Đổi theme sáng/tối rồi điều hướng qua các mục; lựa chọn được giữ.
- [ ] Xóa dự án thử nghiệm; dự án biến mất khỏi danh sách.

## Đề bài và AI (chỉ kiểm tra khi có key)

- [ ] Nhập Markdown gồm heading, danh sách, bảng và công thức; preview hiển thị dễ đọc.
- [ ] Chọn ảnh PNG/JPG/WebP; loại file khác được thông báo.
- [ ] Không có key: chọn AI hiển thị hướng dẫn cấu hình, nội dung soạn thảo còn nguyên.
- [ ] Có key: bấm **Kiểm tra kết nối** và xác nhận thông báo phù hợp.
- [ ] Dùng ảnh đề / **Phân tích bằng AI**; rà soát kết quả trước khi dùng.
- [ ] Sai key/model/mạng: lỗi hiện rõ và nội dung đề không bị mất.

## Compiler, generator và solution

- [ ] Không cài compiler: dashboard/cài đặt báo thiếu g++; phần còn lại của app vẫn mở.
- [ ] Chọn `g++.exe` hợp lệ; compile C++17 đơn giản thành công.
- [ ] Compile mã lỗi cú pháp; diagnostics hiển thị và có thể sửa rồi biên dịch lại.
- [ ] Generator đọc `argv[1..3]`, in input vào stdout; sinh vài testcase và xác nhận seed tái lập.
- [ ] Generator thoát lỗi, quá thời gian hoặc in dữ liệu quá lớn; app báo lỗi rõ.
- [ ] Solution đọc stdin, in kết quả; chạy thử và chạy tất cả test.
- [ ] Solution lỗi runtime hoặc quá thời gian; testcase báo thất bại nhưng output cũ vẫn giữ nguyên.

## Export

- [ ] Chưa chạy solution: Themis ZIP từ chối xuất.
- [ ] Sau khi các test chạy thành công, xuất ZIP và kiểm tra cấu trúc `BAI/TESTxx/BAI.INP` + `BAI.OUT`.
- [ ] Xuất Markdown và mở file để xác nhận Unicode.
- [ ] Xuất PDF; kiểm tra tiếng Việt, công thức inline/khối và ngắt dòng `<br>`.
- [ ] Xuất DOCX; xác nhận công thức là Equation có thể chỉnh trong Word và font văn bản là Roboto.

## Cách nhận biết lỗi

- Thông báo đỏ/toast: thao tác thất bại; xem câu chữ và giữ lại nội dung.
- `g++` không chạy: xác nhận đường dẫn compiler và PATH, mở lại app sau khi sửa PATH.
- AI lỗi: kiểm tra provider, model, quyền API và kết nối Internet.
- ZIP thiếu file: xác nhận testcase có trạng thái chạy thành công.
- DOCX/PDF lỗi: xác nhận thư mục `.tools/document-export/` có Pandoc, Typst, template và font đi kèm.
- Mã C++ treo: dừng theo timeout; sửa generator/solution rồi chạy lại.
