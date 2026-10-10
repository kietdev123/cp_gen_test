# Tải công cụ riêng

MSI không chứa GCC/MinGW, Pandoc, Typst hoặc Roboto. Build MSI vì thế không tải các gói lớn. Tải các file chính chủ sau và kiểm tra SHA-256 trước khi chia sẻ qua Drive.

| Thành phần | Tải xuống | SHA-256 |
|---|---|---|
| GCC 16.1.0 + MinGW-w64 x64 UCRT r2 | [ZIP](https://github.com/brechtsanders/winlibs_mingw/releases/download/16.1.0posix-14.0.0-ucrt-r2/winlibs-x86_64-posix-seh-gcc-16.1.0-mingw-w64ucrt-14.0.0-r2.zip) | `78eff1e2e804b6a6320c713f084b8f820c662104a24cea6a3bfcab82032bdd60` |
| Pandoc 3.12.1 | [ZIP](https://github.com/jgm/pandoc/releases/download/3.12.1/pandoc-3.12.1-windows-x86_64.zip) | `6ef431cb20b2c24a0371fc19200dc49d452be54b1b5c9239f3462841ef53e587` |
| Typst 0.15.1 | [ZIP](https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-pc-windows-msvc.zip) | `19ce3551153c2fe7ee9fa2f95208310c8f4d3209fedb699e0333faf8913f6736` |
| Roboto variable font | [TTF](https://raw.githubusercontent.com/google/fonts/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf) | `d7598e12c5dbef095ff8272cfc55da0250bd07fbdecbac8a530b9b277872a134` |
| Pandoc license | [COPYING.md](https://raw.githubusercontent.com/jgm/pandoc/3.12.1/COPYING.md) | `3ebfbf9235b049d384cdba5a66a1a3434bb544391e720b76faa8e1b3ee61a4e5` |
| Typst license | [LICENSE](https://raw.githubusercontent.com/typst/typst/v0.15.1/LICENSE) | `62c7a1e35f56406896d7aa7ca52d0cc0d272ac022b5d2796e7d6905db8a3636a` |
| Roboto license | [OFL.txt](https://raw.githubusercontent.com/google/fonts/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/roboto/OFL.txt) | `061402327a96aadb0bfb694a960ed289ecd38d383e396243831ab81feb109c41` |

## Chuẩn bị công cụ xuất tài liệu

Lưu các file trên vào một thư mục tải về, giữ tên `pandoc.zip`, `typst.zip`, `Roboto.ttf`, `PANDOC-COPYING.md`, `TYPST-LICENSE.txt` và `ROBOTO-OFL.txt` cho các thành phần tài liệu. Có thể dùng thư mục đó làm cache offline cho script:

```powershell
$env:CP_STUDIO_DOWNLOADS = 'D:\CP-Studio-Downloads'
npm.cmd run prepare:document-tools
```

Script tạo `.tools/document-export/`; upload thư mục này lên Drive để người dùng tải và giải nén. Với GCC, chỉ cần tải ZIP, giữ nguyên cây thư mục khi giải nén, rồi chọn `mingw64\bin\g++.exe` trong ứng dụng. Nếu chuẩn bị từ source, `prepare:mingw` cũng dùng file GCC đã tải trước khi `CP_STUDIO_DOWNLOADS` trỏ tới thư mục chứa ZIP.

## Build MSI nhanh

Sau `npm.cmd install`, chạy:

```powershell
npm.cmd run dist:win:installer
```

Lệnh chỉ build app và MSI; không gọi các script tải công cụ. Kết quả nằm trong `release/`.
