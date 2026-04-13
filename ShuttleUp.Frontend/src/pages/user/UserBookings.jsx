import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getMyBookings, cancelBooking, getCancelPreview, updateRefundBankInfo, remindOwner, uploadRefundQr } from '../../api/bookingApi';
import ReportModal from '../../components/common/ReportModal';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatPaymentMethodLabel(method) {
  if (!method) return 'Chờ minh chứng CK';
  const u = String(method).toUpperCase();
  if (u.includes('QR')) return 'Quét mã QR';
  if (u.includes('BANK')) return 'Chuyển khoản';
  if (u.includes('VNPAY')) return 'VNPay';
  return 'Chờ minh chứng CK';
}

function mapUserBookingTabStatus(apiStatus, items) {
  if (apiStatus === 'CANCELLED') return 'CANCELLED';
  if (apiStatus === 'PENDING_RECONCILIATION' || apiStatus === 'PENDING_REFUND') return 'REFUND';
  if (apiStatus === 'REFUNDED') return 'REFUND';
  if (apiStatus === 'PENDING') return 'PENDING';
  if (apiStatus === 'CONFIRMED') {
    const ends = (items || []).map((i) => new Date(i.endTime).getTime()).filter(Number.isFinite);
    if (ends.length === 0) return 'UPCOMING';
    const maxEnd = Math.max(...ends);
    return maxEnd >= Date.now() ? 'UPCOMING' : 'COMPLETED';
  }
  return 'UPCOMING';
}

function isThisWeek(d) {
  const n = new Date();
  const s = new Date(n);
  s.setDate(n.getDate() - n.getDay());
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
}

function isThisMonth(d) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

function matchesTimeFilter(filterDate, timeFilter) {
  if (timeFilter === 'all') return true;
  if (!filterDate || Number.isNaN(filterDate.getTime())) return true;
  if (timeFilter === 'week') return isThisWeek(filterDate);
  if (timeFilter === 'month') return isThisMonth(filterDate);
  return true;
}

function mapApiRowToBooking(api) {
  const items = [...(api.items || [])].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime),
  );
  const first = items[0];
  const last = items[items.length - 1];
  const start = first?.startTime ? new Date(first.startTime) : new Date(api.createdAt);
  const end = last?.endTime ? new Date(last.endTime) : start;
  const courtLabel =
    items.length <= 1
      ? `${first?.courtName || 'Sân'} – ${api.venueName || ''}`.replace(/ – $/, '').trim()
      : `${items.length} khung – ${api.venueName || ''}`.replace(/ – $/, '').trim();

  const dateStr = `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}/${start.getFullYear()}`;
  const timeStr = `${pad2(start.getHours())}:${pad2(start.getMinutes())} – ${pad2(end.getHours())}:${pad2(end.getMinutes())}`;

  return {
    id: api.id,
    code: api.bookingCode,
    rawStatus: api.status,
    isLongTerm: api.isLongTerm === true || !!api.seriesId,
    needsPaymentRetry: !!api.needsPaymentRetry,
    managerStatusNote: (api.managerStatusNote || '').trim(),
    court: courtLabel || api.venueName || 'Đặt sân',
    courtImg: '/assets/img/booking/booking-01.jpg',
    venueAddress: api.venueAddress || api.venueName || '',
    venueId: api.venueId,
    venueReviewId: api.venueReviewId ?? null,
    reviewWindowEndsAt: api.reviewWindowEndsAt,
    canReview: api.canReview === true,
    canEditReview: api.canEditReview === true,
    date: dateStr,
    time: timeStr,
    amount: Number(api.finalAmount ?? api.totalAmount ?? 0),
    paymentMethod: formatPaymentMethodLabel(api.lastPaymentMethod),
    status: mapUserBookingTabStatus(api.status, items),
    sortTime: new Date(api.createdAt).getTime(),
    filterDate: start,
    refundStatus: api.refundStatus || null,
    refundAmount: api.refundAmount ?? null,
    refundBankName: api.refundBankName || '',
    refundAccountNumber: api.refundAccountNumber || '',
    refundAccountHolder: api.refundAccountHolder || '',
    refundQrImageUrl: api.refundQrImageUrl || '',
  };
}

const TABS = [
  { key: 'PENDING',   label: 'Chờ duyệt',  color: 'warning' },
  { key: 'UPCOMING',  label: 'Sắp tới',    color: 'primary' },
  { key: 'COMPLETED', label: 'Hoàn thành', color: 'success' },
  { key: 'REFUND',    label: 'Hoàn tiền',  color: 'info'    },
  { key: 'CANCELLED', label: 'Đã huỷ',     color: 'danger'  },
];

