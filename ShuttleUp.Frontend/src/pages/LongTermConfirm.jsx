import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import LongTermBookingSteps from '../components/booking/LongTermBookingSteps';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profileApi';
import { createLongTermBooking, previewDiscount } from '../api/bookingApi';

function formatDateVN(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const dow = days[new Date(isoDate).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}

function generateDates(startDate, endDate, selectedDays) {
  if (!startDate || !endDate || !selectedDays || selectedDays.length === 0) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const result = [];
  const current = new Date(start);
  while (current <= end) {
    if (selectedDays.includes(current.getDay())) {
      const d = current.getDate().toString().padStart(2, '0');
      const m = (current.getMonth() + 1).toString().padStart(2, '0');
      result.push(`${d}/${m}/${current.getFullYear()}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return result;
}

const DOW_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function computeDaysDuration(rangeStartIso, rangeEndIso) {
  const d1 = new Date(rangeStartIso);
  const d2 = new Date(rangeEndIso);
  return Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
}

export default function LongTermConfirm() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state ?? {};
  const { user } = useAuth();

  const {
    venueId = null,
    venueName = '',
    venueAddress = '',
    courtId = '',
    courtName = '',
    rangeStart = '',
    rangeEnd = '',
    sessionStartTime = '',
    sessionEndTime = '',
    daysOfWeek = [],
    dailySchedules = null,
    preview = null,
    autoSwitchCourt = false,
    pricePreference = null,
    slotDuration: stateSlotDuration = 60,
  } = state;

  // Detect bookingId from state (passed back from Payment page) or URL search params (browser back button)
  const [searchParams] = useSearchParams();
  const existingBookingId = state.bookingId || searchParams.get('bookingId') || null;
  const isUpdating = !!existingBookingId;

  const totalPrice = preview?.totalAmount ?? 0;
  const slotCount = preview?.slotCount ?? 0;
  const sessionCount = preview?.sessionCount ?? 0;

  const slotDuration = [30, 60, 120].includes(stateSlotDuration) ? stateSlotDuration : 60;

  const totalMins = slotCount * slotDuration;
  const th = Math.floor(totalMins / 60);
  const tm = totalMins % 60;
  const totalHours = tm > 0 ? `${th}h${tm}` : `${th}h`;

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
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponError, setCouponError] = useState('');
  const [previewingDiscount, setPreviewingDiscount] = useState(false);

  /** Giữ số giảm “đợt dài hạn” lúc chưa có mã — để tách dòng nếu API chỉ trả discountAmount tổng. */
  const longTermDiscountBaselineRef = useRef(0);

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

  useEffect(() => {
    if (!venueId || !totalPrice || !rangeStart || !rangeEnd) return;
    const daysDuration = computeDaysDuration(rangeStart, rangeEnd);
    previewDiscount({ venueId, baseAmount: totalPrice, daysDuration, couponCode: '' })
      .then(res => setDiscountInfo(res))
      .catch(() => {});
  }, [venueId, totalPrice, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!discountInfo) return;
    if (!appliedCoupon) {
      const lt = Number(discountInfo.longTermDiscountAmount ?? 0);
      const cp = Number(discountInfo.couponDiscountAmount ?? 0);
      const total = Number(discountInfo.discountAmount ?? 0);
      if (lt > 0) longTermDiscountBaselineRef.current = lt;
      else if (cp === 0 && total > 0) longTermDiscountBaselineRef.current = total;
    }
  }, [discountInfo, appliedCoupon]);

  const fetchCouponPreview = async (code) => {
    setPreviewingDiscount(true);
    setCouponError('');
    try {
      const daysDuration = computeDaysDuration(rangeStart, rangeEnd);
      const resp = await previewDiscount({ venueId, baseAmount: totalPrice, daysDuration, couponCode: code });
      if (resp.errorMsg || resp.isValidCoupon === false) {
        setCouponError(resp.errorMsg || 'Mã giảm giá không hợp lệ.');
        setAppliedCoupon('');
      } else {
        setDiscountInfo(resp);
        setAppliedCoupon(code);
      }
    } catch (e) {
      setCouponError(e.response?.data?.message || 'Mã giảm giá không hợp lệ.');
      setAppliedCoupon('');
    } finally {
      setPreviewingDiscount(false);
    }
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) { setCouponError('Vui lòng nhập mã giảm giá'); return; }
    fetchCouponPreview(couponCode.trim());
  };

  const handleRemoveCoupon = async () => {
    setCouponCode('');
    setAppliedCoupon('');
    setCouponError('');
    if (!venueId || !totalPrice || !rangeStart || !rangeEnd) return;
    setPreviewingDiscount(true);
    try {
      const daysDuration = computeDaysDuration(rangeStart, rangeEnd);
      const resp = await previewDiscount({ venueId, baseAmount: totalPrice, daysDuration, couponCode: '' });
      setDiscountInfo(resp);
    } catch {
      // Giữ giá trị cũ nếu API lỗi
    } finally {
      setPreviewingDiscount(false);
    }
  };

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
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!venueId || !rangeStart || !rangeEnd || courtId === undefined) {
      setSubmitError('Thiếu dữ liệu lịch. Vui lòng làm lại từ đầu.');
      return;
    }
    setSubmitError('');
    setLoading(true);
    try {
      const payload = {
        venueId,
        courtId,
        rangeStart,
        rangeEnd,
        sessionStartTime,
        sessionEndTime,
        daysOfWeek,
        autoSwitchCourt,
        pricePreference,
        contactName: form.name.trim(),
        contactPhone: form.phone.trim(),
        note: form.note.trim() || undefined,
        couponCode: appliedCoupon || undefined,
        bookingId: existingBookingId || undefined,
      };
      if (dailySchedules && dailySchedules.length > 0) {
        payload.dailySchedules = dailySchedules;
      }
      const result = await createLongTermBooking(payload);
      const bookingId = result.bookingId ?? result.BookingId;
      if (!bookingId) { setSubmitError('Phản hồi server không có mã đơn.'); setLoading(false); return; }
      navigate(`/booking/payment?bookingId=${bookingId}&flow=long-term`, { state: { ...state, bookingId } });
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message || 'Không tạo được đơn.';
      if (status === 409) setSubmitError(`${msg} Vui lòng quay lại chọn giờ.`);
      else setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  const daysLabels = useMemo(() => (daysOfWeek || []).map(d => DOW_LABELS[d] || d).join(', '), [daysOfWeek]);

  const usedDays = useMemo(() => {
    if (daysOfWeek && daysOfWeek.length > 0) return daysOfWeek.map(Number);
    if (dailySchedules && dailySchedules.length > 0) return dailySchedules.map(d => Number(d.dayOfWeek));
    return [];
  }, [daysOfWeek, dailySchedules]);

  const actualDaysPlayed = useMemo(() => {
    if (!rangeStart || !rangeEnd || usedDays.length === 0) return [];
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    const result = new Set();
    const current = new Date(start);
    while (current <= end) {
      if (usedDays.includes(current.getDay())) {
        result.add(current.getDay());
      }
      current.setDate(current.getDate() + 1);
    }
    return Array.from(result);
  }, [rangeStart, rangeEnd, usedDays]);

  const sessionChips = useMemo(() => {
    return generateDates(rangeStart, rangeEnd, usedDays);
  }, [rangeStart, rangeEnd, usedDays]);

  if (!venueId || !preview) {
    return (
      <div className="main-wrapper content-below-header text-center py-5" style={{ paddingTop: '120px' }}>
        <p className="mb-3">Chưa có dữ liệu xem trước.</p>
        <Link to="/venues" className="btn btn-primary">Tìm sân</Link>
      </div>
    );
  }

  const displayPrice = discountInfo?.finalAmount ?? totalPrice;

  const legacyDiscountTotal = Number(discountInfo?.discountAmount ?? 0);
  let longTermDiscountAmount = Number(discountInfo?.longTermDiscountAmount ?? 0);
  let couponDiscountAmount = Number(discountInfo?.couponDiscountAmount ?? 0);

  if (
    appliedCoupon &&
    legacyDiscountTotal > 0 &&
    longTermDiscountAmount === 0 &&
    couponDiscountAmount === 0
  ) {
    const base = longTermDiscountBaselineRef.current;
    if (base > 0 && legacyDiscountTotal >= base) {
      longTermDiscountAmount = base;
      couponDiscountAmount = legacyDiscountTotal - base;
    } else if (legacyDiscountTotal > 0) {
      couponDiscountAmount = legacyDiscountTotal;
    }
  }

  const hasSplitDiscount =
    discountInfo &&
    (longTermDiscountAmount > 0 || couponDiscountAmount > 0);
  const showLegacyDiscountRow =
    discountInfo && !hasSplitDiscount && legacyDiscountTotal > 0;
  const anyDiscount =
    hasSplitDiscount || showLegacyDiscountRow;

  return (
    <div className="main-wrapper" style={{ paddingTop: '96px' }}>
      <LongTermBookingSteps
        currentStep={2}
        scheduleStepPath="/booking/long-term/fixed"
        scheduleStepLabel="Lịch cố định"
        confirmPath="/booking/long-term/confirm"
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
                      onError={ev => { ev.target.src = '/assets/img/venues/venues-01.jpg'; }}
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
                      <h4 className="primary-text mb-0">{Math.round(displayPrice).toLocaleString('vi-VN')} VNĐ</h4>
                      <small className="text-muted">Tổng thanh toán</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="small text-danger text-center mt-3 mb-0">
              Đặt lịch dài hạn cố định — huỷ đơn sẽ huỷ toàn bộ các khung trong chuỗi; thanh toán một lần.
            </p>
          </section>

          <div className="row g-lg-5">
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
                        <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(var(--primary-rgb,34,139,34),0.12)', color: 'var(--primary-color)', border: '1px solid currentColor', borderRadius: 20, padding: '1px 8px', fontWeight: 500 }}>
                          Tự động điền
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                      placeholder="Nhập họ và tên"
                      value={form.name}
                      onChange={ev => {
                        setForm(f => ({ ...f, name: ev.target.value }));
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
                        <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(var(--primary-rgb,34,139,34),0.12)', color: 'var(--primary-color)', border: '1px solid currentColor', borderRadius: 20, padding: '1px 8px', fontWeight: 500 }}>
                          Tự động điền
                        </span>
                      )}
                    </label>
                    <input
                      type="tel"
                      className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
                      placeholder="Nhập số điện thoại"
                      value={form.phone}
                      onChange={ev => {
                        setForm(f => ({ ...f, phone: ev.target.value }));
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
                      onChange={ev => setForm(f => ({ ...f, note: ev.target.value }))}
                    />
                  </div>
                  {submitError && <div className="alert alert-danger">{submitError}</div>}
                </form>
              </section>

              <section className="card booking-order-confirmation mb-4">
                <h5 className="mb-3">Chi tiết lịch đặt</h5>
                <div className="table-responsive">
                  <table className="table mb-0 align-top">
                    <thead className="table-light bg-gray-50 border-gray-50">
                      <tr>
                        <th className="font-semibold text-slate-700 p-3">Sân & Quy mô</th>
                        <th className="font-semibold text-slate-700 p-3">Lịch định kỳ</th>
                        <th className="font-semibold text-slate-700 p-3">Lịch tham gia ({sessionChips.length} ngày)</th>
                      </tr>
                    </thead>
                    <tbody className="border-gray-50">
                      <tr>
                        {/* Column 1: Court Identity */}
                        <td className="align-top p-4 border-end border-gray-50">
                          <div className="fw-bold primary-text mb-1" style={{ fontSize: '15px' }}>{courtName || 'Sân linh hoạt'}</div>
                          <div className="text-muted" style={{ fontSize: '13px' }}>
                            {sessionCount} Buổi<br/>({slotCount > 0 && sessionCount > 0 ? (slotCount * 30 / 60 / sessionCount) : 0}h/buổi)
                          </div>
                        </td>

                        {/* Column 2: Schedule & Frequency */}
                        <td className="align-top p-4 border-end border-gray-50">
                          {dailySchedules && dailySchedules.length > 0 ? (
                            <div className="d-flex flex-column gap-3">
                              {dailySchedules.map((ds) => (
                                <div key={ds.dayOfWeek} className="mb-2 last:mb-0">
                                  <div className="fw-bold text-slate-800" style={{ fontSize: '14px' }}>
                                    {ds.startTime} – {ds.endTime}
                                  </div>
                                  <div className="d-flex flex-wrap gap-1 mt-2">
                                    {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((lbl, i) => (
                                      <span key={i} className={`d-inline-flex justify-content-center align-items-center rounded-circle ${i === ds.dayOfWeek ? 'bg-primary text-white shadow-sm' : 'bg-white text-muted border border-gray-200'}`} style={{ width: '28px', height: '28px', fontSize: '11px', fontWeight: i === ds.dayOfWeek ? 600 : 400 }}>{lbl}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div>
                              <div className="fw-bold text-slate-800" style={{ fontSize: '14px' }}>
                                {sessionStartTime} – {sessionEndTime}
                              </div>
                              <div className="d-flex flex-wrap gap-1 mt-2">
                                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((lbl, i) => (
                                  <span key={i} className={`d-inline-flex justify-content-center align-items-center rounded-circle ${actualDaysPlayed.includes(i) ? 'bg-primary text-white shadow-sm' : 'bg-white text-muted border border-gray-200'}`} style={{ width: '28px', height: '28px', fontSize: '11px', fontWeight: actualDaysPlayed.includes(i) ? 600 : 400 }}>{lbl}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Column 3: Session Breakdown */}
                        <td className="align-top p-4 border-end border-gray-50">
                           <div className="d-flex flex-wrap gap-2">
                             {sessionChips.map((date, idx) => {
                               const displayDate = date.substring(0, 5); 
                               return (
                                 <span key={idx} className="badge bg-light text-dark border border-gray-200 px-2.5 py-1.5 rounded-pill" style={{ fontWeight: 500 }}>
                                   {displayDate}
                                 </span>
                               );
                             })}
                           </div>
                           <div className="text-slate-800 fw-bold mt-4 pt-3 border-top border-gray-50" style={{ fontSize: '14px' }}>
                             Giai đoạn: {formatDateVN(rangeStart)} – {formatDateVN(rangeEnd)}
                           </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

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
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger p-1"
                        onClick={() => { void handleRemoveCoupon(); }}
                        disabled={previewingDiscount}
                        title="Xóa mã"
                      >
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
                          onChange={e => { setCouponCode(e.target.value); setCouponError(''); }}
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
                    {formatDateVN(rangeStart).split(', ')[1]} - {formatDateVN(rangeEnd).split(', ')[1]}
                  </li>
                  <li className="mb-2">
                    <i className="feather-clock me-2 text-primary" />
                    <strong>{sessionCount} buổi:</strong> 
                    <span className="text-muted ms-1">({slotCount} ô × {slotDuration < 60 ? `${slotDuration} phút` : slotDuration === 60 ? '1 giờ' : `${slotDuration / 60} giờ`})</span>
                  </li>
                </ul>
                <hr />
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Tổng giờ</span>
                  <strong>{totalHours}</strong>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span>Giá gốc</span>
                  <strong className={anyDiscount ? 'text-decoration-line-through text-muted' : 'primary-text fs-5'}>
                    {Math.round(totalPrice).toLocaleString('vi-VN')} VNĐ
                  </strong>
                </div>
                {sessionCount > 0 && (
                  <div className="d-flex justify-content-end text-muted mb-2 mt-1" style={{ fontSize: '12px' }}>
                    {Math.round(totalPrice / sessionCount).toLocaleString('vi-VN')}đ × {sessionCount} buổi
                  </div>
                )}
                {longTermDiscountAmount > 0 && (
                  <div className="d-flex justify-content-between align-items-center mb-2 text-success">
                    <span><i className="feather-tag me-1" />Giảm giá đợt dài hạn</span>
                    <strong>-{Math.round(longTermDiscountAmount).toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                )}
                {couponDiscountAmount > 0 && (
                  <div className="d-flex justify-content-between align-items-center mb-2 text-success">
                    <span>
                      <i className="feather-gift me-1" />
                      Giảm giá do mã ưu đãi{appliedCoupon ? ` (${appliedCoupon})` : ''}
                    </span>
                    <strong>-{couponDiscountAmount.toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                )}
                {showLegacyDiscountRow && (
                  <div className="d-flex justify-content-between align-items-center mb-2 text-success">
                    <span><i className="feather-tag me-1" />Giảm giá</span>
                    <strong>-{legacyDiscountTotal.toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                )}
                {anyDiscount ? (
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="fw-bold">Thành tiền</span>
                    <strong className="primary-text fs-4">{Number(discountInfo.finalAmount).toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                ) : (
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="fw-bold">Thành tiền</span>
                    <strong className="primary-text fs-4">{Math.round(totalPrice).toLocaleString('vi-VN')} VNĐ</strong>
                  </div>
                )}
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
                    onClick={() => navigate('/booking/long-term/fixed', { state: location.state })}
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
