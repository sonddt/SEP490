import { Link, useLocation } from 'react-router-dom';

const green = '#16a34a';
const greenDark = '#15803d';
const teal = '#0d9488';

export default function LongTermGateway() {
  const location = useLocation();
  let state = location.state;
  if (!state) {
    try {
      const cached = sessionStorage.getItem('booking_venue_context');
      if (cached) state = JSON.parse(cached);
    } catch { }
  }
  state = state || {};
  
  const venueName = state.venueName ?? 'Cơ sở';
  const venueAddress = state.venueAddress ?? '';

  if (!state.venueId) {
    return (
      <div className="main-wrapper content-below-header text-center py-5" style={{ paddingTop: '120px' }}>
        <p className="mb-3">Thiếu thông tin cơ sở.</p>
        <Link to="/venues" className="btn btn-primary">Tìm sân</Link>
      </div>
    );
  }

  const cardState = {
    venueId: state.venueId,
    venueName: state.venueName,
    venueAddress: state.venueAddress,
    weeklyDiscountPercent: state.weeklyDiscountPercent,
    monthlyDiscountPercent: state.monthlyDiscountPercent
  };

  return (
    <div
      className="main-wrapper"
      style={{
        paddingTop: '96px',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f7faf8 0%, #f0f4f2 100%)',
      }}
    >
      <div className="content">
        <div className="container py-5" style={{ maxWidth: 960 }}>
          <header className="text-center mb-4 mb-md-5">
            <h1 className="fw-bold mb-3" style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', color: '#0f172a' }}>
              Đặt lịch dài hạn
            </h1>
            <p className="text-secondary mb-2" style={{ fontSize: '1rem' }}>
              {venueName}
              {venueAddress ? ` — ${venueAddress}` : ''}
            </p>
            <p className="text-muted small mb-0" style={{ maxWidth: 520, margin: '0 auto' }}>
              Chọn hình thức phù hợp — mỗi lựa chọn đều là một đơn, thanh toán một lần trước khi chủ sân duyệt.
            </p>
          </header>

          <div className="row g-4 justify-content-center align-items-stretch">
            <div className="col-12 col-md-6">
              <Link to="/booking/long-term/fixed" state={cardState} className="text-decoration-none d-block h-100">
                <div
                  className="h-100 bg-white border-0 shadow-sm d-flex flex-column"
                  style={{
                    borderRadius: 16,
                    padding: '1.5rem',
                    minHeight: 280,
                    border: '1px solid #e2e8f0',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                  }}
                >
                  <h2 className="h5 fw-semibold mb-3" style={{ color: greenDark }}>
                    Đặt sân cố định
                  </h2>
                  <p className="text-muted small flex-grow-1 mb-4" style={{ lineHeight: 1.65 }}>
                    Chọn một sân, khung giờ trong ngày và các thứ lặp lại (ví dụ mỗi thứ Hai, Tư, Sáu).
                    Hệ thống tạo toàn bộ buổi trong khoảng ngày bạn chọn — phù hợp tập luyện đều đặn.
                  </p>
                  <span
                    className="btn w-100 text-white fw-semibold py-2 rounded-3 border-0"
                    style={{ backgroundColor: green, fontSize: '0.95rem' }}
                  >
                    Tiếp tục
                  </span>
                </div>
              </Link>
            </div>

            <div className="col-12 col-md-6">
              <Link to="/booking/long-term/flexible" state={cardState} className="text-decoration-none d-block h-100">
                <div
                  className="h-100 bg-white d-flex flex-column"
                  style={{
                    borderRadius: 16,
                    padding: '1.5rem',
                    minHeight: 280,
                    border: `1px solid ${teal}`,
                    boxShadow: '0 1px 3px rgba(13, 148, 136, 0.08)',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                  }}
                >
                  <h2 className="h5 fw-semibold mb-3" style={{ color: teal }}>
                    Đặt sân linh hoạt
                  </h2>
                  <p className="text-muted small flex-grow-1 mb-4" style={{ lineHeight: 1.65 }}>
                    Chọn nhiều ngày và nhiều khung giờ khác nhau trên lịch — gom vào một đơn dài hạn,
                    vẫn thanh toán một lần. Phù hợp khi lịch thay đổi theo tuần.
                  </p>
                  <span
                    className="btn w-100 fw-semibold py-2 rounded-3 bg-white"
                    style={{
                      border: `2px solid ${teal}`,
                      color: teal,
                      fontSize: '0.95rem',
                    }}
                  >
                    Tiếp tục
                  </span>
                </div>
              </Link>
            </div>
          </div>

          <div className="text-center mt-5">
            <Link to="/venues" className="text-muted text-decoration-none small">
              Quay lại tìm sân
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