/** Màu + trạng thái hover/active cho từng tab (ảnh 2) */
const BOOKING_TAB_STYLES = {
  PENDING: {
    active: 'ub-tab--active-amber',
    inactive: 'ub-tab--idle-amber',
    countActive: 'ub-tab-count--on',
    countIdle: 'ub-tab-count--amber',
  },
  UPCOMING: {
    active: 'ub-tab--active-sky',
    inactive: 'ub-tab--idle-sky',
    countActive: 'ub-tab-count--on',
    countIdle: 'ub-tab-count--sky',
  },
  COMPLETED: {
    active: 'ub-tab--active-emerald',
    inactive: 'ub-tab--idle-emerald',
    countActive: 'ub-tab-count--on',
    countIdle: 'ub-tab-count--emerald',
  },
  REFUND: {
    active: 'ub-tab--active-cyan',
    inactive: 'ub-tab--idle-cyan',
    countActive: 'ub-tab-count--on',
    countIdle: 'ub-tab-count--cyan',
  },
  CANCELLED: {
    active: 'ub-tab--active-rose',
    inactive: 'ub-tab--idle-rose',
    countActive: 'ub-tab-count--on',
    countIdle: 'ub-tab-count--rose',
  },
};

const REFUND_STATUS_LABEL = {
  PENDING_RECONCILIATION: { text: 'Chờ đối soát', color: 'warning' },
  PENDING_REFUND:         { text: 'Chờ hoàn tiền', color: 'info'    },
  COMPLETED:              { text: 'Đã hoàn tiền',  color: 'success' },
  REJECTED:               { text: 'Từ chối hoàn',  color: 'danger'  },
  REFUNDED:               { text: 'Đã hoàn tiền',  color: 'success' },
};

function StatusBadge({ b }) {
  if (b.status === 'REFUND') {
    const r = REFUND_STATUS_LABEL[b.rawStatus] || REFUND_STATUS_LABEL[b.refundStatus] || { text: 'Hoàn tiền', color: 'info' };
    return <span className={`badge bg-${r.color}${r.color === 'warning' ? ' text-dark' : ''}`}>{r.text}</span>;
  }
  const map = {
    PENDING:   <span className="badge bg-warning text-dark">Chờ duyệt</span>,
    UPCOMING:  <span className="badge bg-primary">Sắp tới</span>,
    COMPLETED: <span className="badge bg-success">Hoàn thành</span>,
    CANCELLED: <span className="badge bg-danger">Đã huỷ</span>,
  };
  return map[b.status] || null;
}

const BANKS = [
  'Vietcombank', 'BIDV', 'VietinBank', 'Techcombank', 'MB Bank',
  'ACB', 'Sacombank', 'VP Bank', 'TPBank', 'HD Bank',
  'SHB', 'OCB', 'SeABank', 'LPBank', 'Eximbank', 'Khác',
];

