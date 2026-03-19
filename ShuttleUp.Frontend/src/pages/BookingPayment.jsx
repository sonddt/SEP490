import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import BookingSteps from '../components/booking/BookingSteps';

const BANK_INFO = {
  bank:    'Vietcombank',
  account: '1234 5678 9012',
  name:    'SHUTTLEUP BADMINTON',
  note:    'Nội dung CK: [SĐT] - [Tên sân] - [Ngày]',
};

const HOLD_SECONDS = 15 * 60; // 15 minutes

function formatDateVN(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function padTwo(n) { return String(n).padStart(2, '0'); }

export default function BookingPayment() {
  const navigate  = useNavigate();
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

  // ── Payment method: bank or qr only ─────────────────────────────────────
  const [method, setMethod] = useState('bank');

  // ── Proof image upload ───────────────────────────────────────────────────
  const [proofFile,    setProofFile]    = useState(null);   // File object
  const [proofPreview, setProofPreview] = useState(null);   // Object URL
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh (JPG, PNG, ...).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ảnh không được vượt quá 10 MB.');
      return;
    }
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setError('');
  };

  const removeProof = () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cleanup object URL on unmount
  useEffect(() => () => { if (proofPreview) URL.revokeObjectURL(proofPreview); }, [proofPreview]);

  // ── 15-minute hold countdown ─────────────────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const [expired,     setExpired]     = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const timerMins = Math.floor(secondsLeft / 60);
  const timerSecs = secondsLeft % 60;
  const timerUrgent = secondsLeft <= 120; // red when ≤ 2 min

  // When expired: show overlay → after user clicks "OK" send them back
  const handleExpiredOk = useCallback(() => {
    navigate('/booking', { state: location.state, replace: true });
  }, [navigate, location.state]);

  // ── Form ─────────────────────────────────────────────────────────────────
  const [agreed,  setAgreed]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleConfirm = async () => {
    if (!proofFile)  { setError('Vui lòng upload ảnh minh chứng chuyển khoản.'); return; }
    if (!agreed)     { setError('Vui lòng đồng ý với điều khoản dịch vụ.'); return; }
    if (expired)     { setError('Thời gian giữ chỗ đã hết. Vui lòng đặt lại.'); return; }

    setError('');
    setLoading(true);

    // Upload proof image + create booking — wired to real API later
    await new Promise(r => setTimeout(r, 1200));

    setLoading(false);
    clearInterval(intervalRef.current);

    const bookingCode = `SU${Date.now().toString().slice(-6)}`;
    navigate('/booking/complete', {
      state: {
        venueId, venueName, venueAddress, date,
        selectedSlots, totalPrice, totalHours,
        customerName, customerPhone, note,
        paymentMethod: method === 'qr' ? 'Quét mã QR' : 'Chuyển khoản ngân hàng',
        bookingCode,
      },
    });
  };

  return (
    <div className="main-wrapper" style={{ paddingTop: '96px' }}>

      {/* ── Expired overlay ─────────────────────────────────────────────── */}
      {expired && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            className="card text-center p-4"
            style={{ maxWidth: 420, width: '90%', borderRadius: 16 }}
          >
            <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 12 }}>⏰</div>
            <h4 className="mb-2">Thời gian giữ chỗ đã hết!</h4>
            <p className="text-muted mb-4">
              15 phút đã trôi qua. Các khung giờ bạn chọn đã được giải phóng để người khác đặt.
              Vui lòng thực hiện lại quá trình đặt sân.
            </p>
            <button
              type="button"
              className="btn btn-secondary w-100"
              onClick={handleExpiredOk}
            >
              Quay lại chọn giờ
            </button>
          </div>
        </div>
      )}

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

          {/* ── Countdown banner ──────────────────────────────────────────── */}
          <div
            className="d-flex align-items-center justify-content-center gap-3 rounded p-3 mb-4"
            style={{
              background: timerUrgent ? '#fff1f1' : '#f0fdf4',
              border: `1.5px solid ${timerUrgent ? '#fca5a5' : '#6ee7b7'}`,
              transition: 'background 0.4s, border-color 0.4s',
            }}
          >
            <i
              className="feather-clock"
              style={{ fontSize: 22, color: timerUrgent ? '#ef4444' : 'var(--primary-color)' }}
            />
            <span style={{ fontWeight: 600, color: timerUrgent ? '#ef4444' : 'var(--primary-color)', fontSize: '1.05rem' }}>
              Giữ chỗ còn: {padTwo(timerMins)}:{padTwo(timerSecs)}
            </span>
            <span className="text-muted small">
              — Hoàn tất trong 15 phút, slot sẽ tự động giải phóng khi hết giờ.
            </span>
          </div>

          {/* Venue card */}
          <div className="master-academy dull-whitesmoke-bg card mb-4">
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
            {/* ── Left: order summary ─────────────────────────────────────── */}
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

            {/* ── Right: payment panel ────────────────────────────────────── */}
            <div className="col-12 col-lg-5">
              <aside className="card payment-modes">
                <h3 className="border-bottom">Phương thức thanh toán</h3>

                {/* Method selector — bank & QR only */}
                <div className="radio mb-3">
                  {[
                    { id: 'bank', label: 'Chuyển khoản ngân hàng', icon: 'feather-credit-card' },
                    { id: 'qr',   label: 'Quét mã QR',              icon: 'feather-smartphone'  },
                  ].map(pm => (
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
                      <p className="mb-1"><strong>Ngân hàng:</strong> {BANK_INFO.bank}</p>
                      <p className="mb-1">
                        <strong>Số tài khoản:</strong>{' '}
                        <span
                          style={{ fontFamily: 'monospace', letterSpacing: 1, cursor: 'pointer', textDecoration: 'underline dotted' }}
                          title="Nhấn để sao chép"
                          onClick={() => navigator.clipboard?.writeText(BANK_INFO.account.replace(/\s/g, ''))}
                        >
                          {BANK_INFO.account}
                        </span>
                      </p>
                      <p className="mb-1"><strong>Chủ TK:</strong> {BANK_INFO.name}</p>
                      <p className="mb-1"><strong>Số tiền:</strong> <span className="primary-text fw-semibold">{totalPrice.toLocaleString('vi-VN')} VNĐ</span></p>
                      <p className="mb-0 text-muted">{BANK_INFO.note}</p>
                    </div>
                  )}
                  {method === 'qr' && (
                    <div className="text-center small">
                      <p className="mb-2 text-muted">Mở ứng dụng ngân hàng và quét mã QR bên dưới</p>
                      <div
                        className="mx-auto d-flex align-items-center justify-content-center rounded"
                        style={{ width: '140px', height: '140px', backgroundColor: '#e5e7eb', fontSize: '12px', color: '#6b7280' }}
                      >
                        [QR mock]
                      </div>
                      <p className="mt-2 mb-0 primary-text fw-semibold">{totalPrice.toLocaleString('vi-VN')} VNĐ</p>
                    </div>
                  )}
                </div>

                {/* ── Upload proof image ───────────────────────────────── */}
                <div className="mb-3">
                  <label className="form-label fw-semibold d-flex align-items-center gap-2">
                    <i className="feather-image text-primary" />
                    Ảnh minh chứng chuyển khoản <span className="text-danger">*</span>
                  </label>

                  {proofPreview ? (
                    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                      <img
                        src={proofPreview}
                        alt="Minh chứng thanh toán"
                        style={{
                          width: '100%',
                          maxHeight: '220px',
                          objectFit: 'contain',
                          borderRadius: 10,
                          border: '2px solid #6ee7b7',
                          backgroundColor: '#f8fafc',
                        }}
                      />
                      <button
                        type="button"
                        onClick={removeProof}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          background: 'rgba(0,0,0,0.55)',
                          color: '#fff', border: 'none',
                          borderRadius: '50%', width: 28, height: 28,
                          cursor: 'pointer', fontSize: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Xóa ảnh"
                      >
                        ×
                      </button>
                      <p className="text-success small mt-1 mb-0">
                        <i className="feather-check-circle me-1" />
                        {proofFile.name}
                      </p>
                    </div>
                  ) : (
                    <div
                      className="d-flex flex-column align-items-center justify-content-center rounded p-4"
                      style={{
                        border: '2px dashed #d1fae5',
                        background: '#f0fdf4',
                        cursor: 'pointer',
                        minHeight: '120px',
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <i className="feather-upload-cloud" style={{ fontSize: 32, color: 'var(--primary-color)', marginBottom: 8 }} />
                      <p className="mb-1 fw-semibold" style={{ color: 'var(--primary-color)' }}>Nhấn để chọn ảnh</p>
                      <p className="text-muted small mb-0">JPG, PNG — tối đa 10 MB</p>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
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
                    disabled={loading || expired}
                  >
                    {loading
                      ? <><span className="spinner-border spinner-border-sm me-2" />Đang xử lý...</>
                      : `Xác nhận đặt sân — ${totalPrice.toLocaleString('vi-VN')} VNĐ`
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
