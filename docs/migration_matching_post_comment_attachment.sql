-- Ảnh đính kèm bình luận matching (attachment_file_id → files).
-- Chạy sau khi đã USE <tên_database>; có thể chạy lại an toàn.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments' AND column_name = 'attachment_file_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE matching_post_comments ADD COLUMN attachment_file_id CHAR(36) NULL COMMENT ''FK files — ảnh đính kèm''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments'
    AND constraint_name = 'matching_post_comments_attachment_fk'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE matching_post_comments ADD CONSTRAINT matching_post_comments_attachment_fk FOREIGN KEY (attachment_file_id) REFERENCES files(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
