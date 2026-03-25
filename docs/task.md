# Task Breakdown & Tickets

## Epic 1: Booking System (Player & Manager)
- [x] Xây dựng UI danh sách sân.
- [x] Triển khai flow đặt chỗ của Player (Check availability, chọn slots, điền form).
- [x] Chức năng Manager Duyệt/Từ chối Booking.
- [x] Cổng cài đặt tài khoản nhận thanh toán VietQR cho từng Manager.

## Epic 2: Manager UI Refactoring & Validation
- [x] Đồng nhất Pagination cho Manager.
- [x] Gỡ bỏ alert() mặc định báo Error ở tất cả các trang Manager.
- [x] Gắn Bootstrap Validation (`is-invalid`, `invalid-feedback`) cho Profile Request, Venues, Courts, Payment Settings.
- [x] Cập nhật UX Copywriting (Bạn quên nhập ABC, Oops, ghi số thay vì chữ) theo guideline của khách hàng.

## Epic 3: Matching / Ghép Kèo (Next Focus)
- [ ] Tạo UI hiển thị danh sách Post ghép kèo (Lọc theo trình độ: Yếu, Trung Bình, Khá).
- [ ] Flow: Người dùng ấn "Gửi yêu cầu tham gia".
- [ ] UI dành cho Host: Xem danh sách những người ứng tuyển vào Post của mình.
- [ ] API Accept/Reject Join Request.
- [ ] Tự động khoá (Auto-Close) Post khi Host "Accept" đủ số lượng max slots.
- [ ] Host thao tác tính năng "Reopen matching post" để gọi người mới vào.

## Epic 4: SignalR & Real-time Action
- [ ] Code Hub kết nối Socket ở backend.
- [ ] Setup Frontend hứng sự kiện (Toast notification).
- [ ] Tích hợp tính năng In-app chat giữa Host và người Join Kèo.
