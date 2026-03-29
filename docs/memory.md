# Lịch sử phát triển (Development memory)

Tài liệu ghi lại các mốc làm việc theo thời gian. Đọc từ trên xuống là từ cũ đến mới.

---

## Nguyên tắc cố định (áp dụng xuyên suốt)

- Giọng điệu giao diện: vui vẻ, cởi mở. Tránh nhãn kiểu “Lỗi” cứng nhắc; ưu tiên thông điệp thân thiện (“Oops…”, “Tuyệt vời…”).
- Validation: không dùng alert toàn trang hay alert trình duyệt; hiển thị gần ô nhập. Ưu tiên số thay chữ (“3 file” thay vì “ba file”) khi phù hợp.
- Sân (Venue): luồng Draft → Active; không publish nếu thiếu sân hoặc cấu hình giá. `VenueService` đã phản ánh rule này.
- Cloudinary: key chỉ nằm trong `.env` (frontend) hoặc Secret Manager (backend), không đưa lên repo.
- Player booking (luồng đặt sân cơ bản) đã hoàn tất; ưu tiên tiếp theo là các module khác (ví dụ Matching).

---

## 20–22 tháng 3, 2026

1. Booking cốt lõi: xem lịch trống, slot 30 phút, kiểm tra trùng lịch (concurrency) phía DB; luồng đặt sân phía người chơi hoàn chỉnh.
2. API REST cho Manager tạo cụm sân.
3. Form Manager: chuyển validation sang inline, hướng UX SaaS (rõ ràng, nhẹ, ưu tiên số khi hợp lý).

---

## 22 tháng 3, 2026 (portal Manager, Auth & User)

1. Copywriting / UX SaaS cho portal Manager: thông báo và trạng thái form gần với chuẩn sản phẩm (Profile, Payment, Add Venue, Add Court).
2. Mở rộng inline validation sang toàn bộ trang Auth & User/Player:
   - `Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`: thông báo dưới từng trường, tone tích cực.
   - `user/UserProfileEdit.jsx`, `user/UserProfileChangePassword.jsx`: `fieldErrors` dưới từng input.
   - `user/UserManagerInfo.jsx`: form gửi duyệt, lỗi theo từng field.
   - `user/UserBookings.jsx`: toast khi huỷ đặt sân gọn với UX mới.
   - `VenueDetails.jsx`: xử lý lỗi tải dữ liệu êm hơn.
3. `UserFavorites.jsx`: sửa scroll bị header che (`content-below-header`, breadcrumb); chỉnh màu chữ (bỏ `text-white` chồng nền sáng, dùng `#1e293b` / `text-muted`).
4. Gỡ tính năng Ví: xóa menu “Ví” ở `UserDashboardMenu` và `ManagerDashboardMenu`; rà `Database.txt` không còn bảng/khóa liên quan ví.
5. Tách Manager Profile và Player Profile:
   - Xóa file cũ không dùng (`ManagerDashboardMenu.jsx`, `ManagerCourts.jsx`, `managerCourtsMock.js`).
   - Trang `/manager/profile` trong `ManagerLayout` (chủ sân, giấy phép, CCCD).
   - `MyProfile.jsx` (player) định tuyến `/user/profile`.
   - Cập nhật `ManagerSidebar.jsx`, `UserDropdown.jsx`, `ManagerLayout.jsx`; “Sân yêu thích” nằm trong `/user/profile`.
6. Cá nhân hoá onboarding (Player):
   - DB: cột `skill_level`, `play_purpose`, `play_frequency`, `is_personalized` trên User (DAL/Backend).
   - Backend: `GetMyProfile` / `UpdateMyProfile` trong `ProfileController.cs` map và lưu các trường trên.
   - Frontend: `Personalization.jsx` — stepper 5 bước (vị trí, giới tính, trình độ, mục tiêu, tần suất), header xanh lá, progress tracker.
   - `ProtectedRoute.jsx`: user `PLAYER` với `isPersonalized` false/null bị redirect `/personalization` đến khi xong.
   - `UserProfileEdit.jsx`: chỉnh sửa lại 3 thông số thể thao bất cứ lúc nào.

---

## 26 tháng 3, 2026

1. Schema trong `Database.txt` (single source of truth):
   - `venues`: cột thanh toán + chính sách huỷ (`payment_bank_*`, `cancel_*`, `refund_*`, …).
   - `bookings`: `cancellation_policy_snapshot_json`.
   - Bảng `user_notifications` + index `idx_user_notifications_user_created`; phần reset DB có `DROP TABLE IF EXISTS user_notifications`.
2. Xóa file migration rời `Database/migrations_venue_checkout_notifications.sql` — chỉ cần chạy `Database.txt` một lần khi init.
3. Backend notifications: `DbSet<UserNotification>`, map entity trong `ShuttleUpDbContext`, navigation trên `User`; build Backend OK.
4. Thông báo trong app: `NotificationDispatchService`, email HTML tùy chọn, `GET/PATCH /api/notifications`, tích hợp booking/thanh toán; frontend `useAppNotificationsHub`, `/user/notifications`, dropdown header, `ManagerNotifications` dùng API thật, badge unread.
5. Sửa lỗi 500 `Unknown column PaymentBankName / CancelAllowed`: EF thêm `HasColumnName` snake_case cho Venue + `CancellationPolicySnapshotJson` trên Booking; cuối `Database.txt` có block migration có điều kiện cho DB cũ (MySQL).
6. Nâng cấp notification (03/2026): deep link + `NotificationMetadataBuilder`; `NotificationTypes` (C#) và `constants/notificationTypes.js`; `GET /notifications` cursor `before` + soft delete; SignalR kèm `bookingId` trong payload; sửa `getNotifications` (axios interceptor trả body sẵn, không destructure `data` sai); gỡ hook dư `useBookingNotificationsHub.js`.

---

## 28 tháng 3, 2026

Kết bạn & quan hệ xã hội (Player):

- Database: `user_privacy_settings`, `friend_requests`, `friendships`, `user_blocks` (trong `Database.txt`; script bổ sung: `docs/migration_friends_social.sql` cho DB đang chạy).
- Backend: `SocialController` (`/api/social`) — privacy, tìm exact/name, lời mời, bạn bè, chặn, `GET relationship/{id}`; thông báo `FRIEND_REQUEST` / `FRIEND_ACCEPTED` + `deepLink` trong metadata; `ProfileController`: `GET /api/profile/{userId}` (hồ sơ tối thiểu, `relationshipState`, `pendingRequestId` khi `PENDING_IN`).
- Frontend: `/user/social/search`, `/user/social/friends` (tab Bạn bè / Đã nhận / Đã gửi), `/user/profile/:userId`; `RelationshipActions`, `socialApi`; QR (`qrcode.react`) + đọc ảnh QR (`jsqr`); `VITE_PUBLIC_APP_URL` (fallback `window.location.origin`); menu Tìm bạn / Bạn bè; `notificationTypes` + `notificationNavigation`.
- Personalization: cho phép vào `/user/social/*` và `/user/profile/{guid}` dù chưa xong onboarding (theo kế hoạch tính năng xã hội).

---

*Cập nhật: gom theo ngày, bỏ trùng lặp và định dạng lại cho dễ đọc.*
