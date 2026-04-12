# Lịch sử phát triển (Development memory)

Tài liệu ghi lại các mốc làm việc theo thời gian. Đọc từ trên xuống là từ cũ đến mới.

---

## Nguyên tắc cố định (áp dụng xuyên suốt)

- Database: chỉ `Database.txt` — không thêm file `.sql` rời trong repo; sửa schema + dữ liệu mẫu trong file đó, chạy full script khi cần DB sạch (xem `.cursor/rules/project-context.mdc`).
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

- Database: `user_privacy_settings`, `friend_requests`, `friendships`, `user_blocks` (trong `Database.txt`).
- Backend: `SocialController` (`/api/social`) — privacy, tìm exact/name, lời mời, bạn bè, chặn, `GET relationship/{id}`; thông báo `FRIEND_REQUEST` / `FRIEND_ACCEPTED` + `deepLink` in metadata; `ProfileController`: `GET /api/profile/{userId}` (hồ sơ tối thiểu, `relationshipState`, `pendingRequestId` khi `PENDING_IN`).
- Frontend: `/user/social/search`, `/user/social/friends` (tab Bạn bè / Đã nhận / Đã gửi), `/user/profile/:userId`; `RelationshipActions`, `socialApi`; QR (`qrcode.react`) + đọc ảnh QR (`jsqr`); `VITE_PUBLIC_APP_URL` (fallback `window.location.origin`); menu Tìm bạn / Bạn bè; `notificationTypes` + `notificationNavigation`.
- Personalization: cho phép vào `/user/social/*` và `/user/profile/{guid}` dù chưa xong onboarding (theo kế hoạch tính năng xã hội).
- Bình luận matching: sửa lệch giờ sau F5 (MySQL `datetime` → JSON có `Z` qua `AsUtcForJson` trong `MatchingController` GET/POST comments); giới hạn 1 comment / 0,5s / user / post (HTTP 429); `MatchingComments.jsx` parse ISO không offset như UTC + cooldown client + hiển thị `message` từ API; UI chỉ hiện 5 bình luận đầu, nút **Xem thêm** gọi một lần `pageSize = total` để tải hết.
- Bình luận matching (quyền & xóa mềm): bảng `matching_post_comments` thêm `is_deleted`, `deleted_at`, `deleted_by_user_id`, `updated_at`; GET chỉ trả comment chưa xóa; `PATCH .../comments/{id}` (tác giả sửa), `DELETE .../comments/{id}` xóa mềm (chủ bài hoặc tác giả); FE nút Sửa/Gỡ + `isHost` từ `MatchingPostDetail`.
- Trả lời bình luận matching (1 cấp): cột `parent_comment_id` (FK `ON DELETE SET NULL`), POST body `parentCommentId` chỉ trỏ tới bình luận gốc; GET/PATCH trả `replyToFullName`; FE banner “Đang trả lời…”, nút **Trả lời** trên bình luận gốc, dòng reply thụt + nhãn “Trả lời {tên}” (schema trong `Database.txt`).
- Bình luận matching (mở rộng theo roadmap): API chỉ trả **bình luận gốc** phân trang + `replyCount`, `totalAll`; `GET .../comments/{rootId}/replies` lazy-load phản hồi; `sort=newest|oldest|popular`; upload ảnh `POST .../comments/upload-image` + cột `attachment_file_id` (trong `Database.txt`); `PostComment` thông báo host + (reply) chủ comment gốc — `MATCHING_NEW_COMMENT` / `MATCHING_COMMENT_REPLY` + `deepLink`; FE `MatchingComments.jsx`: textarea, `CommentRichText` (xuống dòng, link, @mention thành viên), ảnh, “Xem N phản hồi”, phân trang gốc; `notificationTypes.js` + `notificationNavigation` (`postId`).

---

## 29 tháng 3 – 1 tháng 4, 2026 (Matching Core — Phase 1)

1. **Database Schema (`Database.txt`)**:
   - Nâng cấp `matching_posts`: thêm `title`, `play_date`, `play_start/end_time`, `venue_id`, `court_name`, `price_per_slot`.
   - Bảng trung gian `matching_post_items`: liên kết bài đăng với các `booking_items` cụ thể.
   - Mở rộng `matching_join_requests` (`message`, `reject_reason`) và `matching_members` (`joined_at`).
2. **Backend Architecture**:
   - `MatchingController.cs`: triển khai 15 API endpoints quản lý toàn bộ vòng đời bài đăng.
   - Logic nghiệp vụ:
     - **Over-join protection**: Chặn duyệt khi đã đủ người.
     - **Auto-close**: Tự động chuyển status `FULL` và hủy yêu cầu pending khi slot cuối được accept.
     - **Re-open**: Tự động mở lại bài đăng khi có người bị kick/rời nhóm khiến slot trống.
     - **Auth-gated Social**: Chỉ host và thành viên được duyệt mới thấy/gửi bình luận nhóm (FB-style).
3. **Frontend UI/UX**:
   - `MatchingHub.jsx`: Grid bài đăng kèm filter chuyên sâu (trình độ, ngày, khu vực) và pagination.
   - `MatchingCreate.jsx`: Stepper 4 bước (Chọn đơn sân → Chọn ca chơi → Thông tin bài → Xác nhận) kèm Preview Card trực quan. Áp dụng Rule 2 (inline validation, copywriting thân thiện).
   - `MatchingPostDetail.jsx`: Dashboard quản lý cho host (duyệt/tối chối/kick) và seeker (form xin tham gia, countdown slots).
   - Tích hợp `index.css`: ~370 dòng CSS tùy chỉnh cho matching (nền gradient, progress bar, circular SVG chart cho slots).
4. **Hệ thống Thông báo**: Tích hợp notifications SignalR cho mọi hành động (xin gia nhập, duyệt, từ chối, đóng bài, bình luận mới).

---

## 2 tháng 4, 2026 (Manager & Admin UI Premium Overhaul)

