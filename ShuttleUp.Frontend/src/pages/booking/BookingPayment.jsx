import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import BookingSteps from '../../components/booking/BookingSteps';
import LongTermBookingSteps from '../../components/booking/LongTermBookingSteps';
import {
  submitPayment,
  getVenueCheckoutSettings,
  getBookingPaymentContext,
  cancelHold,
} from '../../api/bookingApi';

const FALLBACK_BANK = {
  bank: 'Vietcombank',
  account: '—',
  name: '—',
  note: 'Nội dung CK: [SĐT] - [Tên sân] - [Ngày]',
};

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
    let timeEndLabel = s.timeEndLabel;
    if (s.startTime) {
      const d = new Date(s.startTime);
      if (!timeLabel) timeLabel = `${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
    }
    if (s.endTime) {
      const de = new Date(s.endTime);
      if (!timeEndLabel) timeEndLabel = `${padTwo(de.getHours())}:${padTwo(de.getMinutes())}`;
    }
    return { ...s, timeLabel, timeEndLabel, price: s.price ?? 0 };
  });
}

export default function BookingPayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const paramBookingId = searchParams.get('bookingId');
  const isLongTermFlow = searchParams.get('flow') === 'long-term';

  const [pay, setPay] = useState({
    venueId: null,
    venueName: 'Sân cầu lông',
    venueAddress: '',
    date: new Date().toISOString().split('T')[0],
    selectedSlots: [],
    totalPrice: 0,
    totalHours: '0h',
    slotDuration: 60,
    customerName: '',
    customerPhone: '',
    note: '',
  });

  const [bookingId, setBookingId] = useState(paramBookingId);
  const [bookingCode, setBookingCode] = useState(null);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [checkoutSettings, setCheckoutSettings] = useState(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState('');

  const loadContext = useCallback(async () => {
    if (!paramBookingId) {
      setError('Không tìm thấy mã đơn. Vui lòng đặt lại.');
      setLoadingContext(false);
      return;
    }
    setLoadingContext(true);
    try {
      const ctx = await getBookingPaymentContext(paramBookingId);
      setBookingId(ctx.bookingId);
      setBookingCode(ctx.bookingCode ?? null);
      setBookingStatus(ctx.status ?? null);
      setHoldExpiresAt(ctx.holdExpiresAt ?? null);
      setPay({
        venueId: ctx.venueId,
        venueName: ctx.venueName ?? 'Sân cầu lông',
        venueAddress: ctx.venueAddress ?? '',
        date: ctx.date ?? new Date().toISOString().split('T')[0],
        selectedSlots: mapApiSlotsToRows(ctx.selectedSlots),
        totalPrice: Number(ctx.totalPrice ?? 0),
        totalHours: ctx.totalHours ?? '0h',
        slotDuration: [30, 60, 120].includes(ctx.slotDuration) ? ctx.slotDuration : 60,
        customerName: ctx.customerName ?? '',
        customerPhone: ctx.customerPhone ?? '',
        note: ctx.note ?? '',
      });
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'HOLD_EXPIRED') {
        setError('Thời gian giữ chỗ đã hết. Vui lòng đặt lại.');
      } else {
        setError('Không tải được đơn để thanh toán. Vui lòng thử từ Lịch sử đặt sân.');
      }
    } finally {
      setLoadingContext(false);
    }
  }, [paramBookingId]);

  useEffect(() => { loadContext(); }, [loadContext]);

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
        const data = await getVenueCheckoutSettings(pay.venueId, {
          amount: pay.totalPrice,
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
  }, [pay.venueId, pay.totalPrice, transferNote]);

  const bankInfo = useMemo(() => {
    if (checkoutSettings?.bankName) {
      return {
        bank: checkoutSettings.bankName,
        account: checkoutSettings.accountNumber || FALLBACK_BANK.account,
        name: checkoutSettings.accountHolder || FALLBACK_BANK.name,
        note: `Nội dung CK: ${transferNote}`,
      };
    }
    return { ...FALLBACK_BANK, note: `Nội dung CK: ${transferNote}` };
  }, [checkoutSettings, transferNote]);

  const vietQrUrl = checkoutSettings?.vietQrImageUrl || null;

  const [method, setMethod] = useState('bank');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Vui lòng chọn file ảnh (JPG, PNG, ...).'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Ảnh không được vượt quá 10 MB.'); return; }
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

  /* ── Server-synced countdown ── */
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [expired, setExpired] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!holdExpiresAt) return;
    const computeRemaining = () => {
      let ts = holdExpiresAt;
      if (typeof ts === 'string' && !ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
      const diff = Math.floor((new Date(ts).getTime() - Date.now()) / 1000);
      return Math.max(diff, 0);
    };
    setSecondsLeft(computeRemaining());
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const remaining = computeRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        setExpired(true);
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [holdExpiresAt]);

  const timerMins = secondsLeft != null ? Math.floor(secondsLeft / 60) : 0;
  const timerSecs = secondsLeft != null ? secondsLeft % 60 : 0;
  const timerUrgent = secondsLeft != null && secondsLeft <= 60;
  const isHolding = bookingStatus === 'HOLDING';

  const handleExpiredOk = useCallback(() => {
    if (pay.venueId) navigate(`/venues/${pay.venueId}`);
    else navigate('/venues');
  }, [navigate, pay.venueId]);

  const [agreed, setAgreed] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const navigateComplete = (payload) => {
    navigate('/booking/complete', {
      state: isLongTermFlow ? { ...payload, flowLongTerm: true } : payload,
    });
  };

  const handleConfirm = async () => {
    if (!proofFile) { setError('Vui lòng upload ảnh minh chứng chuyển khoản.'); return; }
    if (!agreed) { setError('Vui lòng đồng ý với điều khoản dịch vụ.'); return; }
    if (expired) { setError('Thời gian giữ chỗ đã hết. Vui lòng đặt lại.'); return; }
    if (!bookingId) { setError('Thiếu mã đơn. Vui lòng đặt lại.'); return; }

    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('method', method === 'qr' ? 'QR' : 'BANK');
      formData.append('proofImage', proofFile);

      const payRes = await submitPayment(bookingId, formData);
      const code = payRes.bookingCode ?? bookingCode ?? `SU${String(bookingId).slice(-6)}`;

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
        slotDuration: pay.slotDuration,
        customerName: pay.customerName,
        customerPhone: pay.customerPhone,
        note: pay.note,
        bookingId,
        paymentMethod: method === 'qr' ? 'Quét mã QR' : 'Chuyển khoản ngân hàng',
        bookingCode: code,
        bookingStatus: payRes.bookingStatus ?? 'PENDING',
      });
    } catch (e) {
      setLoading(false);
      const status = e.response?.status;
      const body = e.response?.data;
      const code = body?.code;
      if (code === 'HOLD_EXPIRED') {
        setExpired(true);
        setSecondsLeft(0);
        return;
      }
      const msg =
        (typeof body === 'string' ? body : null)
        || body?.message
        || body?.title
        || (Array.isArray(body?.errors) ? body.errors.join(' ') : null)
        || e.message
        || 'Đã có lỗi xảy ra.';
      if (status === 409) setError(`${msg} Bạn có thể quay lại bước chọn giờ.`);
      else if (status === 401) setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại rồi thử thanh toán.');
      else setError(msg);
    }
  };

  const { venueName, venueAddress, date, selectedSlots, totalPrice, totalHours, customerName, customerPhone, note } = pay;

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
          aVal = a.startTime || a.timeLabel || '';
          bVal = b.startTime || b.timeLabel || '';
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

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [sortConfig, selectedSlots]);

  const totalPages = Math.ceil(sortedSlots.length / ITEMS_PER_PAGE);
  const paginatedSlots = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedSlots.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedSlots, currentPage]);

  const toggleSort = (key) => setSortConfig(prev => ({
    key,
    dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
  }));

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <i className="feather-chevron-down text-muted ms-1" style={{ fontSize: '0.8em', opacity: 0.3 }} />;
    return <i className={`feather-chevron-${sortConfig.dir === 'asc' ? 'up' : 'down'} text-primary ms-1`} style={{ fontSize: '0.8em' }} />;
  };

  if (loadingContext) {
    return (
      <div className="main-wrapper content-below-header text-center py-5">
        <div className="spinner-border text-secondary" role="status" />
        <p className="text-muted mt-2">Đang tải thông tin thanh toán…</p>
      </div>
    );
  }

  return (
    <div className="main-wrapper content-below-header">

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
              5 phút đã trôi qua. Các khung giờ bạn chọn đã được giải phóng để người khác đặt.
              Vui lòng thực hiện lại quá trình đặt sân.
            </p>
            <button
              type="button"
              className="btn btn-secondary w-100"
              onClick={handleExpiredOk}
            >
              Quay lại trang sân
            </button>
          </div>
        </div>
      )}

      {isLongTermFlow ? (
        <LongTermBookingSteps
          currentStep={3}
          bookingId={bookingId || paramBookingId || undefined}
        />
      ) : (
        <BookingSteps currentStep={3} />
      )}

      <div className="content">
        <div className="container">

          {/* Server-synced countdown */}
          {isHolding && secondsLeft != null && (
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
                — Hoàn tất trong 5 phút, slot sẽ tự động giải phóng khi hết giờ.
              </span>
            </div>
          )}

          {bookingCode && (
            <p className="small text-muted mb-3">
              <i className="feather-info me-1" />
              Mã đơn: <code>{bookingCode}</code>
              {isHolding && <> — đang giữ chỗ, vui lòng hoàn tất thanh toán.</>}
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
                    {totalHours} ({selectedSlots.length} ô × {pay.slotDuration < 60 ? `${pay.slotDuration} phút` : pay.slotDuration === 60 ? '1 giờ' : `${pay.slotDuration / 60} giờ`})
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
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('courtName')}>Sân {renderSortIcon('courtName')}</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('time')}>Giờ {renderSortIcon('time')}</th>
                        <th style={{ cursor: 'pointer', userSelect: 'none' }} className="text-end" onClick={() => toggleSort('price')}>Tiền {renderSortIcon('price')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSlots.map((s, i) => (
                        <tr key={i}>
                          <td>{s.courtName}</td>
                          <td>{s.timeEndLabel ? `${s.timeLabel} – ${s.timeEndLabel}` : s.timeLabel}</td>
                          <td className="text-end">{(s.price ?? 0).toLocaleString('vi-VN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', padding: '8px 4px' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>
                      Trang <strong style={{ color: '#111' }}>{currentPage}</strong> / {totalPages}
                      <span style={{ color: '#9ca3af', marginLeft: '8px' }}>({sortedSlots.length} khung giờ)</span>
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        style={{
                          border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 14px',
                          fontSize: '13px', fontWeight: 500, cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          backgroundColor: currentPage === 1 ? '#f9fafb' : '#fff',
                          color: currentPage === 1 ? '#d1d5db' : '#374151',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <i className="feather-chevron-left" style={{ fontSize: '12px', marginRight: '4px' }} />Trước
                      </button>
                      {[...Array(totalPages)].map((_, idx) => {
                        const pg = idx + 1;
                        const isActive = currentPage === pg;
                        return (
                          <button
                            key={idx}
                            onClick={() => setCurrentPage(pg)}
                            style={{
                              border: isActive ? '1px solid #16a34a' : '1px solid #e5e7eb',
                              borderRadius: '8px', padding: '6px 12px', minWidth: '36px',
                              fontSize: '13px', fontWeight: isActive ? 700 : 500,
                              cursor: 'pointer',
                              backgroundColor: isActive ? '#16a34a' : '#fff',
                              color: isActive ? '#fff' : '#374151',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {pg}
                          </button>
                        );
                      })}
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        style={{
                          border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 14px',
                          fontSize: '13px', fontWeight: 500, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          backgroundColor: currentPage === totalPages ? '#f9fafb' : '#fff',
                          color: currentPage === totalPages ? '#d1d5db' : '#374151',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Sau<i className="feather-chevron-right" style={{ fontSize: '12px', marginLeft: '4px' }} />
                      </button>
                    </div>
                  </div>
                )}
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
                      <p className="mb-1"><strong>Số tiền:</strong> <span className="primary-text fw-semibold">{totalPrice.toLocaleString('vi-VN')} VNĐ</span></p>
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
                      <p className="mt-2 mb-0 primary-text fw-semibold">{totalPrice.toLocaleString('vi-VN')} VNĐ</p>
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
                          width: '100%', maxHeight: '220px', objectFit: 'contain',
                          borderRadius: 10, border: '2px solid #6ee7b7', backgroundColor: '#f8fafc',
                        }}
                      />
                      <button
                        type="button"
                        onClick={removeProof}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
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
                      style={{ border: '2px dashed #d1fae5', background: '#f0fdf4', cursor: 'pointer', minHeight: '120px' }}
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
                  <li className="d-flex justify-content-between mb-2">
                    <span>Phí dịch vụ</span>
                    <span>0 VNĐ</span>
                  </li>
                </ul>
                <div className="order-total d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Tổng cộng</h5>
                  <h5 className="mb-0 primary-text">{totalPrice.toLocaleString('vi-VN')} VNĐ</h5>
                </div>

                {/* ── Venue Rules + Cancellation Policy ── */}
                {(checkoutSettings?.venueRules?.trim() || checkoutSettings?.cancellation) && (
                  <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <div
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      onClick={() => setRulesExpanded(!rulesExpanded)}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#581c87' }}>
                        <i className="feather-book-open me-2" style={{ fontSize: 14 }} />Quy định sân & Chính sách hoàn tiền
                      </span>
                      <i className={`feather-chevron-${rulesExpanded ? 'up' : 'down'}`} style={{ fontSize: 14, color: '#7c3aed' }} />
                    </div>
                    {rulesExpanded && (
                      <div style={{ marginTop: 12 }}>
                        {checkoutSettings?.venueRules?.trim() && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Quy định tại sân</div>
                            <div style={{ fontSize: 13, color: '#581c87', whiteSpace: 'pre-line', lineHeight: 1.7, background: '#f5f3ff', borderRadius: 8, padding: '10px 14px' }}>
                              {checkoutSettings.venueRules.trim()}
                            </div>
                          </div>
                        )}
                        {checkoutSettings?.cancellation && (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Chính sách huỷ & hoàn tiền</div>
                            <div style={{ fontSize: 13, color: '#78350f', background: '#fffbeb', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6 }}>
                              {checkoutSettings.cancellation.allowCancel
                                ? `Được huỷ trước ${checkoutSettings.cancellation.cancelBeforeMinutes >= 1440 ? `${checkoutSettings.cancellation.cancelBeforeMinutes / 1440} ngày` : checkoutSettings.cancellation.cancelBeforeMinutes >= 60 ? `${checkoutSettings.cancellation.cancelBeforeMinutes / 60} giờ` : `${checkoutSettings.cancellation.cancelBeforeMinutes} phút`}. Hoàn tiền: ${(checkoutSettings.cancellation.refundType || 'NONE') === 'FULL' ? '100%' : (checkoutSettings.cancellation.refundType || 'NONE') === 'PERCENT' ? `${checkoutSettings.cancellation.refundPercent}%` : 'không hoàn tiền'}.`
                                : 'Không cho phép tự huỷ trên app. Liên hệ chủ sân nếu cần huỷ.'}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!rulesExpanded && (
                      <p className="mb-0 mt-1" style={{ fontSize: 12, color: '#7c3aed' }}>Nhấn để xem chi tiết quy định và chính sách.</p>
                    )}
                  </div>
                )}



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
                    disabled={loading || expired || !agreed}
                  >
                    {loading
                      ? <><span className="spinner-border spinner-border-sm me-2" />Đang xử lý...</>
                      : `Xác nhận thanh toán — ${totalPrice.toLocaleString('vi-VN')} VNĐ`
                    }
                  </button>
                </div>
              </aside>
            </div>
          </div>

          <div className="text-center btn-row mt-4 d-flex justify-content-center gap-3">
            <button
              type="button"
              className="btn btn-primary btn-icon"
              onClick={() => {
                // Navigate back to the correct Confirm page, passing bookingId
                const backState = {
                  ...(location.state || {}),
                  ...pay,
                  bookingId: bookingId || paramBookingId,
                  customerName: pay.customerName,
                  customerPhone: pay.customerPhone,
                  note: pay.note,
                };
                if (isLongTermFlow) {
                  // For long-term flows, navigate to the generic long-term confirm
                  // The user will need the original schedule state; we pass what we have
                  navigate('/booking/long-term/confirm', { state: backState, replace: true });
                } else {
                  navigate('/booking/confirm', { state: backState, replace: true });
                }
              }}
              disabled={expired || cancelling}
            >
              <i className="feather-edit me-1" /> Quay lại chỉnh sửa thông tin
            </button>
            <button
              type="button"
              className="btn btn-outline-danger btn-icon"
              onClick={() => setShowCancelDialog(true)}
              disabled={expired || loading || cancelling}
            >
              <i className="feather-x-circle me-1" /> Huỷ giữ chỗ
            </button>
          </div>

          {/* Cancel confirmation dialog */}
          {showCancelDialog && (
            <div
              style={{
                position: 'fixed', inset: 0, zIndex: 9998,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div
                className="card text-center p-4"
                style={{ maxWidth: 420, width: '90%', borderRadius: 16 }}
              >
                <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 12, color: '#ef4444' }}>
                  <i className="feather-alert-triangle" />
                </div>
                <h4 className="mb-2">Xác nhận huỷ giữ chỗ?</h4>
                <p className="text-muted mb-4">
                  Các khung giờ bạn đã chọn sẽ được giải phóng để người khác đặt.
                  Bạn sẽ cần thực hiện lại từ đầu nếu muốn đặt sân.
                </p>
                <div className="d-flex gap-3 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowCancelDialog(false)}
                    disabled={cancelling}
                  >
                    Không, quay lại
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={cancelling}
                    onClick={async () => {
                      setCancelling(true);
                      try {
                        await cancelHold(bookingId || paramBookingId);
                        clearInterval(intervalRef.current);
                        if (pay.venueId) navigate(`/venues/${pay.venueId}`);
                        else navigate('/venues');
                      } catch (e) {
                        setError(e.response?.data?.message || 'Đã có lỗi khi huỷ giữ chỗ.');
                        setShowCancelDialog(false);
                      } finally {
                        setCancelling(false);
                      }
                    }}
                  >
                    {cancelling
                      ? <><span className="spinner-border spinner-border-sm me-2" />Đang huỷ...</>
                      : 'Xác nhận huỷ'
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
