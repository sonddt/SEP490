-- =====================================================================
-- Migration: Bảng kết bạn, chặn user-user, cài đặt tìm kiếm (email/SĐT)
-- Chạy trên MySQL database shuttle_up (hoặc DB team đang dùng).
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_privacy_settings (
    user_id CHAR(36) PRIMARY KEY,
    allow_find_by_email TINYINT(1) NOT NULL DEFAULT 1,
    allow_find_by_phone TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id CHAR(36) NOT NULL,
    blocked_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id),
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_blocks_blocked (blocked_id)
);

CREATE TABLE IF NOT EXISTS friendships (
    id CHAR(36) PRIMARY KEY,
    user_low_id CHAR(36) NOT NULL,
    user_high_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_friend_pair (user_low_id, user_high_id),
    FOREIGN KEY (user_low_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_high_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS friend_requests (
    id CHAR(36) PRIMARY KEY,
    from_user_id CHAR(36) NOT NULL,
    to_user_id CHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    INDEX idx_friend_req_to_status (to_user_id, status),
    INDEX idx_friend_req_from_status (from_user_id, status),
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Hàng mặc định privacy cho user đã tồn tại (bỏ qua nếu đã có)
INSERT IGNORE INTO user_privacy_settings (user_id, allow_find_by_email, allow_find_by_phone)
SELECT id, 1, 1 FROM users;