1. **Giao diện Manager (Premium SaaS)**:
   - Thay đổi kiến trúc CSS (`.mgr-sidebar`, `.mgr-topbar`), chuyển sang thiết kế dạng thẻ nổi (floating cards).
   - Sidebar được bo tròn 20px, sử dụng gradient Emerald Green (`#064e3b` kết hợp `#065f46`), text đậm hơn để tăng độ tương phản.
   - Topbar sử dụng hiệu ứng frosted-glass (`backdrop-filter: blur`), bo góc 16px, thụt lề 14px tạo cảm giác tách biệt khỏi viền trình duyệt.
   - Layout tổng quan được bổ sung background với radial-gradient nhẹ, tạo chiều sâu cho màn hình.
2. **Quản lý sân con (Courts)**:
   - Sửa lỗi thẻ Type hiện `ACTIVE` bằng hàm loại trừ logic nội bộ (`isRealCourtType`).
   - Card Actions và Table Actions được chuẩn hoá (nút lớn, nhãn bằng chữ, màu xanh da trời cho Edit và đỏ ngói cho Delete).
3. **Giao diện Admin**:
   - Khởi tạo thư mục `layouts/AdminLayout.jsx` và `components/admin/AdminSidebar.jsx` chuyên biệt.
   - Áp dụng cấu trúc nested-route trên `App.jsx` (`/admin/*`) thay vì wrap thủ công ở từng page.
   - Xoá triệt để dải header cũ (breadcrumb) và thanh menu ngang (`AdminDashboardMenu`) lỗi thời ở tất cả trang con (`AdminDashboard`, `AdminAccounts`, `AdminManagerRequests`, ...).
   - Sidebar sử dụng bộ màu Indigo/Dark Navy (`#1e1b4b` -> `#312e81`) để phân biệt với role Manager, giữ nguyên hiệu ứng floating floating/rounded. Sắp xếp lại logo, icon feather, và menu phụ Khác. Thống kê sử dụng card `adm-stat-card` có sọc màu accent tương ứng nội dung.

---

## 4 tháng 4, 2026 (Hủy sân & hoàn tiền; Coupon modal & font)

### A. Hủy sân & hoàn tiền thủ công

1. **Database Schema (`Database.txt`)**:
   - Mở rộng `refund_requests`: thêm `reason_code`, `requested_amount`, `paid_amount`, `refund_bank_name`, `refund_account_number`, `refund_account_holder`, `player_note`, `rejection_reason`, `manager_note`, `manager_evidence_file_id`, `player_received_file_id`.
   - Migration có điều kiện (ALTER IF NOT EXISTS) cho DB đang chạy.
   - Booking statuses mới: `PENDING_RECONCILIATION`, `PENDING_REFUND`, `REFUNDED`.

2. **Backend API**:
   - `GET /api/bookings/{id}/cancel-preview`: Preview trước khi hủy — trả chính sách snapshot, phí phạt, số tiền hoàn, trạng thái thanh toán, nhánh xử lý (`NO_PAYMENT` / `PROOF_UPLOADED` / `PAID`).
   - `PATCH /api/bookings/{id}/cancel`: Cải tiến — tự tạo `refund_request` theo nhánh; nhận thông tin bank nhận hoàn trong body; set booking status tương ứng; gửi notification cho Manager.
   - `PATCH /api/bookings/{id}/refund-bank-info`: Player cập nhật STK nhận hoàn sau khi hủy.
   - `GET /api/manager/refunds`: Danh sách yêu cầu hoàn tiền cho venue của Manager.
   - `PATCH /api/manager/refunds/{id}/reconcile`: Đối soát — Manager xác nhận đã nhận CK hoặc từ chối kèm lý do.
   - `PATCH /api/manager/refunds/{id}/complete`: Đánh dấu đã CK hoàn tiền xong.
   - `POST /api/manager/refunds/{id}/upload-evidence`: Upload ảnh bill CK hoàn.
   - `ManagerBookingsController`: Khi Manager hủy đơn CONFIRMED đã thu tiền → tự tạo refund_request `PENDING_REFUND`.
   - Notification types mới: `REFUND_REQUEST`, `REFUND_COMPLETED`, `REFUND_REJECTED`, `REFUND_RECONCILED`.

3. **Frontend — Player (`UserBookings.jsx`)**:
   - Cancel Preview Modal: gọi `cancel-preview` API, hiển thị chính sách sân (snapshot), tính toán minh bạch (đã trả / phí phạt / được hoàn), checkbox đồng ý.
   - Nhánh PAID: form nhập STK/QR nhận hoàn ngay trong modal trước khi xác nhận hủy.
   - Nhánh PROOF_UPLOADED: alert chờ đối soát.
   - Tab mới "Hoàn tiền" hiển thị đơn `PENDING_RECONCILIATION`, `PENDING_REFUND`, `REFUNDED`.
   - Bank Info Modal: cho phép cập nhật STK nhận hoàn sau khi đã hủy.

4. **Frontend — Manager (`ManagerRefunds.jsx`)**:
   - Trang quản lý hoàn tiền mới: danh sách tab lọc theo status, bảng chi tiết.
   - Đối soát (Nhánh 2): nút "Đã nhận tiền" / "Từ chối" kèm lý do.
   - Hoàn tiền (Nhánh 3): hiển thị STK Player, upload ảnh bill, bấm "Đã chuyển khoản hoàn tiền".
   - Sidebar Manager: thêm mục "Hoàn tiền" với icon `feather-rotate-ccw`.
   - Route `/manager/refunds` trong `App.jsx`.

### B. Coupon modal & cấu hình font

1. **Quản lý mã khuyến mãi (`ManagerCoupons.jsx`)**:
   - Sửa modal "Tạo mã khuyến mãi" bị `.mgr-topbar` (z-index 1030) che phần đầu: dùng `createPortal(..., document.body)` để render modal ra ngoài `.mgr-page` stacking context; CSS class `.mgr-coupon-modal` (`position: fixed`, `z-index: 1100`, `overflow-y: auto`).
   - Thống nhất typography toàn modal: bỏ `form-control-lg` / `form-select-lg` / inline `fontSize: 18px`; tất cả label 13px, input 14px; section title uppercase 13px; tiêu đề modal 18px.
   - Mã Code cho phép chữ hoa + thường + số (bỏ `toUpperCase()`, `text-uppercase`); regex `^[A-Za-z0-9]+$`.
