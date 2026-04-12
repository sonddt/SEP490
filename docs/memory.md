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
- Backend: `SocialController` (`/api/social`) — privacy, tìm exact/name, lời mời, bạn bè, chặn, `GET relationship/{id}`; thông báo `FRIEND_REQUEST` / `FRIEND_ACCEPTED` + `deepLink` trong metadata; `ProfileController`: `GET /api/profile/{userId}` (hồ sơ tối thiểu, `relationshipState`, `pendingRequestId` khi `PENDING_IN`).
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
   - `MatchingPostDetail.jsx`: Dashboard quản lý cho host (duyệt/từ chối/kick) và seeker (form xin tham gia, countdown slots).
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

## 12–13 tháng 4, 2026 (Hoàn thiện Report & Sửa lỗi giao diện)

1. **Tinh chỉnh tính năng Báo cáo (Violation Report)**:
   - **Backend**: Xoá `ViolationReportController.cs` (phiên bản cũ trùng lặp). Tập trung xử lý tại `ReportsController` (Player tạo) và `AdminReportsController` (Admin xử lý).
   - **Validation**: Thêm check chống tự-report (TargetType USER) và chống spam (chỉ 1 báo cáo PENDING cho mỗi cặp user-target).
   - **Admin UX**: Sửa dropdown trạng thái trong `AdminReports.jsx` chỉ cập nhật local state, yêu cầu bấm "Lưu" mới gửi API (tránh Admin bấm nhầm đổi trạng thái ngay lập tức).
2. **Sửa lỗi giao diện quan trọng (Frontend Fixes)**:
   - **Bootstrap JS**: Bổ sung `bootstrap.bundle.min.js` vào `index.html`. Sửa lỗi nút 3 chấm (...) và các dropdown trong app không hoạt động.
   - **Chống kẹt màn hình tối (Blackout)**: Thêm cơ chế cleanup vào `App.jsx`. Tự động xóa class `modal-open` và các thẻ `modal-backdrop` dư thừa mỗi khi chuyển trang (route change), giải quyết triệt để lỗi màn hình bị tối sầm và khóa click sau khi login hoặc chuyển hướng.


