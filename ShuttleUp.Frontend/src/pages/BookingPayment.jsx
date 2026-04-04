import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import BookingSteps from '../components/booking/BookingSteps';
import LongTermBookingSteps from '../components/booking/LongTermBookingSteps';
import {
  createBooking,
  submitPayment,
  getVenueCheckoutSettings,
  getBookingPaymentContext,
} from '../api/bookingApi';

const FALLBACK_BANK = {
  bank: 'Vietcombank',
  account: '—',
  name: '—',
  note: 'Nội dung CK: [SĐT] - [Tên sân] - [Ngày]',
};

const HOLD_SECONDS = 15 * 60;

function formatDateVN(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function padTwo(n) { return String(n).padStart(2, '0'); }

function buildTransferNote(template, { phone, venueName, dateIso }) {
  const t = template || '[SĐT] - [Tên sân] - [Ngày]';
  return t
    .replace('[SĐT]', phone || '')
    .replace('[Tên sân]', venueName || '')
    .replace('[Ngày]', dateIso ? formatDateVN(dateIso) : '');
}

function mapApiSlotsToRows(items) {
  if (!Array.isArray(items)) return [];
  return items.map((s) => {
    let timeLabel = s.timeLabel;
    if (!timeLabel && s.startTime) {
      const d = new Date(s.startTime);
      timeLabel = `${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
    }
    return { ...s, timeLabel, price: s.price ?? 0 };
  });
}

export default function BookingPayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const paramBookingId = searchParams.get('bookingId');
  const isLongTermFlow = searchParams.get('flow') === 'long-term';

  const initial = location.state ?? {};

  const [pay, setPay] = useState({
    venueId: initial.venueId ?? null,
    venueName: initial.venueName ?? 'Sân cầu lông',
    venueAddress: initial.venueAddress ?? '',
    date: initial.date ?? new Date().toISOString().split('T')[0],
    selectedSlots: initial.selectedSlots ?? [],
    totalPrice: initial.totalPrice ?? 0,
    totalHours: initial.totalHours ?? '0h',
    customerName: initial.customerName ?? '',
    customerPhone: initial.customerPhone ?? '',
    note: initial.note ?? '',
    couponCode: initial.couponCode ?? null,
    discountInfo: initial.discountInfo ?? null,
  });

  /** Chỉ nộp CK (đã có booking — thanh toán lại) */
  const [resumeBookingId, setResumeBookingId] = useState(paramBookingId);
  const [resumeBookingCode, setResumeBookingCode] = useState(null);
  const [loadingContext, setLoadingContext] = useState(!!paramBookingId);
  const [checkoutSettings, setCheckoutSettings] = useState(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState('');

  const loadResume = useCallback(async () => {
    if (!paramBookingId) return;
    setLoadingContext(true);
    try {
      const ctx = await getBookingPaymentContext(paramBookingId);
      setResumeBookingId(ctx.bookingId);
      setResumeBookingCode(ctx.bookingCode ?? null);
      setPay({
        venueId: ctx.venueId,
        venueName: ctx.venueName ?? 'Sân cầu lông',
        venueAddress: ctx.venueAddress ?? '',
        date: ctx.date ?? new Date().toISOString().split('T')[0],
        selectedSlots: mapApiSlotsToRows(ctx.selectedSlots),
        totalPrice: Number(ctx.totalPrice ?? 0),
        totalHours: ctx.totalHours ?? '0h',
        customerName: ctx.customerName ?? '',
        customerPhone: ctx.customerPhone ?? '',
        note: ctx.note ?? '',
      });
    } catch {
      setError('Không tải được đơn để thanh toán. Vui lòng thử từ Lịch sử đặt sân.');
    } finally {
      setLoadingContext(false);
    }
  }, [paramBookingId]);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  const transferNote = useMemo(
    () => buildTransferNote(checkoutSettings?.transferNoteTemplate, {
      phone: pay.customerPhone,
      venueName: pay.venueName,
      dateIso: pay.date,
    }),
    [checkoutSettings?.transferNoteTemplate, pay.customerPhone, pay.venueName, pay.date],
  );

  useEffect(() => {
    if (!pay.venueId) return;
    let cancelled = false;
    (async () => {
      setLoadingCheckout(true);
      try {
        const finalPrice = pay.discountInfo ? (pay.discountInfo.finalAmount || pay.discountInfo.finalPrice) : pay.totalPrice;
        const data = await getVenueCheckoutSettings(pay.venueId, {
          amount: finalPrice,
          addInfo: transferNote,
        });
        if (!cancelled) setCheckoutSettings(data);
      } catch {
        if (!cancelled) setCheckoutSettings(null);
      } finally {
        if (!cancelled) setLoadingCheckout(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pay.venueId, pay.totalPrice, pay.discountInfo, transferNote]);

  const bankInfo = useMemo(() => {
    if (checkoutSettings?.bankName) {
      return {
        bank: checkoutSettings.bankName,
        account: checkoutSettings.accountNumber || FALLBACK_BANK.account,
        name: checkoutSettings.accountHolder || FALLBACK_BANK.name,
        note: `Nội dung CK: ${transferNote}`,
      };
    }
    return {
      ...FALLBACK_BANK,
      note: `Nội dung CK: ${transferNote}`,
    };
  }, [checkoutSettings, transferNote]);

  const vietQrUrl = checkoutSettings?.vietQrImageUrl || null;

  const [method, setMethod] = useState('bank');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
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

  useEffect(() => () => { if (proofPreview) URL.revokeObjectURL(proofPreview); }, [proofPreview]);

  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const [expired, setExpired] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
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
  const timerUrgent = secondsLeft <= 120;

  const handleExpiredOk = useCallback(() => {
    navigate('/booking', { state: location.state, replace: true });
  }, [navigate, location.state]);

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigateComplete = (payload) => {
    navigate('/booking/complete', {
      state: isLongTermFlow ? { ...payload, flowLongTerm: true } : payload,
    });
  };

  const handleConfirm = async () => {
    if (!proofFile) { setError('Vui lòng upload ảnh minh chứng chuyển khoản.'); return; }
    if (!agreed) { setError('Vui lòng đồng ý với điều khoản dịch vụ.'); return; }
    if (expired) { setError('Thời gian giữ chỗ đã hết. Vui lòng đặt lại.'); return; }
    if (!pay.venueId) { setError('Thiếu thông tin cơ sở. Vui lòng chọn sân lại.'); return; }

    setError('');
    setLoading(true);

    try {
      let bookingId = resumeBookingId;
      let bookingCodeFromApi = resumeBookingCode;
      let bookingStatus = 'PENDING';

      if (resumeBookingId) {
        /* Thanh toán lại — chỉ upload CK */
      } else {
        const items = (pay.selectedSlots || [])
          .filter(s => s.courtId && s.startTime && s.endTime)
          .map(s => ({
            courtId: s.courtId,
            startTime: s.startTime,
            endTime: s.endTime,
          }));

        if (items.length === 0) {
          setError('Không có khung giờ hợp lệ. Vui lòng quay lại chọn giờ.');
          setLoading(false);
          return;
        }

        const created = await createBooking({
          venueId: pay.venueId,
          items,
          contactName: pay.customerName,
          contactPhone: pay.customerPhone,
          note: pay.note || undefined,
          couponCode: pay.couponCode || undefined,
        });

        bookingId = created.bookingId ?? created.BookingId;
        bookingCodeFromApi = created.bookingCode ?? created.BookingCode;
        bookingStatus = created.status ?? created.Status ?? 'PENDING';
        if (!bookingId) {
          setError('Phản hồi từ server không hợp lệ (thiếu mã đơn).');
          setLoading(false);
          return;
        }
      }

      const formData = new FormData();
      formData.append('method', method === 'qr' ? 'QR' : 'BANK');
      formData.append('proofImage', proofFile);

      const payRes = await submitPayment(bookingId, formData);
      const bookingCode = payRes.bookingCode ?? bookingCodeFromApi ?? `SU${String(bookingId).slice(-6)}`;

      setLoading(false);
      clearInterval(intervalRef.current);

      navigateComplete({
        venueId: pay.venueId,
        venueName: pay.venueName,
        venueAddress: pay.venueAddress,
        date: pay.date,
        selectedSlots: pay.selectedSlots,
        totalPrice: pay.totalPrice,
        totalHours: pay.totalHours,
        customerName: pay.customerName,
        customerPhone: pay.customerPhone,
        note: pay.note,
        bookingId,
        paymentMethod: method === 'qr' ? 'Quét mã QR' : 'Chuyển khoản ngân hàng',
        bookingCode,
        bookingStatus,
      });
    } catch (e) {
      setLoading(false);
      const status = e.response?.status;
      const body = e.response?.data;
      const msg =
        (typeof body === 'string' ? body : null)
        || body?.message
        || body?.title
        || (Array.isArray(body?.errors) ? body.errors.join(' ') : null)
        || e.message
        || 'Đã có lỗi xảy ra.';
      if (status === 409) {
        setError(`${msg} Bạn có thể quay lại bước chọn giờ.`);
      } else if (status === 401) {
        setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại rồi thử thanh toán.');
      } else {
        setError(msg);
      }
    }
  };

  const {
    venueName, venueAddress, date, selectedSlots, totalPrice, totalHours,
    customerName, customerPhone, note, discountInfo
  } = pay;
  const finalPriceToDisplay = discountInfo ? (discountInfo.finalAmount || discountInfo.finalPrice) : totalPrice;

  if (loadingContext) {
    return (
      <div className="main-wrapper content-below-header text-center py-5" style={{ paddingTop: '120px' }}>
        <div className="spinner-border text-secondary" role="status" />
        <p className="text-muted mt-2">Đang tải thông tin thanh toán…</p>
      </div>
    );
  }

  return (
    <div className="main-wrapper" style={{ paddingTop: '96px' }}>

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

      {isLongTermFlow ? (
        <LongTermBookingSteps
          currentStep={3}
          bookingId={resumeBookingId || paramBookingId || undefined}
        />
      ) : (
        <BookingSteps currentStep={3} />
      )}

      <div className="content">
        <div className="container">

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

          {resumeBookingId && (
            <p className="small text-muted mb-3">
              <i className="feather-info me-1" />
              Bạn đang <strong>thanh toán lại</strong> cho đơn chờ duyệt
              {resumeBookingCode ? <> — mã <code>{resumeBookingCode}</code></> : null}.
            </p>
          )}

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

            <div className="col-12 col-lg-5">
              <aside className="card payment-modes">
                <h3 className="border-bottom">Phương thức thanh toán</h3>

                {loadingCheckout && (
                  <p className="small text-muted mb-2">Đang tải thông tin tài khoản…</p>
                )}

                <div className="radio mb-3">
                  {[
                    { id: 'bank', label: 'Chuyển khoản ngân hàng', icon: 'feather-credit-card' },
                    { id: 'qr', label: 'Quét mã QR (VietQR)', icon: 'feather-smartphone' },
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

                <div
                  className="rounded p-3 mb-3"
                  style={{ backgroundColor: '#f0fdf4', border: '1px solid #d1fae5' }}
                >
                  {method === 'bank' && (
                    <div className="small">
                      <p className="mb-1"><strong>Ngân hàng:</strong> {bankInfo.bank}</p>
                      <p className="mb-1">
                        <strong>Số tài khoản:</strong>{' '}
                        <span
                          style={{ fontFamily: 'monospace', letterSpacing: 1, cursor: 'pointer', textDecoration: 'underline dotted' }}
                          title="Nhấn để sao chép"
                          onClick={() => navigator.clipboard?.writeText(String(bankInfo.account).replace(/\s/g, ''))}
                        >
                          {bankInfo.account}
                        </span>
                      </p>
                      <p className="mb-1"><strong>Chủ TK:</strong> {bankInfo.name}</p>
                      <p className="mb-1"><strong>Số tiền:</strong> <span className="primary-text fw-semibold">{finalPriceToDisplay.toLocaleString('vi-VN')} VNĐ</span></p>
                      <p className="mb-0 text-muted">{bankInfo.note}</p>
                    </div>
                  )}
                  {method === 'qr' && (
                    <div className="text-center small">
                      <p className="mb-2 text-muted">Mở app ngân hàng và quét mã VietQR</p>
                      {vietQrUrl ? (
                        <img
                          src={vietQrUrl}
                          alt="VietQR"
                          style={{ maxWidth: '220px', width: '100%', height: 'auto', borderRadius: 12, border: '1px solid #d1fae5' }}
                        />
                      ) : (
                        <div
                          className="mx-auto d-flex align-items-center justify-content-center rounded"
                          style={{ width: '140px', height: '140px', backgroundColor: '#fef3c7', fontSize: '12px', color: '#92400e', padding: 8 }}
                        >
                          Chưa cấu hình STK/BIN đủ để tạo QR. Chủ sân cần cập nhật tại Cài đặt thanh toán.
                        </div>
                      )}
                      <p className="mt-2 mb-0 primary-text fw-semibold">{finalPriceToDisplay.toLocaleString('vi-VN')} VNĐ</p>
                      <p className="text-muted mt-1 mb-0" style={{ fontSize: '11px' }}>{bankInfo.note}</p>
                    </div>
                  )}
                </div>

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

                <ul className="order-sub-total list-unstyled">
                  <li className="d-flex justify-content-between mb-2">
                    <span>Tạm tính</span>
                    <span>{totalPrice.toLocaleString('vi-VN')} VNĐ</span>
                  </li>
                  {discountInfo && discountInfo.discountAmount > 0 && (
                    <li className="d-flex justify-content-between mb-2 text-success">
                      <span>Giảm giá</span>
                      <span>-{(discountInfo.discountAmount).toLocaleString('vi-VN')} VNĐ</span>
                    </li>
                  )}
                  <li className="d-flex justify-content-between mb-2">
                    <span>Phí dịch vụ</span>
                    <span>0 VNĐ</span>
                  </li>
                </ul>
                <div className="order-total d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Tổng cộng</h5>
                  <h5 className="mb-0 primary-text">{finalPriceToDisplay.toLocaleString('vi-VN')} VNĐ</h5>
                </div>

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
                      : (resumeBookingId ? `Gửi minh chứng — ${finalPriceToDisplay.toLocaleString('vi-VN')} VNĐ` : `Xác nhận đặt sân — ${finalPriceToDisplay.toLocaleString('vi-VN')} VNĐ`)
                    }
                  </button>
                </div>
              </aside>
            </div>
          </div>

          <div className="text-center btn-row mt-4">
            {!resumeBookingId ? (
              <button
                type="button"
                className="btn btn-primary me-3 btn-icon"
                onClick={() => navigate('/booking/confirm', { state: location.state })}
              >
                <i className="feather-arrow-left-circle me-1" /> Quay lại
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-outline-secondary me-3 btn-icon"
                onClick={() => navigate('/user/bookings')}
              >
                <i className="feather-arrow-left-circle me-1" /> Về lịch sử đặt sân
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
