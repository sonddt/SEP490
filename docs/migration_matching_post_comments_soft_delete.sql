-- Chạy trên database đang dùng (ví dụ shuttle_up).
-- Sửa lỗi: Unknown column 'm.is_deleted' — backend đã map xóa mềm, bảng cần thêm cột.
-- An toàn chạy lại: chỉ ADD nếu chưa có.

USE shuttle_up;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments' AND column_name = 'is_deleted'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE matching_post_comments ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments' AND column_name = 'deleted_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE matching_post_comments ADD COLUMN deleted_at DATETIME NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments' AND column_name = 'deleted_by_user_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE matching_post_comments ADD COLUMN deleted_by_user_id CHAR(36) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments' AND column_name = 'updated_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE matching_post_comments ADD COLUMN updated_at DATETIME NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments'
    AND constraint_name = 'matching_post_comments_deleted_by_fk'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE matching_post_comments ADD CONSTRAINT matching_post_comments_deleted_by_fk FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'matching_post_comments' AND index_name = 'idx_matching_comments_post_active'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_matching_comments_post_active ON matching_post_comments (post_id, is_deleted, created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
