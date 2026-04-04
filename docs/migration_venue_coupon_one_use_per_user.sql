-- Mã khuyến mãi: tùy chọn giới hạn 1 lần / tài khoản (chạy trên DB đang có)
-- Sau khi chạy: restart backend, cấu hình trên Manager → Quản lý khuyến mãi

SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = 'venue_coupons' AND column_name = 'one_use_per_user');
SET @sql := IF(@col = 0,
  'ALTER TABLE venue_coupons ADD COLUMN one_use_per_user TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''TRUE: mỗi user chỉ dùng mã 1 lần (đơn không huỷ)''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
