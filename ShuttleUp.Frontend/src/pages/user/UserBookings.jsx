import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import { getMyBookings, cancelBooking, getCancelPreview, updateRefundBankInfo } from '../../api/bookingApi';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatPaymentMethodLabel(method) {
  if (!method) return 'Chuyển khoản';
  const u = String(method).toUpperCase();
  if (u.includes('QR')) return 'Quét mã QR';
  if (u.includes('BANK')) return 'Chuyển khoản';
  return 'Chuyển khoản';
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
  };
}

const TABS = [
  { key: 'PENDING',   label: 'Chờ duyệt',  color: 'warning' },
  { key: 'UPCOMING',  label: 'Sắp tới',    color: 'primary' },
  { key: 'COMPLETED', label: 'Hoàn thành', color: 'success' },
  { key: 'REFUND',    label: 'Hoàn tiền',  color: 'info'    },
  { key: 'CANCELLED', label: 'Đã huỷ',     color: 'danger'  },
];

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

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelPreview) return;
    setCancelSubmitting(true);
    try {
      const body = cancelPreview.cancelBranch === 'PAID'
        ? { refundBankName: bankForm.refundBankName, refundAccountNumber: bankForm.refundAccountNumber, refundAccountHolder: bankForm.refundAccountHolder }
        : {};
      const result = await cancelBooking(cancelTarget.id, body);
      setCancelTarget(null);
      setCancelPreview(null);
      setDetailBooking(null);

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

  return (
    <div className="main-wrapper content-below-header">
      {toastMsg && (
        <div
          className={`alert ${toastMsg.isError ? 'alert-danger' : 'alert-success'} shadow-sm`}
          style={{ position: 'fixed', top: 88, right: 16, zIndex: 9999, minWidth: 260, margin: 0 }}
          role="alert"
        >
          {toastMsg.msg}
        </div>
      )}
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Lịch sử đặt sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Lịch sử đặt sân</li>
          </ul>
        </div>
      </section>

      <UserDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {/* ── Filter bar ──────────────────────────────────────────────── */}
          <div className="row">
            <div className="col-lg-12">
              <div className="sortby-section court-sortby-section">
                <div className="sorting-info">
                  <div className="row d-flex align-items-center">
                    <div className="col-xl-6 col-lg-6 col-sm-12 col-12">
                      <div className="coach-court-list">
                        <ul className="nav">
                          {TABS.map(t => (
                            <li key={t.key}>
                              <a
                                href="#"
                                className={activeTab === t.key ? 'active' : ''}
                                onClick={e => { e.preventDefault(); setActiveTab(t.key); }}
                              >
                                {t.label}
                                <span className={`badge bg-${t.color} ms-2`}>
                                  {bookings.filter(b => b.status === t.key).length}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="col-xl-6 col-lg-6 col-sm-12 col-12">
                      <div className="sortby-filter-group court-sortby">
                        <div className="sortbyset week-bg">
                          <div className="sorting-select">
                            <select
                              className="form-control select"
                              value={timeFilter}
                              onChange={e => setTimeFilter(e.target.value)}
                            >
                              <option value="week">Tuần này</option>
                              <option value="month">Tháng này</option>
                              <option value="all">Tất cả</option>
                            </select>
                          </div>
                        </div>
                        <div className="sortbyset">
                          <span className="sortbytitle">Sắp xếp</span>
                          <div className="sorting-select">
                            <select
                              className="form-control select"
                              value={sortBy}
                              onChange={e => setSortBy(e.target.value)}
                            >
                              <option value="newest">Mới nhất</option>
                              <option value="oldest">Cũ nhất</option>
                              <option value="amount">Theo giá</option>
                            </select>
                          </div>
                        </div>
                      </div>
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
                        <div className="col-md-6 text-end d-flex gap-2 justify-content-end flex-wrap">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            disabled={loading}
                            onClick={() => loadBookings()}
                          >
                            <i className="feather-refresh-cw me-1" />
                            {loading ? 'Đang tải…' : 'Làm mới'}
                          </button>
                          <Link to="/venues" className="btn btn-secondary btn-sm">
                            <i className="feather-plus me-1" />Đặt sân mới
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-borderless datatable">
                        <thead className="thead-light">
                          <tr>
                            <th>Sân</th>
                            <th>Mã đặt</th>
                            <th>Ngày</th>
                            <th>Giờ</th>
                            <th>Thanh toán</th>
                            <th>P.thức</th>
                            <th>Trạng thái</th>
                            <th>Đánh giá</th>
                            <th>Chi tiết</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {loading && (
                            <tr>
                              <td colSpan={10} className="text-center text-muted py-5">
                                <div className="spinner-border spinner-border-sm text-secondary mb-2" role="status" />
                                <div>Đang tải lịch đặt sân…</div>
                              </td>
                            </tr>
                          )}
                          {!loading && filtered.length === 0 && (
                            <tr>
                              <td colSpan={10} className="text-center text-muted py-5">
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
                                        <span className="badge bg-info text-dark ms-1" style={{ fontSize: '0.65rem' }}>Lịch dài hạn</span>
                                      )}
                                    </span>
                                    <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>
                                      <i className="feather-map-pin me-1" />{b.venueAddress}
                                    </small>
                                  </span>
                                </h2>
                              </td>
                              {/* Code */}
                              <td>
                                <span className="badge"
                                  style={{ background: '#f0fdf4', color: 'var(--primary-color)', border: '1px solid #6ee7b7', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  #{b.code}
                                </span>
                              </td>
                              <td>{b.date}</td>
                              <td>{b.time}</td>
                              <td><strong>{b.amount.toLocaleString('vi-VN')} ₫</strong></td>
                              <td>
                                <span className="text-muted small">
                                  <i className={`${b.paymentMethod === 'Quét mã QR' ? 'feather-smartphone' : 'feather-credit-card'} me-1`} />
                                  {b.paymentMethod}
                                </span>
                              </td>
                              <td><StatusBadge b={b} /></td>
                              <td>
                                {b.venueId && (b.canReview || b.canEditReview) ? (
                                  <Link
                                    className="btn btn-sm btn-outline-secondary"
                                    to={`/venue-details/${b.venueId}?openReview=1&bookingId=${b.id}`}
                                    title={b.canEditReview ? 'Sửa đánh giá' : 'Viết đánh giá'}
                                  >
                                    <i className="feather-star me-1" />
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
                              {/* Detail btn */}
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => setDetailBooking(b)}
                                >
                                  <i className="feather-eye me-1" />Xem
                                </button>
                              </td>
                              {/* Actions */}
                              <td className="text-end">
                                <div className="dropdown dropdown-action table-drop-action">
                                  <button type="button" className="action-icon dropdown-toggle" data-bs-toggle="dropdown">
                                    <i className="fas fa-ellipsis-h" />
                                  </button>
                                  <ul className="dropdown-menu dropdown-menu-end">
                                    <li>
                                      <button type="button" className="dropdown-item"
                                        onClick={() => setDetailBooking(b)}>
                                        <i className="feather-eye me-2" />Xem chi tiết
                                      </button>
                                    </li>
                                    {b.needsPaymentRetry && b.status === 'PENDING' && (
                                      <li>
                                        <button
                                          type="button"
                                          className="dropdown-item text-primary"
                                          onClick={() => navigate(`/booking/payment?bookingId=${b.id}`)}
                                        >
                                          <i className="feather-credit-card me-2" />Thanh toán lại
                                        </button>
                                      </li>
                                    )}
                                    {b.venueId && (b.canReview || b.canEditReview) && (
                                      <li>
                                        <Link
                                          className="dropdown-item"
                                          to={`/venue-details/${b.venueId}?openReview=1&bookingId=${b.id}`}
                                        >
                                          <i className="feather-star me-2" />
                                          {b.canEditReview ? 'Sửa đánh giá' : 'Đánh giá sân'}
                                        </Link>
                                      </li>
                                    )}
                                    {canUserCancel(b) && (
                                      <li>
                                        <button
                                          type="button"
                                          className="dropdown-item text-danger"
                                          onClick={() => openCancelPreview(b)}
                                        >
                                          <i className="feather-x-circle me-2" />Huỷ lịch
                                        </button>
                                      </li>
                                    )}
                                    {b.status === 'REFUND' && !b.refundAccountNumber && (
                                      <li>
                                        <button
                                          type="button"
                                          className="dropdown-item text-info"
                                          onClick={() => { setBankForm({ refundBankName: '', refundAccountNumber: '', refundAccountHolder: '' }); setShowBankForm(b); }}
                                        >
                                          <i className="feather-credit-card me-2" />Nhập STK nhận hoàn
                                        </button>
                                      </li>
                                    )}
                                  </ul>
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
                    <i className="feather-x-circle me-1" />Huỷ lịch
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
