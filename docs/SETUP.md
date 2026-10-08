# Cài đặt và cấu hình

## Dùng ứng dụng Windows

1. Giải nén `CP-Test-Studio-0.1.0-win-x64.zip`.
2. Chạy `CP Test Studio.exe`.
3. Có thể bỏ qua API AI ở màn hình chào mừng. Ứng dụng mở được khi chưa có API key.
4. Dự án và dữ liệu được lưu cục bộ trong thư mục user data của Electron. Dùng nút **Mở thư mục** trong dự án để xem tệp trên máy.

## Môi trường phát triển

- Windows 10/11 64-bit.
- Node.js 22 trở lên và npm.
- MinGW-w64 có `g++.exe` cho chức năng compile/run C++17.
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

## Cài MinGW-w64 / chọn compiler

Ứng dụng tự tìm `g++.exe` trong `PATH`. Nếu không nhận ra compiler:

1. Cài MinGW-w64 có `g++.exe`.
2. Thêm thư mục `bin` vào biến môi trường `PATH`, hoặc mở **Cài đặt → Compiler C++ → Chọn g++.exe**.
3. Khởi động lại ứng dụng nếu chỉ vừa sửa `PATH`.

Compiler cần hỗ trợ `-std=c++17`. Project compile vào thư mục build của ứng dụng; source gốc vẫn nằm trong thư mục dự án.

## Cấu hình AI

Trong **Cài đặt → Trợ lý AI**, chọn provider và model, dán API key rồi bấm **Lưu key**. Electron `safeStorage` mã hóa key bằng cơ chế bảo vệ thông tin của Windows. Nút **Kiểm tra kết nối** mới gửi request kiểm tra; các nút AI trên màn hình chỉ gửi dữ liệu khi được bấm.

Key và nội dung dự án không được ghi vào log ứng dụng. Tác vụ AI cần Internet và chịu điều khoản/chi phí của nhà cung cấp API.

## Cài Pandoc

Cài Pandoc và để `pandoc.exe` trong `PATH`, hoặc chọn file trong **Cài đặt → Pandoc**. Nếu không cài, Markdown, PDF và Themis vẫn dùng được; DOCX sẽ báo hướng dẫn.
