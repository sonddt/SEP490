# API Contract & Data Formats

## 1. Conventions chung
- **URL Base:** `/api/v1`
- **Request/Response Format:** `application/json`
- **Authentication:** `Bearer {JWT_TOKEN}`
- **Standard Response Envelope (Hạn chế tối đa bọc lỏng lẻo):**
  - Trả thẳng list rỗng `[]` nếu không có dữ liệu thay vì `{ "data": null }`.
  - Nếu có lỗi Bad Request: Trả `{ "errors": { "fieldName": ["Message"] }}` (Theo chuẩn ASP.NET ModelState).

## 2. Các Module chính
### 2.1. Authentication (Xác thực)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-otp`

### 2.2. Venues & Courts (Cơ sở cầu lông)
- `GET /api/venues`: Xem danh sách tất cả cụm sân (chỉ hiện `IsActive = true`).
- `GET /api/venues/{id}`: Xem chi tiết.
- `GET /manager/venues`: Xem sân do Manager quản lý (Draft & Active).
- `PUT /manager/venues/{id}/publish`: Publish cụm sân lên trạng thái hoạt động.
- `POST /manager/venues/{id}/courts`: Tạo sân con mới. Lịch và Giá thiết lập theo mảng TimeSlots.

### 2.3. Booking (Đặt sân)
- `GET /api/bookings/available-slots`: Player lấy danh sách giờ trống.
- `POST /api/bookings`: Player tiến hành book sân, chờ thanh toán.
- `PUT /api/bookings/{id}/confirm-payment`: Manager duyệt thanh toán và check-in cho khách.
- **Lịch dài hạn (một đơn, nhiều slot 30 phút, thanh toán một lần):**
  - `POST /api/bookings/long-term/preview` — body: `venueId`, `courtId`, `startTime`, `endTime` (HH:mm), `dayOfWeek` (0–6, CN=0), `fromDate`, `toDate` (yyyy-MM-dd). Trả về `items`, `totalAmount`, `occurrenceCount`, `conflictCount`, `invalidOccurrences` (nếu có).
  - `POST /api/bookings/long-term` — cùng payload + `contactName`, `contactPhone`, `note` (optional). Tạo `booking_series` + một `booking` + toàn bộ `booking_items`; giới hạn tối đa 400 slot.
  - **Lịch dài hạn linh hoạt** (nhiều ngày/slot tự chọn, cùng mô hình một đơn + `booking_series` với `recurrence_rule_json` type `FLEXIBLE`):
    - `POST /api/bookings/long-term/flexible/preview` — body: `venueId`, `items` (mảng `{ courtId, startTime, endTime }` — ISO local, khung là bội 30 phút). Trả `slotCount`, `totalAmount`, `rangeStart`, `rangeEnd`, `items`.
    - `POST /api/bookings/long-term/flexible` — `venueId`, `items`, `contactName`, `contactPhone`, `note` (optional). Tạo series + booking + items; tối đa 400 ô slot.
- `GET /api/bookings/my` — mỗi phần tử có thêm `seriesId` (nullable), `isLongTerm` (bool).
- `GET /api/manager/bookings` — mỗi phần tử có thêm `seriesId`, `isLongTerm` để badge UI.

### 2.4. Matching (Kèo giao lưu)
- `GET /api/matching-posts`: Xem danh sách các kèo đang mở (chưa đủ người).
- `POST /api/matching-posts`: Tạo kèo mới.
- `POST /api/matching-posts/{id}/join`: Gửi yêu cầu xin tham gia kèo (Join Request).
- `PUT /api/matching-posts/{id}/requests/{reqId}/accept`: Host duyệt cho vào kèo (Tự đóng kèo nếu đủ Slot).
- `PUT /api/matching-posts/{id}/reopen`: Host mở lại kèo nếu có ai đó huỷ ngang.

## 3. Web Socket (SignalR)
- **Hub URL:** `/hubs/shuttleup`
- Bắn sự kiện `ReceiveNotification` cho Player khi Join Request được Accepted / Rejected.
- Bắn sự kiện `NewBookingAlert` cho Manager khi có đơn mới.
