# Architecture Overview (Sơ đồ hệ thống)

## 1. Cấu trúc tổng thể
Hệ thống áp dụng kiến trúc N-Tier trên nền tảng .NET 8 (Backend) và React + Vite (Frontend).

## 2. Cấu trúc thư mục Backend

```
ShuttleUp.Backend/
├── ShuttleUp.Backend.DAL/
├── ShuttleUp.Backend.BLL/
└── ShuttleUp.Backend.Presentation/
```

## 3. Các Layers (Backend)
- **ShuttleUp.Backend.DAL (Data Access Layer):** 
  - Khởi tạo DbContext (Entity Framework Core).
  - Quản lý các Entities (Booking, Venue, Court, Post, PostJoinRequest,...).
  - Repository Pattern.
- **ShuttleUp.Backend.BLL (Business Logic Layer):**
  - Chứa toàn bộ DTOs và Interfaces.
  - Quản lý logic nghiệp vụ qua các Services (AuthService, VenueService, BookingService, PostService).
- **ShuttleUp.Backend.Presentation (Presentation & API Layer):**
  - Controllers cung cấp RESTful APIs.
  - Cấu hình Dependency Injection (DI) trong `Program.cs`.
  - SignalR Hubs (Real-time notifications, Chat).
  - Middleware xử lý JWT Auth và Error Logging.

> Namespace C# trong code vẫn giữ `ShuttleUp.DAL`, `ShuttleUp.BLL`, `ShuttleUp.Backend` — chỉ tên project/thư mục được chuẩn hóa.

## 4. Cấu trúc thiết kế (Frontend)
- **React 19 + Vite 7:** Công nghệ lõi.
- **State Management:** Context API (AuthContext) + Local State.
- **Styling:** Bootstrap 5, FontAwesome, Feather Icons, Custom CSS (SaaS UI template).
- **API Interceptor:** Axios client tích hợp xử lý renew/refresh token.
- **Routing:** React Router v7.

## 5. Dịch vụ bên thứ ba (3rd Party Services)
- **Cơ sở dữ liệu:** MySQL Database.
- **Lưu trữ hình ảnh:** Cloudinary (Lưu avatar, hình sân, giấy phép kinh doanh).
- **Thông báo Email:** MailKit (Gửi OTP, xác nhận tài khoản).
- **Thanh toán:** Cổng VNPay, VietQR, Open API Ngân hàng.
