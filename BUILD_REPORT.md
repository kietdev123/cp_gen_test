# Build report

Ngày cập nhật: 2026-10-09

## CP Test Studio V2 — xác nhận source

- `npm run typecheck` — **exit code 0** sau khi bổ sung Test Plan, Testlib generator, validator, dedup/retry, runner, cache và export review.
- `npm run build` — **exit code 0**; electron-vite tạo thành công bundle main, preload và renderer.
- Build in warning từ hai comment annotation trong Zod mà Rollup không diễn giải được; Rollup bỏ các comment này. Không có lỗi build.
- Monaco Editor và worker được bundle offline; không tải editor từ CDN. `npm install` báo 16 advisory trong dependency tree (6 low, 8 moderate, 2 high); không tự chạy `npm audit fix`.
- Không gọi OpenAI/Gemini thật, không chạy generator/solution mẫu và không chạy functional/E2E test theo giới hạn kiểm thử.
- App chưa có sandbox OS hoặc giới hạn RAM. Xem [docs/TEST_GENERATION_V2.md](docs/TEST_GENERATION_V2.md) để biết các giới hạn V2.

## Follow-up — generator prompt, loading overlay và runner EOF

- `npm run typecheck` — **exit code 0**.
- `npm run build` — **exit code 0**; renderer/main/preload bundle thành công. Còn warning annotation của Zod như trên.
- Generator mặc định được nhận diện là starter nên bước này hỏi người dùng dùng AI hay tự nhập. Busy overlay đặt giữa màn hình và vô hiệu hóa phần còn lại của app.
- Runner bắt lỗi stream `EPIPE`/`EOF` khi chương trình con đóng stdin sớm, tránh lỗi JavaScript uncaught trong main process.
- Không chạy thao tác chức năng hoặc E2E; checklist kiểm tra thủ công được bổ sung tại [docs/MANUAL_TEST.md](docs/MANUAL_TEST.md).

Ngày build: 2026-10-08

## Cập nhật source xuất tài liệu

- DOCX/PDF chuyển Markdown bằng Pandoc 3.12.1; PDF dùng Typst 0.15.1 và font Roboto. Script chuẩn bị tải binary theo phiên bản ghim, xác minh SHA-256 và đưa license vào tài nguyên ứng dụng.
- Smoke check từ Markdown tiếng Việt có công thức inline/khối và `<br>`: DOCX có OOXML Equation và line break; PDF hợp lệ khổ A4, đã render để kiểm tra bố cục.
- `npm run typecheck` và `npm run build` — **exit code 0** sau cập nhật.
- Cấu hình `npm run dist:win:installer` tạo mục tiêu MSI x64; chưa chạy lệnh này.

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
- Build lịch sử trong Docker chỉ tạo ZIP portable. Source hiện cấu hình `npm run dist:win:installer` để tạo MSI trên Windows; mục tiêu MSI chưa được chạy.
- Trình nhập mã hiện dùng vùng soạn thảo văn bản thường; chưa có Monaco, tô màu cú pháp hoặc gợi ý mã.

## Ghi chú build

- Lần build renderer đầu tiên chỉ ra `index.html` cần nằm trong `src/renderer`; đã chuyển file và cập nhật entry point Electron, các lần build sau thành công.
- npm báo 14 advisory ở dependency tree trong lần cài package (4 low, 8 moderate, 2 high). Chưa chạy `npm audit fix` vì có thể làm thay đổi phiên bản ngoài phạm vi build này.
- electron-builder dùng icon mặc định vì project chưa có icon riêng.
- Giao diện và vùng soạn mã dùng Roboto được đóng gói trong app; công thức toán vẫn dùng font glyph chuyên dụng của KaTeX.
