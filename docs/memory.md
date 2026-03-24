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
