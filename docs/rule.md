# Project & AI Rules

> File này lữu trữ các nguyên tắc bắt buộc dành cho bất kì Assistant/AI nào (Cursor, Windsurf, Copilot, v.v...) tham gia viết mã nguồn cho dự án này.

## Quy tắc 1: Cập nhật `docs/memory.md` liên tục
- Mọi Assistant **BẮT BUỘC** phải ghi lại và tóm tắt những thay đổi lớn về code, fix bug, kiến trúc, thay đổi DB hoặc quy tắc triển khai... vào file `docs/memory.md` ngay sau khi phiên làm việc/nhiệm vụ (Task) hoàn tất hoặc có thay đổi quan trọng.
- Thông tin phải được ghi thật ngắn gọn, rành mạch và có dấu mốc thời gian.
- Điều này để đảm bảo ngữ cảnh của toàn bộ dự án luôn được bảo lưu vững chắc khi người dùng mở phiên làm việc mới, loại bỏ các nỗ lực đi lại lối mòn hoặc lặp lại công việc đã làm rồi.

## Quy tắc 2: Clean code & Tích cực (UX Copywriting)
- Mọi message hiển thị ra màn hình cho người dùng cuối (Player, Manager) không được dùng từ gay gắt như "Lỗi", "Thất bại". Luôn dùng ngôn từ hướng dẫn linh hoạt, thân thiện, mang tính hành động (VD: "Oops...", "Bạn vui lòng điền...", "Tuyệt vời...", các số lượng dùng số "3" thay vì chữ "ba").
- Ưu tiên dùng `Inline Field Validation` (hiển thị fieldErrors đỏ ngay dưới từng ô input) thay cho một alert to tướng trên cùng.

*(Cập nhật thêm khi dự án phát triển...)*

## Quy tắc 3: `Database.txt` là nguồn sự thật duy nhất cho Schema DB
- Bất kỳ khi nào có thay đổi schema DB (thêm bảng, thêm cột, xóa cột, đổi kiểu dữ liệu...), **BẮT BUỘC** phải cập nhật file `Database.txt` ngay lập tức, trong cùng một phiên làm việc.
- File `Database.txt` phải luôn ở trạng thái có thể **copy toàn bộ và chạy một lần duy nhất** để tạo lại toàn bộ database từ đầu (idempotent: DROP IF EXISTS → CREATE → INSERT seed data).
- Không được tách riêng migration file chỉ cho một tính năng mà bỏ qua chỉnh sửa `Database.txt` — cả hai phải đồng bộ.
- Ghi chú cho Assistant: Sau khi sửa schema C# Entity hay `DbContext`, hãy kiểm tra ngay `Database.txt` và cập nhật nếu chưa đồng bộ.

