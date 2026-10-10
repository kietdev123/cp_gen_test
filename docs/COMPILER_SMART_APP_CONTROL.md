# Lỗi GCC do Smart App Control

## Triệu chứng

Ở bước **Sinh testcase**, GCC báo không chạy được `collect2.exe`:

```text
g++.exe: fatal error: cannot execute '.../collect2.exe': CreateProcess: No such file or directory
```

Ứng dụng gọi `g++.exe` để biên dịch Generator C++17. Khi liên kết file `.exe`, GCC gọi `collect2.exe` nội bộ. Vì vậy lỗi xảy ra trước khi testcase được sinh; source Generator không nhất thiết là nguyên nhân.

## Nguyên nhân đã xác nhận trên máy gặp lỗi

- `collect2.exe` có tồn tại trong toolchain MinGW-w64 đã chọn ở **Cài đặt → Compiler C++**.
- Nhật ký **CodeIntegrity/Operational** có sự kiện 3077 và 3033, cho biết Windows chặn file này do chính sách toàn vẹn mã.
- Smart App Control đang ở chế độ **On**. Máy là máy cá nhân, không tham gia domain; tính năng này vẫn có thể bật trên máy cá nhân.
- Giá trị registry trước đó là `2` (Evaluation), hiện là `1` (On). Điều này phù hợp với việc chuyển sang chế độ thực thi, nhưng nhật ký đã xem không xác định chính xác thời điểm chuyển.

Do đó, thông báo “No such file” gây hiểu nhầm: file có mặt nhưng Windows không cho tiến trình chạy. Không có bằng chứng cho thấy riêng lỗi này là do đề bài, project hay mã Generator.

## Cách xử lý

1. **Cần chạy lại ngay:** mở **Windows Security → App & browser control → Smart App Control settings**. Nếu đang On, có thể chuyển Off rồi mở lại CP Test Studio. Thao tác này giảm bảo vệ trên toàn máy; cân nhắc trước khi đổi.
2. **Muốn giữ Smart App Control:** dùng toolchain mà các file thực thi cần thiết được ký số bởi chứng thư Windows tin cậy hoặc được Microsoft đánh giá là an toàn. Chỉ đổi sang GCC tải từ nguồn khác không đảm bảo hết lỗi.
3. **MSYS2 UCRT64:** là nguồn GCC chính thức, đáng tin để dùng, nhưng chữ ký gói của MSYS2 không đồng nghĩa với chữ ký Authenticode của từng `.exe`. Đã có báo cáo về Smart App Control chặn `collect2.exe` của MSYS2, nên chưa thể xem đây là cách sửa đã xác nhận.

Microsoft hiện không cung cấp ngoại lệ Smart App Control cho riêng một ứng dụng. Tài liệu Microsoft cũng nêu các bản Windows mới có thể hỗ trợ bật lại tính năng sau khi tắt; hãy kiểm tra tùy chọn thực tế trên máy trước khi đổi trạng thái.

## Tham khảo

- [Smart App Control FAQ — Microsoft Support](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions)
- [Smart App Control overview — Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview)
- [Cài GCC bằng MSYS2 — mingw-w64](https://www.mingw-w64.org/getting-started/msys2/)
- [Ký gói MSYS2](https://www.msys2.org/wiki/Signing-packages/)
- [Báo cáo collect2 bị Smart App Control chặn trong MSYS2 — Microsoft Q&A](https://learn.microsoft.com/en-gb/answers/questions/4266990/windows-securitys-smart-app-control-is-blocking-a)
