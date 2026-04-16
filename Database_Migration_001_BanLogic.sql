-- Migration for Ban Logic Feature
-- Thêm các cột phục vụ cho luồng cấm tài khoản (Grace Period)

ALTER TABLE `user` 
ADD COLUMN `ban_type` VARCHAR(10) NULL DEFAULT NULL AFTER `blocked_reason`,
ADD COLUMN `soft_ban_expires_at` DATETIME NULL DEFAULT NULL AFTER `ban_type`;

-- Nếu DB schema name khác (ví dụ Users thay vì user) hãy điều chỉnh cho phù hợp nha.