2. **Sửa lỗi cấu hình font (quan trọng)**:
   - **Gỡ `@fortawesome/fontawesome-free` khỏi npm**: xóa import trong `main.jsx`, chạy `npm uninstall`. Package npm này khi bundle qua Vite sẽ chèn `@font-face` + CSS reset gây lỗi render tiếng Việt (dấu bị méo hoặc font fallback sai).
   - **Load FontAwesome từ file template local**: thêm `<link>` trong `index.html` trỏ tới `public/assets/plugins/fontawesome/css/all.min.css` (v7.1.0, file tĩnh không qua Vite bundle). Các trang Player/landing vẫn dùng class `fa-*` nên cần file này.
   - **Webfonts phải có trong `public/`**: CSS FontAwesome trỏ tới `../webfonts/*.woff2` → các file này phải tồn tại tại `public/assets/plugins/fontawesome/webfonts/`. Nếu thiếu, icon hiện thành hình vuông trắng (□). Cách copy: tạm install npm FA, copy `node_modules/@fortawesome/fontawesome-free/webfonts/*.woff2` vào thư mục trên, rồi uninstall npm. Các file woff2 được commit vào git (static asset cần thiết).
   - **Xóa `font-family` ghi đè trong `ShuttleDatePicker.css`**: 2 chỗ đặt `font-family: system-ui, ...` trên `.shuttle-cal__title` và `.shuttle-cal__day` đã bị bỏ — giờ thừa hưởng "Be Vietnam Pro" từ layout cha.
3. **Quy tắc font cố định**:
   - Font chữ chính: **"Be Vietnam Pro"** (Google Font, hỗ trợ tiếng Việt tốt) — load qua `style.css` template.
   - Icon Manager/Admin: **Feather** (`feather.css`, load qua `<link>` trong `index.html`).
   - Icon Player/landing: **FontAwesome** (file tĩnh `public/assets/plugins/fontawesome/css/all.min.css`, load qua `<link>` trong `index.html`). **KHÔNG dùng npm package**.
   - **KHÔNG** thêm `font-family` tùy chỉnh (system-ui, Roboto, v.v.) vào CSS mới — luôn để `inherit` hoặc dùng CSS variable `var(--mgr-font)` / `var(--adm-font)`.

---

## 7 tháng 4, 2026 (Chính sách sân, Toast hệ thống, Xác minh bank)

### A. Venue Policy & Rules System (hoàn thiện)

1. **Database / Backend**: `venue_rules` (TEXT) đã có trong `Database.txt` + Venue model (DAL & Backend). `VenueCheckoutSettingsDto` có trường `VenueRules`; s`PutCheckoutSettings` dùng `SanitizeText(…, 5000)` strip HTML. Checkout GET (cả public và manager) trả `venueRules`.
2. **Manager UI (`ManagerVenuePolicySettings.jsx`)**: Textarea "Quy định chung tại sân" + nút "Sử dụng mẫu quy định chung" (5 quy tắc mẫu). Có khối refund policy cố định (100% hoàn thủ công khi sân hủy). Preview bên phải real-time.
3. **Player UI (`BookingPayment.jsx`)**: Hiển thị `venueRules` + chính sách hủy trong accordion "Quy định sân & Chính sách hoàn tiền". Checkbox bắt buộc "Tôi đã đọc và đồng ý…". Nút thanh toán **disabled** cho đến khi tick cả checkbox quy định sân lẫn checkbox điều khoản dịch vụ.

### B. Global Toast Notification System

1. **Hạ tầng**: Dùng `react-toastify` (đã có). `ToastContainer` trong `App.jsx` đặt top-right, auto-dismiss 4s, limit 5, newestOnTop.
2. **Hook `useNotification.js`**: export `notify(type, msg, opts)`, `notifySuccess`, `notifyError`, `notifyWarning`, `notifyInfo`. Dùng được cả hook (`useNotification()`) lẫn import trực tiếp hàm.
3. **Notification Content Library (`constants/toastMessages.js`)**: Đối tượng `TOAST` phân theo role — `GUEST` (login/register/reset), `PLAYER` (booking/cancel/matching/refund), `MANAGER` (orders/venue/settings/refund), `ADMIN` (lock/unlock/request).
4. **Axios Interceptor (`axiosClient.js`)**: Response interceptor tự hiện error toast khi status 400/401/403/500, trích `message` từ body. Hỗ trợ `_silenceToast: true` trên config request để tắt toast cho call cụ thể.
5. **Migration toast cũ → mới**: `useAppNotificationsHub` → `notifyInfo`/`notifySuccess`; `ManagerFeaturedPosts`, `ManagerCoupons` → `notifySuccess`/`notifyError`; `RelationshipActions`, `UserSocialFriends`, `UserSocialSearch`, `ChatProvider` → `notifySuccess`/`notifyWarning`/`notifyInfo`; `Login` + `Register` + `ForgotPassword` → `notifySuccess` + `TOAST.*` messages.

### C. Bank Lookup Refinement

1. **Xác minh STK (`ManagerPaymentSettings.jsx`)**: Nút "Xác minh" đặt cạnh ô số tài khoản (thay vì chỉ ở chủ TK). Gọi `lookupBankAccount` (VietQR) — tự điền tên chủ TK nếu thành công.
2. **Account Holder luôn editable**: Nếu lookup fail / chưa cấu hình → chủ TK vẫn sửa tự do. Badge trạng thái (success / not_found / unavailable / error) hiện cạnh label.
3. **Sandbox**: Backend giữ nguyên logic `AccountNumber == "999999"` → trả `NGUYEN VAN TEST (SANDBOX)` không gọi API.

---

## 8 tháng 4, 2026 (Server-side Hold & Unified Booking Flow)

### A. Server-side Soft Lock (HOLDING status)

