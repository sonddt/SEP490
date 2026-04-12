import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import LongTermBookingSteps from '../components/booking/LongTermBookingSteps';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profileApi';
import { createLongTermFlexible, previewDiscount } from '../api/bookingApi';

function formatDateVN(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const dow = days[new Date(isoDate).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}

export default function LongTermFlexibleConfirm() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state ?? {};
  const { user } = useAuth();

  const {
    venueId = null,
    venueName = 'Sân cầu lông',
    venueAddress = '',
    date = new Date().toISOString().split('T')[0],
    selectedSlots = [],
    items = [],
    preview = null,
    totalHours: stateTotalHours = '0h',
    totalPrice: stateTotalPrice,
  } = state;

  /* Compute slotDuration from first slot's time range */
  const slotDuration = useMemo(() => {
    const first = selectedSlots?.[0];
    if (!first?.startTime || !first?.endTime) return 30;
    const s = new Date(first.startTime);
    const e = new Date(first.endTime);
    const diffMins = Math.round((e - s) / 60000);
    return [30, 60, 120].includes(diffMins) ? diffMins : 30;
  }, [selectedSlots]);

  const slotLabelStr = slotDuration < 60 ? `${slotDuration} phút` : slotDuration === 60 ? '1 giờ' : `${slotDuration / 60} giờ`;

  // Detect bookingId from state (passed back from Payment page) or URL search params (browser back button)
  const [searchParams] = useSearchParams();
  const existingBookingId = state.bookingId || searchParams.get('bookingId') || null;
  const isUpdating = !!existingBookingId;

  const totalPrice = stateTotalPrice ?? preview?.totalAmount ?? 0;
  const totalHours = stateTotalHours;

  const slotsByCourt = useMemo(() => {
    const map = {};
    selectedSlots.forEach((s) => {
      const key = `${s.dateIso || date}|${s.courtName}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
    });
    return map;
  }, [selectedSlots, date]);

  const [form, setForm] = useState({
    name: state.customerName || (user?.fullName ?? ''),
    phone: (state.customerPhone || (user?.phoneNumber ?? '')).trim(),
    note: state.note || '',
  });
  const [autoFilled, setAutoFilled] = useState({
    name: !!user?.fullName,
    phone: !!(user?.phoneNumber && String(user.phoneNumber).trim()),
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  const [discountInfo, setDiscountInfo] = useState(null);

  useEffect(() => {
    if (!venueId || !totalPrice || !selectedSlots.length) return;
    const sortedDates = selectedSlots.map(s => s.dateIso || date).sort();
    const dStart = new Date(sortedDates[0]);
    const dEnd = new Date(sortedDates[sortedDates.length - 1]);
    const dDuration = Math.round(Math.abs(dEnd - dStart) / (1000 * 60 * 60 * 24)) + 1;

    previewDiscount({
      venueId,
      baseAmount: totalPrice,
      daysDuration: dDuration,
      couponCode: ''
    }).then(res => setDiscountInfo(res)).catch(() => {});
  }, [venueId, totalPrice, selectedSlots, date]);

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

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Vui lòng nhập họ tên';
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

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (!venueId || !Array.isArray(items) || items.length === 0) {
      setSubmitError('Thiếu dữ liệu lịch. Vui lòng làm lại từ đầu.');
      return;
    }
    setSubmitError('');
    setLoading(true);
    try {
      const result = await createLongTermFlexible({
        venueId,
        items,
        contactName: form.name.trim(),
        contactPhone: form.phone.trim(),
        note: form.note.trim() || undefined,
        bookingId: existingBookingId || undefined,
      });
      const bookingId = result.bookingId ?? result.BookingId;
      if (!bookingId) {
        setSubmitError('Phản hồi server không có mã đơn.');
        setLoading(false);
        return;
      }
      navigate(`/booking/payment?bookingId=${bookingId}&flow=long-term`);
    } catch (err) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.message
        || err.message
        || 'Không tạo được đơn.';
      if (status === 409) setSubmitError(`${msg} Vui lòng quay lại chọn giờ.`);
      else setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!venueId || !preview) {
    return (
      <div className="main-wrapper content-below-header text-center py-5" style={{ paddingTop: '120px' }}>
        <p className="mb-3">Chưa có dữ liệu xem trước.</p>
        <Link to="/venues" className="btn btn-primary">Tìm sân</Link>
      </div>
    );
  }

  const flexLongTermDiscount = Number(discountInfo?.longTermDiscountAmount ?? 0);
  const flexCouponDiscount = Number(discountInfo?.couponDiscountAmount ?? 0);
  const flexLegacyDiscount = Number(discountInfo?.discountAmount ?? 0);
  const flexLongTermLineAmount =
    flexLongTermDiscount > 0
      ? flexLongTermDiscount
      : (flexCouponDiscount === 0 && flexLegacyDiscount > 0 ? flexLegacyDiscount : 0);
  const flexHasLongTermDiscount = flexLongTermLineAmount > 0;

  return (
    <div className="main-wrapper" style={{ paddingTop: '96px' }}>
      <LongTermBookingSteps
        currentStep={2}
        scheduleStepPath="/booking/long-term/flexible"
        scheduleStepLabel="Lịch linh hoạt"
        confirmPath="/booking/long-term/flexible/confirm"
      />

      <div className="content book-cage">
        <div className="container">

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
                      onError={(ev) => { ev.target.src = '/assets/img/venues/venues-01.jpg'; }}
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
                      <h4 className="primary-text mb-0">{Number(discountInfo?.finalAmount || totalPrice).toLocaleString('vi-VN')} VNĐ</h4>
                      <small className="text-muted">Tổng thanh toán</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="small text-danger text-center mt-3 mb-0">
              Đặt lịch dài hạn linh hoạt — huỷ đơn sẽ huỷ toàn bộ các khung trong chuỗi; thanh toán một lần.
            </p>
          </section>

          <div className="row">
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
                      onChange={(ev) => {
                        setForm((f) => ({ ...f, name: ev.target.value }));
                        setErrors((er) => ({ ...er, name: '' }));
                        if (autoFilled.name) setAutoFilled((a) => ({ ...a, name: false }));
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
                      onChange={(ev) => {
                        setForm((f) => ({ ...f, phone: ev.target.value }));
                        setErrors((er) => ({ ...er, phone: '' }));
                        if (autoFilled.phone) setAutoFilled((a) => ({ ...a, phone: false }));
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
                      onChange={(ev) => setForm((f) => ({ ...f, note: ev.target.value }))}
                    />
                  </div>
                  {submitError && <div className="alert alert-danger">{submitError}</div>}
                </form>
              </section>

              <section className="card booking-order-confirmation mb-4">
                <h5 className="mb-3">Chi tiết khung giờ đã chọn</h5>
                <div className="table-responsive">
                  <table className="table table-bordered mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Ngày</th>
                        <th>Sân</th>
                        <th>Giờ</th>
                        <th className="text-end">Đơn giá ({slotLabelStr})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSlots.map((s, i) => (
                        <tr key={i}>
                          <td>{formatDateVN(s.dateIso || date)}</td>
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

            <div className="col-12 col-lg-4">
              <aside className="card booking-details sticky-top" style={{ top: '110px' }}>
                <h3 className="border-bottom">Tóm tắt đơn</h3>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="fa-regular fa-building me-2 text-primary" />
                    <strong>{venueName}</strong>
                  </li>
                  {preview.sessionCount > 1 && (
                    <li className="mb-2 text-muted small">
                      {preview.sessionCount} ngày có đặt · {preview.slotCount} ô × {slotLabelStr}
                    </li>
                  )}
                  {Object.entries(slotsByCourt).map(([key, slotObjs]) => {
                    const first = slotObjs[0];
                    const last = slotObjs[slotObjs.length - 1];
                    const endLabel = last?.timeEndLabel ?? last?.timeLabel;
                    return (
                      <li key={key} className="mb-2">
                        <i className="feather-calendar me-2 text-primary" />
                        {formatDateVN(first.dateIso || date)}
                        <br />
                        <span className="ms-4 d-inline-block mt-1">
                          <i className="feather-clock me-2 text-primary" />
                          <strong>{first.courtName}:</strong>{' '}
                          {first?.timeLabel} – {endLabel}
                          <span className="text-muted ms-1">({slotObjs.length} ô × {slotLabelStr})</span>
                        </span>
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
                  <span>Tổng tiền gốc</span>
                  <strong className={flexHasLongTermDiscount ? "text-decoration-line-through text-muted" : "primary-text"}>
                    {Number(totalPrice).toLocaleString('vi-VN')} VNĐ
                  </strong>
                </div>
                {flexHasLongTermDiscount && (
                  <div className="d-flex justify-content-between align-items-center mb-2 text-success">
                    <span><i className="feather-tag me-1" /> Giảm giá đợt dài hạn</span>
                    <strong>- {flexLongTermLineAmount.toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                )}
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold">Thành tiền</span>
                  <strong className="primary-text fs-5">{Number(discountInfo?.finalAmount || totalPrice).toLocaleString('vi-VN')} VNĐ</strong>
                </div>
                <div className="d-grid gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="btn btn-success btn-icon"
                  >
              {loading ? (isUpdating ? 'Đang cập nhật…' : 'Đang tạo đơn…') : 'Tiếp theo'} <i className="feather-arrow-right-circle ms-1" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-icon"
                    onClick={() => navigate('/booking/long-term/flexible', { state: { venueId, venueName, venueAddress } })}
                  >
                    <i className="feather-arrow-left-circle me-1" /> Quay lại chỉnh sửa
                  </button>
                </div>
              </aside>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
