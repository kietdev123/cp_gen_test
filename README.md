# CP Test Studio

CP Test Studio là ứng dụng desktop Windows bằng tiếng Việt để soạn đề lập trình thi đấu, viết chương trình C++ tạo input, chạy lời giải chuẩn và xuất bộ testcase theo cấu trúc Themis. Dữ liệu dự án lưu cục bộ; không có tài khoản hay backend cloud.

## Chạy và đóng gói

Yêu cầu Node.js 22 trở lên và npm:

```powershell
npm install
npm run dev
```

Kiểm tra và build bản production:

```powershell
npm run typecheck
npm run build
npm run dist:win
```

`npm run dist:win` tạo gói ZIP Windows x64 trong `release/`; giải nén và chạy `CP Test Studio.exe`. Có thể tạo installer NSIS trên Windows bằng `npm run dist:win:installer`.

Hướng dẫn chi tiết ở [docs/SETUP.md](docs/SETUP.md), thao tác ở [docs/USER_GUIDE.md](docs/USER_GUIDE.md), checklist thủ công ở [docs/MANUAL_TEST.md](docs/MANUAL_TEST.md).

## Chức năng hiện có

- Quản lý dự án và lưu tự động trong thư mục dữ liệu ứng dụng của Windows.
- Soạn đề Markdown, preview và công thức LaTeX; lưu ảnh gốc trong dự án và trích nội dung bằng AI theo yêu cầu.
- Cấu hình OpenAI hoặc Gemini, mã hóa khóa bằng `safeStorage` của Electron; gọi AI phân tích đề, gợi ý generator và lời giải khi người dùng bấm nút.
- Viết và biên dịch generator/lời giải C++17 bằng `g++`; tạo testcase theo seed, chạy lời giải trên testcase và lưu stdout thành output.
- Xuất bộ test ZIP theo `BAI/TESTxx/BAI.INP` và `BAI.OUT`; xuất đề Markdown, PDF hoặc DOCX qua Pandoc.
- Giao diện tiếng Việt dùng Roboto đóng gói offline, có sáng/tối, thông báo lỗi và trạng thái compiler rõ ràng.

## Kiến trúc

- Electron Main Process giữ quyền truy cập file, API key, compiler, runner và export.
- Preload chỉ phơi các hàm IPC có kiểu dữ liệu; renderer bật `contextIsolation`, không bật Node integration.
- Project JSON, Markdown, source và testcase lưu dưới `app.getPath('userData')/projects/`.
- C++ chạy bằng child process với danh sách tham số, không ghép lệnh shell. Runner có timeout và giới hạn stdout/stderr cơ bản.

## Giới hạn MVP

- Mã chạy trong tiến trình riêng nhưng chưa có sandbox OS hoặc giới hạn RAM; chỉ chạy mã bạn tin cậy.
- Generator nhận seed, số thứ tự testcase và mode qua `argv[1..3]`; app không kèm `testlib.h` và chưa có trình tạo cấu trúc testcase tự động.
- Chưa có validator trong giao diện, stress differential/brute-force checker, xuất DOCX tùy biến, quản lý nhiều thư mục dự án hay tùy chỉnh tên file Themis.
- Tác vụ AI phụ thuộc API/key và mô hình/provider bạn cấu hình; AI có thể tạo nội dung sai cần người dùng xem lại.
- PDF MVP trình bày nội dung đề dạng văn bản Unicode; chưa chuyển toàn bộ cú pháp Markdown/LaTeX thành dàn trang nâng cao.
- Không chạy functional/end-to-end test trong phạm vi bàn giao. Xem [BUILD_REPORT.md](BUILD_REPORT.md) để biết các lệnh build đã chạy.