1. **Database Schema (`Database.txt`)**: Thêm cột `hold_expires_at DATETIME NULL` vào bảng `bookings`. Migration có điều kiện (ALTER IF NOT EXISTS) cho DB cũ. Trạng thái mới `HOLDING` — đặt trước khi thanh toán, TTL 5 phút.
2. **DAL Model**: `Booking.HoldExpiresAt` (nullable DateTime) + EF mapping `HasColumnName("hold_expires_at")`.
3. **BookingSlotHelper**: Collision detection loại trừ `HOLDING` đã hết hạn (`HoldExpiresAt <= UtcNow`), chỉ block slot cho hold còn hiệu lực.
4. **ExpiredHoldCleanupService** (`BackgroundService`): Chạy mỗi 30s, tìm booking `HOLDING` hết hạn → chuyển `CANCELLED`, giải phóng slot. Đăng ký `AddHostedService<>` trong `Program.cs`.
5. **BookingsController — 3 endpoint tạo đơn** (`POST /bookings`, `/bookings/long-term`, `/bookings/long-term/flexible`):
   - Trạng thái khởi tạo: `HOLDING` (thay vì `PENDING`).
   - Set `HoldExpiresAt = UtcNow + 5 min`.
   - **Không** gửi notification cho chủ sân khi tạo (chủ sân chỉ thấy đơn khi có minh chứng CK).
6. **SubmitPayment** (`POST /bookings/{id}/payment`):
   - Cho phép `HOLDING` hoặc `PENDING`. Kiểm tra hold hết hạn → 400 `HOLD_EXPIRED`.
   - Khi `HOLDING` → chuyển booking + items + series (nếu có) sang `PENDING`, xoá `HoldExpiresAt`.
   - Gửi notification "Có đơn đặt sân mới" cho chủ sân (trước đây gửi ở tạo đơn).
7. **GetPaymentContext**: Trả thêm `status`, `holdExpiresAt` cho FE đồng bộ countdown.
8. **ManagerBookingsController**: Lọc `Status != "HOLDING"` — chủ sân không nhìn thấy đơn đang giữ chỗ.

### B. Unified 4-Step Booking UI

1. **BookingConfirm.jsx** (đặt sân đơn): Khi nhấn "Tiếp theo" → gọi `createBooking` API (tạo HOLDING) → navigate `/booking/payment?bookingId=...`. Trước đây chỉ pass state, tạo booking ở bước Payment.
2. **LongTermConfirm.jsx** (cố định): Refactored giao diện thành 2 cột matching BookingConfirm (card sân + form liên hệ + sidebar tóm tắt + mã giảm giá). Đã có gọi API, giữ nguyên.
3. **LongTermFlexibleConfirm.jsx**: Đã có giao diện matching; giữ nguyên.
4. **BookingPayment.jsx**: Viết lại hoàn toàn:
   - Luôn nhận `bookingId` qua query param (không còn tạo booking ở bước này).
   - Fetch context từ `GET /bookings/{id}/payment-context` → lấy `holdExpiresAt`.
   - Countdown **đồng bộ server** (tính từ `holdExpiresAt`, không hardcode 15 phút).
   - Modal hết hạn: 5 phút, redirect về trang sân.
   - Xoá logic "thanh toán lại" / "re-pay".
   - Xoá `createBooking` import & call.
5. **BookingResponseDto**: Thêm `HoldExpiresAt` (nullable).

### C. Loại bỏ "Tiền mặt" (CASH)

1. **bookingsMock.js**: Xoá `CASH` khỏi `PAYMENT_METHODS`, thêm `NONE` ("Chờ minh chứng CK") + `BANK_TRANSFER`. Mock data cũ `CASH` → `BANK`.
2. **ManagerBookings.jsx**: Fallback `CASH` → `NONE`.
3. **BookingDetailModal.jsx**: Fallback `CASH` → `NONE`.
4. **UserBookings.jsx**: `formatPaymentMethodLabel` trả "Chờ minh chứng CK" nếu null/unknown (không còn trả "Chuyển khoản" mặc định).

---

*Cập nhật: gom theo ngày, bổ sung các tinh chỉnh responsive quan trọng ngăn layout bị vỡ trên mobile/Laptop L.*

---

## 8 tháng 4, 2026 (Cập nhật tại chỗ - Update-in-Place cho Đơn đặt sân HOLDING)

1. **Khắc phục lỗi 409 Conflict**: Xử lý vấn đề người dùng quay lại ("Back to Edit") khi đang ở trang thanh toán sẽ tạo ra booking mới bị kẹt ở trạng thái `HOLDING`, gây lỗi trùng lịch giả.
2. **Backend API**:
   - Các API tạo đơn (`POST /bookings`, `/bookings/long-term`) hỗ trợ thêm tham số tuỳ chọn `bookingId` để cập nhật lại booking đang `HOLDING` thay vì tạo mới.
   - Thêm endpoint `POST /bookings/{id}/cancel-hold` để chủ động huỷ đơn `HOLDING` ngay lập tức.
3. **Frontend Cải tiến**:
   - Cập nhật state quản lý form đặt sân để luôn truyền `bookingId` khi quay lại chỉnh sửa.
   - Thêm nút "Hủy đơn" trên trang thanh toán để gọi API `cancel-hold` và giải phóng sân.

---

## 9 tháng 4, 2026 (Hệ thống Xếp hạng Elite Owner & Tối ưu UI Thanh toán)

1. **Hệ thống Xếp hạng Elite Owner**:
   - Xây dựng hệ thống huy hiệu / xếp hạng Elite cho các chủ sân (Manager) có hiệu suất hoạt động và dịch vụ xuất sắc.
   - Run migration lưu hạn mức xếp hạng (rank thresholds).
   - Backend service tính toán xếp hạng tự động.
   - Frontend hiển thị huy hiệu Elite trên Dashboard chủ sân và UI tìm kiếm/thông tin sân cho người dùng.
2. **Soft Reminders (Nhắc nhở nhẹ) cho Đơn chờ**:
   - Tự động nhắc nhở thanh toán (pending bookings) thông qua các Notification Job.
3. **Tối ưu UX Thanh toán & Hoàn tiền (Manager)**:
   - Tích hợp tính năng tải ảnh VietQR trực tiếp.
   - Cải tiến Workflow đối soát & hoàn tiền thuận tiện với giao diện quản lý.

