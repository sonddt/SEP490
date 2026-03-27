import { Link, useLocation } from 'react-router-dom';

export default function LongTermGateway() {
  const location = useLocation();
  const state = location.state ?? {};
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
  };

  return (
    <div className="main-wrapper" style={{ paddingTop: '96px' }}>
      <div className="content">
        <div className="container py-4">
          <div className="text-center mb-4">
            <h3 className="mb-2">Đặt lịch dài hạn</h3>
            <p className="text-muted mb-0">
              {venueName}
              {venueAddress ? ` — ${venueAddress}` : ''}
            </p>
            <p className="small text-muted mt-2 mb-0">
              Chọn hình thức phù hợp — mỗi lựa chọn đều là một đơn, thanh toán một lần trước khi chủ sân duyệt.
            </p>
          </div>

          <div className="row g-4 justify-content-center">
            <div className="col-12 col-md-6 col-lg-5">
              <Link to="/booking/long-term/fixed" state={cardState} className="text-decoration-none text-dark">
                <div
                  className="card h-100 border shadow-sm"
                  style={{ borderRadius: 12, transition: 'box-shadow 0.2s' }}
                >
                  <div className="card-body p-4 d-flex flex-column">
                    <h5 className="card-title mb-3">Đặt sân cố định</h5>
                    <p className="text-muted small flex-grow-1 mb-0">
                      Chọn một sân, khung giờ trong ngày và các thứ lặp lại (ví dụ mỗi thứ Hai, Tư, Sáu).
                      Hệ thống tạo toàn bộ buổi trong khoảng ngày bạn chọn — phù hợp tập luyện đều đặn.
                    </p>
                    <span className="btn btn-primary mt-3 align-self-start">Tiếp tục</span>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-12 col-md-6 col-lg-5">
              <Link to="/booking/long-term/flexible" state={cardState} className="text-decoration-none text-dark">
                <div
                  className="card h-100 border shadow-sm"
                  style={{ borderRadius: 12, transition: 'box-shadow 0.2s' }}
                >
                  <div className="card-body p-4 d-flex flex-column">
                    <h5 className="card-title mb-3">Đặt sân linh hoạt</h5>
                    <p className="text-muted small flex-grow-1 mb-0">
                      Chọn nhiều ngày và nhiều khung giờ khác nhau trên lịch — gom vào một đơn dài hạn,
                      vẫn thanh toán một lần. Phù hợp khi lịch thay đổi theo tuần.
                    </p>
                    <span className="btn btn-outline-primary mt-3 align-self-start">Tiếp tục</span>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className="text-center mt-4">
            <Link to="/venues" className="btn btn-link text-muted">Quay lại tìm sân</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
