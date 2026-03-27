-- =====================================================================
-- Migration: Thêm các cột cá nhân hoá vào bảng users
-- Chạy script này trên MySQL database của bạn để kích hoạt tính năng Personalization
-- =====================================================================

-- Thêm cột skill_level (trình độ)
ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_level VARCHAR(50) NULL AFTER date_of_birth;

-- Thêm cột play_purpose (mục tiêu chơi)
ALTER TABLE users ADD COLUMN IF NOT EXISTS play_purpose VARCHAR(100) NULL AFTER skill_level;

-- Thêm cột play_frequency (tần suất chơi)
ALTER TABLE users ADD COLUMN IF NOT EXISTS play_frequency VARCHAR(50) NULL AFTER play_purpose;

-- Thêm cột is_personalized (đã hoàn thành onboarding chưa)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_personalized BOOLEAN DEFAULT FALSE AFTER play_frequency;

-- Kiểm tra kết quả
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'users'
  AND COLUMN_NAME IN ('skill_level', 'play_purpose', 'play_frequency', 'is_personalized')
ORDER BY ORDINAL_POSITION;
