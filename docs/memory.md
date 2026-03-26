# Development Memory (Lịch sử làm việc)

## Mar 20, 2026 - Mar 22, 2026
1. Hoàn thành chức năng xử lý nghiệp vụ Booking cốt lõi. Gồm xem lịch trống, tính toán Slot Time 30 phút, check trùng lặp (Concurrency) rất chặt chẽ ở DB. Đoạn Player Booking kết thúc thành công.
2. Thiết kế API chuẩn RESTful cho Manager tạo Cụm Sân.
3. Tổ chức lại toàn bộ Validation Form trên FrontEnd Manager thành Inline Validation, chuẩn UX SaaS (Dùng số, không dùng chữ, thân thiện, nhẹ nhàng).

## Điều cần nhớ (Memory hooks):
- **User Preference:** Giọng điệu giao diện phải luôn RẤT vui vẻ, cởi mở. Từ "Lỗi" (Error) bị cấm ngặt. Không bao giờ được render Validation dưới dạng Alert Box to đùng ở góc màn hình hay Alert native của browser. Các message nên tuân theo quy tắc: Dùng số thay cho chữ ("3 file" thay vì "ba file"), dùng từ ngữ thân thiện ("Oops...", "Tuyệt vời..."). Toàn bộ hệ thống Manager và Auth/Player đều đã được apply quy tắc này.
- Sân (Venue) có logic Draft -> Active. Không cho Publish nếu thiếu Courts hoặc cấu hình giá. Đã code `VenueService` đáp ứng tiêu chuẩn này.
- Cloudinary Keys được giấu kín tại `.env` (Frontend) hoặc Secret Manager (Backend). Đừng lộ API Key lên repo.
- Phần Booking Player đã HOÀN TẤT. Đừng phí thời gian lặp lại nó nữa. Giờ nhiệm vụ trọng tâm là tập trung sức cho Matching Module.

## Mar 22, 2026 - Present
1. Triển khai UX Copywriting chuẩn SaaS (thân thiện, number-focused) cho hệ thống Portal của Manager. Chuyển đổi toàn bộ alert mặc định thành dạng Inline Validation State ở tất cả các form (Profile, Payment, Add Venue, Add Court).
2. Mở rộng bộ quy tắc UX (Tone tích cực, thân thiện) và **Quy tắc hiển thị lỗi ngay dưới trường nhập liệu (Inline Field Validation)** sang **toàn bộ pages thuộc mảng Auth & User/Player**:
   - `Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`: Cập nhật format validation "Oops...", "Bạn nhớ...". Luôn hiển thị thông báo lỗi báo đỏ ngay bên dưới trường dữ liệu bị nhập sai thay vì dùng alert tổng ở trên cùng.
   - `user/UserProfileEdit.jsx` & `user/UserProfileChangePassword.jsx`: Thông báo success/error dạng trò chuyện tích cực, tích hợp Inline Field Validation (`fieldErrors`) hiển thị lỗi dưới từng ô input.
   - `user/UserManagerInfo.jsx`: Rà soát validation form gửi duyệt, hiển thị lỗi chuẩn Inline Validation dưới từng field.
   - `user/UserBookings.jsx`: Cải thiện UI Toast báo huỷ sân chuẩn UX mới.
   - `VenueDetails.jsx`: Handle error fetching êm ái hơn.

3. Sửa lỗi giao diện (CSS/Layout) trang `UserFavorites.jsx`:
   - Lỗi Scroll bị che khuất: Fix bằng cách bổ sung cấu trúc chuẩn lưới (`content-below-header` và `<section className="breadcrumb">`) giúp container tránh bị Header dạng Fixed đè lên phần Menu.
   - Lỗi Highlight Text hòa vào nền: Xóa các class `text-white` ép cố định màu trắng trên container lót nền trắng, thay bằng thẻ chuẩn màu dark (`#1e293b` và `text-muted`).

4. Xoá tính năng Ví (Wallet):
   - Đã gỡ bỏ menu "Ví" ở cả `UserDashboardMenu` và `ManagerDashboardMenu` theo yêu cầu (Hệ thống không dùng ví nội bộ).
   - Kiểm tra Database `Database.txt` không còn bảng hay khoá ngoại nào liên quan đến Ví.

