import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import BookingSteps from '../components/booking/BookingSteps';

const PAYMENT_METHODS = [
  {
    id: 'bank',
    label: 'Chuyển khoản ngân hàng',
    icon: 'feather-credit-card',
    detail: {
      bank:    'Vietcombank',
      account: '1234 5678 9012',
      name:    'SHUTTLEUP BADMINTON',
      note:    'Ghi nội dung: [SDT] - [Tên sân] - [Ngày]',
    },
  },
  {
    id: 'qr',
    label: 'Quét mã QR',
    icon: 'feather-smartphone',
    detail: {
      imgSrc: '/assets/img/icons/qr-mock.png',
      note:   'Mở ứng dụng ngân hàng và quét mã QR bên dưới',
    },
  },
  {
    id: 'deposit',
    label: 'Đặt cọc / Thanh toán tại sân',
    icon: 'feather-dollar-sign',
    detail: {
      note: 'Thanh toán phần còn lại trực tiếp tại sân trước khi vào chơi.',
    },
  },
];

function formatDateVN(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export default function BookingPayment() {
  const navigate = useNavigate();
  const location  = useLocation();
  const state     = location.state ?? {};

  const {
    venueId       = null,
    venueName     = 'Sân cầu lông',
    venueAddress  = '',
    date          = new Date().toISOString().split('T')[0],
    selectedSlots = [],
    totalPrice    = 0,
    totalHours    = '0h',
    customerName  = '',
    customerPhone = '',
    note          = '',
  } = state;

  const [method, setMethod]   = useState('bank');
  const [agreed, setAgreed]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const selectedMethod = PAYMENT_METHODS.find(m => m.id === method);

  const handleConfirm = async () => {
    if (!agreed) { setError('Vui lòng đồng ý với điều khoản dịch vụ.'); return; }
    setError('');
    setLoading(true);
    // Mock API call — replace with real API later
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    const bookingCode = `SU${Date.now().toString().slice(-6)}`;
    navigate('/booking/complete', {
      state: {
        venueId, venueName, venueAddress, date,
        selectedSlots, totalPrice, totalHours,
        customerName, customerPhone, note,
        paymentMethod: selectedMethod.label,
        bookingCode,
      },
    });
  };

  return (
    <div className="main-wrapper" style={{ paddingTop: '96px' }}>

      {/* Breadcrumb */}
      <div className="breadcrumb mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Đặt Sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Thanh toán</li>
          </ul>
        </div>
      </div>

      <BookingSteps currentStep={3} />

      <div className="content">
        <div className="container">
          <div className="text-center mb-5">
            <h3 className="mb-1">Thanh Toán</h3>
            <p className="sub-title mb-0">Hoàn tất thanh toán để xác nhận lịch đặt sân của bạn</p>
          </div>

          {/* Venue card */}
          <div className="master-academy dull-whitesmoke-bg card mb-5">
            <div className="d-sm-flex justify-content-start align-items-center">
              <img
                className="corner-radius-10"
                src="/assets/img/master-academy.png"
                alt="Venue"
                style={{ width: '120px', height: '80px', objectFit: 'cover' }}
                onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }}
              />
              <div className="info">
                <h3 className="mb-1">{venueName}</h3>
                {venueAddress && (
                  <p className="mb-0 text-muted">
                    <i className="feather-map-pin me-1" />{venueAddress}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="row checkout">
            {/* Left: order summary */}
            <div className="col-12 col-lg-7 mb-4 mb-lg-0">
              <div className="card booking-details">
                <h3 className="border-bottom">Tóm tắt đơn đặt</h3>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="fa-regular fa-building me-2 text-primary" />
                    <strong>{venueName}</strong>
                  </li>
                  <li className="mb-2">
                    <i className="feather-calendar me-2 text-primary" />
                    {formatDateVN(date)}
                  </li>
                  <li className="mb-2">
                    <i className="feather-clock me-2 text-primary" />
                    {totalHours} ({selectedSlots.length} ô × 30 phút)
                  </li>
                  {customerName && (
                    <li className="mb-2">
                      <i className="feather-user me-2 text-primary" />
                      {customerName} — {customerPhone}
                    </li>
                  )}
                  {note && (
                    <li className="mb-2">
                      <i className="feather-message-square me-2 text-primary" />
                      <em className="text-muted">{note}</em>
                    </li>
                  )}
                </ul>

                <hr />

                {/* Selected slots grouped by court */}
                <h6 className="mb-2">Chi tiết sân &amp; giờ</h6>
                <div className="table-responsive">
                  <table className="table table-sm table-bordered mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Sân</th>
                        <th>Giờ bắt đầu</th>
                        <th className="text-end">Tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSlots.map((s, i) => (
                        <tr key={i}>
                          <td>{s.courtName}</td>
                          <td>{s.timeLabel}</td>
                          <td className="text-end">{(s.price ?? 0).toLocaleString('vi-VN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: payment panel */}
            <div className="col-12 col-lg-5">
              <aside className="card payment-modes">
                <h3 className="border-bottom">Phương thức thanh toán</h3>

                {/* Method selector */}
                <div className="radio mb-3">
                  {PAYMENT_METHODS.map(pm => (
                    <div key={pm.id} className="form-check mb-2">
                      <input
                        className="form-check-input default-check"
                        type="radio"
                        id={pm.id}
                        name="paymentMethod"
                        value={pm.id}
                        checked={method === pm.id}
                        onChange={() => setMethod(pm.id)}
                      />
                      <label className="form-check-label d-flex align-items-center gap-2" htmlFor={pm.id}>
                        <i className={`${pm.icon} text-primary`} />
                        {pm.label}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Method detail */}
                <div
                  className="rounded p-3 mb-3"
                  style={{ backgroundColor: '#f0fdf4', border: '1px solid #d1fae5' }}
                >
                  {method === 'bank' && (
                    <div className="small">
                      <p className="mb-1"><strong>Ngân hàng:</strong> {selectedMethod.detail.bank}</p>
                      <p className="mb-1"><strong>Số tài khoản:</strong> {selectedMethod.detail.account}</p>
                      <p className="mb-1"><strong>Chủ TK:</strong> {selectedMethod.detail.name}</p>
                      <p className="mb-0 text-muted">{selectedMethod.detail.note}</p>
                    </div>
                  )}
                  {method === 'qr' && (
                    <div className="text-center small">
                      <p className="mb-2 text-muted">{selectedMethod.detail.note}</p>
                      <div
                        className="mx-auto d-flex align-items-center justify-content-center rounded"
                        style={{ width: '140px', height: '140px', backgroundColor: '#e5e7eb', fontSize: '12px', color: '#6b7280' }}
                      >
                        [QR mock]
                      </div>
                    </div>
                  )}
                  {method === 'deposit' && (
                    <p className="mb-0 small text-muted">{selectedMethod.detail.note}</p>
                  )}
                </div>

                <hr />

                {/* Price breakdown */}
                <ul className="order-sub-total list-unstyled">
                  <li className="d-flex justify-content-between mb-2">
                    <span>Tạm tính</span>
                    <span>{totalPrice.toLocaleString('vi-VN')} VNĐ</span>
                  </li>
                  <li className="d-flex justify-content-between mb-2">
                    <span>Phí dịch vụ</span>
                    <span>0 VNĐ</span>
                  </li>
                </ul>
                <div className="order-total d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Tổng cộng</h5>
                  <h5 className="mb-0 primary-text">{totalPrice.toLocaleString('vi-VN')} VNĐ</h5>
                </div>

                {/* Agree checkbox */}
                <div className="form-check d-flex align-items-start gap-2 policy mb-3">
                  <input
                    className="form-check-input mt-1"
                    type="checkbox"
                    id="agreePolicy"
                    checked={agreed}
                    onChange={e => { setAgreed(e.target.checked); setError(''); }}
                  />
                  <label className="form-check-label small" htmlFor="agreePolicy">
                    Tôi đồng ý với{' '}
                    <Link to="/privacy-policy">Chính sách bảo mật</Link> và{' '}
                    <Link to="/terms">Điều khoản sử dụng</Link> của ShuttleUp
                  </label>
                </div>
                {error && <p className="text-danger small mb-2">{error}</p>}

                <div className="d-grid btn-block">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirm}
                    disabled={loading}
                  >
                    {loading
                      ? <><span className="spinner-border spinner-border-sm me-2" />Đang xử lý...</>
                      : `Xác nhận — ${totalPrice.toLocaleString('vi-VN')} VNĐ`
                    }
                  </button>
                </div>
              </aside>
            </div>
          </div>

          {/* Nav buttons */}
          <div className="text-center btn-row mt-4">
            <button
              type="button"
              className="btn btn-primary me-3 btn-icon"
              onClick={() => navigate('/booking/confirm', { state: location.state })}
            >
              <i className="feather-arrow-left-circle me-1" /> Quay lại
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
