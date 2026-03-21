import { Link, useLocation } from 'react-router-dom';
import BookingSteps from '../components/booking/BookingSteps';

function formatDateVN(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  const days = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const dow  = days[new Date(isoDate).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}

export default function BookingComplete() {
  const location = useLocation();
  const state    = location.state ?? {};

  const {
    venueName     = 'Sân cầu lông',
    venueAddress  = '',
    date          = new Date().toISOString().split('T')[0],
    selectedSlots = [],
    totalPrice    = 0,
    totalHours    = '0h',
    customerName  = '',
    customerPhone = '',
    paymentMethod = 'Chuyển khoản ngân hàng',
    bookingCode   = `SU${Date.now().toString().slice(-6)}`,
    bookingId     = null,
    bookingStatus = 'PENDING',
  } = state;

  const statusUpper = String(bookingStatus || 'PENDING').toUpperCase();

  // Group by court
  const courts = [...new Set(selectedSlots.map(s => s.courtName))];

  return (
    <div className="main-wrapper" style={{ paddingTop: '96px', minHeight: '100vh' }}>

      {/* Breadcrumb */}
      <div className="breadcrumb mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Đặt Sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Hoàn tất</li>
          </ul>
        </div>
      </div>

      <BookingSteps currentStep={4} />

      <div className="content">
        <div className="container">

          {/* Success banner */}
          <div className="text-center mb-5">
            <div
              className="mx-auto mb-4 d-flex align-items-center justify-content-center rounded-circle"
              style={{ width: '96px', height: '96px', backgroundColor: '#dcfce7' }}
            >
              <i className="feather-check-circle" style={{ fontSize: '48px', color: '#16a34a' }} />
            </div>
            <h2 className="mb-2" style={{ color: '#16a34a' }}>Đã gửi yêu cầu đặt sân!</h2>
            <p className="sub-title text-muted mb-1">
              {statusUpper === 'CONFIRMED'
                ? 'Lịch đặt của bạn đã được xác nhận. Chúc bạn có buổi tập luyện vui vẻ!'
                : 'Chúng tôi đã nhận thanh toán và thông tin của bạn. Vui lòng chờ chủ sân xác nhận — bạn có thể theo dõi trạng thái trong mục Lịch sử đặt sân.'}
            </p>
            <p className="text-muted mb-1">
              Mã đặt sân: <strong className="primary-text fs-5">{bookingCode}</strong>
            </p>
            {bookingId && (
              <p className="text-muted small mb-0">
                Mã tham chiếu: <code>{bookingId}</code>
              </p>
            )}
          </div>

          {/* Booking detail card */}
          <div className="row justify-content-center">
            <div className="col-12 col-lg-8">
              <section className="card booking-order-confirmation mb-5">
                <h5 className="mb-3 border-bottom pb-2">Thông tin đặt sân</h5>

                <ul className="booking-info list-unstyled">
                  <li className="mb-3">
                    <h6 className="mb-1 text-muted">Cơ sở</h6>
                    <p className="mb-0 fw-semibold">{venueName}</p>
                    {venueAddress && <small className="text-muted">{venueAddress}</small>}
                  </li>
                  <li className="mb-3">
                    <h6 className="mb-1 text-muted">Ngày chơi</h6>
                    <p className="mb-0">{formatDateVN(date)}</p>
                  </li>
                  <li className="mb-3">
                    <h6 className="mb-1 text-muted">Sân &amp; Giờ</h6>
                    {courts.map(courtName => {
                      const slots = selectedSlots.filter(s => s.courtName === courtName);
                      return (
                        <p key={courtName} className="mb-1">
                          <strong>{courtName}:</strong>{' '}
                          {slots[0]?.timeLabel} – {slots[slots.length - 1]?.timeLabel}
                          <span className="text-muted ms-1">({slots.length} ô × 30ph)</span>
                        </p>
                      );
                    })}
                  </li>
                  <li className="mb-3">
                    <h6 className="mb-1 text-muted">Tổng giờ</h6>
                    <p className="mb-0">{totalHours}</p>
                  </li>
                </ul>

                <hr />

                <h5 className="mb-3">Thông tin liên hệ</h5>
                <ul className="contact-info list-unstyled">
                  {customerName && (
                    <li className="mb-2">
                      <i className="feather-user me-2 text-primary" />
                      {customerName}
                    </li>
                  )}
                  {customerPhone && (
                    <li className="mb-2">
                      <i className="feather-phone me-2 text-primary" />
                      {customerPhone}
                    </li>
                  )}
                </ul>

                <hr />

                <h5 className="mb-3">Thanh toán</h5>
                <ul className="payment-info list-unstyled">
                  <li className="d-flex justify-content-between mb-2">
                    <span>Phương thức</span>
                    <strong>{paymentMethod}</strong>
                  </li>
                  <li className="d-flex justify-content-between">
                    <span>Tổng cộng</span>
                    <strong className="primary-text fs-5">{totalPrice.toLocaleString('vi-VN')} VNĐ</strong>
                  </li>
                </ul>
              </section>

              {/* CTA buttons */}
              <div className="text-center btn-row">
                <Link
                  to="/user/bookings"
                  className="btn btn-primary me-3 btn-icon"
                >
                  <i className="feather-list me-1" /> Lịch sử đặt sân
                </Link>
                <Link
                  to="/courts"
                  className="btn btn-secondary btn-icon"
                >
                  <i className="feather-search me-1" /> Đặt sân mới
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
