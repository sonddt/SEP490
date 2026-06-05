import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getMyBookings, cancelBooking, getCancelPreview, updateRefundBankInfo, remindOwner, uploadRefundQr } from '../../api/bookingApi';
import ReportModal from '../../components/common/ReportModal';
import LongTermScheduleDisplay from '../../components/common/LongTermScheduleDisplay';
import { BankPicker } from '../../components/common/BankPicker';
import { fetchVietqrBanks } from '../../components/manager/CheckoutSettingsShared';

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
  if (apiStatus === 'COMPLETED') return 'COMPLETED';
  if (apiStatus === 'CONFIRMED') {
    // Client-side fallback: nếu BG service chưa chuyển sang COMPLETED
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
    courtImg: api.venueImageUrl || '/assets/img/booking/booking-01.jpg',
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
    refundManagerEvidenceUrl: api.refundManagerEvidenceUrl || '',
    refundRejectionReason: api.refundRejectionReason || '',
    paymentProofUrl: api.paymentProofUrl || null,
    items: api.items || [],
  };
}

const TABS = [
  { key: 'ALL', label: 'Tất cả', color: 'secondary' },
  { key: 'PENDING', label: 'Chờ duyệt', color: 'warning' },
  { key: 'UPCOMING', label: 'Sắp tới', color: 'primary' },
  { key: 'COMPLETED', label: 'Hoàn thành', color: 'success' },
  { key: 'REFUND', label: 'Hoàn tiền', color: 'info' },
  { key: 'CANCELLED', label: 'Đã huỷ', color: 'danger' },
];

/** Màu + trạng thái hover/active cho từng tab (ảnh 2) */
const BOOKING_TAB_STYLES = {
  ALL: {
    active: 'ub-tab--active-slate',
    inactive: 'ub-tab--idle-slate',
    countActive: 'ub-tab-count--on',
    countIdle: 'ub-tab-count--slate',
  },
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
  PENDING_REFUND: { text: 'Chờ hoàn tiền', color: 'info' },
  REFUNDED: { text: 'Đã hoàn tiền', color: 'success' },
};

