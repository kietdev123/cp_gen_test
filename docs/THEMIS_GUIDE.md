# Hướng dẫn làm việc với Themis

Tài liệu này được tổng hợp từ tab **Hướng dẫn** của Themis đang cài trên máy (20/10/2026). Dùng làm ghi chú cho agent khi tạo cấu trúc bài, cấu hình I/O và kiểm tra kết quả trong Themis.

## Cấu trúc kỳ thi

Themis nạp các bài thi từ thư mục `Tasks`; mỗi bài là một thư mục con. Mỗi bài có thư mục con cho từng testcase. Thư mục bài làm thí sinh là `Contestants`; mỗi thí sinh có một thư mục riêng chứa file bài làm đặt theo tên bài.

```text
Tasks/
  SUMSTD/
    TEST01/
      SUMSTD.INP
      SUMSTD.OUT
  SUMFILE/
    TEST01/
      SUMFILE.INP
      SUMFILE.OUT
Contestants/
  BOT/
    SUMSTD.cpp
    SUMFILE.cpp
```

Mỗi test có thư mục riêng. File dữ liệu, file kết quả chuẩn và file phụ trợ (nếu có) được đặt trong thư mục test. Tên bài quyết định tên file source của thí sinh: ví dụ bài `SUMSTD` cần `SUMSTD.cpp`.

## Hai kiểu nhập/xuất

Hai kiểu I/O dùng **cùng cấu trúc thư mục test và cùng cặp file dữ liệu/kết quả**. Khác biệt nằm ở cấu hình bài thi và cách chương trình thí sinh đọc/ghi:

| Chế độ | File dữ liệu | Dùng luồng vào chuẩn | File kết quả | Dùng luồng ra chuẩn |
|---|---|---:|---|---:|
| stdin/stdout | `TENBAI.INP` | Bật | `TENBAI.OUT` | Bật |
| File Input / File Output | `TENBAI.INP` | Tắt | `TENBAI.OUT` | Tắt |

Trong **Cấu hình bài thi**, danh sách tên file dữ liệu và kết quả nằm trong thư mục từng test. Nếu có nhiều file, ghi tên cách nhau bằng `|`. Khi bật **Dùng luồng vào chuẩn**, Themis chuyển file dữ liệu đầu tiên thành stdin. Khi bật **Dùng luồng ra chuẩn**, Themis chuyển stdout vào file kết quả đầu tiên. Nếu tắt các tùy chọn này, chương trình dùng file theo tên đã cấu hình; stdin/stdout mặc định trỏ tới thiết bị đầu cuối.

Với File Input / File Output, lời giải phải đọc đúng file `.INP` và ghi đúng file `.OUT` (thường dùng `freopen` hoặc `ifstream`/`ofstream`). Themis chép file test vào thư mục chạy trước khi chấm và so sánh file kết quả chương trình tạo với file kết quả chuẩn trong test.

## Nạp bài và chấm thử

1. Chuẩn bị thư mục `Tasks` theo cấu trúc trên. Mỗi bài có ít nhất một `TESTxx` với input và output chuẩn.
2. Trong Themis, tạo hoặc mở kỳ thi. Ở tab **Bảng điểm**, chọn **Bài thi → Nạp danh sách bài thi** (F2), rồi chọn thư mục `Tasks`. Nạp bài thi mới sẽ xóa bảng điểm hiện tại; dùng kỳ thi thử riêng khi có dữ liệu cần giữ.
3. Mở cấu hình từng bài (menu **Bài thi** hoặc chuột phải tiêu đề cột). Đặt tên file dữ liệu và kết quả, bật/tắt hai tùy chọn luồng chuẩn theo bảng trên. Chọn bộ chấm văn bản, chẳng hạn `C4WordsCase`, nếu cần so sánh từ có phân biệt hoa/thường; `C3WordsIgnoreCase` bỏ qua hoa/thường. `C5Binary` so sánh từng byte.
4. Nạp thư mục thí sinh bằng **Thí sinh → Nạp danh sách thí sinh** (F3). Thư mục con, ví dụ `BOT`, là tên thí sinh; bên trong đặt source trùng tên từng bài.
5. Kiểm tra cấu hình compiler tại **Chấm bài → Đặt cấu hình bộ dịch** (F6). Mỗi lệnh dịch cần tạo file chạy `<TênBài>.EXE` trong thư mục làm việc mà Themis chỉ định.
6. Chọn bài và thí sinh cần chấm rồi dùng chức năng **Chấm bài**. Kiểm tra trạng thái và điểm trong bảng. Nếu thay đổi cấu hình bài sau khi chấm, cấu hình lại và chấm lại để kết quả phản ánh thiết lập mới.

