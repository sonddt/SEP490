import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import BookingSteps from '../components/booking/BookingSteps';
import { useAuth } from '../context/AuthContext';

function formatDateVN(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  const days  = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const dow   = days[new Date(isoDate).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}

export default function BookingConfirm() {
  const navigate = useNavigate();
  const location  = useLocation();
  const state     = location.state ?? {};
  const { user }  = useAuth();

  const {
    venueId      = null,
    venueName    = 'Sân cầu lông',
    venueAddress = '',
    date         = new Date().toISOString().split('T')[0],
    selectedSlots = [],
    totalPrice   = 0,
    totalHours   = '0h',
  } = state;

  // Group slots by court for display
  const slotsByCourt = useMemo(() => {
    const map = {};
    selectedSlots.forEach(s => {
      if (!map[s.courtName]) map[s.courtName] = [];
      map[s.courtName].push(s.timeLabel);
    });
    return map;
  }, [selectedSlots]);

  // Pre-fill from logged-in user; phone fetched from profile API
  const [form, setForm] = useState({
    name:  user?.fullName  ?? '',
    phone: '',
    note:  '',
  });
  const [autoFilled, setAutoFilled] = useState({ name: !!user?.fullName, phone: false });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const apiBase = import.meta.env.VITE_API_URL ?? '';
    fetch(`${apiBase}/api/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => {
        if (!data) return;
        // GET /api/profile/me trả về { user: { fullName, phoneNumber, ... }, roles, ... }
        const u = data.user ?? data;
        const apiFullName = (u.fullName ?? '').trim();
        const apiPhone = (u.phoneNumber ?? '').trim();
        setForm(prev => ({
          ...prev,
          name:  prev.name || apiFullName || '',
          phone: prev.phone || apiPhone || '',
        }));
        setAutoFilled(prev => ({
          name:  prev.name || !!apiFullName,
          phone: prev.phone || !!apiPhone,
        }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'Vui lòng nhập họ tên';
    if (!form.phone.trim()) e.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^[0-9]{9,11}$/.test(form.phone.replace(/\s/g, '')))
      e.phone = 'Số điện thoại không hợp lệ';
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    navigate('/booking/payment', {
      state: {
        venueId, venueName, venueAddress, date,
        selectedSlots, totalPrice, totalHours,
        customerName:  form.name,
        customerPhone: form.phone,
        note:          form.note,
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
            <li>Xác nhận đặt sân</li>
          </ul>
        </div>
      </div>

      <BookingSteps currentStep={2} />

      <div className="content book-cage">
        <div className="container">

          {/* Venue summary card */}
          <section className="card mb-40">
            <div className="text-center mb-4">
              <h3 className="mb-1">Xác Nhận Đặt Sân</h3>
              <p className="sub-title mb-0">Kiểm tra lại thông tin trước khi tiến hành thanh toán.</p>
            </div>
            <div className="master-academy dull-whitesmoke-bg card">
              <div className="row d-flex align-items-center justify-content-center">
                <div className="col-12 col-lg-6">
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
                <div className="col-12 col-lg-6 mt-3 mt-lg-0">
                  <div className="d-flex align-items-center justify-content-lg-end gap-3">
                    <div className="text-center">
                      <h4 className="primary-text mb-0">{totalHours}</h4>
                      <small className="text-muted">Tổng giờ</small>
                    </div>
                    <div className="text-center">
                      <h4 className="primary-text mb-0">{totalPrice.toLocaleString('vi-VN')} VNĐ</h4>
                      <small className="text-muted">Tổng tiền</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="row">
            {/* Left: personal info form */}
            <div className="col-12 col-lg-8">
              <section className="card booking-form mb-4">
                <h3 className="border-bottom">Thông tin liên hệ</h3>
                <form noValidate>
                  {user && (
                    <p className="text-muted small mb-3" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="feather-user" style={{ color: 'var(--primary-color)' }} />
                      Thông tin được điền tự động từ tài khoản của bạn. Bạn có thể chỉnh sửa nếu cần.
                    </p>
                  )}
                  <div className="mb-3">
                    <label className="form-label fw-semibold d-flex align-items-center gap-2">
                      Họ tên <span className="text-danger">*</span>
                      {autoFilled.name && (
                        <span
                          className="badge"
                          style={{ fontSize: '0.7rem', background: 'rgba(var(--primary-rgb,34,139,34),0.12)', color: 'var(--primary-color)', border: '1px solid currentColor', borderRadius: 20, padding: '1px 8px', fontWeight: 500 }}
                        >
                          Tự động điền
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                      placeholder="Nhập họ và tên"
                      value={form.name}
                      onChange={e => {
                        setForm(f => ({ ...f, name: e.target.value }));
                        setErrors(er => ({ ...er, name: '' }));
                        if (autoFilled.name) setAutoFilled(a => ({ ...a, name: false }));
                      }}
                    />
                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold d-flex align-items-center gap-2">
                      Số điện thoại <span className="text-danger">*</span>
                      {autoFilled.phone && (
                        <span
                          className="badge"
                          style={{ fontSize: '0.7rem', background: 'rgba(var(--primary-rgb,34,139,34),0.12)', color: 'var(--primary-color)', border: '1px solid currentColor', borderRadius: 20, padding: '1px 8px', fontWeight: 500 }}
                        >
                          Tự động điền
                        </span>
                      )}
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
                      placeholder="Nhập số điện thoại"
                      value={form.phone}
                      onChange={e => {
                        setForm(f => ({ ...f, phone: e.target.value }));
                        setErrors(er => ({ ...er, phone: '' }));
                        if (autoFilled.phone) setAutoFilled(a => ({ ...a, phone: false }));
                      }}
                    />
                    {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Ghi chú cho chủ sân</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Ví dụ: mang vợt giúp tôi, cần đặt thêm bóng..."
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    />
                  </div>
                </form>
              </section>

              {/* Slot detail table */}
              <section className="card booking-order-confirmation mb-4">
                <h5 className="mb-3">Chi tiết khung giờ đã chọn</h5>
                <div className="table-responsive">
                  <table className="table table-bordered mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Sân</th>
                        <th>Giờ</th>
                        <th className="text-end">Đơn giá (30 phút)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSlots.map((s, i) => (
                        <tr key={i}>
                          <td>{s.courtName}</td>
                          <td>{s.timeLabel}</td>
                          <td className="text-end">{(s.price ?? 0).toLocaleString('vi-VN')} VNĐ</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Right: order summary sidebar */}
            <div className="col-12 col-lg-4">
              <aside className="card booking-details sticky-top" style={{ top: '110px' }}>
                <h3 className="border-bottom">Tóm tắt đơn</h3>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="fa-regular fa-building me-2 text-primary" />
                    <strong>{venueName}</strong>
                  </li>
                  <li className="mb-2">
                    <i className="feather-calendar me-2 text-primary" />
                    {formatDateVN(date)}
                  </li>
                  {Object.entries(slotsByCourt).map(([court, slots]) => (
                    <li key={court} className="mb-2">
                      <i className="feather-clock me-2 text-primary" />
                      <strong>{court}:</strong>{' '}
                      {slots[0]} – {slots[slots.length - 1]}
                      <span className="text-muted ms-1">({slots.length} ô × 30 phút)</span>
                    </li>
                  ))}
                </ul>
                <hr />
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Tổng giờ</span>
                  <strong>{totalHours}</strong>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span>Tổng tiền</span>
                  <strong className="primary-text fs-5">{totalPrice.toLocaleString('vi-VN')} VNĐ</strong>
                </div>
                <div className="d-grid">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="btn btn-secondary btn-icon"
                  >
                    Tiếp theo <i className="feather-arrow-right-circle ms-1" />
                  </button>
                </div>
              </aside>
            </div>
          </div>

          {/* Nav buttons */}
          <div className="text-center btn-row mt-3">
            <button
              type="button"
              className="btn btn-primary me-3 btn-icon"
              onClick={() => navigate('/booking', { state: location.state })}
            >
              <i className="feather-arrow-left-circle me-1" /> Quay lại
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={handleNext}
            >
              Tiếp theo <i className="feather-arrow-right-circle ms-1" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
