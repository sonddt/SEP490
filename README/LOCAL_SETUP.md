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

Chạy API:

```
dotnet run
```

Swagger thường mở tại http://localhost:5079/swagger

Nếu thiếu Cloudinary, ứng dụng sẽ dừng và báo lỗi ngay khi khởi động. Đó là bình thường để tránh chạy sai mà không hay.

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

- Không ghi Cloudinary ApiKey hoặc ApiSecret vào appsettings rồi commit.
- Không đăng key hoặc secret lên nhóm công khai.

## Khi deploy server (tham khảo)

Có thể dùng biến môi trường, ví dụ Cloudinary__CloudName, Cloudinary__ApiKey, Cloudinary__ApiSecret (hai dấu gạch dưới tương ứng section trong cấu hình ASP.NET).

## Gặp lỗi

- Backend báo thiếu Cloudinary: làm lại bước User Secrets hoặc kiểm tra đã dán đúng key chưa.
- Lệnh user-secrets lỗi với secret: thử bọc giá trị bằng nháy đơn.
- Lỗi kết nối database: kiểm tra MySQL đã bật và ConnectionStrings trong appsettings.

Nếu vẫn không được, nhờ lead xem giúp và gửi log console của backend hoặc nội dung lỗi API (không gửi kèm secret).
