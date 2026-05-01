/**
 * Centralized toast message library for all roles.
 * Usage: import { TOAST } from '…/constants/toastMessages';
 *        notifySuccess(TOAST.PLAYER.BOOKING_SUCCESS);
 */

export const TOAST = {
  GUEST: {
    LOGIN_SUCCESS:          'Đăng nhập thành công!',
    LOGIN_FAIL:             'Oops — Sai email hoặc mật khẩu. Vui lòng thử lại.',
    LOGIN_LOCKED:           'Tài khoản đã bị khóa. Liên hệ hỗ trợ để được giúp đỡ.',
    REGISTER_SUCCESS:       'Đăng ký thành công! Chào mừng bạn đến ShuttleUp.',
    REGISTER_FAIL:          'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.',
    RESET_PASSWORD_SUCCESS: 'Đặt lại mật khẩu thành công! Hãy đăng nhập lại.',
    RESET_PASSWORD_FAIL:    'Không thể đặt lại mật khẩu. Link có thể đã hết hạn.',
    FORGOT_PASSWORD_SENT:   'Email khôi phục đã được gửi. Kiểm tra hộp thư nhé!',
  },

  PLAYER: {
    BOOKING_SUCCESS:        'Đặt sân thành công! Chờ thanh toán để xác nhận.',
    BOOKING_CONFLICT:       'Oops — Trùng lịch! Khung giờ này đã được đặt.',
    BOOKING_CONFIRMED:      'Xác nhận đặt sân thành công!',
    PAYMENT_SUCCESS:        'Thanh toán thành công! Đơn đang chờ duyệt.',
    PAYMENT_FAIL:           'Thanh toán thất bại. Vui lòng thử lại.',
    PAYMENT_UPLOADED:       'Tải chứng từ thanh toán thành công!',
    CANCEL_SUCCESS:         'Hủy đặt sân thành công.',
    CANCEL_OVERDUE:         'Oops — Đã quá hạn hủy theo chính sách sân.',
    MATCHING_ACCEPTED:      'Chủ kèo đã chấp nhận yêu cầu tham gia của bạn!',
    MATCHING_REJECTED:      'Chủ kèo đã từ chối yêu cầu tham gia.',
    MATCH_REMINDER:         'Nhắc lịch: bạn có trận sắp tới!',
    REFUND_REQUESTED:       'Yêu cầu hoàn tiền đã được gửi.',
    REFUND_COMPLETED:       'Tiền đã được hoàn về tài khoản của bạn.',
    PROFILE_UPDATED:        'Cập nhật hồ sơ thành công.',
    PROFILE_UPDATE_FAIL:    'Oops — Cập nhật hồ sơ thất bại. Thử lại nhé!',
    AVATAR_SUCCESS:         'Cập nhật ảnh đại diện thành công!',
    PASSWORD_CHANGED:       'Đổi mật khẩu thành công!',
    PASSWORD_CHANGE_FAIL:   'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại.',
    PASSWORD_ADDED:         'Thêm mật khẩu thành công!',
    PASSWORD_ADD_FAIL:      'Thêm mật khẩu thất bại. Vui lòng thử lại.',
    FAVORITE_ADDED:         'Đã thêm vào danh sách yêu thích!',
    FAVORITE_REMOVED:       'Đã bỏ khỏi danh sách yêu thích.',
    REVIEW_SUBMITTED:       'Đánh giá đã được gửi thành công!',
    REVIEW_FAIL:            'Gửi đánh giá thất bại. Vui lòng thử lại.',
    LINK_COPIED:            'Đã sao chép link!',
    MANAGER_DOCS_SUBMITTED: 'Hồ sơ đã được gửi! Chờ Admin duyệt.',
  },

  MANAGER: {
    NEW_ORDER:              'Có đơn đặt sân mới!',
    ORDER_CONFIRMED:        'Đã xác nhận đơn đặt sân.',
    ORDER_REJECTED:         'Đã từ chối đơn đặt sân.',
    CUSTOMER_CANCELLED:     'Khách vừa hủy sân.',
    VENUE_ADDED:            'Thêm sân thành công!',
    VENUE_UPDATED:          'Cập nhật thông tin sân thành công!',
    VENUE_DELETED:          'Đã xoá sân thành công.',
    VENUE_MAINTENANCE:      'Đã chuyển sân sang chế độ bảo trì.',
    COURT_ADDED:            'Thêm sân con thành công!',
    COURT_UPDATED:          'Cập nhật sân con thành công!',
    COURT_DELETED:          'Đã xoá sân con.',
    SETTINGS_SAVED:         'Đã lưu cài đặt.',
    PAYMENT_SETTINGS_SAVED: 'Đã lưu cài đặt thanh toán!',
    REFUND_COMPLETED:       'Đã xác nhận hoàn tiền cho khách.',
    REFUND_PROCESSED:       'Đã xử lý yêu cầu hoàn tiền.',
    COUPON_CREATED:         'Tạo mã khuyến mãi thành công.',
    PROFILE_UPDATED:        'Cập nhật hồ sơ chủ sân thành công!',
    AVAILABILITY_SAVED:     'Đã lưu lịch hoạt động.',
  },

  ADMIN: {
    USER_LOCKED:            'Khóa người dùng thành công.',
    USER_UNLOCKED:          'Mở khóa người dùng thành công.',
    NEW_MANAGER_REQUEST:    'Có đơn xin duyệt Manager mới!',
    REQUEST_APPROVED:       'Đã duyệt yêu cầu làm chủ sân.',
    REQUEST_REJECTED:       'Đã từ chối yêu cầu làm chủ sân.',
    POST_CREATED:           'Tạo bài đăng nổi bật thành công!',
    POST_UPDATED:           'Cập nhật bài đăng thành công!',
    POST_DELETED:           'Đã xoá bài đăng.',
  },
};