Có thể nạp Tasks hoặc Contestants bằng cách kéo thả thư mục tương ứng vào vùng bảng điểm. F4 cập nhật danh sách bài khi cấu trúc Tasks thay đổi; F5 cập nhật danh sách thí sinh.

## Quy trình thao tác nhanh đã kiểm chứng trên máy này

Đã thực hiện trên Themis cài tại máy ngày 20/10/2026 với fixture trong `examples/themis-io-modes/`:

1. Nếu bảng điểm đã có cột `SUMSTD`, `SUMFILE` và thí sinh `BOT`, **không nạp lại F2/F3**. Chọn dòng thí sinh cần kiểm tra và nhấn **F9** để chấm. Kiểm tra từng cột bài và tổng điểm; fixture này cho `SUMSTD` 1.00, `SUMFILE` 1.00, tổng 2.00.
2. Chỉ khi danh sách bài chưa có hoặc cần thay đổi thì dùng **F2** và chọn thư mục `examples/themis-io-modes/Tasks`. F2 nạp lại bài sẽ xóa điểm cũ; Themis có thể hiện hộp xác nhận.
3. Xác nhận cấu hình một lần cho từng task: chuột phải tiêu đề cột → **Cấu hình bài thi**. Cả hai dùng `SUMxxx.INP` và `SUMxxx.OUT`, bộ chấm `C1LinesWordsIgnoreCase.dll`. Với `SUMSTD`, bật cả **Dùng luồng vào chuẩn** và **Dùng luồng ra chuẩn**. Với `SUMFILE`, tắt cả hai. Nhấn **Ghi nhận** và xác nhận xóa điểm cũ nếu Themis hỏi.
4. Chỉ khi thí sinh chưa được nạp hoặc source đã đổi thì dùng **F3**, chọn `examples/themis-io-modes/Contestants`. Thư mục con `BOT` là tên thí sinh.
5. Chọn `BOT`, nhấn **F9**, đợi biên dịch/chấm hoàn tất rồi đọc điểm trong bảng. F6 chỉ cần mở nếu Themis báo lỗi biên dịch hoặc chưa có compiler phù hợp; lần kiểm chứng này dùng cấu hình C++ có sẵn của Themis.

Trước khi thao tác, lấy một ảnh/trạng thái cửa sổ để biết kỳ thi, task và thí sinh đang được nạp. Trạng thái UI có thể còn nguyên nếu cửa sổ Themis vẫn mở, nhưng không được giả định nó còn nguyên ở lần gọi sau. Nếu bảng vẫn có đúng hai cột và dòng `BOT`, đường chạy nhanh là chọn dòng rồi F9; không cần mở lại hướng dẫn, tìm thư mục, hay cấu hình checkbox lần nữa. Nếu đã đóng Themis hoặc nạp kỳ thi khác, dùng các bước F2/F3 ở trên.

Hộp chọn thư mục mở dạng dialog Windows. Có thể đi nhanh bằng cách chọn trường **Folder**, nhập đường dẫn đầy đủ tới `Tasks` hoặc `Contestants`, rồi bấm **OK**, thay vì mở từng cấp thư mục trong cây.

## Lưu ý khi thử khác biệt I/O

- Dùng cùng một input, đáp án chuẩn và thuật toán ở hai bài riêng, ví dụ `SUMSTD` và `SUMFILE`.
- Source `SUMSTD.cpp` đọc `cin` và ghi `cout`; cấu hình bật cả hai luồng chuẩn.
- Source `SUMFILE.cpp` mở `SUMFILE.INP` và `SUMFILE.OUT`; cấu hình tắt cả hai luồng chuẩn.
- Nếu cả hai đều được điểm tối đa với cùng test, Themis dùng được cả hai chế độ. Bộ test không cần chuyển đổi định dạng giữa hai kiểu.
- Lưu ý tên bài, tên source, tên input/output và tên trong cấu hình phải khớp chính xác; Windows thường không phân biệt hoa/thường nhưng nên giữ thống nhất.

## Tài liệu gốc trên máy

Tab **Hướng dẫn** trong Themis mở tài liệu cài đặt tại `C:\Program Files (x86)\Themis\~Documentation\themis.html`. Các phần liên quan: **Chuẩn bị một kỳ thi**, **Nạp danh sách bài thi**, **Cấu hình bài thi**, **Nạp danh sách thí sinh**, **Đặt cấu hình bộ dịch**, và **Chấm bài**.