5. Tách biệt `Manager Profile` và `Player Profile` để khắc phục lỗi xung đột UX thao tác chéo:
   - Xóa bỏ file cũ không sử dụng (`ManagerDashboardMenu.jsx`, `ManagerCourts.jsx`, `managerCourtsMock.js`).
   - Tạo trang `/manager/profile` riêng khép kín trong `ManagerLayout` (hiển thị thông tin Chủ Sân, Giấy phép kinh doanh, CCCD) giao diện chuẩn SaaS.
   - Định tuyến lại trang `MyProfile.jsx` (của chức năng Player) từ `/profile` về lại `/user/profile` để rõ ràng về mặt định danh component.
   - Chỉnh sửa `ManagerSidebar.jsx`, `UserDropdown.jsx`, `ManagerLayout.jsx` để Navbar menu điều hướng chính xác vào 2 luồng Route tách biệt. Mọi thao tác trái tim trên "Sân yêu thích" đều được bảo vệ trong `/user/profile`.

6. Khởi tạo tính năng Cá Nhân Hoá (Player Onboarding Personalization):
   - **Database**: Thêm cột `skill_level`, `play_purpose`, `play_frequency`, `is_personalized` vào model User của C# (ShuttleUp.DAL/Backend).
   - **Backend (C#)**: Cập nhật hàm `GetMyProfile` và `UpdateMyProfile` trong `ProfileController.cs` để hỗ trợ Map và Lưu/Sửa các trường cấu hình trên. Đã build thành công không lỗi.
   - **Frontend (Tương thích Theme 2 UX/UI)**: Tạo trang `Personalization.jsx` dạng Stepper 5 bước (Vị trí, Giới tính, Trình độ, Mục tiêu, Tần suất). Giao diện tối ưu có Header nền Xanh Lá, Progress Tracker, tuân thủ UX thân thiện.
   - **Bảo vệ luồng (Guard)**: Thay đổi file middleware React `ProtectedRoute.jsx` buộc người dùng có quyền `PLAYER` mà `isPersonalized == false` (hoặc null) thì vĩnh viễn bị Redirect vào `/personalization` cho tới khi hoàn tất stepper.
   - **Hồ sơ**: Đồng bộ form `UserProfileEdit.jsx` cho phép người dùng thay đổi 3 thông số Thể Thao kể trên bất kì lúc nào.

## Mar 26, 2026
1. Đồng bộ schema DB theo rule "single source of truth" vào `Database.txt`:
   - Thêm cột thanh toán + chính sách huỷ trong bảng `venues`: `payment_bank_name`, `payment_bank_bin`, `payment_account_number`, `payment_account_holder`, `payment_transfer_note_template`, `cancel_allowed`, `cancel_before_minutes`, `refund_type`, `refund_percent`.
   - Thêm cột snapshot chính sách huỷ trong bảng `bookings`: `cancellation_policy_snapshot_json`.
   - Thêm bảng `user_notifications` (kèm index `idx_user_notifications_user_created`).
   - Thêm `DROP TABLE IF EXISTS user_notifications` ở phần reset DB.
2. Xoá file migration rời `Database/migrations_venue_checkout_notifications.sql` theo yêu cầu để chỉ cần chạy `Database.txt` một lần.
3. Sửa compile backend cho Notifications:
   - Bổ sung `DbSet<UserNotification>` và map `modelBuilder.Entity<UserNotification>` trong `ShuttleUpDbContext`.
   - Bổ sung navigation `ICollection<UserNotification>` trong model `User`.
   - Kết quả: `dotnet build ShuttleUp.Backend` thành công (0 errors).

7. Thông báo trong app (API + SignalR + UI):
   - Backend: `NotificationDispatchService`, email HTML tùy chọn, endpoints `GET/PATCH /api/notifications`, tích hợp vào luồng booking/thanh toán.
   - Frontend: `useAppNotificationsHub` trong `App.jsx`, trang `/user/notifications`, dropdown Header, `ManagerNotifications` dùng API thật (không mock), badge/chấm đỏ sidebar & topbar manager theo `useUnreadNotificationCount`, menu user có mục Thông báo.

8. Fix 500 `Unknown column PaymentBankName / CancelAllowed`: EF map thiếu `HasColumnName` snake_case cho các field thanh toán + huỷ trên `Venue` và `CancellationPolicySnapshotJson` trên `Booking` trong `ShuttleUpDbContext`. Thêm block migration có điều kiện ở cuối `Database.txt` để DB cũ tự thêm cột `venues.*` và `bookings.cancellation_policy_snapshot_json` — chạy script (hoặc đoạn migration đó) trên MySQL đang dùng.
