# Đặc tả người dùng

## Người dùng mục tiêu

Người ra đề hoặc giáo viên dạy lập trình thi đấu, cần soạn đề, tạo generator C++17, kiểm tra lời giải và đóng gói testcase. Người dùng có thể nhờ AI tạo bản nháp nhưng cần xem lại và chỉnh sửa trước khi sử dụng.

## Nhu cầu chính

- Soạn đề từ ý tưởng hoặc trích nội dung từ ảnh.
- Tạo và chỉnh sửa generator, lời giải C++17.
- Sinh testcase, chạy lời giải và xuất bộ đề.
- Cấu hình OpenAI hoặc Gemini để dùng các chức năng AI.

## Tạo và chỉnh sửa mã C++17

- **Test Plan:** Người dùng tạo hoặc nhờ AI phân tích đề để lập nhóm test, chọn mode `random`, `boundary`, `constructive`, `stress`, số lượng và tham số. Có thể sửa plan mà không cần AI.
- **Generator:** Người dùng dùng template, tự viết hoặc nhờ AI tạo bản nháp, sau đó xem và sửa mã. Ứng dụng đóng gói `testlib.h`, chạy riêng từng testcase với seed ở `argv[1]` và tùy chọn dạng `--testIndex=...`, `--mode=...`, `--n_min=...`. Generator in đúng một input ra `stdout`. Input được kiểm tra validator tùy chọn và đối chiếu SHA-256; test trùng được thử sinh bù có giới hạn.
- **Lời giải:** Người dùng tự viết hoặc nhờ AI tạo lời giải tham khảo C++17, có thể chỉnh sửa trước khi biên dịch. Ứng dụng chạy lại trên input đã có và lưu output. Có thể thêm oracle độc lập để đối chiếu token; `GENERATED` có output mới nhưng chưa xác minh, `VERIFIED` khớp oracle.
- Sửa đề hoặc generator giữ lại testcase cũ và đánh dấu input cũ; sửa lời giải đánh dấu output cũ để chạy lại.

## Prompt AI

Prompt được quản lý tại `src/shared/ai-prompts.ts`; version prompt hiện tại là `2.0.0`.

- **Đọc ảnh:** Đọc và chuyển toàn bộ nội dung đề lập trình trong ảnh thành Markdown có thể chỉnh sửa. Giữ nguyên công thức dưới dạng LaTeX. Không tự suy đoán phần không rõ; ghi `[không rõ]` tại vị trí đó. Chỉ trả về nội dung đề.
- **Soạn đề:** Bạn là người biên soạn đề lập trình thi đấu. Từ ý tưởng bên dưới, hãy soạn một đề bài hoàn chỉnh bằng tiếng Việt, trình bày bằng Markdown. Nếu phù hợp, gồm tên bài, mô tả, dữ liệu vào, dữ liệu ra, ràng buộc, ví dụ và giải thích ví dụ. Không thêm lời chào hay lời dẫn ngoài đề. Không tự bịa quy tắc, giới hạn hoặc kết quả không có cơ sở từ ý tưởng; chỗ cần người dùng xác nhận ghi `[Cần xác nhận: ...]`. Nội dung ý tưởng được chèn tại `${idea}`.
- **Test Plan:** Phân tích đề, trả JSON theo schema `problemSpec` và các nhóm `name`, `description`, `mode`, `count`, `params`; không tự bịa ràng buộc.
- **Generator:** Dùng `testlib.h`, `registerGen` và `opt<T>()`; sinh đúng một input theo Test Plan, không sinh đáp án và không tự xử lý dedup. Electron truyền seed cùng `testIndex`, `mode` và params dạng named option. Không TODO hay mã giả; chỉ trả mã C++ trong code block.
- **Validator:** Kiểm tra định dạng và ràng buộc của một input; cần người dùng rà soát vì validator AI có thể chưa bao phủ đủ điều kiện.
- **Lời giải:** Viết lời giải tham khảo C++17 hoàn chỉnh, đúng theo đề và ràng buộc. Không TODO hay mã giả; chỉ trả mã C++ trong code block.
- **Thử kết nối:** Trả lời ngắn gọn: kết nối thành công.
