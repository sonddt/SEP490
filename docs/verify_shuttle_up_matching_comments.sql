-- Kiểm tra schema bình luận matching trên ĐÚNG database backend đang dùng.
-- 1) Mở file này, sửa USE nếu appsettings của bạn dùng tên DB khác (mặc định shuttle_up).
-- 2) Chạy toàn bộ. Phải thấy dòng parent_comment_id và (nếu dùng ảnh) attachment_file_id.

USE shuttle_up;

SELECT DATABASE() AS db_connected;

SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'matching_post_comments'
ORDER BY ORDINAL_POSITION;

-- Kỳ vọng: có cột parent_comment_id (reply 1 cấp) và attachment_file_id (ảnh).
