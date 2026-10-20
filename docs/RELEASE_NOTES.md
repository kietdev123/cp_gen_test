# Ghi chú phát hành

Nhật ký dưới đây ghi nội dung theo từng version được tìm thấy trong lịch sử `package.json` của Git. Repo không có tag hoặc bằng chứng cho biết các version này đã được phát hành thành bản cài đặt, vì vậy đây là ghi chú theo version trong mã nguồn.

## 1.0.22 — cập nhật lúc 20/10/2026 21:42:21 +07:00

- Trang **Hướng dẫn sử dụng** và **Ghi chú phát hành** chỉ hiển thị panel nội dung chính; bỏ tiêu đề trang, nút tạo bài thi và cảnh báo compiler khỏi hai trang tài liệu.
- Mở rộng panel tài liệu theo chiều cao vùng nội dung để có thể cuộn bên trong.

## 1.0.21 — 20/10/2026 21:37:43 +07:00

- Thêm trang **Ghi chú phát hành** trong sidebar để xem lịch sử thay đổi ngay trong ứng dụng.
- Loading modal khóa toàn bộ khu vực làm việc; thêm nút **Hủy thao tác** cho các tác vụ AI, biên dịch, chạy chương trình và xử lý testcase có thể dừng an toàn.

## 1.0.20 — 20/10/2026 21:28:52 +07:00

- Chuẩn hóa cài đặt trợ lý AI sang Google Gemini và tải dữ liệu vòng đời model từ tài liệu Google.
- Hiển thị các nhãn gợi ý model **Mạnh nhất**, **Nhẹ nhất**, **Cân bằng**; bấm nhãn để điền model vào ô cài đặt, hoặc mở các model khác bằng **xem thêm**.
- Thêm cảnh báo về quota và độ ổn định có thể thay đổi khi dùng API key miễn phí, nhất là với model mới hoặc đang có nhiều người dùng.
- Cập nhật hướng dẫn kết nối và sử dụng AI.

## 1.0.10 — 20/10/2026 20:34:02 +07:00

- Hoàn thiện luồng xuất bộ đề thành ZIP có cấu trúc thư mục rõ ràng.
- Sửa các lỗi xuất đề bài và tài liệu; bổ sung checklist kiểm tra thủ công cho luồng xuất.

## 1.0.7 — 20/10/2026 20:15:48 +07:00

- Tạo lời giải tham khảo C++17 cùng Editorial, gồm hướng tiếp cận, chứng minh, độ phức tạp và trường hợp biên.
- Đồng bộ lời giải với hướng dẫn giải khi xuất tài liệu; cập nhật Test Plan và hướng dẫn kiểm thử tương ứng.

## 1.0.1 — 19/10/2026 19:18:52 +07:00

- Cải thiện luồng xử lý lỗi biên dịch và khả năng nhờ AI đề xuất sửa mã dựa trên diagnostics.
- Cập nhật các prompt tạo đề, Test Plan, generator và lời giải; thêm hướng dẫn bắt đầu nhanh.

## 1.0.0 — 10/10/2026 13:59:35 +07:00

- Ghi nhận mốc version `1.0.0` trong dự án.
- Cập nhật hướng dẫn cài đặt và bổ sung quy tắc làm việc cho agent trong repo.

## 0.1.0 — 08/10/2026 18:49:57–10/10/2026 13:34:15 +07:00

- Khởi tạo ứng dụng desktop để quản lý bài thi cục bộ, soạn đề Markdown và biên dịch/chạy C++.
- Xây dựng các bước tạo testcase, kiểm tra output, giao diện và hướng dẫn sử dụng.
- Bổ sung xuất tài liệu Word/PDF, logo, font và cấu hình compiler/công cụ xuất để chạy trên máy khác.
