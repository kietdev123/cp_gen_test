export const AI_PROMPTS = {
  imageToStatement:
    'Đọc và chuyển toàn bộ nội dung đề lập trình trong ảnh thành Markdown có thể chỉnh sửa. Giữ nguyên công thức dưới dạng LaTeX. Không tự suy đoán phần không rõ; ghi [không rõ] tại vị trí đó. Chỉ trả về nội dung đề.',

  statementFromIdea: (idea: string) =>
    `Bạn là người biên soạn đề lập trình thi đấu. Từ ý tưởng bên dưới, hãy soạn một đề bài hoàn chỉnh bằng tiếng Việt, trình bày bằng Markdown. Nếu phù hợp, gồm: tên bài, mô tả, dữ liệu vào, dữ liệu ra, ràng buộc, ví dụ và giải thích ví dụ. Không thêm lời chào hay lời dẫn ngoài đề. Không tự bịa quy tắc, giới hạn hoặc kết quả không có cơ sở từ ý tưởng; chỗ nào cần người dùng xác nhận thì ghi rõ [Cần xác nhận: ...].\n\nÝ tưởng bài toán:\n${idea}`,

  testPlan:
    'Phân tích đề lập trình thi đấu dưới đây và chỉ trả về một JSON hợp lệ theo cấu trúc: {"problemSpec":{"summary":"...","inputFormat":"...","outputFormat":"...","constraints":["..."]},"groups":[{"name":"...","description":"...","mode":"random|boundary|constructive|stress","count":1,"params":{"n_min":"1","n_max":"100"}}]}. Đề xuất nhóm test đa dạng, tổng count không vượt quá 100. Không tự bịa dữ kiện hay ràng buộc; nếu thiếu thông tin, ghi rõ trong summary/description và để params trống. Chỉ dùng tham số có thể truyền dưới dạng key=value cho generator. Đề bài:\n\n${statement}',

  generator:
    'Viết generator C++17 hoàn chỉnh, độc lập, tạo đúng một input hợp lệ theo đề và Test Plan. Dùng `#include "testlib.h"`, gọi `registerGen(argc, argv, 1)`, đọc `testIndex` bằng `opt<int>("testIndex", 1)`, `mode` bằng `opt<std::string>("mode", "random")`, và tham số nhóm bằng `opt<T>("<tên_tham_số>", giá_trị_mặc_định)`. Gọi `suppressEnsureNoUnusedOpts()` sau khi đọc các tùy chọn vì Electron có thể truyền thêm tham số của nhóm. Seed được Electron truyền làm argv[1]; mỗi lần chạy là một testcase riêng. Hỗ trợ mode `random`, `boundary`, `constructive`, `stress`; dùng testIndex/mode/params phù hợp với nhóm. In duy nhất input ra stdout. Không tạo output đáp án, không tự quản lý vòng lặp nhiều testcase, không để TODO hay mã giả. Chỉ trả mã C++ trong một code block. Đề và Test Plan sẽ được cung cấp sau hướng dẫn này.',

  solution:
    'Viết lời giải tham khảo C++17 hoàn chỉnh, đúng theo đề và các ràng buộc. Dùng Test Plan và generator từ bước trước làm ngữ cảnh để bao phủ dữ liệu; đề bài là đặc tả ưu tiên nếu thông tin mâu thuẫn. Không để TODO hay mã giả. Chỉ trả về mã C++ trong một code block.',

  validator:
    'Viết validator C++17 đọc một input từ stdin, kiểm tra đúng định dạng và mọi ràng buộc của đề. Thoát mã 0 nếu hợp lệ, mã khác 0 nếu không hợp lệ; ghi lý do ngắn vào stderr. Không sửa input, không sinh output đáp án, không để TODO hay mã giả. Chỉ trả mã C++ trong một code block.',

  codeFix:
    'Sửa lỗi biên dịch trong mã C++17 dưới đây. Giữ nguyên thuật toán và ý định nếu có thể; chỉ sửa những gì cần thiết. Chỉ trả về mã C++ trong một code block.\n\nLỗi biên dịch:\n${diagnostics}\n\nMã nguồn:\n${source}',

  quick:
    'Tạo một Test Plan và generator C++17 từ đề bài. Chỉ trả về JSON hợp lệ theo cấu trúc {"testPlan":{"problemSpec":{"summary":"...","inputFormat":"...","outputFormat":"...","constraints":["..."]},"groups":[{"name":"...","description":"...","mode":"random|boundary|constructive|stress","count":1,"params":{}}]},"generator":"..."}. Generator phải dùng testlib.h, registerGen(argc, argv, 1), opt<T>(), suppressEnsureNoUnusedOpts(), sinh đúng một input ra stdout cho mỗi lần chạy, nhận mode/testIndex/params từ Electron; không sinh output đáp án. Không tự bịa dữ kiện hoặc ràng buộc. Đề bài:\n\n${statement}',

  connectionTest: 'Trả lời ngắn gọn: kết nối thành công.',
} as const;

export const AI_PROMPT_VERSION = '2.1.0';