---

## 10-11 tháng 4, 2026 (Smart Court Allocation & Flexible Booking - Phân bổ sân thông minh)

1. **Thuật toán Phân bổ linh hoạt 3 Pha (Backend - `BookingSlotHelper.cs`)**:
   - Triển khai cấp độ "Sân bất kỳ" (Any Court) giải quyết triệt để tính cứng nhắc của việc đặt lịch dài hạn.
   - **Phase 1 (Stability):** Ưu tiên tìm 1 sân trống 100% cho mọi buổi.
   - **Phase 2 (Optimization):** Đổi sân tối thiểu, cố gắng giữ lại sân lấp kín nhất có thể.
   - **Phase 3 (Partial & Upsell):** Loại bỏ slot hết sân, gợi ý sân Premium.
   - Set-cap giới hạn 90 ngày được validate cứng (400 Bad Request) ở Tầng Backend (Server-level security).
2. **DTO & Logic Backend**:
   - Cập nhật `LongTermScheduleDto.cs`: `CourtId` chuyển sang kiểu nullable (`Guid?`).
   - Thêm cờ `AutoSwitchCourt` (Cho phép thuật toán đổi sân nếu kẹt) và cờ `PricePreference` ("BUDGET" cho tiết kiệm, "BEST" cho linh hoạt).
   - Truy vấn Bulk loading toàn bộ conflict trong vòng đời đặt sân lên bộ nhớ (In-memory verification) với độ trễ thấp, thay vì loop từng query DB.
3. **Giao diện & Trải nghiệm Thông minh (Frontend - `LongTermBooking.jsx`)**:
   - **Any Court Dropdown:** Tuỳ chọn ở đầu "🏸 Sân bất kỳ" kèm lời khuyên UI/UX.
   - **Price Filters Radio:** Tuỳ chọn linh hoạt giữa tiết kiệm và tối ưu. Độc lập xuất hiện khi bật Checkbox tính năng linh hoạt.
   - Bảng **Preview Tương tác:** Gồm cột "Sân", "Trạng thái". Slot no c thay đổi do hệ thống chèn vào sẽ có badge màu cảnh báo (🔄) và lời gợi ý tự động (tooltip). Rào xoá các Slot hết sân bằng đường gạch ngang, đỏ (`✖`).
   - **Partial Booking CTA:** Nút sẽ tự động chuyển đổi văn bản sang kiểu chốt linh hoạt (ví dụ: "Đặt 8/10 buổi") thay vì block toàn bộ chuỗi hành động khi có Slot Unavailable. Phối hợp với Backend chỉ trừ tiền đúng 8 buổi.
4. **Tinh chỉnh UI & Trải nghiệm (Frontend)**:
   - Định dạng lại vị trí `ToastContainer` (`App.jsx`), đẩy thông báo toast xuống (`marginTop: '65px'`) để tránh bị che khuất bởi avatar người dùng ở Header.
   - **Lưới lịch linh hoạt (`LongTermFlexible.jsx`):** Đánh dấu trạng thái `in_cart` bằng màu xanh lá (`#16a34a` - Đang chọn) cho các ô/slote hiện đang có trong giỏ hàng. Điều này giúp lịch trực quan hơn khi người chơi đã "Thêm ngày vào đơn" nhưng vẫn đang ở cùng giao diện ngày hôm đó.

---

## 11 tháng 4, 2026 (Đại tu giao diện Dashboard User & Tin nhắn)

1. **Hiện đại hóa Dashboard (SaaS Standard)**:
   - Tái cấu trúc bộ UI Người chơi: `UserProfileEdit.jsx`, `UserProfileChangePassword.jsx`, `UserManagerInfo.jsx`, `UserBookings.jsx`, `UserFavorites.jsx`.
   - **Sửa lỗi hiển thị nút bấm:** Loại bỏ triệt để class `.btn` của Bootstrap gây xung đột màu chữ (trùng màu nền) trên các trang form. Chuyển sang Tailwind utility classes hoàn toàn cho các nút hành động (Emerald Green `#10b981`).
   - **UserFavorites (Sân yêu thích):** Sửa lỗi hiển thị dữ liệu thô (JSON), chuyển sang dùng lưới `row g-4` của Bootstrap đồng bộ với component `VenueCard` để hiển thị sân đẹp như trang chủ.
   - **UserBookings:** Cập nhật bộ lọc Tab pill-shaped và các ô select bo tròn theo chuẩn giao diện hiện đại.

2. **Đại tu toàn diện Chat (`ChatPage.jsx`)**:
   - Đập đi xây lại 100% giao diện chat theo cấu trúc mẫu `user-chat.html`.
   - **Xử lý xung đột Layout:** Thay thế các class khoá cứng layout cũ (`chat-window`, `chat-cont-left`, `chat-cont-right`) bằng hệ thống Flexbox của Tailwind để tránh bị co rúm giao diện do CSS template gốc (`style.css`).
   - **Fix Header Overlap:** Sử dụng container `content-below-header` để đẩy nội dung chat xuống dưới thanh Header cố định, khắc phục lỗi chat bị che khuất.

3. **Quản trị Repository**:
   - Thực hiện Commit & Merge an toàn: Xử lý conflict Git thủ công để bảo vệ mã nguồn giao diện Tailwind mới trước các cập nhật Bootstrap cũ từ remote.
   - Commit message chuẩn hoá tiếng Anh: `fix: resolve user dashboard and chat UI alignment issues`.

4. **Tinh chỉnh UI nhỏ**:
   - Cập nhật Badge số lượng sân yêu thích (dùng `inline-flex` thay cho `.badge` để hiện rõ chữ).
   - Căn chỉnh lại `ToastContainer` để thông báo không đè lên Avatar người dùng.

