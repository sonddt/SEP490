# ShuttleUp - Hệ Thống Kỹ Thuật (Technical Stack)

> Tài liệu tham chiếu chính thức – cập nhật theo cấu trúc project hiện tại.

---

## 1. Tổng Quan Kiến Trúc

```
┌─────────────────────┐     HTTPS / REST API      ┌─────────────────────┐
│   ShuttleUp.Frontend │ ◄──────────────────────► │  ShuttleUp.Backend   │
│   React + Vite (JS)  │     localhost:5173       │   ASP.NET Core 8     │
└──────────┬──────────┘                          └──────────┬──────────┘
           │                                                │
           │                                                │  EF Core / ADO
           │                                                ▼
           │                                      ┌─────────────────────┐
           │                                      │       MySQL         │
           │                                      │   (Relational DB)   │
           │                                      └─────────────────────┘
```

---

## 2. Chi Tiết Công Nghệ

### 2.1 Frontend

| Thành phần | Công nghệ |
|------------|-----------|
| Framework | React 19.x |
| Build Tool | Vite 7.x |
| Ngôn ngữ | JavaScript (JSX) |
| Port mặc định | 5173 |

### 2.2 Backend

| Thành phần | Công nghệ |
|------------|-----------|
| Framework | ASP.NET Core 8 (.NET 8) |
| Kiểu ứng dụng | Web API (REST) |
| API Documentation | Swagger (Swashbuckle) |

### 2.3 Database

| Thành phần | Công nghệ |
|------------|-----------|
| Hệ quản trị CSDL | **MySQL** |
| ORM / Data Access | Entity Framework Core (dự kiến) |

### 2.4 Giao Thức & Bảo Mật

| Thành phần | Công nghệ / Chuẩn |
|------------|-------------------|
| Giao thức | HTTPS, TLS 1.2+ |
| Xác thực | JWT (dự kiến) |
| Phân quyền | Role-Based Access Control (RBAC) |
| Bảo mật mật khẩu | bcrypt (dự kiến) |

### 2.5 Tích Hợp Bên Ngoài (dự kiến theo Report 3)

| Dịch vụ | Mục đích |
|---------|----------|
| VietQR | Thanh toán đặt sân, phí trận đấu |
| SMTP | Email xác thực, xác nhận booking, thông báo |
| AWS S3 (hoặc tương đương) | Lưu ảnh venue, court, profile |
| Google Maps API | Hiển thị địa điểm venue, chỉ đường, khoảng cách |

---

## 3. Cấu Trúc Solution

```
SEP490/
├── ShuttleUp.sln
├── ShuttleUp.Backend/       # ASP.NET Core 8 Web API
│   ├── Controllers/
│   ├── Models/
│   ├── Program.cs
│   └── appsettings.json
│
└── ShuttleUp.Frontend/      # React + Vite
    ├── src/
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    └── vite.config.js
```

---

## 4. So Sánh Với Bản Report 3 Gốc

| Mục | Report 3 (gốc) | Thực tế |
|-----|----------------|---------|
| Frontend | React | React + Vite |
| Ngôn ngữ FE | (TS mặc định) | JavaScript |
| Backend | Spring Boot (Java) | **ASP.NET Core 8 (C#)** |
| Database | PostgreSQL | **MySQL** |
| Kết nối DB | JDBC | **Entity Framework Core / MySQL Connector** |

---

*Cập nhật lần cuối: Dựa trên cấu trúc project thực tế.*
