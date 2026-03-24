# Development Memory (Lịch sử làm việc)

## Mar 20, 2026 - Mar 22, 2026
1. Hoàn thành chức năng xử lý nghiệp vụ Booking cốt lõi. Gồm xem lịch trống, tính toán Slot Time 30 phút, check trùng lặp (Concurrency) rất chặt chẽ ở DB. Đoạn Player Booking kết thúc thành công.
2. Thiết kế API chuẩn RESTful cho Manager tạo Cụm Sân.
3. Tổ chức lại toàn bộ Validation Form trên FrontEnd Manager thành Inline Validation, chuẩn UX SaaS (Dùng số, không dùng chữ, thân thiện, nhẹ nhàng).

## Điều cần nhớ (Memory hooks):
- **User Preference:** Giọng điệu giao diện phải luôn RẤT vui vẻ, cởi mở. Từ "Lỗi" (Error) bị cấm ngặt. Không bao giờ được render Validation dưới dạng Alert Box to đùng ở góc màn hình hay Alert native của browser.
- Sân (Venue) có logic Draft -> Active. Không cho Publish nếu thiếu Courts hoặc cấu hình giá. Đã code `VenueService` đáp ứng tiêu chuẩn này.
- Cloudinary Keys được giấu kín tại `.env` (Frontend) hoặc Secret Manager (Backend). Đừng lộ API Key lên repo.
- Phần Booking Player đã HOÀN TẤT. Đừng phí thời gian lặp lại nó nữa. Giờ nhiệm vụ trọng tâm là tập trung sức cho Matching Module.