function StatusBadge({ b }) {
  if (b.status === 'REFUND') {
    const r = REFUND_STATUS_LABEL[b.rawStatus] || REFUND_STATUS_LABEL[b.refundStatus] || { text: 'Hoàn tiền', color: 'info' };
    return <span className={`badge bg-${r.color}${r.color === 'warning' ? ' text-dark' : ''}`}>{r.text}</span>;
  }
  const map = {
    PENDING: <span className="badge bg-warning text-dark">Chờ duyệt</span>,
    UPCOMING: <span className="badge bg-primary">Sắp tới</span>,
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
  const [activeTab, setActiveTab] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [detailBooking, setDetailBooking] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [previewImage, setPreviewImage] = useState(null);

  const [vietqrBanks, setVietqrBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBanksLoading(true);
      const banks = await fetchVietqrBanks();
      if (!cancelled) { setVietqrBanks(banks); setBanksLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

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
    .filter(b => activeTab === 'ALL' || b.status === activeTab)
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
      if (qrFile && !qrUrl && (cancelPreview.cancelBranch === 'PAID' || cancelPreview.cancelBranch === 'PROOF_UPLOADED')) {
        qrUrl = await handleQrUpload();
      }
      const needsBankInfo = cancelPreview.cancelBranch === 'PAID' || cancelPreview.cancelBranch === 'PROOF_UPLOADED';
      const body = needsBankInfo
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
                        {t.key === 'ALL' ? bookings.length : bookings.filter(b => b.status === t.key).length}
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
                        <th>Mã đặt</th>
                        <th>Chi tiết sân</th>
                        <th>Lịch chơi</th>
                        <th>Thanh toán</th>
                        <th>Trạng thái</th>
                        <th>Đánh giá</th>
                        <th>Thao tác</th>
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
                          {/* Code */}
                          <td>
                            <span
                              className="badge"
                              title={`Mã đặt: #${b.code}`}
                              style={{
                                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                                color: '#065f46',
                                border: '1px solid #6ee7b7',
                                fontFamily: 'monospace, ui-monospace, monospace',
                                fontSize: 13,
                                fontWeight: 700,
                                padding: '6px 10px',
                                borderRadius: 8,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              #{b.code}
                            </span>
                          </td>
                          {/* Court & Venue */}
                          <td>
                            <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
                              <div className="flex-shrink-0" style={{ width: 56, height: 56 }}>
                                <img className="rounded shadow-sm" src={b.courtImg} alt="Venue" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }} />
                              </div>
                              <div className="flex-grow-1" style={{ minWidth: 0, overflow: 'hidden' }}>
                                <strong
                                  title={b.court}
                                  style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.3, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >{b.court}</strong>
                                {b.isLongTerm ? (
                                  <span className="badge" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, marginTop: 4, display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: '#fff' }}><i className="feather-calendar me-1" style={{ fontSize: 10 }} />Cố định</span>
                                ) : (
                                  <span className="badge" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, marginTop: 4, display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' }}><i className="feather-clock me-1" style={{ fontSize: 10 }} />Lịch đơn</span>
                                )}
                                <small
                                  className="d-block text-muted"
                                  title={b.venueAddress}
                                  style={{ fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                  <i className="feather-map-pin me-1" />{b.venueAddress}
                                </small>
                              </div>
                            </div>
                          </td>
                          {/* Schedule (merged Date + Time) */}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div title={`${b.date} ${b.time}`}>{b.date}</div>
                            <small className="text-muted">{b.time}</small>
                          </td>
                          {/* Payment (merged Amount + Method) */}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <strong style={{ color: '#059669' }}>{b.amount.toLocaleString('vi-VN')} ₫</strong>
                            <div className="text-muted small" title={b.paymentMethod} style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
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
                            <div className="d-flex align-items-center gap-1 flex-wrap">
                              <button
                                type="button"
                                title="Xem chi tiết"
                                className="btn btn-sm btn-outline-info d-inline-flex align-items-center justify-content-center shadow-none p-0"
                                style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1.5 }}
                                onClick={() => setDetailBooking(b)}
                              >
                                <i className="feather-eye m-0"></i>
                              </button>
                              {canUserCancel(b) && (
                                <button
                                  type="button"
                                  title="Huỷ sân"
                                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center shadow-none p-0"
                                  style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1.5 }}
                                  onClick={() => openCancelPreview(b)}
                                >
                                  <i className="feather-x-circle m-0"></i>
                                </button>
                              )}
                              {b.needsPaymentRetry && b.status === 'PENDING' && (
                                <button
                                  type="button"
                                  title="Thanh toán lại"
                                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center shadow-none p-0"
                                  style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1.5 }}
                                  onClick={() => navigate(`/booking/payment?bookingId=${b.id}`)}
                                >
                                  <i className="feather-credit-card m-0"></i>
                                </button>
                              )}
                              {b.status === 'PENDING' && (
                                <button
                                  type="button"
                                  title={remindCooldowns[b.id] ? `Chờ ${remindCooldowns[b.id]} phút nữa` : 'Nhắc chủ sân duyệt đơn'}
                                  className="btn btn-sm btn-outline-warning text-dark d-inline-flex align-items-center justify-content-center shadow-none p-0"
                                  style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1.5, ...(remindCooldowns[b.id] ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                                  disabled={remindLoading === b.id || !!remindCooldowns[b.id]}
                                  onClick={() => handleRemindOwner(b.id)}
                                >
                                  {remindLoading === b.id
                                    ? <span className="spinner-border spinner-border-sm m-0" role="status" />
                                    : (remindCooldowns[b.id] ? <span style={{ fontSize: 11, fontWeight: 'bold' }}>{remindCooldowns[b.id]}m</span> : <i className="feather-bell m-0"></i>)
                                  }
                                </button>
                              )}
                              {b.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  title="Khiếu nại / tranh chấp giao dịch"
                                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center shadow-none p-0"
                                  style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1.5 }}
                                  onClick={() => setDisputeTarget(b)}
                                >
                                  <i className="feather-flag m-0"></i>
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
        <div className="bk-modal-overlay" onClick={() => setDetailBooking(null)}>
          <div className="bk-modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bk-modal-header" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderBottom: '1px solid #d1fae5' }}>
              <div className="d-flex align-items-center gap-3">
                <div className="bk-modal-icon" style={{ background: '#dcfce7', border: '2px solid #86efac', color: '#16a34a' }}>
                  <i className="feather-file-text" />
                </div>
                <div>
                  <h5 className="bk-modal-title mb-0" style={{ color: '#166534' }}>Chi tiết đặt sân</h5>
                  <p className="bk-modal-sub mb-0">Mã đặt: <strong style={{ fontFamily: 'monospace' }}>#{detailBooking.code}</strong></p>
                </div>
              </div>
              <button type="button" className="bk-modal-close" onClick={() => setDetailBooking(null)}>
                <i className="feather-x" />
              </button>
            </div>

            {/* Body */}
            <div className="bk-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <div className="row g-4">
                {/* Left Column — Venue Info */}
                <div className="col-md-6">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <img
                      src={detailBooking.courtImg}
                      alt=""
                      style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '2px solid #e2e8f0' }}
                      onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h6 className="mb-1" style={{ fontSize: 15, color: '#1e293b' }}>{detailBooking.court}</h6>
                      <small className="text-muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={detailBooking.venueAddress}>
                        <i className="feather-map-pin me-1" />{detailBooking.venueAddress}
                      </small>
                    </div>
                  </div>

                  <div className="d-flex flex-column" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                    <div className="bk-detail-row d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted small">Mã đặt sân:</span>
                      <span className="badge" style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', fontFamily: 'monospace', fontSize: 13 }}>#{detailBooking.code}</span>
                    </div>
                    <div className="bk-detail-row d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted small">Trạng thái:</span>
                      <StatusBadge b={detailBooking} />
                    </div>
                    <div className="bk-detail-row d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted small">Tổng tiền:</span>
                      <strong style={{ color: '#097E52', fontSize: 16 }}>{detailBooking.amount.toLocaleString('vi-VN')} ₫</strong>
                    </div>
                    <div className="bk-detail-row d-flex justify-content-between align-items-center">
                      <span className="text-muted small">Thanh toán:</span>
                      <div className="text-end">
                        <strong style={{ fontSize: 13 }}>{detailBooking.paymentMethod}</strong>
                        {detailBooking.paymentProofUrl && (
                          <div className="mt-1">
                            <button
                              type="button"
                              className="btn btn-sm py-1 px-2 border-0 shadow-sm"
                              style={{ fontSize: 11, borderRadius: 6, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff' }}
                              onClick={() => setPreviewImage(detailBooking.paymentProofUrl)}
                            >
                              <i className="feather-image me-1" />Xem phiếu CK
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column — Schedule */}
                <div className="col-md-6">
                  {!detailBooking.isLongTerm ? (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, height: '100%' }}>
                      <h6 className="mb-3" style={{ color: '#1e293b', fontSize: 14 }}>
                        <i className="feather-calendar me-2" style={{ color: '#10b981' }} />Thông tin thời gian
                      </h6>
                      <div className="mb-3">
                        <small className="text-muted d-block mb-1">Ngày diễn ra</small>
                        <strong style={{ fontSize: 14, color: '#1e293b' }}>{detailBooking.date}</strong>
                      </div>
                      <div>
                        <small className="text-muted d-block mb-1">Khung giờ</small>
                        <strong style={{ fontSize: 14, color: '#1e293b' }}>{detailBooking.time}</strong>
                      </div>
                    </div>
                  ) : (
                    <LongTermScheduleDisplay items={detailBooking.items} />
                  )}
                </div>
              </div>

              {/* Manager rejection note */}
              {(detailBooking.status === 'CANCELLED' || detailBooking.status === 'REFUND') && detailBooking.managerStatusNote && (
                <div className="mt-3 p-3 rounded" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                  <small className="text-danger d-block fw-semibold mb-1">
                    <i className="feather-alert-circle me-1" />Ghi chú từ sân
                  </small>
                  <p className="mb-0 small text-danger">{detailBooking.managerStatusNote}</p>
                </div>
              )}

              {/* Refund Info Section */}
              {detailBooking.status === 'REFUND' && (
                <div className="mt-3">
                  <div className="p-3 rounded" style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid #bbf7d0', borderRadius: 12 }}>
                    <div className="d-flex align-items-center mb-3">
                      <i className="feather-refresh-cw me-2" style={{ color: '#16a34a', fontSize: 18 }} />
                      <h6 className="mb-0 fw-bold" style={{ color: '#166534', fontSize: 15 }}>Thông tin hoàn tiền</h6>
                    </div>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="mb-2 d-flex justify-content-between align-items-center">
                          <span className="text-muted small">Trạng thái:</span>
                          <span className={`badge ${
                            detailBooking.refundStatus === 'PENDING_RECONCILIATION' ? 'bg-warning text-dark' :
                            detailBooking.refundStatus === 'PENDING_REFUND' ? 'bg-info' :
                            detailBooking.refundStatus === 'COMPLETED' ? 'bg-success' :
                            detailBooking.refundStatus === 'REJECTED' ? 'bg-danger' : 'bg-secondary'
                          }`}>
                            {detailBooking.refundStatus === 'PENDING_RECONCILIATION' ? 'Chờ đối soát' :
                             detailBooking.refundStatus === 'PENDING_REFUND' ? 'Chờ hoàn tiền' :
                             detailBooking.refundStatus === 'COMPLETED' ? 'Đã hoàn tiền' :
                             detailBooking.refundStatus === 'REJECTED' ? 'Từ chối' : detailBooking.refundStatus}
                          </span>
                        </div>
                        <div className="mb-2 d-flex justify-content-between align-items-center">
                          <span className="text-muted small">
                            {detailBooking.refundStatus === 'COMPLETED' ? 'Số tiền đã hoàn:' : 'Số tiền cần hoàn:'}
                          </span>
                          <strong style={{ color: '#097E52', fontSize: 17 }}>
                            {detailBooking.refundAmount != null ? `${Number(detailBooking.refundAmount).toLocaleString('vi-VN')} ₫` : '—'}
                          </strong>
                        </div>

                        {(detailBooking.refundBankName || detailBooking.refundAccountNumber) && (
                          <div className="mt-2 p-3 rounded" style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10 }}>
                            <strong className="d-block text-success small mb-1">
                              <i className="feather-credit-card me-1" />Tài khoản nhận:
                            </strong>
                            <div className="small text-dark">
                              <strong>{detailBooking.refundBankName}</strong><br />
                              STK: <strong>{detailBooking.refundAccountNumber}</strong><br />
                              Chủ TK: <strong>{detailBooking.refundAccountHolder}</strong>
                            </div>
                          </div>
                        )}
                        {!detailBooking.refundAccountNumber && (
                          <div className="mt-3 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                            <strong className="d-block text-dark small mb-2">
                              <i className="feather-credit-card me-1" />Nhập STK nhận hoàn tiền:
                            </strong>
                            <div className="mb-2">
                              <BankPicker
                                banks={vietqrBanks}
                                value={bankForm.refundBankName}
                                onSelect={(shortName) => setBankForm(p => ({ ...p, refundBankName: shortName }))}
                                loading={banksLoading}
                              />
                            </div>
                            <div className="mb-2">
                              <input type="text" className="form-control" placeholder="Số tài khoản" value={bankForm.refundAccountNumber}
                                onChange={e => setBankForm(p => ({ ...p, refundAccountNumber: e.target.value }))}
                                style={{ borderRadius: 8, fontSize: 13, padding: '6px 12px' }}
                              />
                            </div>
                            <div className="mb-2">
                              <input type="text" className="form-control text-uppercase" placeholder="Chủ tài khoản (VD: NGUYEN VAN A)" value={bankForm.refundAccountHolder}
                                onChange={e => setBankForm(p => ({ ...p, refundAccountHolder: e.target.value.toUpperCase() }))}
                                style={{ borderRadius: 8, fontSize: 13, padding: '6px 12px' }}
                              />
                            </div>
                            <button type="button" className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2 mt-2"
                              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 600 }}
                              disabled={bankSubmitting}
                              onClick={async () => {
                                if (!bankForm.refundBankName || !bankForm.refundAccountNumber || !bankForm.refundAccountHolder) {
                                  showToast('Vui lòng điền đầy đủ thông tin ngân hàng.', true);
                                  return;
                                }
                                setBankSubmitting(true);
                                try {
                                  let qrUrl = qrUploadedUrl;
                                  if (qrFile && !qrUrl) {
                                    qrUrl = await handleQrUpload();
                                  }
                                  const body = { ...bankForm, refundQrImageUrl: qrUrl || undefined };
                                  await updateRefundBankInfo(detailBooking.id, body);
                                  showToast('Đã lưu thông tin nhận hoàn tiền.');
                                  setDetailBooking(p => ({ ...p, refundBankName: bankForm.refundBankName, refundAccountNumber: bankForm.refundAccountNumber, refundAccountHolder: bankForm.refundAccountHolder, refundQrImageUrl: qrUrl }));
                                  setQrFile(null); setQrPreview(null); setQrUploadedUrl(null);
                                  await loadBookings();
                                } catch (e) {
                                  showToast(e?.response?.data?.message || 'Cập nhật thất bại.', true);
                                } finally {
                                  setBankSubmitting(false);
                                }
                              }}>
                              {bankSubmitting ? <><span className="spinner-border spinner-border-sm" />Đang lưu...</> : <><i className="feather-save" />Lưu STK</>}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="col-md-6">
                        {detailBooking.refundManagerEvidenceUrl ? (
                          <div>
                            <span className="text-muted small d-block mb-2">Ảnh bill hoàn (chủ sân tải lên):</span>
                            <div
                              style={{
                                position: 'relative', cursor: 'pointer', borderRadius: 10,
                                overflow: 'hidden', border: '2px solid #16a34a', background: '#fff'
                              }}
                              onClick={() => setPreviewImage(detailBooking.refundManagerEvidenceUrl)}
                            >
                              <img
                                src={detailBooking.refundManagerEvidenceUrl}
                                alt="Refund Evidence"
                                style={{ width: '100%', maxHeight: 150, objectFit: 'contain', display: 'block', padding: 4 }}
                              />
                              <div
                                style={{
                                  position: 'absolute', inset: 0,
                                  background: 'linear-gradient(transparent 50%, rgba(0,0,0,.5))',
                                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                                  padding: 8,
                                }}
                              >
                                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}><i className="feather-maximize-2 me-1" />Nhấn để phóng to</span>
                              </div>
                            </div>
                          </div>
                        ) : !detailBooking.refundAccountNumber ? (
                          <div className="h-100 mt-3 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                            <strong className="d-block text-dark small mb-2">
                              <i className="feather-upload-cloud me-1" />Ảnh mã QR nhận tiền <span className="text-muted fw-normal">(tùy chọn)</span>:
                            </strong>
                            {!qrPreview ? (
                              <div className="ub-qr-upload-zone" style={{ padding: '16px 12px' }}
                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ub-qr-upload-zone--active'); }}
                                onDragLeave={e => e.currentTarget.classList.remove('ub-qr-upload-zone--active')}
                                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('ub-qr-upload-zone--active'); handleQrFile(e.dataTransfer.files?.[0]); }}>
                                <i className="feather-upload-cloud ub-qr-upload-zone__icon" style={{ fontSize: 24 }} />
                                <div className="ub-qr-upload-zone__label" style={{ fontSize: 12 }}>Kéo thả hoặc nhấn để chọn ảnh QR</div>
                                <div className="ub-qr-upload-zone__hint" style={{ fontSize: 11 }}>Hỗ trợ JPG, PNG, WEBP — tối đa 10MB</div>
                                <input type="file" accept="image/*" onChange={e => handleQrFile(e.target.files?.[0])} />
                              </div>
                            ) : (
                              <div className="text-center">
                                <div className="ub-qr-preview">
                                  <img src={qrPreview} alt="QR preview" className="ub-qr-preview__img" style={{ maxHeight: 150 }} />
                                  <button type="button" className="ub-qr-preview__remove" title="Xóa ảnh"
                                    onClick={() => { setQrFile(null); setQrPreview(null); setQrUploadedUrl(null); }}>
                                    <i className="feather-x" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : detailBooking.refundQrImageUrl ? (
                          <div>
                            <span className="text-muted small d-block mb-2">Ảnh QR nhận tiền của bạn:</span>
                            <div
                              style={{
                                position: 'relative', cursor: 'pointer', borderRadius: 10,
                                overflow: 'hidden', border: '2px solid #3b82f6', background: '#fff'
                              }}
                              onClick={() => setPreviewImage(detailBooking.refundQrImageUrl)}
                            >
                              <img
                                src={detailBooking.refundQrImageUrl}
                                alt="Refund QR"
                                style={{ width: '100%', maxHeight: 150, objectFit: 'contain', display: 'block', padding: 4 }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center p-3 rounded" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, minHeight: 100 }}>
                            <i className="feather-image mb-2" style={{ fontSize: 24, color: '#cbd5e1' }} />
                            <span className="small" style={{ color: '#94a3b8' }}>Chưa có ảnh bill hoàn</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {detailBooking.refundRejectionReason && (
                      <div className="mt-3 p-3 rounded" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10 }}>
                        <small className="text-danger d-block fw-semibold mb-1">
                          <i className="feather-alert-circle me-1" />Lý do từ chối hoàn tiền
                        </small>
                        <p className="mb-0 small text-danger">{detailBooking.refundRejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bk-modal-footer">
              {detailBooking && canUserCancel(detailBooking) && (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm me-auto d-flex align-items-center gap-1"
                  onClick={() => { setDetailBooking(null); openCancelPreview(detailBooking); }}
                >
                  <i className="feather-x-circle" />Huỷ sân
                </button>
              )}
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setDetailBooking(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )
      }

      {/* ── Image Preview Modal ─────────────────────────────────────────── */}
      {
        previewImage && (
          <div
            className="modal fade show d-block"
            style={{ background: 'rgba(0,0,0,0.85)', zIndex: 1060 }}
            onClick={() => setPreviewImage(null)}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-content overflow-hidden border-0 bg-transparent shadow-none" style={{ borderRadius: '16px' }}>
                <div className="modal-header border-0 pb-0 position-absolute w-100 p-3" style={{ zIndex: 10, right: 0, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-close bg-white rounded-circle p-2 shadow"
                    onClick={() => setPreviewImage(null)}
                    style={{ opacity: 1, cursor: 'pointer' }}
                  />
                </div>
                <div className="modal-body p-0 text-center d-flex align-items-center justify-content-center" style={{ minHeight: '300px' }}>
                  <img
                    src={previewImage}
                    alt="Ảnh chuyển khoản"
                    style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* ── Cancel Preview Modal ────────────────────────────────────────── */}
      {
        cancelTarget && (
          <div
            className="bk-modal-overlay"
            onClick={() => { setCancelTarget(null); setCancelPreview(null); setPolicyAgreed(false); }}
          >
            <div className="bk-modal bk-modal--lg" style={{ maxWidth: cancelPreview && (cancelPreview.cancelBranch === 'PAID' || cancelPreview.cancelBranch === 'PROOF_UPLOADED') ? '880px' : '520px', width: '95%' }} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="bk-modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fca5a5' }}>
                <div className="d-flex align-items-center gap-3">
                  <div className="bk-modal-icon" style={{ background: '#fee2e2', borderColor: '#fca5a5' }}>
                    <i className="feather-alert-triangle" style={{ color: '#dc2626' }} />
                  </div>
                  <div>
                    <h5 className="bk-modal-title mb-0" style={{ color: '#dc2626' }}>Xác nhận huỷ đặt sân</h5>
                    {cancelTarget.bookingCode && <p className="bk-modal-sub mb-0">Mã đơn: <strong>{cancelTarget.bookingCode}</strong></p>}
                  </div>
                </div>
                <button type="button" className="bk-modal-close" onClick={() => { setCancelTarget(null); setCancelPreview(null); setPolicyAgreed(false); }}>
                  <i className="feather-x" />
                </button>
              </div>

              {/* Body */}
              <div className="bk-modal-body">
                {cancelPreviewLoading && (
                  <div className="text-center py-4">
                    <div className="spinner-border text-secondary" role="status" />
                    <div className="text-muted mt-2">Đang tải chính sách…</div>
                  </div>
                )}
                {!cancelPreviewLoading && cancelPreview && (
                  <div className="row g-4">
                    {/* ── LEFT COLUMN: Booking info + Policy + Amounts ── */}
                    <div className={cancelPreview.cancelBranch === 'PAID' || cancelPreview.cancelBranch === 'PROOF_UPLOADED' ? 'col-md-6' : 'col-12'}>
                      {/* Booking info card */}
                      <div className="bk-detail-card mb-3">
                        <div className="bk-detail-card__body" style={{ padding: 0 }}>
                          <div className="bk-detail-card__title">{cancelTarget.court}</div>
                          <div className="bk-detail-card__sub">
                            <i className="feather-calendar" style={{ fontSize: 12 }} />
                            {cancelTarget.date} — {cancelTarget.time}
                          </div>
                          {cancelTarget.isLongTerm && (
                            <div className="text-danger small fw-semibold mt-1">
                              <i className="feather-alert-circle me-1" />Lịch dài hạn: huỷ áp dụng cho toàn bộ chuỗi.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Policy section */}
                      <div className="p-3 rounded mb-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                        <div className="fw-semibold mb-1" style={{ color: '#1e40af', fontSize: 13 }}>
                          <i className="feather-shield me-1" />Chính sách sân (áp dụng lúc đặt)
                        </div>
                        <div className="small" style={{ color: '#1e40af' }}>
                          {cancelPreview.refund?.policyDescription}
                        </div>
                      </div>

                      {/* Amounts row */}
                      <div className="row g-2 mb-3">
                        <div className="col-4 text-center">
                          <small className="text-muted d-block" style={{ fontSize: 11 }}>
                            {cancelPreview.cancelBranch === 'PROOF_UPLOADED' ? 'Chờ đối soát (CK)' : 'Đã thanh toán'}
                          </small>
                          <strong style={{ fontSize: 14 }}>
                            {Number(
                              cancelPreview.cancelBranch === 'PROOF_UPLOADED'
                                ? (cancelPreview.payment?.pendingPaymentAmount ?? 0)
                                : (cancelPreview.payment?.paidAmount || 0)
                            ).toLocaleString('vi-VN')} ₫
                          </strong>
                        </div>
                        <div className="col-4 text-center">
                          <small className="text-muted d-block" style={{ fontSize: 11 }}>Phí phạt</small>
                          <strong className="text-danger" style={{ fontSize: 14 }}>{Number(cancelPreview.refund?.penaltyAmount || 0).toLocaleString('vi-VN')} ₫</strong>
                        </div>
                        <div className="col-4 text-center">
                          <small className="text-muted d-block" style={{ fontSize: 11 }}>Được hoàn</small>
                          <strong className="text-success" style={{ fontSize: 14 }}>{Number(cancelPreview.refund?.refundAmount || 0).toLocaleString('vi-VN')} ₫</strong>
                        </div>
                      </div>



                      {cancelPreview.cancelBranch === 'PROOF_UPLOADED' && (
                        <div className="alert alert-success small mb-3" style={{ borderColor: '#86efac', background: '#f0fdf4', color: '#166534', marginBottom: 0 }}>
                          <i className="feather-check-circle me-1" />Chủ sân chưa xác nhận sân → bạn được hoàn <strong>100%</strong> số tiền đã chuyển.
                        </div>
                      )}

                      {/* No payment branch — show agreement here */}
                      {cancelPreview.cancelBranch !== 'PAID' && cancelPreview.cancelBranch !== 'PROOF_UPLOADED' && (
                        <>
                          {!cancelPreview.canCancel && (
                            <div className="alert alert-danger small mb-3">
                              <i className="feather-x-circle me-1" />{cancelPreview.disableReason}
                            </div>
                          )}
                          {cancelPreview.canCancel && (
                            <div className="form-check mb-0 mt-2">
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

                    {/* ── RIGHT COLUMN: QR + Bank + Agreement (only for PAID/PROOF_UPLOADED) ── */}
                    {(cancelPreview.cancelBranch === 'PAID' || cancelPreview.cancelBranch === 'PROOF_UPLOADED') && (
                      <div className="col-md-6">
                        {/* QR Upload Zone */}
                        <div className="bk-detail-section mb-3">
                          <h6 className="bk-detail-section-title">Ảnh mã QR nhận tiền <span className="text-muted fw-normal" style={{ fontSize: 11 }}>(tùy chọn)</span></h6>
                          {!qrPreview ? (
                            <div className="ub-qr-upload-zone" style={{ padding: '16px 12px' }}
                              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ub-qr-upload-zone--active'); }}
                              onDragLeave={e => e.currentTarget.classList.remove('ub-qr-upload-zone--active')}
                              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('ub-qr-upload-zone--active'); handleQrFile(e.dataTransfer.files?.[0]); }}>
                              <i className="feather-upload-cloud ub-qr-upload-zone__icon" style={{ fontSize: 24 }} />
                              <div className="ub-qr-upload-zone__label" style={{ fontSize: 12 }}>Kéo thả hoặc nhấn để chọn ảnh QR</div>
                              <div className="ub-qr-upload-zone__hint" style={{ fontSize: 11 }}>Hỗ trợ JPG, PNG, WEBP — tối đa 10MB</div>
                              <input type="file" accept="image/*" onChange={e => handleQrFile(e.target.files?.[0])} />
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="ub-qr-preview">
                                <img src={qrPreview} alt="QR preview" className="ub-qr-preview__img" style={{ maxHeight: 100 }} />
                                <button type="button" className="ub-qr-preview__remove" title="Xóa ảnh"
                                  onClick={() => { setQrFile(null); setQrPreview(null); setQrUploadedUrl(null); }}>
                                  <i className="feather-x" />
                                </button>
                              </div>
                              {qrUploading && <div className="small text-info mt-1"><span className="spinner-border spinner-border-sm me-1" />Đang tải lên…</div>}
                              {qrUploadedUrl && <div className="small text-success mt-1"><i className="feather-check-circle me-1" />Đã tải lên thành công</div>}
                            </div>
                          )}
                        </div>

                        {/* Bank Info Form */}
                        <div className="bk-detail-section mb-3">
                          <h6 className="bk-detail-section-title"><i className="feather-credit-card me-1" />Thông tin nhận hoàn tiền</h6>
                          <div className="mb-2">
                            <label className="form-label small fw-semibold mb-1">Ngân hàng <span className="text-danger">*</span></label>
                            <BankPicker
                              banks={vietqrBanks}
                              value={bankForm.refundBankName}
                              onSelect={(shortName) => setBankForm(p => ({ ...p, refundBankName: shortName }))}
                              loading={banksLoading}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label small fw-semibold mb-1">Số tài khoản <span className="text-danger">*</span></label>
                            <input type="text" className="form-control" placeholder="0123456789"
                              value={bankForm.refundAccountNumber}
                              onChange={e => setBankForm(p => ({ ...p, refundAccountNumber: e.target.value }))}
                              style={{ borderRadius: 10 }} />
                          </div>
                          <div>
                            <label className="form-label small fw-semibold mb-1">Chủ tài khoản <span className="text-danger">*</span></label>
                            <input type="text" className="form-control text-uppercase" placeholder="NGUYEN VAN A"
                              value={bankForm.refundAccountHolder}
                              onChange={e => setBankForm(p => ({ ...p, refundAccountHolder: e.target.value.toUpperCase() }))}
                              style={{ borderRadius: 10 }} />
                          </div>
                        </div>

                        {/* Agreement + disabled warning */}
                        {!cancelPreview.canCancel && (
                          <div className="alert alert-danger small mb-2">
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
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bk-modal-footer">
                <button type="button" className="btn btn-outline-secondary btn-sm"
                  onClick={() => { setCancelTarget(null); setCancelPreview(null); setPolicyAgreed(false); }}>
                  Giữ lại
                </button>
                {cancelPreview?.canCancel && (
                  <button type="button" className="btn btn-danger btn-sm"
                    disabled={cancelSubmitting || !policyAgreed || ((cancelPreview.cancelBranch === 'PAID' || cancelPreview.cancelBranch === 'PROOF_UPLOADED') && (!bankForm.refundBankName || !bankForm.refundAccountNumber || !bankForm.refundAccountHolder))}
                    onClick={confirmCancel}>
                    {cancelSubmitting ? 'Đang xử lý…' : 'Xác nhận huỷ'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* ── Bank Info Modal (for existing refund requests) ────────────── */}
      {
        showBankForm && (
          <div className="bk-modal-overlay" onClick={() => setShowBankForm(null)}>
            <div className="bk-modal bk-modal--sm" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="bk-modal-header" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderBottom: '1px solid #d1fae5' }}>
                <div className="d-flex align-items-center gap-3">
                  <div className="bk-modal-icon" style={{ background: '#dcfce7', border: '2px solid #86efac', color: '#16a34a' }}>
                    <i className="feather-credit-card" />
                  </div>
                  <div>
                    <h5 className="bk-modal-title mb-0" style={{ color: '#166534' }}>Thông tin nhận hoàn tiền</h5>
                    <p className="bk-modal-sub mb-0">Nhập thông tin tài khoản để chủ sân chuyển khoản hoàn tiền cho bạn.</p>
                  </div>
                </div>
                <button type="button" className="bk-modal-close" onClick={() => setShowBankForm(null)}>
                  <i className="feather-x" />
                </button>
              </div>

              {/* Body */}
              <div className="bk-modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Ngân hàng</label>
                  <BankPicker
                    banks={vietqrBanks}
                    value={bankForm.refundBankName}
                    onSelect={(shortName) => setBankForm(p => ({ ...p, refundBankName: shortName }))}
                    loading={banksLoading}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Số tài khoản</label>
                  <input type="text" className="form-control" placeholder="Nhập số tài khoản" value={bankForm.refundAccountNumber}
                    onChange={e => setBankForm(p => ({ ...p, refundAccountNumber: e.target.value }))}
                    style={{ borderRadius: 10 }}
                  />
                </div>
                <div>
                  <label className="form-label small fw-semibold">Chủ tài khoản</label>
                  <input type="text" className="form-control text-uppercase" placeholder="VD: NGUYEN VAN A" value={bankForm.refundAccountHolder}
                    onChange={e => setBankForm(p => ({ ...p, refundAccountHolder: e.target.value.toUpperCase() }))}
                    style={{ borderRadius: 10 }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="bk-modal-footer">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowBankForm(null)}>Hủy</button>
                <button type="button" className="btn btn-sm d-flex align-items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600 }}
                  disabled={bankSubmitting} onClick={submitBankInfo}>
                  {bankSubmitting ? (
                    <><span className="spinner-border spinner-border-sm" />Đang gửi…</>
                  ) : (
                    <><i className="feather-save" />Lưu</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
