import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import BookingSteps from '../components/booking/BookingSteps';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profileApi';
import { previewDiscount, createBooking } from '../api/bookingApi';

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

  // Detect bookingId from state (passed back from Payment page) or URL search params (browser back button)
  const [searchParams] = useSearchParams();
  const existingBookingId = state.bookingId || searchParams.get('bookingId') || null;
  const isUpdating = !!existingBookingId;

  // Group slots by court (giữ object để lấy đúng khoảng bắt đầu–kết thúc)
  const slotsByCourt = useMemo(() => {
    const map = {};
    selectedSlots.forEach((s) => {
      if (!map[s.courtName]) map[s.courtName] = [];
      map[s.courtName].push(s);
    });
    Object.keys(map).forEach((court) => {
      map[court].sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
    });
    return map;
  }, [selectedSlots]);

  // Pre-fill từ AuthContext + GET /profile/me (axios baseURL đã có /api — không gọi /api/api/...)
  const [form, setForm] = useState({
    name:  state.customerName || (user?.fullName ?? ''),
    phone: (state.customerPhone || (user?.phoneNumber ?? '')).trim(),
    note:  state.note || '',
  });
  const [autoFilled, setAutoFilled] = useState({
    name: !!user?.fullName,
    phone: !!(user?.phoneNumber && String(user.phoneNumber).trim()),
  });
  const [errors, setErrors] = useState({});

  const [discountInfo, setDiscountInfo] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponError, setCouponError] = useState('');
  const [previewingDiscount, setPreviewingDiscount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    profileApi
      .getMe()
      .then((data) => {
        const u = data?.user ?? data;
        if (!u) return;
        const apiFullName = (u.fullName ?? '').trim();
        const apiPhone = (u.phoneNumber ?? '').trim();
        setForm((prev) => ({
          ...prev,
          name: prev.name || apiFullName || '',
          phone: prev.phone || apiPhone || '',
        }));
        setAutoFilled((prev) => ({
          name: prev.name || !!apiFullName,
          phone: prev.phone || !!apiPhone,
        }));
      })
      .catch(() => {});
  }, []);

  const fetchPreview = async (code) => {
    setPreviewingDiscount(true);
    setCouponError('');
    try {
      const resp = await previewDiscount({
        venueId,
        baseAmount: totalPrice,
        daysDuration: 1,
        couponCode: code
      });
      if (resp.errorMsg || resp.isValidCoupon === false) {
        setCouponError(resp.errorMsg || 'Mã giảm giá không hợp lệ.');
        setDiscountInfo(null);
        setAppliedCoupon('');
      } else {
        setDiscountInfo(resp);
        setAppliedCoupon(code);
      }
    } catch (e) {
      setCouponError(e.response?.data?.message || 'Mã giảm giá không hợp lệ hoặc không áp dụng được.');
      setDiscountInfo(null);
      setAppliedCoupon('');
    } finally {
      setPreviewingDiscount(false);
    }
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      setCouponError('Vui lòng nhập mã giảm giá');
      return;
    }
    fetchPreview(couponCode.trim());
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon('');
    setDiscountInfo(null);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'Vui lòng nhập họ tên';
    const rawPhone = (form.phone || '').trim();
    if (!rawPhone) e.phone = 'Vui lòng nhập số điện thoại';
    else {
      const withoutSpaces = rawPhone.replace(/\s+/g, '');
      const vnLocal = /^(0[35789][0-9]{8})$/;
      const ok = vnLocal.test(withoutSpaces) || /^\+84\d{9,10}$/.test(withoutSpaces);
      if (!ok) e.phone = 'Số điện thoại không hợp lệ';
    }
    return e;
  };

  const handleNext = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!venueId) { setSubmitError('Thiếu thông tin cơ sở.'); return; }

    const items = (selectedSlots || [])
      .filter(s => s.courtId && s.startTime && s.endTime)
      .map(s => ({ courtId: s.courtId, startTime: s.startTime, endTime: s.endTime }));
    if (items.length === 0) { setSubmitError('Không có khung giờ hợp lệ.'); return; }

    setSubmitError('');
    setLoading(true);
    try {
      const created = await createBooking({
        venueId,
        items,
        contactName: form.name.trim(),
        contactPhone: form.phone.trim(),
        note: form.note.trim() || undefined,
        couponCode: appliedCoupon || undefined,
        bookingId: existingBookingId || undefined,
      });
      const bookingId = created.bookingId ?? created.BookingId;
      if (!bookingId) { setSubmitError('Phản hồi server không có mã đơn.'); setLoading(false); return; }
      navigate(`/booking/payment?bookingId=${bookingId}`);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message || 'Không tạo được đơn.';
      if (status === 409) setSubmitError(`${msg} Vui lòng quay lại chọn giờ.`);
      else setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  const [sortConfig, setSortConfig] = useState({ key: 'time', dir: 'asc' });

  const sortedSlots = useMemo(() => {
    if (!selectedSlots) return [];
    return [...selectedSlots].sort((a, b) => {
      let aVal, bVal;
      switch (sortConfig.key) {
        case 'courtName':
          aVal = a.courtName || '';
          bVal = b.courtName || '';
          break;
        case 'time':
          aVal = a.slotIndex || 0;
          bVal = b.slotIndex || 0;
          break;
        case 'price':
          aVal = a.price || 0;
          bVal = b.price || 0;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [selectedSlots, sortConfig]);

  const toggleSort = (key) => setSortConfig(prev => ({
    key,
    dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
  }));

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <i className="feather-chevron-down text-muted ms-1" style={{ fontSize: '0.8em', opacity: 0.3 }} />;
    return <i className={`feather-chevron-${sortConfig.dir === 'asc' ? 'up' : 'down'} text-primary ms-1`} style={{ fontSize: '0.8em' }} />;
  };

  return (
    <div className="main-wrapper content-below-header">
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
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('courtName')}>Sân {renderSortIcon('courtName')}</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('time')}>Giờ {renderSortIcon('time')}</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} className="text-end" onClick={() => toggleSort('price')}>Đơn giá (30 phút) {renderSortIcon('price')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSlots.map((s, i) => (
                        <tr key={i}>
                          <td>{s.courtName}</td>
                          <td>{s.timeEndLabel ? `${s.timeLabel} – ${s.timeEndLabel}` : s.timeLabel}</td>
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
                <h3 className="border-bottom">Mã giảm giá</h3>
                <p className="text-muted mb-3" style={{ fontSize: 12, lineHeight: 1.5 }}>
                  <i className="feather-info me-1" style={{ fontSize: 11 }} />
                  Bạn có thể theo dõi các chương trình khuyến mãi và giảm giá ở trang <Link to="/featured" className="fw-semibold" style={{ color: 'var(--primary-color)' }}>Nổi bật</Link>.
                </p>
                <div className="mb-4">
                  {appliedCoupon && discountInfo ? (
                    <div className="alert alert-success d-flex align-items-center justify-content-between p-2 mb-0">
                      <div>
                        <i className="feather-check-circle me-1" /> Đã áp dụng mã <strong>{appliedCoupon}</strong>
                      </div>
                      <button className="btn btn-sm btn-outline-danger p-1" onClick={handleRemoveCoupon} title="Xóa mã">
                        <i className="feather-x" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="input-group">
                        <input
                          type="text"
                          className={`form-control ${couponError ? 'is-invalid' : ''}`}
                          placeholder="Nhập mã voucher (nếu có)"
                          value={couponCode}
                          onChange={e => {
                            setCouponCode(e.target.value);
                            setCouponError('');
                          }}
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={previewingDiscount || !couponCode.trim()}
                        >
                          {previewingDiscount ? <i className="fas fa-spinner fa-spin" /> : 'Áp dụng'}
                        </button>
                      </div>
                      {couponError && <div className="text-danger small mt-1">{couponError}</div>}
                    </>
                  )}
                </div>

                <h3 className="border-bottom mt-2">Tóm tắt đơn</h3>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="fa-regular fa-building me-2 text-primary" />
                    <strong>{venueName}</strong>
                  </li>
                  <li className="mb-2">
                    <i className="feather-calendar me-2 text-primary" />
                    {formatDateVN(date)}
                  </li>
                  {Object.entries(slotsByCourt).map(([court, slotObjs]) => {
                    const first = slotObjs[0];
                    const last = slotObjs[slotObjs.length - 1];
                    const endLabel = last?.timeEndLabel ?? last?.timeLabel;
                    return (
                      <li key={court} className="mb-2">
                        <i className="feather-clock me-2 text-primary" />
                        <strong>{court}:</strong>{' '}
                        {first?.timeLabel} – {endLabel}
                        <span className="text-muted ms-1">({slotObjs.length} ô × 30 phút)</span>
                      </li>
                    );
                  })}
                </ul>
                <hr />
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Tổng giờ</span>
                  <strong>{totalHours}</strong>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Giá gốc</span>
                  <strong className={discountInfo ? "text-decoration-line-through text-muted" : "primary-text fs-5"}>
                    {totalPrice.toLocaleString('vi-VN')} VNĐ
                  </strong>
                </div>
                {discountInfo && (
                  <>
                    {discountInfo.discountAmount > 0 && (
                      <div className="d-flex justify-content-between align-items-center mb-2 text-success">
                        <span>Giảm giá</span>
                        <strong>-{(discountInfo.discountAmount).toLocaleString('vi-VN')} VNĐ</strong>
                      </div>
                    )}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="fw-bold">Thành tiền</span>
                      <strong className="primary-text fs-4">{(discountInfo.finalAmount || discountInfo.finalPrice).toLocaleString('vi-VN')} VNĐ</strong>
                    </div>
                  </>
                )}
                {!discountInfo && (
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="fw-bold">Thành tiền</span>
                    <strong className="primary-text fs-4">{totalPrice.toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                )}
                {submitError && <div className="alert alert-danger small mb-2">{submitError}</div>}
                <div className="d-grid">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    className="btn btn-secondary btn-icon"
                  >
                    {loading ? (isUpdating ? 'Đang cập nhật…' : 'Đang tạo đơn…') : 'Tiếp theo'} <i className="feather-arrow-right-circle ms-1" />
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
              disabled={loading}
            >
              {loading ? 'Đang tạo đơn…' : 'Tiếp theo'} <i className="feather-arrow-right-circle ms-1" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
