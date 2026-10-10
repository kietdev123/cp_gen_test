# Cài đặt và cấu hình

## Dùng ứng dụng Windows

1. Chạy file `CP-Test-Studio-0.1.0-win-x64.msi` và hoàn tất cài đặt.
2. Mở CP Test Studio từ Start hoặc shortcut trên Desktop.
3. Có thể bỏ qua API AI ở màn hình chào mừng. Ứng dụng mở được khi chưa có API key.
4. Dự án và dữ liệu được lưu cục bộ trong thư mục user data của Electron. Dùng nút **Mở thư mục** trong dự án để xem tệp trên máy.

Gói ZIP portable vẫn được tạo bằng `npm run dist:win` nếu không muốn cài MSI.

## Môi trường phát triển

- Windows 10/11 64-bit.
- Node.js 22 trở lên và npm.
- GCC/MinGW-w64 được tải riêng, không nằm trong MSI. Chọn `g++.exe` sau khi giải nén tại **Cài đặt → Compiler C++**.
- Testlib `testlib.h` và license được lưu trong source, đóng gói cùng ứng dụng; generator không cần tải thư viện lúc chạy.
- Pandoc, Typst và Roboto được tải riêng, không nằm trong MSI. Chọn thư mục `document-export` đã chuẩn bị tại **Cài đặt → Xuất tài liệu**.
- API key OpenAI hoặc Google Gemini là tùy chọn, chỉ cần cho chức năng AI.

```powershell
npm install
npm run dev
```

Nếu terminal báo không tìm thấy lệnh `npm`, dùng lệnh source có sẵn trong môi trường máy này: `node .tools/npm/bin/npm-cli.js run dev`.

Để biên dịch TypeScript và tạo bundle production:

```powershell
npm run typecheck
npm run build
```

## Tạo gói Windows

```powershell
npm run dist:win
```

Lệnh trên tạo ZIP portable. Để tạo một installer MSI x64 duy nhất trên Windows:

```powershell
npm run dist:win:installer
```

Tệp MSI sẽ nằm trong `release/`.

Installer mở wizard cài đặt, cài theo tài khoản Windows hiện tại và tạo shortcut Start/Desktop; không yêu cầu quyền quản trị.

## Compiler C++

Tải GCC x64 từ [docs/EXTERNAL_TOOLS.md](EXTERNAL_TOOLS.md), giải nén toàn bộ ZIP rồi chọn `mingw64\bin\g++.exe` trong **Cài đặt → Compiler C++**. Giữ nguyên cấu trúc thư mục để GCC tìm được linker và thư viện. App chỉ thêm đường dẫn cho tiến trình con, không sửa PATH của Windows.

Compiler cần hỗ trợ `-std=c++17`. Project compile vào thư mục build của ứng dụng; source gốc vẫn nằm trong thư mục dự án.

## Cấu hình AI

Trong **Cài đặt → Trợ lý AI**, chọn provider và model, dán API key rồi bấm **Lưu key**. Electron `safeStorage` mã hóa key bằng cơ chế bảo vệ thông tin của Windows. Khi mở bước Test Plan thiếu đặc tả, Generator thiếu mã hoặc Lời giải trống, ứng dụng tự gọi AI; nếu chưa lưu key, ứng dụng sẽ yêu cầu cấu hình key trước khi gửi request. Các chức năng AI khác chỉ gửi dữ liệu khi được chọn.

Key và nội dung dự án không được ghi vào log ứng dụng. Tác vụ AI cần Internet và chịu điều khoản/chi phí của nhà cung cấp API.

## Xuất tài liệu

Tải các thành phần từ [docs/EXTERNAL_TOOLS.md](EXTERNAL_TOOLS.md), chạy script chuẩn bị để tạo `.tools/document-export/`, rồi trong ứng dụng chọn thư mục này tại **Cài đặt → Xuất tài liệu**. DOCX dùng template Word và PDF dùng Typst để hiển thị công thức TeX.
