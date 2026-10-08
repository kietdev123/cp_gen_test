# Cài đặt và cấu hình

## Dùng ứng dụng Windows

1. Giải nén `CP-Test-Studio-0.1.0-win-x64.zip`.
2. Chạy `CP Test Studio.exe`.
3. Có thể bỏ qua API AI ở màn hình chào mừng. Ứng dụng mở được khi chưa có API key.
4. Dự án và dữ liệu được lưu cục bộ trong thư mục user data của Electron. Dùng nút **Mở thư mục** trong dự án để xem tệp trên máy.

## Môi trường phát triển

- Windows 10/11 64-bit.
- Node.js 22 trở lên và npm.
- MinGW-w64 được chuẩn bị tự động khi chạy source và được đóng gói cùng app Windows; người cài app không cần cài riêng compiler.
- Pandoc là tùy chọn, chỉ cần để xuất DOCX.
- API key OpenAI hoặc Google Gemini là tùy chọn, chỉ cần cho chức năng AI.

```powershell
npm install
npm run dev
```

Để biên dịch TypeScript và tạo bundle production:

```powershell
npm run typecheck
npm run build
```

## Tạo gói Windows

```powershell
npm run dist:win
```

Tệp build nằm trong `release/`. Dùng `npm run dist:win:installer` trên Windows nếu cần installer NSIS.

## Compiler C++

App Windows đi kèm MinGW-w64. Khi chạy từ source, `npm run dev` tự tải bản compiler cố định vào `.tools/` (thư mục này không được đưa vào Git) và xác minh SHA-256 trước khi giải nén. Lệnh tạo gói Windows cũng chuẩn bị compiler tự động.

Nếu compiler đi kèm không khởi động được, có thể chọn một `g++.exe` khác trong **Cài đặt → Compiler C++**. App chỉ thêm thư mục compiler vào `PATH` của tiến trình biên dịch/chạy, không sửa PATH của Windows.

Compiler cần hỗ trợ `-std=c++17`. Project compile vào thư mục build của ứng dụng; source gốc vẫn nằm trong thư mục dự án.

## Cấu hình AI

Trong **Cài đặt → Trợ lý AI**, chọn provider và model, dán API key rồi bấm **Lưu key**. Electron `safeStorage` mã hóa key bằng cơ chế bảo vệ thông tin của Windows. Nút **Kiểm tra kết nối** mới gửi request kiểm tra; các nút AI trên màn hình chỉ gửi dữ liệu khi được bấm.

Key và nội dung dự án không được ghi vào log ứng dụng. Tác vụ AI cần Internet và chịu điều khoản/chi phí của nhà cung cấp API.

## Cài Pandoc

Cài Pandoc và để `pandoc.exe` trong `PATH`, hoặc chọn file trong **Cài đặt → Pandoc**. Nếu không cài, Markdown, PDF và Themis vẫn dùng được; DOCX sẽ báo hướng dẫn.
