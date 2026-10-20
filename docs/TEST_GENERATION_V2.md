# CP Test Studio — Test Generation V2

## Flow

1. Soạn đề bằng Markdown, ảnh OCR hoặc bản nháp AI.
2. Tạo Test Plan thủ công hoặc nhờ AI phân tích; chia testcase thành nhóm `random`, `boundary`, `constructive`, `stress` với params có thể chỉnh offline.
3. Viết generator C++17 trong Monaco, dùng template hoặc AI. Monaco và Testlib được đóng gói cùng app, không cần CDN.
4. Electron biên dịch generator, chạy từng input với seed và named options; validator tùy chọn kiểm tra input. SHA-256 loại trùng và engine thử sinh bù tối đa 8 lần.
5. Viết lời giải, chạy trên các input hiện có và lưu output. Có thể chạy toàn bộ/nhóm hoặc đối chiếu với oracle độc lập.
6. Duyệt testcase, trạng thái, seed, params và hash; chỉ input/output mới được đưa vào bước export Themis.

Khi mở Test Plan chưa có đặc tả hoặc đã lệch đề, Generator chưa có mã dùng được, hay Reference Solution hoặc Editorial còn trống, ứng dụng tự gọi AI và hiện loading khóa giao diện. Nếu chưa lưu API key, ứng dụng yêu cầu cấu hình trước khi gửi request. Chế độ Quick vẫn dùng một request để tạo plan và generator. Các kết quả AI được cache theo nội dung request, provider, model, định dạng và phiên bản prompt; sinh test, chạy C++ và export đều offline. Bước lời giải tạo đồng thời Reference Solution và Editorial. Bộ xuất chia thành `DeBai`, `HuongDan`, `LoiGiai`, `BoTest`; `DeBai` và `HuongDan` có đủ Markdown, PDF, DOCX. Tiền tố file xuất lấy theo tên Input Themis.

## Dữ liệu và trạng thái

- `ProblemSpec`, `TestPlan`, `TestGroup`, testcase, nhật ký sinh và AI cache nằm trong project JSON; schema Zod kiểm tra cấu trúc và giới hạn dữ liệu.
- Mỗi testcase giữ nhóm, mode, seed, index, params, SHA-256 và phiên bản đề/generator/solution. Thay đổi mã hoặc đề đánh dấu dữ liệu cũ thay vì xóa.
- `GENERATED` nghĩa là có input/output mới nhưng chưa xác minh độc lập. `VERIFIED` nghĩa là output khớp oracle sau chuẩn hóa khoảng trắng. `DUPLICATE`, `INVALID`, `ERROR`, `TIMEOUT` và `FAILED` không được xuất.
- Runner lưu output cũ nếu lần chạy mới thất bại, đồng thời đánh dấu stale khi cần chạy lại.
- Themis export dùng tên file Input/Output ở bước 1; thư mục testcase luôn có tiền tố `TEST` (ví dụ `TEST01`). Dialog xác nhận cho biết số test chưa xác minh hoặc bị loại.

## Giới hạn hiện tại

- Validator template chỉ là starter; người dùng cần bổ sung kiểm tra định dạng và ràng buộc của bài. AI-generated validator cũng cần rà soát.
- Oracle so sánh token, chưa có checker chuyên biệt hoặc đảm bảo oracle đúng.
- C++ chạy bằng child process có timeout và giới hạn stdout/stderr; chưa có sandbox OS hoặc giới hạn RAM. Chỉ chạy mã bạn tin cậy.
- Một Test Plan tối đa 30 nhóm và 500 testcase; mỗi testcase thử sinh bù tối đa 8 lần.
- Không có functional/E2E/API test trong lần bàn giao này. Kết quả xác nhận là TypeScript typecheck và production build; xem `BUILD_REPORT.md`.
