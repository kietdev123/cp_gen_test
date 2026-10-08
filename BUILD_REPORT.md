# Build report

Ngày build: 2026-10-08

## Kết quả

- Docker Desktop đang chạy Linux engine; Docker image `cp-test-studio-builder` được tạo thành công.
- `npm run typecheck` — **exit code 0** trong Docker.
- `npm run build` — **exit code 0** trong Docker.
- `npm run dist:win` (`electron-builder --win zip --x64`) — **exit code 0** trong Docker.
- Gói Windows x64: `release/CP-Test-Studio-0.1.0-win-x64.zip` (151,870,429 bytes).
- ZIP liệt kê được `CP Test Studio.exe` và `resources/app.asar`. SHA-256: `4B8661069C31FB6AC337590B9F60B99598697C6FB01BED1F2F9D6D6A0C64C4FD`.
- electron-builder cũng tạo thư mục chạy trực tiếp `release/win-unpacked/`.

## Chưa xác nhận

- Chưa mở ứng dụng Windows sau khi đóng gói và chưa chạy kiểm thử chức năng/end-to-end.
- Chưa gọi API OpenAI/Gemini thật hoặc chạy mã generator/solution của bài thi.
- Docker tạo gói ZIP portable, không tạo installer NSIS. Muốn installer, chạy `npm run dist:win:installer` trên Windows.
- Trình nhập mã hiện dùng vùng soạn thảo văn bản thường; chưa có Monaco, tô màu cú pháp hoặc gợi ý mã.

## Ghi chú build

- Lần build renderer đầu tiên chỉ ra `index.html` cần nằm trong `src/renderer`; đã chuyển file và cập nhật entry point Electron, các lần build sau thành công.
- npm báo 14 advisory ở dependency tree trong lần cài package (4 low, 8 moderate, 2 high). Chưa chạy `npm audit fix` vì có thể làm thay đổi phiên bản ngoài phạm vi build này.
- electron-builder dùng icon mặc định vì project chưa có icon riêng.
- Giao diện và vùng soạn mã dùng Roboto được đóng gói trong app; công thức toán vẫn dùng font glyph chuyên dụng của KaTeX.
