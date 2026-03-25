# Testing Criteria & Edge Cases

## 1. Booking Module (HOÀN TẤT)
- [x] Chọn slots và thanh toán thành công (Pass).
- [x] Không thể chọn các `TimeSlot` đã được đặt hoặc quá hạn (Pass).
- [x] Lỗi trùng giờ (Pass).

## 2. Manager Venues (Draft to Publish)
- [x] **Pass:** Venue không cho phép sửa Info khi chưa Publish, trừ khi tạo Court.
- [x] **Edge Case 1:** Ấn Publish nhưng thiếu Court / Thiếu Giá / Thiếu File Giấy Phép -> Báo lỗi.
- [x] **Edge Case 2:** Ấn Unpublish nhưng đang có Booking tuần sau -> Không cho Unpublish, báo lỗi.

## 3. Manager UI Validations (HOÀN TẤT)
- [x] **Pass:** 100% Form nhập liệu có hiển thị Validation inline dạng `is-invalid` (đường viền đỏ và text lỗi ngay dưới).
- [x] **UX Checking:** Các thông báo sử dụng chuẩn UX "Bạn quên nhập..." thay cho "Lỗi kỹ thuật!".
- [x] **Numbers Check:** Hiện diện chữ số (VD "3 file") thay cho chữ (VD "ba file").

## 4. Matching Module (SẮP TỚI)
- [ ] **Pass:** Flow tạo kèo, xin tham gia kèo, duyệt tham gia suôn sẻ.
- [ ] **Edge Case 1:** Host ấn Accept nhưng kèo đã đủ số lượng -> Báo lỗi Full.
- [ ] **Edge Case 2:** Người tham gia gửi `Join Request` nhiều lần vào cùng một kèo -> Báo lỗi "Bạn đã xin tham gia kèo này".
- [ ] **Edge Case 3:** Flow "Reopen" khi có người huỷ kèo -> Post Status chuyển từ CLOSED sang ACTIVE và tiếp tục nhận yêu cầu.
- [ ] **Real-time (SignalR):** Phải nhận được thông báo Popup khi Host thao tác với yêu cầu tham gia.
