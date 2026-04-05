# ShuttleUp

Web đặt sân cầu lông: backend ASP.NET Core, giao diện React (Vite).

## Chạy nhanh

1. Cài .NET 8 SDK, Node.js và MySQL (hoặc MariaDB).
2. Import file Database.txt vào MySQL. Sửa chuỗi kết nối trong ShuttleUp.Backend/appsettings.json cho đúng máy bạn.
3. Cấu hình Cloudinary (bắt buộc nếu chạy API, vì có upload ảnh).
4. Backend: vào thư mục ShuttleUp.Backend, chạy dotnet run. Swagger thường ở http://localhost:5079
5. Frontend: vào ShuttleUp.Frontend, copy .env.example thành .env, chạy npm install rồi npm run dev.

Hướng dẫn chi tiết: [README/LOCAL_SETUP.md](README/LOCAL_SETUP.md).

Trong thư mục README còn có [README/README.md](README/README.md) (mục lục ngắn).
