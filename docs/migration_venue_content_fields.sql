-- Migration: Thêm các cột nội dung trang chi tiết sân vào bảng venues
-- Ngày tạo: 4 tháng 4, 2026
-- Mô tả: description đã có sẵn; thêm includes, rules, amenities dạng JSON

ALTER TABLE venues
    ADD COLUMN IF NOT EXISTS includes JSON NULL COMMENT 'Mảng chuỗi — những gì khách được sử dụng khi thuê sân'
        AFTER contact_phone,
    ADD COLUMN IF NOT EXISTS rules JSON NULL COMMENT 'Mảng chuỗi — các quy định tại cơ sở'
        AFTER includes,
    ADD COLUMN IF NOT EXISTS amenities JSON NULL COMMENT 'Mảng key chuỗi — tiện ích có tại cơ sở (parking, wifi, ...)'
        AFTER rules;