5. **Giảm giá đặt lịch dài hạn — tách UI + API + chuẩn JSON**:
   - **Lỗi đã sửa:** Trang xác nhận (`LongTermConfirm.jsx`) khi xóa mã voucher gọi `setDiscountInfo(null)` làm mất luôn giảm giá tuần/tháng; sau khi sửa: gọi lại `previewDiscount` với `couponCode: ''` và giữ hai dòng: **Giảm giá đợt dài hạn** / **Giảm giá do mã ưu đãi (mã)**.
   - **Backend (`BookingsController.cs`):** `POST /bookings/preview-discount` trả thêm `longTermDiscountAmount`, `couponDiscountAmount` (tổng `discountAmount` giữ nguyên). Khi mã coupon không hợp lệ, preview vẫn giữ số giảm đợt dài hạn trong body (không trả tổng giảm = 0 như trước).
   - **JSON:** `Program.cs` — `AddJsonOptions` bật `PropertyNamingPolicy = CamelCase` cho response API.
   - **Frontend (`bookingApi.js`):** `normalizePreviewDiscountResponse` gộp camelCase + PascalCase; `previewDiscount()` luôn trả object đã chuẩn hóa. `LongTermConfirm`: `useRef` baseline giảm dài hạn khi chưa có mã — fallback tách dòng nếu API chỉ có `discountAmount` tổng.
   - **Đồng bộ nhãn / preview:** `LongTermBooking.jsx` (khối kết quả xem trước) và `LongTermFlexibleConfirm.jsx` dùng cùng logic nhận field tách / nhãn **Giảm giá đợt dài hạn** khi phù hợp.

6. **Chống sập (Resilience) luồng Đặt Lịch Dài Hạn (Long-term Booking UI & Flow)**:
   - **Mất dữ liệu khi quay lại (Back navigation):** Xóa bỏ nút "Làm lại từ đầu" ở màn hình xác nhận, truyền thẳng State qua `location.state` giúp form ở Bước 1 hydrate lại đầy đủ mọi thông tin cấu hình thay vì reset trắng trơn màn hình.
   - **UI Layout Fix:** Di chuyển bộ Action Buttons (Quay lại, Làm mới) sang góc phải để chừa không gian trống bên trái cho hành động chính (Submit / Xem khung giờ).
   - **Backend Crash on Smart Allocation:** Sửa lỗi `System.ArgumentNullException` (sum price) và `System.NullReferenceException` (court properties) ở `BookingsController.cs` khi API trả về rổ `SmartItems` rỗng hoặc lấy giá trị `.Court` trong khi nó là NULL vì khách hàng dùng "Sân Bất Kỳ (Tự Động Sắp Xếp)".
   - **Frontend Validation Block:** Nới lỏng kiểm tra bắt buộc phải điền `courtId` (vì Sân Bất Kỳ dùng ID null) ở form Xác Nhận Thanh Toán để giúp người dùng vượt qua lỗi giả "Thiếu dữ liệu lịch", đồng thời nhồi ngầm bộ config `autoSwitchCourt` và `pricePreference` xuống Backend để Server hiểu đúng ý đồ Sân Bất Kỳ.

7. **Bảo toàn trạng thái Đặt Sân & Khắc phục Lỗi trùng lịch Ảo (Red slots bug)**:
   - **Backend (BookingSlotHelper.cs & VenuesController.cs)**: Cập nhật hàm CheckSlotConflictsAsync và GetVenueAvailability để nhận parameter excludeHoldingUserId. Hệ thống tự động bỏ qua các khung giờ đang được giữ (HOLDING) tạm thời thuộc về chính user hiện tại để khắc phục triệt để lỗi "Hiển thị màu đỏ" khi người dùng từ bước Xác Nhận quay lại bước Chọn Lịch do slot bị HOLD bởi chính họ.
   - **Frontend (BookingTimeline.jsx)**: Khôi phục lại selection đã chọn trước đó từ location.state.selectedSlots thông qua useState(initialSelections). Loại bỏ useEffect vô tình clear selections khi component mount lần đầu.
   - **UI Bảng biểu (BookingConfirm & BookingPayment)**: Thêm tính năng Sort thông minh (hook useState và useMemo) dựa theo Sân, Giờ, hoặc giá tiền. Có mũi tên lên xuống thể hiện hướng Sort trực quan tại các bảng tóm tắt đơn đặt sân.

8. **Tìm kiếm không dấu (toàn app FE + API Matching)**:
   - **Tiện ích:** `ShuttleUp.Frontend/src/utils/searchNormalize.js` — `normalizeSearchText` (NFD, bỏ dấu kết hợp, gộp khoảng trắng, thường); `normalizedIncludes` / `normalizedIncludesAny`.
   - **Frontend:** `SearchableSelect.jsx`; `vietnamDivisions.js` (`normalizeKey` dùng chung helper); lọc danh sách có ô search: Manager (Bookings, Earnings, Venue list/courts, Payment bank picker), Matching (`MatchingHub` tab Của tôi/Đã tham gia, `MatchingPostDetail` slot, `MatchingComments` @mention), Admin/Manager Featured Posts (`normalizedIncludesAny`), `VenuesListing` (tên + địa điểm); `nominatimGeocode.js`341. **Số hóa tìm kiếm thông minh (Search Normalization Upgrade)**:
    - Cập nhật `normalizeSearchText` trong `utils/searchNormalize.js`:
        - Tự động loại bỏ các tiền tố hành chính: `Thành phố`, `Quận`, `Huyện`, `TP`, `Q`, `P`...
        - Xử lý Alias địa danh đa vùng: Tự động chuẩn hóa song phương (Query và DB) cho nhiều tỉnh thành lớn (**Hà Nội -> HN, HCM -> hcm, Đà Nẵng -> DN, Cần Thơ -> CT**, biểu đồ 12+ tỉnh thành).
        - Loại bỏ dấu câu (`.`, `,`, `-`) để đảm bảo ranh giới từ sạch khi so khớp.
 hành vi không dấu. *(Các API search khác chỉ gửi `search` lên server vẫn phụ thuộc logic từng endpoint.)*

