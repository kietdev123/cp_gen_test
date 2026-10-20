const testlibRandomApiGuidance = [
  'Quy tắc API ngẫu nhiên của Testlib (áp dụng nghiêm ngặt): `rnd` là `random_t`, không phải Python `random` hay API của thư viện khác.',
  'Dùng `rnd.next()` hoặc các overload `rnd.next(n)`, `rnd.next(from, to)` để sinh giá trị; dùng `rnd.any(container)` để chọn phần tử từ một container STL đã khai báo.',
  'Ví dụ chọn ngẫu nhiên dấu: `int sign = rnd.next(0, 1) == 0 ? -1 : 1;`. Nếu chọn từ danh sách, hãy tạo `std::vector<T>` rõ ràng rồi gọi `rnd.any(vector)`; không truyền initializer list trực tiếp.',
  'Không được gọi hoặc tự suy đoán `rnd.choice`, `rnd.randint`, `rnd.pick` hay phương thức không có trong `vendor/testlib/testlib.h`. Trước khi trả mã, rà soát từng lời gọi `rnd.` để chắc chắn tên hàm và kiểu đối số đúng với Testlib.',
].join('\n');

export const AI_PROMPTS = {
  imageToStatement: () =>
    `Đọc và chuyển toàn bộ nội dung đề lập trình trong ảnh thành Markdown có thể chỉnh sửa. Giữ nguyên công thức dưới dạng LaTeX. Không tự suy đoán phần nội dung bài toán không rõ; ghi [không rõ] tại vị trí đó. Hãy tự xác định chế độ nhập/xuất dựa trên đặc tả trong ảnh: chọn "file-io" nếu đề nêu rõ đọc input/ghi output bằng file; chọn "stdin-stdout" nếu đề nêu luồng chuẩn hoặc không chỉ rõ file I/O (mặc định của đề lập trình thi đấu). Trả về trường ioMode với đúng một trong hai giá trị này. Nội dung statement phải giữ đúng cách nhập/xuất đã nhận diện; nếu dùng file, tên file trong statement phải trùng với themisInputFile và themisOutputFile. Đề xuất tên file Themis dựa trên tên bài trong cả hai trường hợp. Tiền tố testcase Themis luôn cố định là TEST, không cần trả về trong JSON. Chỉ trả về một JSON hợp lệ theo cấu trúc {"statement":"Nội dung đề bằng Markdown","ioMode":"stdin-stdout","themisInputFile":"BAI.INP","themisOutputFile":"BAI.OUT"}. Giá trị ioMode chỉ được là "stdin-stdout" hoặc "file-io". Tên file input/output dùng chung tên cơ sở, lần lượt có đuôi .INP và .OUT; dùng ký tự ASCII, không dấu.`,

  statementFromIdea: (idea: string) =>
    `Bạn là người biên soạn đề lập trình thi đấu. Từ ý tưởng bên dưới, hãy soạn một đề bài hoàn chỉnh bằng tiếng Việt, trình bày bằng Markdown. Nếu phù hợp, gồm: tên bài, mô tả, dữ liệu vào, dữ liệu ra, ràng buộc, ví dụ và giải thích ví dụ. Không thêm lời chào hay lời dẫn ngoài đề. Không tự bịa quy tắc, giới hạn hoặc kết quả không có cơ sở từ ý tưởng; chỗ nào cần người dùng xác nhận thì ghi rõ [Cần xác nhận: ...]. Hãy suy luận chế độ nhập/xuất từ ý tưởng: chọn "file-io" nếu yêu cầu nói rõ input/output được đọc/ghi bằng file; nếu ý tưởng nói stdin/stdout thì chọn "stdin-stdout"; nếu không nói rõ thì dùng "stdin-stdout" vì đó là mặc định của đề lập trình thi đấu. Trả về trường ioMode với đúng một trong hai giá trị này. Viết phần nhập/xuất trong statement nhất quán với chế độ đã chọn; nếu dùng file, tên file trong statement phải trùng với themisInputFile và themisOutputFile. Đồng thời đề xuất tên file Themis dựa trên tên bài. Tiền tố testcase Themis luôn cố định là TEST, không cần trả về trong JSON. Chỉ trả về một JSON hợp lệ theo cấu trúc {"statement":"Nội dung đề bằng Markdown","ioMode":"stdin-stdout","themisInputFile":"TEN_BAI.INP","themisOutputFile":"TEN_BAI.OUT"}. Giá trị ioMode chỉ được là "stdin-stdout" hoặc "file-io". Tên file input/output dùng chung tên cơ sở, lần lượt có đuôi .INP và .OUT; dùng ký tự ASCII, không dấu.\n\nÝ tưởng bài toán:\n${idea}`,

  testPlan:
    'Phân tích đề lập trình thi đấu dưới đây và chỉ trả về một JSON hợp lệ theo cấu trúc: {"problemSpec":{"summary":"...","inputFormat":"...","outputFormat":"...","constraints":["..."]},"groups":[{"name":"...","description":"...","mode":"random|boundary|constructive|stress","count":1,"params":{"n_min":"1","n_max":"100"}}]}. Đề xuất nhóm test đa dạng, tổng count không vượt quá 100. Không tự bịa dữ kiện hay ràng buộc; nếu thiếu thông tin, ghi rõ trong summary/description và để params trống. Chỉ dùng tham số có thể truyền dưới dạng key=value cho generator. Đề bài:\n\n${statement}',

  generator:
    [
      'Viết generator C++17 hoàn chỉnh, độc lập, tạo đúng một input hợp lệ theo đề và Test Plan. Dùng `#include "testlib.h"`, gọi `registerGen(argc, argv, 1)`, đọc `testIndex` bằng `opt<int>("testIndex", 1)`, `mode` bằng `opt<std::string>("mode", "random")`, và tham số nhóm bằng `opt<T>("<tên_tham_số>", giá_trị_mặc_định)`. Gọi `suppressEnsureNoUnusedOpts()` sau khi đọc các tùy chọn vì Electron có thể truyền thêm tham số của nhóm. Seed được Electron truyền làm argv[1]; mỗi lần chạy là một testcase riêng. Hỗ trợ mode `random`, `boundary`, `constructive`, `stress`; dùng testIndex/mode/params phù hợp với nhóm.',
      testlibRandomApiGuidance,
      'In duy nhất input ra stdout. Không tạo output đáp án, không tự quản lý vòng lặp nhiều testcase, không để TODO hay mã giả. Chỉ trả mã C++ trong một code block. Đề và Test Plan sẽ được cung cấp sau hướng dẫn này.',
    ].join('\n\n'),

  solution: (ioMode: 'stdin-stdout' | 'file-io', inputFile: string, outputFile: string) =>
    [
      'Bạn là chuyên gia lập trình thi đấu. Phân tích đề bài và tạo đồng thời Reference Solution C++17 để sinh output chuẩn và Editorial bằng tiếng Việt giải thích chính xác thuật toán đã cài trong chính solution đó. Hai phần phải dùng cùng một thuật toán; hãy rà soát và sửa mọi mâu thuẫn trước khi trả lời.',
      ioMode === 'file-io'
        ? `Bài này dùng File Input / File Output. Solution phải đọc từ file '${inputFile}' và ghi kết quả vào file '${outputFile}' bằng freopen hoặc fstream; không đọc stdin hoặc ghi đáp án ra stdout. Editorial cần ghi đúng chế độ và tên file này.`
        : 'Bài này dùng Standard Input / Standard Output (stdin/stdout). Solution phải đọc stdin và ghi kết quả ra stdout; không dùng file I/O. Editorial cần nêu đúng chế độ này.',
      'Solution phải hoàn chỉnh, đúng đề và ràng buộc, dùng cú pháp GNU++98 để tương thích GCC 4.8.1 mặc định của Themis và cũng biên dịch như chương trình C++17, không cần cờ riêng. Không dùng tính năng C++11 trở lên như range-based for, lambda, nullptr, initializer list, auto suy luận kiểu, std::string::back()/front(), stoi, to_string, emplace_back hoặc structured bindings. Khi lấy ký tự cuối chuỗi, kiểm tra chuỗi không rỗng rồi dùng s[s.size() - 1]. Không để TODO hay mã giả.',
      'Editorial cần có: ý tưởng/quan sát, thuật toán theo đúng các bước trong solution, chứng minh tính đúng đắn, độ phức tạp thời gian và bộ nhớ (nêu rõ ký hiệu), cùng các trường hợp biên quan trọng. Không khẳng định solution đã được biên dịch, chạy hay kiểm chứng bằng thực thi; chỉ nói điều đó nếu có bằng chứng thực tế được cung cấp.',
      'Dùng Test Plan và generator chỉ làm ngữ cảnh để hiểu dữ liệu cần bao phủ; nếu khác đề thì đề bài là đặc tả có thẩm quyền. Chỉ trả về một JSON hợp lệ, không markdown fence hay văn bản ngoài JSON, theo cấu trúc {"solution":"mã C++ hoàn chỉnh","editorial":"hướng dẫn giải Markdown"}. Escaping chuỗi JSON phải hợp lệ.',
    ].join('\n\n'),

  validator:
    'Viết validator C++17 đọc một input từ stdin, kiểm tra đúng định dạng và mọi ràng buộc của đề. Thoát mã 0 nếu hợp lệ, mã khác 0 nếu không hợp lệ; ghi lý do ngắn vào stderr. Không sửa input, không sinh output đáp án, không để TODO hay mã giả. Chỉ trả mã C++ trong một code block.',

  codeFix:
    [
      'Sửa tất cả lỗi biên dịch được nêu trong diagnostics cho mã C++17 dưới đây. Giữ nguyên thuật toán, định dạng input/output và ý định của chương trình; chỉ sửa những gì cần thiết. Nếu đây là generator dùng Testlib, chỉ dùng API thực sự có trong `vendor/testlib/testlib.h`; đặc biệt `random_t` không có `choice()`. Dùng `rnd.next(...)` để sinh số hoặc `rnd.any(container)` với container STL đã khai báo để chọn phần tử. Không thay lỗi bằng một API tự suy đoán khác. Rà soát lại mã đã sửa để tránh lỗi biên dịch tương tự. Chỉ trả mã C++ hoàn chỉnh trong một code block, không kèm giải thích.',
      'Lỗi biên dịch:\n${diagnostics}\n\nMã nguồn:\n${source}',
      testlibRandomApiGuidance,
    ].join('\n\n'),

  quick:
    [
      'Tạo một Test Plan và generator C++17 từ đề bài. Chỉ trả về JSON hợp lệ theo cấu trúc {"testPlan":{"problemSpec":{"summary":"...","inputFormat":"...","outputFormat":"...","constraints":["..."]},"groups":[{"name":"...","description":"...","mode":"random|boundary|constructive|stress","count":1,"params":{}}]},"generator":"..."}. Generator phải dùng `testlib.h`, `registerGen(argc, argv, 1)`, `opt<T>()`, `suppressEnsureNoUnusedOpts()`, sinh đúng một input ra stdout cho mỗi lần chạy, nhận mode/testIndex/params từ Electron; không sinh output đáp án. Không tự bịa dữ kiện hoặc ràng buộc.',
      testlibRandomApiGuidance,
      'Đề bài:\n\n${statement}',
    ].join('\n\n'),

  connectionTest: 'Trả lời ngắn gọn: kết nối thành công.',
} as const;

export const AI_PROMPT_VERSION = '2.8.0';
