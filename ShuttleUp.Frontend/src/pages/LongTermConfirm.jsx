import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import LongTermBookingSteps from '../components/booking/LongTermBookingSteps';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profileApi';
import { createLongTermBooking } from '../api/bookingApi';

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
    preview = null,
  } = state;

  const [form, setForm] = useState({
    name: user?.fullName ?? '',
    phone: (user?.phoneNumber ?? '').trim(),
    note: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    profileApi
      .getMe()
      .then((data) => {
        const u = data?.user ?? data;
        if (!u) return;
        setForm((prev) => ({
          ...prev,
          name: prev.name || (u.fullName ?? '').trim() || '',
          phone: prev.phone || (u.phoneNumber ?? '').trim() || '',
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
    if (!venueId || !courtId || !rangeStart || !rangeEnd) {
      setSubmitError('Thiếu dữ liệu lịch. Vui lòng làm lại từ đầu.');
      return;
    }
    setSubmitError('');
    setLoading(true);
    try {
      // axiosClient interceptor returns response.data directly (no nested .data)
      const result = await createLongTermBooking({
        venueId,
        courtId,
        rangeStart,
        rangeEnd,
        sessionStartTime,
        sessionEndTime,
        daysOfWeek,
        contactName: form.name.trim(),
        contactPhone: form.phone.trim(),
        note: form.note.trim() || undefined,
      });
      const bookingId = result.bookingId ?? result.BookingId;
      if (!bookingId) {
        setSubmitError('Phản hồi server không có mã đơn.');
        setLoading(false);
        return;
      }
      navigate(`/booking/payment?bookingId=${bookingId}&flow=long-term`);
    } catch (err) {
      const msg =
        err.response?.data?.message
        || err.message
        || 'Không tạo được đơn.';
      setSubmitError(msg);
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

  return (
    <div className="main-wrapper" style={{ paddingTop: '96px' }}>
      <LongTermBookingSteps currentStep={2} />

      <div className="content">
        <div className="container py-4">
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="mb-3">Xác nhận đặt lịch dài hạn</h3>
              <p className="text-muted mb-1"><strong>{venueName}</strong></p>
              {venueAddress && <p className="small mb-2">{venueAddress}</p>}
              <ul className="list-unstyled small mb-0">
                <li>Sân: <strong>{courtName || courtId}</strong></li>
                <li>Từ {rangeStart} đến {rangeEnd}</li>
                <li>Giờ: {sessionStartTime} – {sessionEndTime}</li>
                <li>
                  {preview.sessionCount} buổi · {preview.slotCount} ô × 30 phút ·{' '}
                  <strong className="text-success">{Number(preview.totalAmount).toLocaleString('vi-VN')} VNĐ</strong>
                </li>
              </ul>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-body">
              <h5 className="border-bottom pb-2">Thông tin liên hệ</h5>
              <div className="mb-3">
                <label className="form-label">Họ tên <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                  value={form.name}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, name: e.target.value }));
                    setErrors((er) => ({ ...er, name: '' }));
                  }}
                />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label">Số điện thoại <span className="text-danger">*</span></label>
                <input
                  type="tel"
                  className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
                  value={form.phone}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, phone: e.target.value }));
                    setErrors((er) => ({ ...er, phone: '' }));
                  }}
                />
                {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
              </div>
              <div className="mb-3">
                <label className="form-label">Ghi chú</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
              {submitError && <div className="alert alert-danger">{submitError}</div>}
              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={handleSubmit}
                >
                  {loading ? 'Đang tạo đơn…' : 'Tạo đơn & thanh toán'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => navigate('/booking/long-term', { state: location.state })}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
