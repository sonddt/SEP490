-- Bình luận matching: cột parent_comment_id (thread 1 cấp) + FK.
-- Chạy sau khi đã USE <tên_database> của bạn (hoặc chọn schema trong Workbench).
-- Có thể chạy lại an toàn (bỏ qua nếu đã tồn tại).

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments' AND column_name = 'parent_comment_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE matching_post_comments ADD COLUMN parent_comment_id CHAR(36) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments'
    AND constraint_name = 'matching_post_comments_parent_fk'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE matching_post_comments ADD CONSTRAINT matching_post_comments_parent_fk FOREIGN KEY (parent_comment_id) REFERENCES matching_post_comments(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