9. **Sửa build Backend: Guid vs string (excludeHoldingUserId)**:
   - `Booking.UserId` là `Guid?`; tham số `excludeHoldingUserId` của `CheckSlotConflictsAsync` phải là `Guid?` (không phải `string?`) để khớp caller `BookingsController` và biểu thức LINQ.
   - `VenuesController` (availability theo ngày): parse claim `NameIdentifier` bằng `Guid.TryParse`, dùng `Guid` trong `Where` so với `Booking.UserId` (trước đó so chuỗi với `Guid?` gây CS0019).

10. **Hệ thống Đặc Quyền Chủ Sân (Elite Owner System)**:
    - **Backend**: Thêm cơ chế đánh giá xếp hạng chủ sân. Những chủ sân duyệt nhanh các đơn đặt sân PENDING dướí 60 phút sẽ được gắn cờ `IsElite`. (Logic hỗ trợ UI badge tại `ManagerProvider` và `VenueCard`).
    - **Frontend**: Hiển thị huy hiệu Elite / Nhanh Nhạy cực kỳ uy tín trên thẻ sân ở màn hình Khám Phá và tại Dashboard Quản Lý (Badge Gradient với Icon vương miện).

11. **Tối ưu Hóa Quy trình "Update-in-place" cho Đặt Sân**:
    - **Giải quyết lỗi 409 Conflict**: Thay vì ném lỗi khi khách quay lại trang đặt sân và hệ thống phát hiện họ đang có một lịch HOLDING trùng lập, nay Controller tự động nhận diện `bookingId` truyền lên để "Cập nhật hóa" (Update-in-place) biên lai HOLDING hiện hữu (Tên Khách, SĐT, Ghi chú) thay vì tạo mới.
    - **API Hỗ trợ**: Bổ sung POST `/api/bookings/{id}/cancel-hold` để giải phóng cọc khi khách chủ động "Hủy Đơn Đang Treo" trên UI.

12. **Bệ phóng Email Tự Động (Production Email Dispatching System)**:
    - **Cấu hình SMTP**: Đấu nối `appsettings.json` vào luồng gửi đi của `ShuttleUp` (tài khoản Gmail dự án).
    - **Email Templates**: Thiết kế các khung Email HTML thương hiệu sang trọng (Màu xanh Forest) không bị vỡ do lỗi mã hóa kép thay vì text chay thô.
    - **3 Luồng Giao Tiếp**: 
      1. Background Worker (Chạy ngầm cứ 5 phút/lần) tự quét các đơn `CONFIRMED` sắp đến giờ (dưới 2h) để nhắc Nhở Người Chơi lên đồ đi vận động.
      2. Thông báo Owner ngay khi có "Đơn Mới" (kèm cảnh báo ranh giới 60 phút để giữ rank Elite !).
      3. Tính năng "Soft Reminder" (Khách hối thúc duyệt) kèm bộ đếm lùi tản nhiệt trên UI + Cache Rate Limit gửi về Chủ sân.

---

## 12–13 tháng 4, 2026 (Linh hoạt hóa Đơn vị Giờ Chẵn & Vá lỗi Timezone Khung lưới)

1. **Tuỳ chỉnh Đơn vị Giờ Chẵn (Customizable Slot Duration)**:
   - **Database & Backend Context**: Thay vì fix cứng 30 phút, `venues` nay có thêm cột `slot_duration` (Default 60). Các Endpoint `ManagerVenuesController` và `VenuesController` sẽ validate giới hạn cứng 3 choices an toàn: 30, 60, và 120 phút.
   - **Safe Transition (Lá chắn An Toàn)**: Ngăn chặn chủ sân (Manager) sửa bậy quy tắc Giờ Chẵn khi cụm sân đó còn đang tồn tại các đơn "Sắp Diễn Ra / Future Bookings". API Controller sẽ trả thẳng `400 Bad Request` nếu phát hiện có người chơi đang cầm lịch tương lai chưa đánh xong.
   - **Giao diện Chủ Sân (Manager)**: Cung cấp Checkbox Select "Đơn vị giờ chẵn" (`ManagerAddVenue`). Label nhập tiền sân của `ManagerAddCourt` tự động biến hình tương ứng: *đ / 30 phút*, *đ / giờ*, *đ / 2 giờ*. 

2. **Cơ chế Lưới Thời Gian Động (Dynamic Grid Timeline Engine)**:
   - Viết lại toàn bộ bộ não dựng lưới của 2 giao diện `BookingTimeline.jsx` (Lịch Trực Quan Khách lẻ) và `LongTermFlexible.jsx` (Lịch Linh Hoạt Khách sỉ).
   - Bơm `slotDuration` từ API/Cache xuống mọi hàm: `computeSlotCount`, `slotLocalBounds`, `getPriceForSlot`, `intervalsToGridBlocks`.
   - **Chống Rendering Dư Thừa (Ghost Slots)**: Thuật toán `Math.floor` sẽ gọt rũa chuẩn xác các Slot trườn ra ngoài ranh giới đóng cửa 24:00 (Ví dụ: Slot 120 phút sẽ tự end mượt mà ở 23:00 mà không sinh ra bóng ma slot 23:00-25:00).
   - **Tối ưu Hóa API Fetches**: Áp dụng cơ chế Conditional Fetch qua Context Router Cache `location.state`. Chỉ chạy Fecth API cấu hình sân nếu End user f5 trắng lại trình duyệt (giảm lượng HTTP hit cho CSDL).

3. **Vá Lỗi Nhảy Ngày Timezone (UTC Midnight Glitch)**:
   - **Tình trạng Phân Lập Múi Giờ**: Ở các khung Giờ Việt Nam `00:00 -> 06:59 AM`, hàm `toISOString().split('T')[0]` sẽ ói ra ngày "Hôm Qua" (Vì máy chủ Node/Browser UTC vẫn đang ở ngày cũ). Sự cố này khiến cho UI Calendar của Người chơi mặc định hiển thị ngày hôm qua, và gây loạn phán đoán ô bị mờ.
   - **Giải pháp**: Xây dựng util helper `localIsoDate(new Date())` (Sử dụng Date Get API thuần: `getFullYear`, `getMonth()`, `getDate()`) giúp khoá cứng String Time theo Local TimeZone.
   - **Tối ưu Hàm `isPastSlot`**: Lột bỏ cơ chế chặn mờ rối rắm thông qua Ngày. Thay vào đó quy chiếu quy luật duy nhất: Nếu Epoch MS của điểm cuối slot (`end.getTime()`) bé hơn hoặc bằng `now.getTime()` thì Slot đó chính thức Bị Xám. Trị dứt điểm căn bệnh ấn được vào ô quá khứ khi Back về Ngày của Hôm qua.

