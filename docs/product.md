# ShuttleUp - Product Specification & Objectives

## 1. Mục tiêu Sản Phẩm (Product Objectives)
ShuttleUp là nền tảng quản lý và đặt sân cầu lông chuyên nghiệp, kết nối chủ sân (Manager) và người chơi (Player). 
Hệ thống không chỉ dừng lại ở việc **đặt sân (Booking)** mà còn cung cấp tính năng **ghép kèo (Matching)** giúp người chơi dễ dàng tìm kiếm những người có cùng trình độ để tham gia.

## 2. Các Role và User Flow chính
### 2.1. Player (Người chơi)
- **Đăng ký / Đăng nhập:** Xác thực qua email.
- **Tìm kiếm sâm & Đặt sân (Booking - HOÀN THÀNH):** Xem danh sách cụm sân, chọn ngày giờ, xem giá tiền, thanh toán bằng VNPay / VietQR.
- **Ghép kèo (Matching - ĐANG PHÁT TRIỂN):** Tạo bài đăng tìm người chơi chung (Host), gửi yêu cầu tham gia (Join Request), nhận phản hồi Chấp nhận/Từ chối qua SignalR.
- **Thanh toán:** Chuyển khoản ngân hàng trực tiếp cho chủ sân.

### 2.2. Manager (Chủ sân)
- **Hồ sơ & Đăng ký cụm sân:** Đăng ký thông tin thuế, giấy phép kinh doanh, cung cấp chứng minh nhân dân (CCCD).
- **Quản lý sân đấu (Venues & Courts):** Đăng sân, tạo các sân con (Courts), cấu hình khung giờ mở cửa, giá ngày thường, giá cuối tuần (Giờ Vàng).
- **Trạng thái sân (Draft to Publish):** Sân mới mặc định là Draft, chỉ Publish khi đủ thông tin (Hình ảnh, giá cả, thời gian). Không cho phép Unpublish nếu có lịch đặt trong tương lai.
- **Quản lý thanh toán:** Điền thông tin VietQR/VNPay để người tham gia chuyển khoản.
- **Quản lý Đặt sân & Doanh thu:** Xem các lịch đặt, duyệt/huỷ, thống kê doanh thu.

### 2.3. Admin (Quản trị viên)
- Phê duyệt các yêu cầu đăng ký tài khoản Manager, xử lý tranh chấp và báo cáo hệ thống.

## 3. Ràng buộc & Tiêu chuẩn Kinh doanh (Constraints)
- UX/UI cần tuân thủ triệt để giao diện SaaS Dashboard chuyên nghiệp (Validations phải hiển thị inline bên dưới input, số thay cho chữ "1 đến 3", ngôn ngữ thân thiện, tránh từ ngữ kỹ thuật/lỗi gắt gỏng).
- Tính toàn vẹn dữ liệu cực kỳ khắt khe: Không Publish sân khi thiếu cấu hình tối thiểu.
- Các bài Post Ghép Kèo (Matching) phải tự động khoá khi đủ số người, và mở lại (Reopen) nếu có người huỷ.