export default function UserBookings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab,     setActiveTab]     = useState('PENDING');
  const [timeFilter,    setTimeFilter]    = useState('all');
  const [sortBy,        setSortBy]        = useState('newest');
  const [detailBooking, setDetailBooking] = useState(null);
  const [cancelTarget,  setCancelTarget]  = useState(null);
  const [bookings,      setBookings]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [cancelPreview, setCancelPreview] = useState(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [bankForm, setBankForm] = useState({ refundBankName: '', refundAccountNumber: '', refundAccountHolder: '' });
  const [showBankForm, setShowBankForm] = useState(null);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [remindLoading, setRemindLoading] = useState(null); // bookingId | null
  const [remindCooldowns, setRemindCooldowns] = useState({}); // { bookingId: remainingMinutes }
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrUploadedUrl, setQrUploadedUrl] = useState(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyBookings();
      const list = Array.isArray(data) ? data : [];
      setBookings(list.map(mapApiRowToBooking));
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    const bid = searchParams.get('bookingId');
    if (!bid || loading || bookings.length === 0) return;
    const found = bookings.find(
      (b) => String(b.id).toLowerCase() === String(bid).toLowerCase(),
    );
    if (!found) {
      const next = new URLSearchParams(searchParams);
      next.delete('bookingId');
      setSearchParams(next, { replace: true });
      return;
    }
    setActiveTab(found.status);
    setDetailBooking(found);
    const next = new URLSearchParams(searchParams);
    next.delete('bookingId');
    setSearchParams(next, { replace: true });
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-booking-row="${found.id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [bookings, loading, searchParams, setSearchParams]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.hidden) return;
      loadBookings();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [loadBookings]);

  const filtered = bookings
    .filter(b => b.status === activeTab)
    .filter(b => matchesTimeFilter(b.filterDate, timeFilter))
    .sort((a, b) => {
      if (sortBy === 'newest') return b.sortTime - a.sortTime;
      if (sortBy === 'oldest') return a.sortTime - b.sortTime;
      if (sortBy === 'amount') return b.amount - a.amount;
      return 0;
    });

  const showToast = (msg, isError = false) => {
    setToastMsg({ msg, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const openCancelPreview = async (b) => {
    setCancelTarget(b);
    setCancelPreviewLoading(true);
    setPolicyAgreed(false);
    setQrFile(null); setQrPreview(null); setQrUploading(false); setQrUploadedUrl(null);
    try {
      const data = await getCancelPreview(b.id);
      setCancelPreview(data);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Không thể tải thông tin hủy.';
      showToast(msg, true);
      setCancelTarget(null);
    } finally {
      setCancelPreviewLoading(false);
    }
  };

  const handleQrFile = (file) => {
    if (!file) return;
    setQrFile(file);
    setQrUploadedUrl(null);
    const reader = new FileReader();
    reader.onload = (e) => setQrPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleQrUpload = async () => {
    if (!qrFile || qrUploadedUrl) return qrUploadedUrl;
    setQrUploading(true);
    try {
      const result = await uploadRefundQr(qrFile);
      const url = result?.url || result;
      setQrUploadedUrl(url);
      return url;
    } catch (e) {
      showToast(e?.response?.data?.message || 'Tải ảnh QR thất bại.', true);
      return null;
    } finally {
      setQrUploading(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelPreview) return;
    setCancelSubmitting(true);
    try {
      let qrUrl = qrUploadedUrl;
      if (qrFile && !qrUrl && cancelPreview.cancelBranch === 'PAID') {
        qrUrl = await handleQrUpload();
      }
      const body = cancelPreview.cancelBranch === 'PAID'
        ? { refundBankName: bankForm.refundBankName, refundAccountNumber: bankForm.refundAccountNumber, refundAccountHolder: bankForm.refundAccountHolder, refundQrImageUrl: qrUrl || undefined }
        : {};
      const result = await cancelBooking(cancelTarget.id, body);
      setCancelTarget(null);
      setCancelPreview(null);
      setDetailBooking(null);
      setQrFile(null); setQrPreview(null); setQrUploadedUrl(null);

      if (result.cancelBranch === 'PAID') {
        showToast(result.message || 'Đã hủy — yêu cầu hoàn tiền đã được gửi.');
        setActiveTab('REFUND');
      } else if (result.cancelBranch === 'PROOF_UPLOADED') {
        showToast(result.message || 'Đã hủy — chờ chủ sân đối soát.');
        setActiveTab('REFUND');
      } else {
        showToast(result.message || 'Đã huỷ lịch đặt sân thành công.');
        setActiveTab('CANCELLED');
      }
      await loadBookings();
    } catch (e) {
      const body = e?.response?.data;
      const message =
        (typeof body?.message === 'string' && body.message)
        || body?.title
        || 'Oops... Huỷ lịch thất bại rồi. Bạn thử lại nhé!';
      showToast(message, true);
    } finally {
      setCancelSubmitting(false);
    }
  };

  const submitBankInfo = async () => {
    if (!showBankForm) return;
    if (!bankForm.refundBankName || !bankForm.refundAccountNumber || !bankForm.refundAccountHolder) {
      showToast('Vui lòng điền đầy đủ thông tin ngân hàng.', true);
      return;
    }
    setBankSubmitting(true);
    try {
      await updateRefundBankInfo(showBankForm.id, bankForm);
      showToast('Đã cập nhật thông tin nhận hoàn tiền.');
      setShowBankForm(null);
      await loadBookings();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Cập nhật thất bại.', true);
    } finally {
      setBankSubmitting(false);
    }
  };

  const canUserCancel = (b) => b.status === 'PENDING' || b.status === 'UPCOMING';

  const handleRemindOwner = async (bookingId) => {
    setRemindLoading(bookingId);
    try {
      const result = await remindOwner(bookingId);
      showToast(result?.message || 'Đã gửi nhắc nhở đến chủ sân!');
      // Start cooldown display (60 min default)
      setRemindCooldowns(prev => ({ ...prev, [bookingId]: 60 }));
      // Tick down every minute
      const iv = setInterval(() => {
        setRemindCooldowns(prev => {
          const mins = (prev[bookingId] || 0) - 1;
          if (mins <= 0) {
            clearInterval(iv);
            const next = { ...prev };
            delete next[bookingId];
            return next;
          }
          return { ...prev, [bookingId]: mins };
        });
      }, 60_000);
    } catch (e) {
      const body = e?.response?.data;
      if (e?.response?.status === 429 && body?.remainingMinutes) {
        setRemindCooldowns(prev => ({ ...prev, [bookingId]: body.remainingMinutes }));
        showToast(body.message || `Vui lòng chờ ${body.remainingMinutes} phút.`, true);
      } else {
        showToast(body?.message || 'Gửi nhắc nhở thất bại.', true);
      }
    } finally {
      setRemindLoading(null);
    }
  };

  return (
    <div className="user-bookings-page">
      <ReportModal
        open={!!disputeTarget}
        onClose={() => setDisputeTarget(null)}
        targetType="BOOKING"
        targetId={disputeTarget?.id}
        title="Khiếu nại / tranh chấp giao dịch"
        requireImage
      />
      {toastMsg && (
        <div
          className={`alert ${toastMsg.isError ? 'alert-danger' : 'alert-success'} shadow-sm`}
          style={{ position: 'fixed', top: 88, right: 16, zIndex: 9999, minWidth: 260, margin: 0 }}
          role="alert"
        >
          {toastMsg.msg}
        </div>
      )}

      <div className="user-bookings-panel bg-white shadow-sm border border-slate-200/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="user-bookings-title font-bold text-slate-900 mb-1 flex items-center">
              <i className="fa-solid fa-calendar-check text-emerald-600"></i>
              Đặt sân của tôi
            </h2>
            <p className="user-bookings-sub text-slate-500 m-0">Quản lý các lịch đặt sân và trạng thái thanh toán của bạn.</p>
          </div>
        </div>
      </div>

      <div className="user-bookings-panel bg-white shadow-sm border border-slate-200/60">
        <div className="sortby-section border-0 p-0 m-0">
          <div className="sorting-info">
            <div className="user-bookings-filter-bar">
              <div className="user-bookings-tabs" role="tablist" aria-label="Lọc theo trạng thái đặt sân">
                {TABS.map((t) => {
                  const st = BOOKING_TAB_STYLES[t.key];
                  const on = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTab(t.key);
                      }}
                      className={`user-bookings-tab ${on ? st.active : st.inactive}`}
                    >
                      <span className="ub-tab-label">{t.label}</span>
                      <span className={`user-bookings-tab-count ${on ? st.countActive : st.countIdle}`}>
                        {bookings.filter(b => b.status === t.key).length}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="user-bookings-filters">
                <div className="relative">
                  <select
                    className="user-bookings-select user-bookings-select--pill appearance-none text-slate-700 font-bold outline-none cursor-pointer transition-all"
                    value={timeFilter}
                    onChange={e => setTimeFilter(e.target.value)}
                  >
                    <option value="week">Tuần này</option>
                    <option value="month">Tháng này</option>
                    <option value="all">Tất cả thời gian</option>
                  </select>
                  <i className="fa-solid fa-chevron-down user-bookings-select-chevron" aria-hidden />
                </div>
                <div className="relative">
                  <select
                    className="user-bookings-select user-bookings-select--pill appearance-none text-slate-700 font-bold outline-none cursor-pointer transition-all"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="amount">Theo giá</option>
                  </select>
                  <i className="fa-solid fa-chevron-down user-bookings-select-chevron" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

          {/* ── Table ───────────────────────────────────────────────────── */}
          <div className="row">
            <div className="col-sm-12">
              <div className="court-tab-content">
                <div className="card card-tableset">
                  <div className="card-body">
                    <div className="coache-head-blk">
                      <div className="row align-items-center">
                        <div className="col-md-6">
                          <div className="court-table-head">
                            <h4>Lịch sử đặt sân của tôi</h4>
                            <p>Xem và quản lý các lịch đặt sân của bạn</p>
                          </div>
                        </div>
                        <div className="user-bookings-toolbar col-md-6 text-end d-flex gap-2 sm:gap-3 justify-content-start flex-wrap mt-3 mt-md-0 justify-content-md-end">
                          <button
                            type="button"
                            className="user-bookings-toolbar-btn user-bookings-toolbar-btn--ghost"
                            disabled={loading}
                            onClick={() => loadBookings()}
                          >
                            <i className={`feather-refresh-cw user-bookings-toolbar-ico ${loading ? 'fa-spin' : ''}`} />
                            {loading ? 'Đang tải…' : 'Làm mới'}
                          </button>
                          <Link to="/venues" className="user-bookings-toolbar-btn user-bookings-toolbar-btn--primary">
                            <i className="feather-plus user-bookings-toolbar-ico" />Đặt sân mới
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="user-bookings-table table table-borderless datatable">
                        <thead className="thead-light">
                          <tr>
                            <th>Sân</th>
                            <th>Mã đặt</th>
                            <th>Lịch</th>
                            <th>Thanh toán</th>
                            <th>Trạng thái</th>
                            <th>Đánh giá</th>
                            <th className="text-nowrap">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading && (
                            <tr>
                              <td colSpan={7} className="text-center text-muted py-5">
                                <div className="spinner-border spinner-border-sm text-secondary mb-2" role="status" />
                                <div>Đang tải lịch đặt sân…</div>
                              </td>
                            </tr>
                          )}
                          {!loading && filtered.length === 0 && (
                            <tr>
                              <td colSpan={7} className="text-center text-muted py-5">
                                <i className="feather-calendar" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.4 }} />
                                Không có lịch đặt sân nào
                              </td>
                            </tr>
                          )}
                          {!loading && filtered.map(b => (
                            <tr key={b.id} data-booking-row={b.id}>
                              {/* Court */}
                              <td>
                                <h2 className="table-avatar">
                                  <span className="avatar avatar-sm flex-shrink-0">
                                    <img className="avatar-img" src={b.courtImg} alt=""
                                      onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }} />
                                  </span>
                                  <span className="table-head-name flex-grow-1 ms-2">
                                    <span>
                                      {b.court}
                                      {b.isLongTerm && (
                                        <span className="badge bg-info text-dark ms-1">Lịch dài hạn</span>
                                      )}
                                    </span>
                                    <small className="d-block text-muted">
                                      <i className="feather-map-pin me-1" />{b.venueAddress}
                                    </small>
                                  </span>
                                </h2>
                              </td>
                              {/* Code */}
                              <td>
                                <span
                                  className="badge"
                                  style={{ background: '#f0fdf4', color: 'var(--primary-color)', border: '1px solid #6ee7b7', fontFamily: 'monospace, ui-monospace, monospace' }}
                                >
                                  #{b.code}
                                </span>
                              </td>
                              {/* Schedule (merged Date + Time) */}
                              <td>
                                <div>{b.date}</div>
                                <small className="text-muted">{b.time}</small>
                              </td>
                              {/* Payment (merged Amount + Method) */}
                              <td>
                                <strong>{b.amount.toLocaleString('vi-VN')} ₫</strong>
                                <div className="text-muted small" style={{ marginTop: 2 }}>
                                  <i className={`${b.paymentMethod === 'Quét mã QR' ? 'feather-smartphone' : 'feather-credit-card'} me-1`} />
                                  {b.paymentMethod}
                                </div>
                              </td>
                              <td><StatusBadge b={b} /></td>
                              <td>
                                {b.venueId && (b.canReview || b.canEditReview) ? (
                                  <Link
                                    className="user-booking-action"
                                    data-variant="review"
                                    to={`/venue-details/${b.venueId}?openReview=1&bookingId=${b.id}`}
                                    title={b.canEditReview ? 'Sửa đánh giá' : 'Viết đánh giá'}
                                  >
                                    <i className="feather-star" aria-hidden />
                                    {b.canEditReview ? 'Sửa ĐG' : 'Đánh giá'}
                                  </Link>
                                ) : b.venueId && b.venueReviewId ? (
                                  <Link
                                    className="btn btn-sm btn-link text-muted p-0 small"
                                    to={`/venue-details/${b.venueId}#reviews`}
                                  >
                                    Đã gửi
                                  </Link>
                                ) : (
                                  <span className="text-muted small">—</span>
                                )}
                              </td>
                              <td className="align-middle">
                                <div className="user-booking-actions d-flex flex-wrap align-items-center">
                                  <button
                                    type="button"
                                    className="user-booking-action"
                                    data-variant="view"
                                    onClick={() => setDetailBooking(b)}
                                  >
                                    <i className="feather-eye" aria-hidden />Xem
                                  </button>
                                  {canUserCancel(b) && (
                                    <button
                                      type="button"
                                      className="user-booking-action"
                                      data-variant="cancel"
                                      onClick={() => openCancelPreview(b)}
                                    >
                                      <i className="feather-x-circle" aria-hidden />Huỷ sân
                                    </button>
                                  )}
                                  {b.needsPaymentRetry && b.status === 'PENDING' && (
                                    <button
                                      type="button"
                                      className="user-booking-action"
                                      data-variant="pay"
                                      onClick={() => navigate(`/booking/payment?bookingId=${b.id}`)}
                                    >
                                      <i className="feather-credit-card" aria-hidden />Thanh toán lại
                                    </button>
                                  )}
                                  {b.status === 'PENDING' && (
                                    <button
                                      type="button"
                                      className="user-booking-action"
                                      data-variant="view"
                                      disabled={remindLoading === b.id || !!remindCooldowns[b.id]}
                                      onClick={() => handleRemindOwner(b.id)}
                                      title={remindCooldowns[b.id] ? `Chờ ${remindCooldowns[b.id]} phút nữa` : 'Nhắc chủ sân duyệt đơn'}
                                      style={remindCooldowns[b.id] ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                    >
                                      {remindLoading === b.id
                                        ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Đang gửi…</>
                                        : <><i className="feather-bell" aria-hidden />{remindCooldowns[b.id] ? `Chờ ${remindCooldowns[b.id]}p` : 'Nhắc duyệt'}</>
                                      }
                                    </button>
                                  )}
                                  {b.status !== 'CANCELLED' && (
                                    <button
                                      type="button"
                                      className="user-booking-action"
                                      data-variant="view"
                                      onClick={() => setDisputeTarget(b)}
                                      title="Khiếu nại / tranh chấp giao dịch"
                                    >
                                      <i className="feather-flag" aria-hidden />Khiếu nại
                                    </button>
                                  )}
                                  {b.status === 'REFUND' && !b.refundAccountNumber && (
                                    <button
                                      type="button"
                                      className="user-booking-action"
                                      data-variant="refund"
                                      onClick={() => {
                                        setBankForm({ refundBankName: '', refundAccountNumber: '', refundAccountHolder: '' });
                                        setShowBankForm(b);
                                      }}
                                    >
                                      <i className="feather-credit-card" aria-hidden />STK hoàn tiền
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

      {/* ── Detail Modal ───────────────────────────────────────────────── */}
      {detailBooking && (
        <div
          className="modal fade show d-block"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDetailBooking(null)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Chi tiết đặt sân</h5>
                <button type="button" className="btn-close" onClick={() => setDetailBooking(null)} />
              </div>
              <div className="modal-body">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <img
                    src={detailBooking.courtImg}
                    alt=""
                    style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }}
                    onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }}
                  />
                  <div>
                    <h6 className="mb-1">{detailBooking.court}</h6>
                    <small className="text-muted">
                      <i className="feather-map-pin me-1" />{detailBooking.venueAddress}
                    </small>
                  </div>
                </div>
                <hr />
                <div className="row g-3">
                  <div className="col-6">
                    <small className="text-muted d-block">Mã đặt sân</small>
                    <strong style={{ fontFamily: 'monospace' }}>#{detailBooking.code}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Trạng thái</small>
                    <StatusBadge b={detailBooking} />
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Ngày</small>
                    <strong>{detailBooking.date}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Khung giờ</small>
                    <strong>{detailBooking.time}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Tổng tiền</small>
                    <strong className="text-success">{detailBooking.amount.toLocaleString('vi-VN')} ₫</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Phương thức</small>
                    <strong>{detailBooking.paymentMethod}</strong>
                  </div>
                  {detailBooking.status === 'CANCELLED' && detailBooking.managerStatusNote && (
                    <div className="col-12">
                      <div
                        className="mt-2 p-3 rounded"
                        style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}
                      >
                        <small className="text-danger d-block fw-semibold mb-1">
                          <i className="feather-alert-circle me-1" />
                          Ghi chú từ sân
                        </small>
                        <p className="mb-0 small text-danger">{detailBooking.managerStatusNote}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                {detailBooking && canUserCancel(detailBooking) && (
                  <button
                    type="button"
                    className="btn btn-outline-danger me-auto"
                    onClick={() => { setDetailBooking(null); openCancelPreview(detailBooking); }}
                  >
                    <i className="feather-x-circle me-1" />Huỷ sân
                  </button>
                )}
                {detailBooking.status === 'REFUND' && (
                  <div className="me-auto">
                    {detailBooking.refundAmount != null && (
                      <span className="badge bg-info me-2">Hoàn: {Number(detailBooking.refundAmount).toLocaleString('vi-VN')} ₫</span>
                    )}
                    {!detailBooking.refundAccountNumber && (
                      <button type="button" className="btn btn-outline-info btn-sm"
                        onClick={() => { setDetailBooking(null); setBankForm({ refundBankName: '', refundAccountNumber: '', refundAccountHolder: '' }); setShowBankForm(detailBooking); }}>
                        <i className="feather-credit-card me-1" />Nhập STK nhận hoàn
                      </button>
                    )}
                  </div>
                )}
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDetailBooking(null)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Preview Modal ────────────────────────────────────────── */}
      {cancelTarget && (
        <div
          className="modal fade show d-block"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setCancelTarget(null); setCancelPreview(null); setPolicyAgreed(false); }}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fca5a5' }}>
                <h5 className="modal-title text-danger"><i className="feather-alert-triangle me-2" />Xác nhận huỷ đặt sân</h5>
                <button type="button" className="btn-close" onClick={() => { setCancelTarget(null); setCancelPreview(null); setPolicyAgreed(false); }} />
              </div>
              <div className="modal-body">
                {cancelPreviewLoading && (
                  <div className="text-center py-4">
                    <div className="spinner-border text-secondary" role="status" />
                    <div className="text-muted mt-2">Đang tải chính sách…</div>
                  </div>
                )}
                {!cancelPreviewLoading && cancelPreview && (
                  <>
                    <div className="mb-3">
                      <strong>{cancelTarget.court}</strong>
                      <div className="text-muted small">{cancelTarget.date} — {cancelTarget.time}</div>
                      {cancelTarget.isLongTerm && (
                        <div className="text-danger small fw-semibold mt-1">
                          <i className="feather-alert-circle me-1" />Lịch dài hạn: huỷ áp dụng cho toàn bộ chuỗi.
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded mb-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <div className="fw-semibold mb-1" style={{ color: '#1e40af' }}>
                        <i className="feather-shield me-1" />Chính sách sân (áp dụng lúc đặt)
                      </div>
                      <div className="small" style={{ color: '#1e40af' }}>
                        {cancelPreview.refund?.policyDescription}
                      </div>
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-4 text-center">
                        <small className="text-muted d-block">
                          {cancelPreview.cancelBranch === 'PROOF_UPLOADED' ? 'Chờ đối soát (CK)' : 'Đã thanh toán'}
                        </small>
                        <strong>
                          {Number(
                            cancelPreview.cancelBranch === 'PROOF_UPLOADED'
                              ? (cancelPreview.payment?.pendingPaymentAmount ?? 0)
                              : (cancelPreview.payment?.paidAmount || 0)
                          ).toLocaleString('vi-VN')} ₫
                        </strong>
                      </div>
                      <div className="col-4 text-center">
                        <small className="text-muted d-block">Phí phạt</small>
                        <strong className="text-danger">{Number(cancelPreview.refund?.penaltyAmount || 0).toLocaleString('vi-VN')} ₫</strong>
                      </div>
                      <div className="col-4 text-center">
                        <small className="text-muted d-block">Được hoàn</small>
                        <strong className="text-success">{Number(cancelPreview.refund?.refundAmount || 0).toLocaleString('vi-VN')} ₫</strong>
                      </div>
                    </div>

                    {cancelPreview.refund?.refundEstimateNote && (
                      <div className="small text-muted mb-2">
                        <i className="feather-info me-1" />{cancelPreview.refund.refundEstimateNote}
                      </div>
                    )}

                    {cancelPreview.cancelBranch === 'PROOF_UPLOADED' && (
                      <div className="alert alert-warning small mb-3">
                        <i className="feather-clock me-1" />Bạn đã gửi chứng từ chuyển khoản nhưng chủ sân chưa xác nhận. Sau khi hủy, chủ sân sẽ đối soát để xử lý hoàn tiền.
                      </div>
                    )}

                    {cancelPreview.cancelBranch === 'PAID' && (
                      <>
                        {/* ── QR Upload Zone ────────────────────────── */}
                        <div className="card border-0 shadow-sm mb-3">
                          <div className="card-body">
                            <h6 className="mb-3"><i className="feather-smartphone me-2" />📱 Ảnh mã QR nhận tiền <span className="text-muted fw-normal" style={{ fontSize: 12 }}>(để chủ sân quét — tùy chọn)</span></h6>
                            {!qrPreview ? (
                              <div className="ub-qr-upload-zone"
                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ub-qr-upload-zone--active'); }}
                                onDragLeave={e => e.currentTarget.classList.remove('ub-qr-upload-zone--active')}
                                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('ub-qr-upload-zone--active'); handleQrFile(e.dataTransfer.files?.[0]); }}>
                                <i className="feather-upload-cloud ub-qr-upload-zone__icon" />
                                <div className="ub-qr-upload-zone__label">Kéo thả hoặc nhấn để chọn ảnh QR</div>
                                <div className="ub-qr-upload-zone__hint">Hỗ trợ JPG, PNG, WEBP — tối đa 10MB</div>
                                <input type="file" accept="image/*" onChange={e => handleQrFile(e.target.files?.[0])} />
                              </div>
                            ) : (
                              <div className="text-center">
                                <div className="ub-qr-preview">
                                  <img src={qrPreview} alt="QR preview" className="ub-qr-preview__img" />
                                  <button type="button" className="ub-qr-preview__remove" title="Xóa ảnh"
                                    onClick={() => { setQrFile(null); setQrPreview(null); setQrUploadedUrl(null); }}>
                                    <i className="feather-x" />
                                  </button>
                                </div>
                                {qrUploading && <div className="small text-info mt-2"><span className="spinner-border spinner-border-sm me-1" />Đang tải lên…</div>}
                                {qrUploadedUrl && <div className="small text-success mt-2"><i className="feather-check-circle me-1" />Đã tải lên thành công</div>}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ── Bank Info Form ────────────────────────── */}
                        <div className="card border-0 shadow-sm mb-3">
                          <div className="card-body">
                            <h6 className="mb-3"><i className="feather-credit-card me-2" />Thông tin nhận hoàn tiền</h6>
                            <div className="mb-2">
                              <label className="form-label small fw-semibold">Ngân hàng <span className="text-danger">*</span></label>
                              <select className="form-select form-select-sm" value={bankForm.refundBankName}
                                onChange={e => setBankForm(p => ({ ...p, refundBankName: e.target.value }))}>
                                <option value="">-- Chọn --</option>
                                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                            <div className="mb-2">
                              <label className="form-label small fw-semibold">Số tài khoản <span className="text-danger">*</span></label>
                              <input type="text" className="form-control form-control-sm" placeholder="0123456789"
                                value={bankForm.refundAccountNumber}
                                onChange={e => setBankForm(p => ({ ...p, refundAccountNumber: e.target.value }))} />
                            </div>
                            <div>
                              <label className="form-label small fw-semibold">Chủ tài khoản <span className="text-danger">*</span></label>
                              <input type="text" className="form-control form-control-sm text-uppercase" placeholder="NGUYEN VAN A"
                                value={bankForm.refundAccountHolder}
                                onChange={e => setBankForm(p => ({ ...p, refundAccountHolder: e.target.value.toUpperCase() }))} />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {!cancelPreview.canCancel && (
                      <div className="alert alert-danger small mb-3">
                        <i className="feather-x-circle me-1" />{cancelPreview.disableReason}
                      </div>
                    )}

                    {cancelPreview.canCancel && (
                      <div className="form-check mb-0">
                        <input className="form-check-input" type="checkbox" id="policyAgree"
                          checked={policyAgreed} onChange={e => setPolicyAgreed(e.target.checked)} />
                        <label className="form-check-label small" htmlFor="policyAgree">
                          Tôi đã đọc và đồng ý với chính sách huỷ sân
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary"
                  onClick={() => { setCancelTarget(null); setCancelPreview(null); setPolicyAgreed(false); }}>
                  Giữ lại
                </button>
                {cancelPreview?.canCancel && (
                  <button type="button" className="btn btn-danger"
                    disabled={cancelSubmitting || !policyAgreed || (cancelPreview.cancelBranch === 'PAID' && (!bankForm.refundBankName || !bankForm.refundAccountNumber || !bankForm.refundAccountHolder))}
                    onClick={confirmCancel}>
                    {cancelSubmitting ? 'Đang xử lý…' : 'Xác nhận huỷ'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bank Info Modal (for existing refund requests) ────────────── */}
      {showBankForm && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowBankForm(null)}>
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="feather-credit-card me-2" />Thông tin nhận hoàn tiền</h5>
                <button type="button" className="btn-close" onClick={() => setShowBankForm(null)} />
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-3">Nhập thông tin tài khoản để chủ sân chuyển khoản hoàn tiền cho bạn.</p>
                <div className="mb-2">
                  <label className="form-label small fw-semibold">Ngân hàng</label>
                  <select className="form-select form-select-sm" value={bankForm.refundBankName}
                    onChange={e => setBankForm(p => ({ ...p, refundBankName: e.target.value }))}>
                    <option value="">-- Chọn --</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-semibold">Số tài khoản</label>
                  <input type="text" className="form-control form-control-sm" value={bankForm.refundAccountNumber}
                    onChange={e => setBankForm(p => ({ ...p, refundAccountNumber: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label small fw-semibold">Chủ tài khoản</label>
                  <input type="text" className="form-control form-control-sm text-uppercase" value={bankForm.refundAccountHolder}
                    onChange={e => setBankForm(p => ({ ...p, refundAccountHolder: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowBankForm(null)}>Hủy</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={bankSubmitting} onClick={submitBankInfo}>
                  {bankSubmitting ? 'Đang gửi…' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
