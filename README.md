# CP Test Studio

CP Test Studio là ứng dụng desktop Windows bằng tiếng Việt để soạn đề lập trình thi đấu, viết chương trình C++ tạo input, chạy lời giải chuẩn và xuất bộ testcase theo cấu trúc Themis. Dữ liệu dự án lưu cục bộ; không có tài khoản hay backend cloud.

## Chạy và đóng gói

Yêu cầu Node.js 22 trở lên và npm:

```powershell
npm install
npm run dev
```

Nếu `npm` chưa nằm trong `PATH` trên máy Windows này, chạy source bằng `node .tools/npm/bin/npm-cli.js run dev`.

Kiểm tra và build bản production:

```powershell
npm run typecheck
npm run build
npm run dist:win
```

`npm run dist:win` tạo gói ZIP Windows x64 trong `release/`. `npm run dist:win:installer` tạo một file MSI. Cả hai lệnh tự chuẩn bị MinGW-w64, Pandoc, Typst và Roboto để người dùng chỉ cần cài ứng dụng.

Hướng dẫn chi tiết ở [docs/SETUP.md](docs/SETUP.md), thao tác ở [docs/USER_GUIDE.md](docs/USER_GUIDE.md), checklist thủ công ở [docs/MANUAL_TEST.md](docs/MANUAL_TEST.md).

## Chức năng hiện có

- Quản lý dự án và lưu tự động trong thư mục dữ liệu ứng dụng của Windows.
- Soạn đề Markdown, preview và công thức LaTeX; lưu ảnh gốc trong dự án và trích nội dung bằng AI theo yêu cầu.
- Lập Test Plan theo nhóm random, boundary, constructive hoặc stress; chỉnh sửa số lượng và tham số offline.
- Dùng Testlib đã đóng gói để biên dịch generator C++17; Electron chạy theo từng testcase, kiểm tra validator tùy chọn và loại input trùng bằng SHA-256.
- Cấu hình OpenAI hoặc Gemini; Test Plan, generator và lời giải tự gọi AI khi nội dung còn thiếu. Validator và chức năng AI khác được gọi theo yêu cầu. Cache theo provider, model, prompt và phiên bản; Quick tạo plan cùng generator trong một request.
- Chạy lời giải trên test hiện có, lưu stdout, chạy lại toàn bộ/nhóm và tùy chọn đối chiếu với oracle theo token.
- Xuất bộ test ZIP theo `BAI/TESTxx/BAI.INP` và `BAI.OUT`; xuất Markdown, DOCX có công thức Word, PDF bằng Pandoc/Typst và file lời giải C++17.
- Trình soạn C++ dùng Monaco đóng gói offline; giao diện tiếng Việt dùng Roboto, có sáng/tối, thông báo lỗi và trạng thái compiler rõ ràng.

## Kiến trúc

- Electron Main Process giữ quyền truy cập file, API key, compiler, runner và export.
- Preload chỉ phơi các hàm IPC có kiểu dữ liệu; renderer bật `contextIsolation`, không bật Node integration.
- Project JSON, Markdown, source và testcase lưu dưới `app.getPath('userData')/projects/`.
- Test Plan, trạng thái/phiên bản testcase, SHA-256 và nhật ký sinh test được lưu theo dự án. Testlib header và license được đóng gói trong ứng dụng.
- C++ chạy bằng child process với danh sách tham số, không ghép lệnh shell. Runner có timeout và giới hạn stdout/stderr cơ bản.

## Giới hạn MVP

- C++ chạy trong tiến trình con có timeout và giới hạn output; chưa có sandbox OS hay giới hạn RAM. Chỉ chạy mã bạn tin cậy.
- Validator cần được rà soát và bổ sung ràng buộc riêng cho đề; template đi kèm chỉ là điểm bắt đầu.
- Oracle so sánh token sau khi chuẩn hóa khoảng trắng; chưa thay thế checker chuyên biệt hoặc kiểm chứng tính đúng đắn của chính oracle.
- Tác vụ AI phụ thuộc API/key và mô hình/provider bạn cấu hình; AI có thể tạo nội dung sai cần người dùng xem lại.
- Bố cục tài liệu được tạo từ Markdown và công thức TeX; cần kiểm tra lại khi đề có HTML tùy biến hoặc cú pháp ngoài Markdown chuẩn.
- Không chạy functional/end-to-end test trong phạm vi bàn giao. Xem [docs/TEST_GENERATION_V2.md](docs/TEST_GENERATION_V2.md), [docs/MANUAL_TEST.md](docs/MANUAL_TEST.md) và [BUILD_REPORT.md](BUILD_REPORT.md).


Set-Location "C:\Users\Kiet Gay\Desktop\cp_gen_test"
& "C:\Users\Kiet Gay\AppData\Local\Programs\nodejs-24.21.0\npm.cmd" run dev
