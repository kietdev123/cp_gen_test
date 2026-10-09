# Checklist kiểm tra thủ công

Checklist này dành cho người dùng kiểm tra ứng dụng sau khi build. Khi triển khai source, agent chỉ chạy typecheck và production build; không gọi API thật hoặc chạy kiểm thử chức năng/E2E.

## 1. Đề bài và Test Plan

- [ ] Mở app lần đầu; bỏ qua cấu hình AI vẫn vào được dashboard.
- [ ] Tạo dự án, nhập đề Markdown và kiểm tra preview, Unicode, công thức.
- [ ] Tạo Test Plan thủ công không cần API; thêm/xóa nhóm và đổi mode, số lượng, params.
- [ ] Đổi đề rồi xác nhận plan báo cần đồng bộ/phân tích lại, testcase cũ còn được lưu và đánh dấu cũ.
- [ ] Có API key: chạy **AI phân tích đề** và **Quick: plan + generator**; xem JSON đã được kiểm tra schema và rà soát nội dung trước khi dùng.
- [ ] Chưa có key: gọi tính năng AI, lưu key trong modal để tiếp tục; Cancel không làm mất nội dung đã nhập.
- [ ] Vào Test Plan mới/rỗng: AI tự phân tích; loading ở giữa khóa tương tác. Nếu chưa có key, nhập key để tiếp tục hoặc hủy.
- [ ] Vào Generator với template mặc định và Lời giải còn trống: AI tự tạo mã không hỏi dùng AI; loading ở giữa khóa tương tác.

## 2. Generator, validator và sinh testcase

- [ ] Dùng template generator; biên dịch được với Testlib đã đóng gói, không cần tải `testlib.h` riêng.
- [ ] Xem/sửa generator và xác nhận nó nhận seed positional, `--testIndex`, `--mode` cùng tham số nhóm.
- [ ] Tạo validator đúng với đề; input hợp lệ có exit code 0, input sai bị loại và có stderr.
- [ ] Sinh test theo nhiều nhóm; tiến độ và nhật ký hiển thị số lượng sinh được, trùng, invalid, lỗi và retry.
- [ ] Sinh lặp cùng miền nhỏ: SHA-256 phát hiện trùng, app thử sinh bù tối đa 8 lần và cảnh báo nếu không đủ số input duy nhất.
- [ ] Sinh lại một testcase: chỉ thay bản ghi được chọn, các testcase khác còn nguyên.
- [ ] Sửa generator hoặc validator: testcase trước được giữ lại và đánh dấu input cũ.
- [ ] Compile lỗi: xem diagnostics và có thể yêu cầu AI đề xuất sửa; mã được đưa vào editor để người dùng rà soát.

## 3. Lời giải, runner và export

- [ ] Nhập hoặc tạo lời giải C++17, biên dịch và chạy trên input mẫu.
- [ ] Chạy tất cả input hoặc một nhóm; xem stdout, stderr, runtime, timeout và trạng thái từng testcase.
- [ ] Cho chương trình thoát sớm khi app đang gửi input; app vẫn hoạt động và hiển thị kết quả lỗi của testcase.
- [ ] Sửa lời giải: output cũ được giữ nhưng đánh dấu cũ; chạy lại input có sẵn không sinh lại testcase.
- [ ] Thêm oracle độc lập: output khớp theo token thành `VERIFIED`; mismatch hoặc oracle lỗi không được đánh dấu xác minh.
- [ ] Mục export hiển thị input/output có thể xuất và số bản ghi lỗi, trùng, thiếu output hoặc cũ bị bỏ qua.
- [ ] Xác nhận ZIP Themis có cấu trúc `BAI/TESTxx/BAI.INP` và `BAI.OUT`; tiền tố luôn là `TEST`, còn tên input/output lấy từ bước 1.
- [ ] Xuất Markdown, DOCX, PDF, `<tên đề>_solution.cpp` và ZIP; kiểm tra Unicode, công thức và bố cục.

## 4. Lỗi thường gặp

- Compiler không chạy: kiểm tra compiler đi kèm hoặc đường dẫn `g++.exe` trong Cài đặt.
- Generator treo/tạo output quá lớn: app dừng theo timeout/giới hạn output; xem stderr và sửa mã.
- Không đủ test duy nhất: mở nhật ký; đổi seed, params hoặc thuật toán generator.
- AI lỗi: kiểm tra provider, model, API key và kết nối. Sinh testcase, runner và export không cần AI.
- Export bỏ qua test: xem trạng thái và phiên bản; chạy lại lời giải để tạo output mới.
