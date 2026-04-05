# Cấu hình môi trường dev

Sau khi clone repo, bạn cần chạy được backend và frontend trên máy mình. Không commit Api Key hay Api Secret của Cloudinary lên Git.

## Cài sẵn một lần

- .NET 8 SDK (kiểm tra: dotnet --version)
- Node.js 18 trở lên (kiểm tra: node -v)
- MySQL hoặc MariaDB, biết user và mật khẩu

## Bước 1: Database

Chạy script Database.txt trong MySQL (theo quy ước team, thường chạy cả file nếu muốn DB mẫu sạch).

Mở ShuttleUp.Backend/appsettings.json và sửa ConnectionStrings DefaultConnection cho đúng server, user, mật khẩu và tên database trên máy bạn.

## Bước 2: Backend và Cloudinary

API cần Cloudinary để upload ảnh (avatar, minh chứng thanh toán, v.v.). Trong repo chỉ có CloudName và tên thư mục; Api Key và Api Secret mỗi người tự cấu hình trên máy bằng User Secrets.

Mở PowerShell tại thư mục ShuttleUp.Backend:

```
cd ShuttleUp.Backend
```

Lần đầu trên máy có thể cần (nếu project đã có UserSecretsId trong file csproj thì có thể bỏ qua):

```
dotnet user-secrets init
```

Lấy Api Key và Api Secret từ người phụ trách hoặc từ Cloudinary Dashboard, mục API Keys. Rồi chạy (thay phần trong ngoặc bằng giá trị thật):

```
dotnet user-secrets set "Cloudinary:ApiKey" "DÁN_API_KEY_VÀO_ĐÂY"
dotnet user-secrets set "Cloudinary:ApiSecret" 'DÁN_API_SECRET_VÀO_ĐÂY'
```

Nếu Api Secret bắt đầu bằng dấu trừ, nên dùng nháy đơn bao quanh giá trị như dòng ApiSecret ở trên, để PowerShell không hiểu nhầm là tham số lệnh.

CloudName đã có trong appsettings.json và appsettings.Development.json. Bạn chỉ cần User Secrets cho ApiKey và ApiSecret.

### VietQR (tra cứu chủ tài khoản ngân hàng)

Trang cài đặt thanh toán của Manager dùng VietQR Lookup API để xác minh chủ tài khoản. Cần ClientId và ApiKey từ https://vietqr.io (mục API Lookup).

**Bắt buộc:** Lệnh `dotnet user-secrets` phải chạy trong thư mục có file `.csproj` (backend), **không** chạy ở thư mục gốc repo `SEP490` — nếu không sẽ báo *Could not find a MSBuild project file*.

Cách 1 — vào đúng thư mục backend rồi chạy (khuyên dùng):

```
cd ShuttleUp.Backend
dotnet user-secrets set "VietQR:ClientId" "DÁN_CLIENT_ID_VÀO_ĐÂY"
dotnet user-secrets set "VietQR:ApiKey" "DÁN_API_KEY_VÀO_ĐÂY"
```

Cách 2 — đứng ở thư mục gốc repo, chỉ rõ project:

```
dotnet user-secrets set "VietQR:ClientId" "DÁN_CLIENT_ID_VÀO_ĐÂY" --project ShuttleUp.Backend/ShuttleUp.Backend.csproj
dotnet user-secrets set "VietQR:ApiKey" "DÁN_API_KEY_VÀO_ĐÂY" --project ShuttleUp.Backend/ShuttleUp.Backend.csproj
```

Mỗi lệnh **một dòng** — không dán hai lệnh `dotnet` liền nhau trên cùng một dòng (PowerShell sẽ báo *Unrecognized command or argument 'dotnet'*).

LookupUrl đã có trong appsettings.json. Bạn chỉ cần User Secrets cho ClientId và ApiKey.

Chạy API:

```
dotnet run
```

Swagger thường mở tại http://localhost:5079/swagger

Nếu thiếu Cloudinary hoặc VietQR, ứng dụng sẽ dừng và báo lỗi ngay khi khởi động. Đó là bình thường để tránh chạy sai mà không hay.

## Bước 3: Frontend

```
cd ShuttleUp.Frontend
copy .env.example .env
npm install
npm run dev
```

File .env có biến VITE_API_URL trỏ tới API (mặc định trong .env.example là http://localhost:5079/api). Đổi nếu bạn chạy API ở cổng khác.

Có thêm VITE_CHAT_HUB_URL cho chat, chỉnh nếu cần.

## Kiểm tra nhanh

- Chạy dotnet run: không lỗi, vào được Swagger.
- Có upload ảnh: không bị lỗi 500 do thiếu Cloudinary nếu đã set đủ key.
- Chạy npm run dev: web mở được và gọi đúng địa chỉ API trong .env.

## Không nên làm

- Không ghi Cloudinary ApiKey/ApiSecret hoặc VietQR ClientId/ApiKey vào appsettings rồi commit.
- Không đăng key hoặc secret lên nhóm công khai.

## Khi deploy server (tham khảo)

Có thể dùng biến môi trường, ví dụ Cloudinary__CloudName, Cloudinary__ApiKey, Cloudinary__ApiSecret, VietQR__ClientId, VietQR__ApiKey (hai dấu gạch dưới tương ứng section trong cấu hình ASP.NET).

## Gặp lỗi

- **Could not find a MSBuild project file:** Bạn đang chạy `dotnet user-secrets` ở thư mục sai. `cd ShuttleUp.Backend` trước, hoặc thêm `--project ShuttleUp.Backend/ShuttleUp.Backend.csproj` (khi đứng ở thư mục gốc repo).
- **Unrecognized command or argument 'dotnet':** Hai lệnh bị dán trên một dòng. Chạy từng lệnh `dotnet user-secrets set ...` riêng biệt, mỗi lệnh Enter một lần.
- Backend báo thiếu Cloudinary hoặc VietQR: làm lại bước User Secrets hoặc kiểm tra đã dán đúng key chưa.
- Lệnh user-secrets lỗi với secret: thử bọc giá trị bằng nháy đơn.
- Lỗi kết nối database: kiểm tra MySQL đã bật và ConnectionStrings trong appsettings.

Nếu vẫn không được, nhờ lead xem giúp và gửi log console của backend hoặc nội dung lỗi API (không gửi kèm secret).
