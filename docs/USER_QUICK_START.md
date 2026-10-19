# Hướng dẫn nhanh CP Test Studio 1.0.0

## Cài đặt

1. Tải và chạy bộ cài [CP Test Studio 1.0.0](LINK_MSI).
2. Tải [bộ công cụ CP Test Studio](LINK_TOOLS_ZIP), giải nén và giữ nguyên cấu trúc thư mục.
3. Mở **Cài đặt** trong ứng dụng: chọn `mingw64\bin\g++.exe` ở mục **Compiler C++** và chọn thư mục `document-export` ở mục **Xuất tài liệu**.
4. AI là tùy chọn. Nếu dùng Gemini, tạo API key theo [video hướng dẫn](LINK_VIDEO_GEMINI_API_KEY), rồi nhập key trong **Cài đặt → Trợ lý AI**.

## Tạo và xuất bài thi

1. Chọn **Bài thi → Bài thi mới**, nhập đề hoặc dùng AI soạn đề.
2. Đi lần lượt qua **Test Plan → Generator → Lời giải**. Xem lại nội dung, biên dịch mã C++17 và chỉnh sửa nếu cần.
3. Sang **Kiểm tra**, chạy testcase và xem input/output.
4. Sang **Xuất bộ đề**, chọn nơi lưu. Ứng dụng tạo file lời giải `.cpp` và bộ testcase dùng cho Themis. Chọn **Mở thư mục đã lưu** để xem kết quả.

## Video và tài liệu

- [Cài đặt ứng dụng và import công cụ](LINK_VIDEO_INSTALL_IMPORT)
- [Soạn đề, tạo testcase và xuất Themis](LINK_VIDEO_USAGE_THEMIS)
- [Tạo API key Gemini](LINK_VIDEO_GEMINI_API_KEY)
- [Xử lý khi Windows chặn ứng dụng hoặc công cụ](LINK_VIDEO_SMART_APP_CONTROL)
- [Tài liệu xây dựng ứng dụng](LINK_BUILD_DOCUMENT)

Thay từng `LINK_...` bằng link chia sẻ Drive tương ứng. Không cần đưa file **Note** vào hướng dẫn.