---

## 12–13 tháng 4, 2026 (Ổn định hồ sơ Quản lý & UI Admin)

1. **Sửa lỗi mất Giấy phép kinh doanh (Manager Profile):**
   - **Vấn đề**: Khi Manager cập nhật thông tin (như mã số thuế/địa chỉ) mà không thay đổi giấy phép, các file giấy phép cũ bị xóa sạch do backend hiểu nhầm là lệnh xóa hết.
   - **Giải pháp**: Frontend (`UserManagerInfo.jsx`) thêm trạng thái `licensesDirty`. Chỉ khi người chơi thực sự thêm hoặc xóa file giấy phép thì mới gửi field `retainedLicenseIds` lên API.
   - **API (`managerProfileApi.js`)**: Điều chỉnh để field `retainedLicenseIds` là tùy chọn, chỉ đính kèm vào `FormData` khi có flag `licensesDirty`. Backend sẽ giữ nguyên các slot hiện tại nếu không nhận được field này.
2. **Điều hướng Đăng nhập Admin (Login Redirection):**
   - Sửa lỗi Admin sau khi đăng nhập vẫn bị kẹt ở trang Profile của Player hoặc trang trước đó.
   - Cập nhật `Login.jsx`: Bổ sung logic kiểm tra role sau khi đăng nhập thành công. Nếu là `ADMIN`, hệ thống sẽ luôn ưu tiên điều hướng về `/admin/dashboard`.
3. **UI Admin (Lightbox Image Preview):**
   - Sửa lỗi Modal xem ảnh giấy phép bị sidebar và header che mất (do xung đột z-index và stacking context).
   - Giải pháp: Refactor `AdminManagerRequests.jsx` sử dụng `createPortal` từ `react-dom` để render modal trực tiếp vào `document.body`, thoát khỏi các lớp layout bị giới hạn của Admin Dashboard.
4. **Database Migration (Upcoming Tasks):**
   - Xác định lỗi schema thiếu cột `is_upcoming_reminder_sent` trong bảng `booking_items` gây crash service nhắc nhở. Cần cập nhật `Database.txt` hoặc chạy lệnh migration bổ sung.

---

## 13 tháng 4, 2026 (Fix Hệ thống Giảm giá Dài hạn & Quy chế Liên tục)

1. **Chuẩn hoá logic giảm giá (Consecutive Day Logic):**
   - **Vấn đề**: Trước đây hệ thống tính giảm giá Tuần (5%) và Tháng (50%) dựa trên khoảng cách giữa ngày bắt đầu và ngày kết thúc (`rangeEnd - rangeStart`). Điều này dẫn đến lỗi nghiêm trọng: khách chỉ đặt 4 ngày thứ Năm trong 1 tháng vẫn được giảm 50%.
   - **Giải pháp - Option A (Liên tục)**: Quy chế mới yêu cầu khách phải đặt sân **mỗi ngày liên tiếp** (không được ngắt quãng dù chỉ 1 ngày).
   - **Backend**: 
     - Sửa `CalculateDiscountAsync` để nhận danh sách ngày thực (`List<DateTime> bookedDates`).
     - Viết hàm `ComputeLongestConsecutiveStreak` để tìm chuỗi ngày liên tục dài nhất trong danh sách đặt sân.
     - Chỉ áp dụng mức giảm giá nếu `streak >= 7` (Tuần) hoặc `streak >= 30` (Tháng).
   - **API & DTO**: 
     - Mở rộng `PreviewDiscountDto` thêm trường `BookedDates` (danh sách String ISO).
     - Cập nhật 4 luồng: `CreateBooking` (Lẻ), `CreateLongTermBooking` (Sỉ cố định), `CreateLongTermFlexibleBooking` (Sỉ linh hoạt), và API xem trước giảm giá.
   - **Frontend**: 
     - Đồng bộ cả 3 trang đặt sân (`LongTermBooking`, `LongTermConfirm`, `LongTermFlexibleConfirm`) truyền danh sách ngày thực tế xuống Backend.
     - Cập nhật nội dung chính sách UI: "giảm X% khi đặt sân **liên tục** từ Y ngày trở lên".

2. **Khắc phục lỗi đứt gãy State của React Router (Back Navigation)**:
   - **Tình trạng**: Di chuyển ngược từ `BookingPayment` (màn Thanh toán) về lại `LongTermConfirm` (màn Xác nhận) bị mất các metadata quan trọng của luồng dài hạn (như thứ trong tuần, giờ cụ thể), dẫn đến việc form ở Bước 1 bị reset rỗng khi lùi về.
   - **Giải pháp**: Xây dựng cầu nối truyền state thông suốt. Bổ sung `location.state` vào tham số `navigate` của `LongTermConfirm.jsx` sang `BookingPayment.jsx`. Tại màn thanh toán, tiến hành hợp nhất `...(location.state || {})` vào biến `backState` trước khi trả hành khách về tuyến đường cũ.
   - Bổ sung kịp thời import hook `useLocation` bị thiếu gây lỗi trắng trang màn hình.

3. **Cải tiến UI Đồng Bộ Cảnh Báo "Đổi Sân" (LongTermBooking.jsx)**:
   - Đồng bộ hoàn toàn tín hiệu thiết kế giữa Trạng thái "Đổi Sân" và "Sẵn Sàng".
   - Loại bỏ nhãn thẻ block thô cứng và emoji. Định dạng chữ mỏng `d-inline-flex gap-1 text-warning`, kết hợp biểu tượng `<i className="feather-refresh-cw" />` bo góc tương tự phong thái của `feather-check-circle text-success`. Tạo cảm giác chuyên nghiệp, liền lạc của một Web App thứ thiệt.
