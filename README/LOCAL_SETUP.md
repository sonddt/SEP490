# Hướng dẫn cấu hình local cho team ShuttleUp

Tài liệu này giúp mọi thành viên chạy backend trên máy của mình mà không cần lưu Cloudinary API Key và API Secret trong Git.

---

## 1. Thống nhất một Cloudinary cho môi trường dev

- Team nên dùng chung một tài khoản Cloudinary dành cho dev (có thể là cloud hiện tại hoặc tạo cloud dev riêng).
- Một người phụ trách (lead) quản lý quyền trên Cloudinary Dashboard.
- Khi có thành viên mới, lead cấp Api Key và Api Secret qua kênh riêng (không để trong repo, không đăng công khai).

---

## 2. Nội dung cần có trên mỗi máy dev

Backend đọc cấu hình Cloudinary qua section `Cloudinary` với các khóa sau:

| Khóa | Ghi chú |
|------|---------|
| CloudName | Có thể giữ trong `appsettings` (không phải bí mật mạnh như key). |
| ApiKey | Bí mật: chỉ set qua User Secrets hoặc biến môi trường, không commit. |
| ApiSecret | Bí mật: chỉ set qua User Secrets hoặc biến môi trường, không commit. |

File `appsettings.json` trong repo chỉ nên chứa phần không nhạy cảm (ví dụ CloudName, Folder). ApiKey và ApiSecret không được đưa vào Git.

---

## 3. Thành viên mới: các bước trên Windows (PowerShell)

Mở terminal tại thư mục backend của solution:

```powershell
cd ShuttleUp.Backend
```

Khởi tạo User Secrets cho project (chỉ cần chạy một lần trên máy đó, nếu chưa có):

```powershell
dotnet user-secrets init
```

Đặt Api Key và Api Secret (thay phần trong ngoặc nhọn bằng giá trị lead cung cấp):

```powershell
dotnet user-secrets set "Cloudinary:ApiKey" "<ApiKey_của_bạn>"
dotnet user-secrets set "Cloudinary:ApiSecret" "<ApiSecret_của_bạn>"
```

Sau đó chạy API như bình thường (Visual Studio, `dotnet run`, hoặc cách team đang dùng).

Lưu ý:

- User Secrets lưu trên profile Windows của chính người đó, không nằm trong thư mục project và không bị commit khi push Git.
- Mỗi máy chỉ cần cấu hình một lần, trừ khi team đổi key hoặc bạn cài lại máy.

---

## 4. Cách chia sẻ secret trong team (nên làm)

Thứ tự ưu tiên từ an toàn đến chấp nhận được:

1. Password manager có vault dùng chung (ví dụ Bitwarden, 1Password cho team).
2. Tin nhắn riêng hoặc cuộc gọi ngắn để truyền key cho member mới, sau đó xóa tin nhắn nếu có thể.
3. Tránh: đăng key lên nhóm lớp công khai, slide công khai, hoặc commit vào Git.

---

## 5. Khi có người rời team

- Vào Cloudinary Dashboard, rotate hoặc xóa Api Key / Api Secret cũ, tạo bộ mới nếu cần.
- Thông báo toàn team set lại User Secrets (hoặc biến môi trường) bằng key mới.

---

## 6. Chuẩn bị deploy production (sau này)

Người dùng cuối của web không cần đọc tài liệu này và không cần cấu hình Cloudinary.

Người deploy (bạn hoặc DevOps) cấu hình một lần trên server hoặc trên nền tảng hosting bằng biến môi trường. Với ASP.NET Core, có thể dùng dấu gạch dưới kép để map section lồng nhau:

| Biến môi trường | Ý nghĩa |
|-----------------|--------|
| Cloudinary__CloudName | Tên cloud |
| Cloudinary__ApiKey | API Key |
| Cloudinary__ApiSecret | API Secret |

Tuỳ nền tảng (Azure App Service, Docker, VPS, v.v.) mà nhập vào mục Application Settings, Environment Variables, hoặc Secret của CI/CD.

---

## Kiểm tra nhanh

Sau khi set User Secrets, chạy backend và thử các API có upload ảnh (ví dụ avatar hoặc minh chứng thanh toán). Nếu thiếu Cloudinary, ứng dụng sẽ báo lỗi cấu hình sớm thay vì chạy sai âm thầm.

---

## Liên hệ trong team

Nếu không chạy được sau khi làm theo các bước trên, báo lead kèm log lỗi từ console hoặc response API để xử lý nhanh.
