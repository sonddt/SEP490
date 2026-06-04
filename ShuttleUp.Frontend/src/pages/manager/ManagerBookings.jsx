import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { BOOKING_STATUSES, PAYMENT_METHODS } from '../../data/bookingsMock';
import { getManagerBookings, patchManagerBookingStatus } from '../../api/managerBookingsApi';
import BookingDetailModal from '../../components/manager/BookingDetailModal';
import RejectModal from '../../components/manager/RejectModal';
import CancelModal from '../../components/manager/CancelModal';
import { normalizeSearchText } from '../../utils/searchNormalize';
import { useNotification } from '../../hooks/useNotification';
import ShuttleDateField from '../../components/ui/ShuttleDateField';

/* ── Constants ──────────────────────────────────────────────────────────── */
const PAGE_SIZE = 8;

const TABS = [
  { key: 'ALL', label: 'Tất cả', icon: 'feather-list' },
  { key: 'PENDING', label: 'Chờ duyệt', icon: 'feather-clock' },
  { key: 'UPCOMING', label: 'Sắp tới', icon: 'feather-calendar' },
  { key: 'COMPLETED', label: 'Hoàn thành', icon: 'feather-check-circle' },
  { key: 'CANCELLED', label: 'Đã huỷ / Từ chối', icon: 'feather-x-circle' },
];

const CANCELLED_GROUP = new Set(['CANCELLED', 'PENDING_REFUND', 'PENDING_RECONCILIATION', 'REFUNDED']);

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function mapManagerBookingFromApi(b) {
  const items = [...(b.items || [])].sort(
    (a, x) => new Date(a.startTime) - new Date(x.startTime),
  );
  const first = items[0];
  const last = items[items.length - 1];
  const start = first?.startTime ? new Date(first.startTime) : new Date(b.createdAt);
  const end = last?.endTime ? new Date(last.endTime) : start;

  const dateStr = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
  const dateDisplay = `${WEEKDAYS[start.getDay()]}, ${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}/${start.getFullYear()}`;

  const raw = (b.status || '').toUpperCase();
  let uiStatus;
  if (raw === 'PENDING' || raw === 'HOLDING') uiStatus = 'PENDING';
  else if (raw === 'CANCELLED') uiStatus = 'CANCELLED';
  else if (raw === 'PENDING_REFUND') uiStatus = 'PENDING_REFUND';
  else if (raw === 'PENDING_RECONCILIATION') uiStatus = 'PENDING_RECONCILIATION';
  else if (raw === 'REFUNDED') uiStatus = 'REFUNDED';
  else if (raw === 'COMPLETED') uiStatus = 'COMPLETED';
  else if (raw === 'CONFIRMED') {
    uiStatus = end.getTime() >= Date.now() ? 'UPCOMING' : 'COMPLETED';
  } else uiStatus = raw || 'PENDING';

  const methodRaw = (b.paymentMethod || '').toUpperCase();
  let paymentMethod = 'NONE';
  if (methodRaw.includes('BANK')) paymentMethod = 'BANK';
  else if (methodRaw.includes('QR')) paymentMethod = 'QR';
  else if (methodRaw.includes('VNPAY')) paymentMethod = 'VNPAY';

  const uniqueCourts = Array.from(new Set(items.map(i => i.courtName).filter(Boolean)));
  const courtLabel = uniqueCourts.length > 0 ? uniqueCourts.join(', ') : 'Sân';

  const created = b.createdAt ? new Date(b.createdAt) : start;
  const createdDateStr = `${pad2(created.getDate())}/${pad2(created.getMonth() + 1)}/${created.getFullYear()}`;
  const createdTimeStr = `${pad2(created.getHours())}:${pad2(created.getMinutes())}`;
  const createdAt = `${createdDateStr} ${createdTimeStr}`;

  const contact = (b.contactName || '').trim();
  const account = (b.playerName || '').trim();
  const player = contact || account || '—';
  const playerAccountSub =
    contact && account && contact.localeCompare(account, undefined, { sensitivity: 'accent' }) !== 0
      ? account
      : null;

  return {
    bookingId: b.bookingId,
    id: b.bookingId,
    bookingCode: b.bookingCode,
    isLongTerm: b.isLongTerm === true || !!b.seriesId,
    player,
    playerAccountSub,
    playerImg: b.playerAvatarUrl || '/assets/img/profiles/avatar-01.jpg',
    playerPhone: b.playerPhone || '—',
    court: courtLabel,
    courtImg: b.venueImageUrl || '/assets/img/booking/booking-01.jpg',
    venue: b.venueName || '',
    date: dateStr,
    dateDisplay,
    timeStart: `${pad2(start.getHours())}:${pad2(start.getMinutes())}`,
    timeEnd: `${pad2(end.getHours())}:${pad2(end.getMinutes())}`,
    guests: 2,
    amount: Number(b.totalAmount) || 0,
    paymentMethod,
    paymentStatus: b.paymentStatus,
    paymentProofImg: b.proofUrl || null,
    status: uiStatus,
    rawStatus: raw,
    note: b.guestNote || '',
    rejectReason: (b.managerStatusNote || '').trim() || null,
    createdAt,
    createdDateStr,
    createdTimeStr,
    rawCreatedAt: created,
    rawDate: start,
    items: b.items || [],
  };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function isToday(d) { const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); }
function isThisWeek(d) { const n = new Date(); const s = new Date(n); s.setDate(n.getDate() - n.getDay()); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999); return d >= s && d <= e; }
function isThisMonth(d) { const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); }

/* ── Action Dropdown ────────────────────────────────────────────────────── */
function ActionDropdown({ children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="dropdown dropdown-action table-drop-action" ref={ref}>
      <button type="button" className="action-icon" onClick={() => setOpen(v => !v)}>
        <i className="feather-more-horizontal" />
      </button>
      {open && (
        <div className="dropdown-menu dropdown-menu-end show" style={{ display: 'block', position: 'absolute', right: 0, top: '100%' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function isHttpProofUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

/* ── Payment Proof Thumb ────────────────────────────────────────────────── */
function ProofThumb({ img }) {
  const [show, setShow] = useState(false);
  if (!img) return null;
  if (!isHttpProofUrl(img)) {
    return (
      <span className="text-muted small d-inline-block" style={{ maxWidth: 200 }}>
        Môi trường dev
      </span>
    );
  }
  return (
    <>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShow(true)} style={{ padding: '4px 8px', fontSize: 12 }}>
        <i className="feather-image" /> Ảnh CK
      </button>
      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }} onClick={() => setShow(false)}>
          <img src={img} alt="Minh chứng" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.4)', objectFit: 'contain', background: '#fff' }} onClick={e => e.stopPropagation()} />
          <button type="button" onClick={() => setShow(false)} style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.9)', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="feather-x" />
          </button>
        </div>
      )}
    </>
  );
}

/* ═══ MAIN ═══════════════════════════════════════════════════════════════ */
export default function ManagerBookings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('created_desc');
  const [page, setPage] = useState(1);
  const [detailModal, setDetailModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const { notifySuccess, notifyError, notifyWarning, notifyInfo } = useNotification();
  const [processingId, setProcessingId] = useState(null);

  const fetchBookings = useCallback(async (showTableLoading = true) => {
    if (showTableLoading) setLoading(true);
    try {
      const data = await getManagerBookings();
      setBookings(Array.isArray(data) ? data.map(mapManagerBookingFromApi) : []);
    } catch (e) {
      setBookings([]);
      const status = e?.response?.status;
      const body = e?.response?.data;
      const serverMsg = typeof body?.message === 'string' ? body.message : '';
      let msg = 'Rất tiếc! Không tải được danh sách đặt sân.';
      if (status === 403) {
        msg = 'Oops... Có vẻ bạn không có quyền xem trang này (Lỗi 403). Bạn thử kiểm tra lại tài khoản nhé!';
      } else if (status === 401) {
        msg = 'Phiên đăng nhập đã hết hạn mất rồi. Bạn vui lòng đăng nhập lại nha!';
      } else if (status >= 500) {
        msg = serverMsg || 'Hệ thống đang bận một chút, bạn thông cảm thử lại sau nha (Lỗi server).';
      } else if (serverMsg) {
        msg = serverMsg;
      }
      notifyWarning(msg);
    } finally {
      if (showTableLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings(true);
  }, [fetchBookings]);

  useEffect(() => {
    const bid = searchParams.get('bookingId');
    if (!bid || loading || bookings.length === 0) return;
    const norm = String(bid).toLowerCase();
    const found = bookings.find(
      (b) => String(b.bookingId || b.id).toLowerCase() === norm,
    );
    if (!found) {
      const next = new URLSearchParams(searchParams);
      next.delete('bookingId');
      setSearchParams(next, { replace: true });
      return;
    }
    setActiveTab(found.status);
    setDetailModal(found);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    next.delete('bookingId');
    setSearchParams(next, { replace: true });
    requestAnimationFrame(() => {
      const id = found.bookingId || found.id;
      const el = document.querySelector(`[data-manager-booking-row="${id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [bookings, loading, searchParams, setSearchParams]);

  useEffect(() => { setPage(1); }, [activeTab, search, startDate, endDate, sortBy]);

  const counts = useMemo(() => {
    const c = {};
    let cancelledTab = 0;
    bookings.forEach(b => {
      c[b.status] = (c[b.status] || 0) + 1;
      if (CANCELLED_GROUP.has(b.status)) cancelledTab++;
    });
    c['CANCELLED'] = cancelledTab;
    c['ALL'] = bookings.length;
    return c;
  }, [bookings]);

  const processed = useMemo(() => {
    let list = bookings.filter(b => {
      if (activeTab === 'ALL') return true;
      if (activeTab === 'CANCELLED') return CANCELLED_GROUP.has(b.status);
      return b.status === activeTab;
    });
    if (startDate) list = list.filter(b => b.date >= startDate);
    if (endDate) list = list.filter(b => b.date <= endDate);
    if (search.trim()) {
      const nq = normalizeSearchText(search);
      if (nq) {
        list = list.filter(
          (b) =>
            normalizeSearchText(b.player).includes(nq) ||
            (b.playerAccountSub && normalizeSearchText(b.playerAccountSub).includes(nq)) ||
            normalizeSearchText(b.court).includes(nq) ||
            normalizeSearchText(b.venue).includes(nq) ||
            normalizeSearchText(String(b.id)).includes(nq) ||
            (b.bookingCode && normalizeSearchText(b.bookingCode).includes(nq)) ||
            (b.items && b.items.some(i => i.courtName && normalizeSearchText(i.courtName).includes(nq))),
        );
      }
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'created_desc') return b.rawCreatedAt - a.rawCreatedAt;
      if (sortBy === 'created_asc') return a.rawCreatedAt - b.rawCreatedAt;
      if (sortBy === 'play_desc') return b.rawDate - a.rawDate;
      if (sortBy === 'play_asc') return a.rawDate - b.rawDate;
      if (sortBy === 'amount_high') return b.amount - a.amount;
      if (sortBy === 'amount_low') return a.amount - b.amount;
      return 0;
    });
    return list;
  }, [bookings, activeTab, search, startDate, endDate, sortBy]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = processed.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleAccept = useCallback(async (bookingId) => {
    try {
      setProcessingId(bookingId);
      await patchManagerBookingStatus(bookingId, { status: 'CONFIRMED' });
      await fetchBookings(false);
      notifySuccess('Đã chấp nhận yêu cầu!');
    } catch {
      notifyError('Duyệt đơn thất bại. Vui lòng thử lại.');
      await fetchBookings(false);
      throw new Error('accept failed');
    } finally {
      setProcessingId(null);
    }
  }, [fetchBookings]);
  const handleRejectConfirm = useCallback(async (bookingId, reason) => {
    try {
      setProcessingId(bookingId);
      await patchManagerBookingStatus(bookingId, { status: 'CANCELLED', reason });
      setRejectModal(null);
      await fetchBookings(false);
      notifyWarning('Đã từ chối yêu cầu.');
    } catch {
      notifyError('Từ chối thất bại. Vui lòng thử lại.');
      await fetchBookings(false);
      throw new Error('reject failed');
    } finally {
      setProcessingId(null);
    }
  }, [fetchBookings]);
  const handleCancel = useCallback(async (bookingId, reason) => {
    try {
      setProcessingId(bookingId);
      await patchManagerBookingStatus(bookingId, { status: 'CANCELLED', reason });
      setCancelModal(null);
      await fetchBookings(false);
      notifyInfo('Đã huỷ lịch.');
    } catch {
      notifyError('Huỷ lịch thất bại. Vui lòng thử lại.');
      await fetchBookings(false);
    } finally {
      setProcessingId(null);
    }
  }, [fetchBookings]);

  const tabRevenue = useMemo(() => bookings.filter(b => b.status === activeTab && b.paymentStatus === 'PAID').reduce((s, b) => s + b.amount, 0), [bookings, activeTab]);

  return (
    <>
      {/* Banner */}
      {activeTab === 'PENDING' && counts.PENDING > 0 && (
        <div className="bk-banner">
          <div className="d-flex align-items-center gap-3">
            <div className="bk-banner-icon"><i className="feather-bell" /></div>
            <div>
              <strong style={{ fontSize: 15 }}>Có {counts.PENDING} yêu cầu đang chờ duyệt!</strong>
              <span className="d-block" style={{ fontSize: 13, color: '#065f3e', marginTop: 2 }}>
                Vui lòng xem xét và phê duyệt các yêu cầu đặt sân mới nhất.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="bk-stats-strip">
        <div className="bk-stat-card" style={{ '--_accent': '#2563eb' }}>
          <div className="bk-stat-card__icon-wrap" style={{ background: '#eff6ff', borderColor: '#93c5fd' }}>
            <i className="feather-clock bk-stat-card__icon" style={{ color: '#2563eb' }} />
          </div>
          <div>
            <div className="bk-stat-card__label text-uppercase">Số đơn chờ duyệt</div>
            <div className="bk-stat-card__value">{counts.PENDING || 0}</div>
          </div>
        </div>
        <div className="bk-stat-card" style={{ '--_accent': '#097E52' }}>
          <div className="bk-stat-card__icon-wrap" style={{ background: '#e8f5ee', borderColor: '#a7d7be' }}>
            <i className="feather-check-circle bk-stat-card__icon" style={{ color: '#097E52' }} />
          </div>
          <div>
            <div className="bk-stat-card__label text-uppercase">Số đơn đã duyệt</div>
            <div className="bk-stat-card__value" style={{ color: '#097E52' }}>{counts.UPCOMING || 0}</div>
          </div>
        </div>
        {(activeTab === 'UPCOMING' || activeTab === 'COMPLETED') && (
          <div className="bk-stat-card" style={{ '--_accent': '#d97706' }}>
            <div className="bk-stat-card__icon-wrap" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
              <i className="feather-dollar-sign bk-stat-card__icon" style={{ color: '#d97706' }} />
            </div>
            <div>
              <div className="bk-stat-card__label text-uppercase">Doanh thu ({TABS.find(t => t.key === activeTab)?.label})</div>
              <div className="bk-stat-card__value" style={{ color: '#d97706' }}>{tabRevenue.toLocaleString('vi-VN')} ₫</div>
            </div>
          </div>
        )}
      </div>

      {/* Main card */}
      <div className="card card-tableset border-0">
        <div className="card-body">
          {/* Tabs + Filters header */}
          <div className="coache-head-blk pb-3">
            <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-3 gap-lg-4">
              <div className="court-table-head mb-0">
                <h4 style={{ whiteSpace: 'nowrap' }}>Quản lý đặt sân</h4>
                <p style={{ whiteSpace: 'nowrap', margin: 0 }}>{processed.length} lịch đặt · {pageItems.length} hiển thị</p>
              </div>
              <div className="coach-court-list">
                <ul className="nav d-flex flex-wrap gap-2 m-0 p-0" style={{ listStyle: 'none' }}>
                  {TABS.map(tab => (
                    <li key={tab.key} style={{ margin: 0, padding: 0, flex: '0 0 auto', width: 'max-content' }}>
                      <button
                        type="button"
                        className={activeTab === tab.key ? 'active' : ''}
                        onClick={() => setActiveTab(tab.key)}
                        style={{ width: '100%' }}
                      >
                        <i className={tab.icon} style={{ fontSize: 14 }} />
                        {tab.label}
                        <span className="bk-tab-count">{counts[tab.key] || 0}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="d-flex flex-wrap gap-2 mb-3 mt-3 align-items-center" style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <select className="form-select" style={{ width: 190 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="created_desc">Giờ đặt mới nhất</option>
              <option value="created_asc">Giờ đặt cũ nhất</option>
              <option value="play_asc">Giờ chơi gần nhất</option>
              <option value="play_desc">Giờ chơi xa nhất</option>
              <option value="amount_high">Tiền cao → thấp</option>
              <option value="amount_low">Tiền thấp → cao</option>
            </select>
            <div className="d-flex align-items-center gap-2">
              <label style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', marginBottom: 0 }}>Từ ngày</label>
              <div style={{ width: 160 }}>
                <ShuttleDateField
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <label style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', marginBottom: 0 }}>Đến ngày</label>
              <div style={{ width: 160 }}>
                <ShuttleDateField
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </div>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <i className="feather-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
              <input
                type="text" className="form-control"
                style={{ paddingLeft: 32 }}
                placeholder="Tìm người đặt, sân, mã HĐ..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
              {search && <button type="button" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }} onClick={() => setSearch('')}><i className="feather-x" /></button>}
            </div>
            {(startDate || endDate || search) && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); }}
              >
                <i className="feather-refresh-cw" style={{ fontSize: 13 }} /> Xóa lọc
              </button>
            )}
            <span className="bk-filter-count">{processed.length} kết quả</span>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã đặt sân</th>
                  <th>Sân</th>
                  <th>Người đặt</th>
                  <th>Ngày đặt</th>
                  <th>Ngày & Giờ chơi</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-secondary mb-2" role="status" />
                      <div>Đang tải danh sách đặt sân…</div>
                    </td>
                  </tr>
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="bk-empty">
                        <div className="bk-empty-icon"><i className={search ? 'feather-search' : 'feather-inbox'} /></div>
                        <p className="bk-empty-title">{search ? `Không tìm thấy "${search}"` : 'Không có dữ liệu'}</p>
                        <p className="bk-empty-sub">{search ? 'Thử tìm với từ khoá khác' : 'Lịch đặt sân sẽ xuất hiện tại đây'}</p>
                      </div>
                    </td>
                  </tr>
                ) : pageItems.map(b => {
                  const st = BOOKING_STATUSES[b.status] || BOOKING_STATUSES.PENDING;
                  const pm = PAYMENT_METHODS[b.paymentMethod] || PAYMENT_METHODS.NONE;
                  return (
                    <tr key={b.id} data-manager-booking-row={b.bookingId || b.id}>
                      {/* Code */}
                      <td>
                        <span
                          className="badge"
                          title={`Mã đặt: #${b.bookingCode}`}
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
                          #{b.bookingCode}
                        </span>
                      </td>
                      {/* Court */}
                      <td style={{ minWidth: 200 }}>
                        <div className="d-flex align-items-center gap-3">
                          <div className="flex-shrink-0" style={{ width: 56, height: 56 }}>
                            <img className="rounded shadow-sm" src={b.courtImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }} />
                          </div>
                          <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <a href="#!" onClick={e => { e.preventDefault(); setDetailModal(b); }} style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.3, display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.court}>
                              {b.court}
                            </a>
                            {b.isLongTerm ? (
                                  <span className="badge" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, marginTop: 4, display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: '#fff' }}><i className="feather-calendar me-1" style={{ fontSize: 10 }} />Lịch dài hạn</span>
                                ) : (
                                  <span className="badge" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, marginTop: 4, display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' }}><i className="feather-clock me-1" style={{ fontSize: 10 }} />Lịch đơn</span>
                                )}
                            <span style={{ display: 'block', fontSize: 12, marginTop: 4, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.venue}>
                              <i className="feather-map-pin me-1" style={{ fontSize: 10 }} />{b.venue}
                            </span>
                          </div>
                        </div>
                      </td>
                      {/* Player */}
                      <td style={{ maxWidth: 180 }}>
                        <h2 className="table-avatar">
                          <span className="avatar avatar-sm flex-shrink-0" style={{ borderRadius: '50%' }}>
                            <img className="avatar-img rounded-circle" src={b.playerImg} alt="" onError={e => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                          </span>
                          <span className="table-head-name flex-grow-1" style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3', marginBottom: '2px', color: '#0f172a' }} title={b.player}>
                              {b.player}
                            </strong>
                            {b.playerAccountSub && (
                              <span className="d-block text-muted" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.2', marginBottom: '2px' }} title={`TK: ${b.playerAccountSub}`}>
                                TK: {b.playerAccountSub}
                              </span>
                            )}
                            <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{b.playerPhone}</span>
                          </span>
                        </h2>
                      </td>
                      {/* Booking Date */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong style={{ color: '#334155', display: 'block', fontSize: 14 }}>{b.createdDateStr}</strong>
                        <small className="text-muted" style={{ display: 'flex', alignItems: 'center', marginTop: 4, gap: 4 }}>
                          <i className="feather-clock" style={{ fontSize: 12 }}></i> {b.createdTimeStr}
                        </small>
                      </td>
                      {/* Date & Time */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong style={{ color: '#334155', display: 'block' }}>{b.dateDisplay}</strong>
                        <small className="text-muted" style={{ display: 'block', marginTop: 4 }}>{b.timeStart} – {b.timeEnd}</small>
                      </td>
                      {/* Payment */}
                      <td>
                        <span className="pay-dark">{b.amount.toLocaleString('vi-VN')} ₫</span>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          <i className={pm.icon} style={{ fontSize: 11, marginRight: 3 }} />{pm.label}
                        </div>
                        {b.paymentStatus === 'PAID' && (
                          <span className="badge bg-success mt-1"><i className="feather-check" />Đã TT</span>
                        )}
                        <div style={{ marginTop: 4 }}>
                          <ProofThumb img={b.paymentProofImg} />
                        </div>
                      </td>
                      {/* Status */}
                      <td>
                        <span className="badge" style={{ background: st.bg, color: st.color }}>
                          <i className={st.icon} />{st.label}
                        </span>
                      </td>
                      {/* Actions */}
                      <td>
                        <div className="d-flex gap-2 flex-wrap">
                          <button type="button" title="Chi tiết" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32, padding: 0 }} onClick={() => setDetailModal(b)}>
                            <i className="feather-eye" />
                          </button>
                          {b.status === 'PENDING' && (
                            <>
                              <button type="button" title="Duyệt" className="btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32, padding: 0 }} disabled={processingId === b.id} onClick={() => handleAccept(b.id)}>
                                {processingId === b.id ? <div className="spinner-border spinner-border-sm" style={{ width: '1rem', height: '1rem' }} role="status" /> : <i className="feather-check" />}
                              </button>
                              <button type="button" title="Từ chối" className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32, padding: 0 }} disabled={processingId === b.id} onClick={() => setRejectModal(b)}>
                                <i className="feather-x" />
                              </button>
                            </>
                          )}
                          {b.status === 'UPCOMING' && (
                            <button type="button" title="Huỷ lịch" className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32, padding: 0 }} disabled={processingId === b.bookingId} onClick={() => setCancelModal(b)}>
                              {processingId === b.bookingId ? <div className="spinner-border spinner-border-sm" style={{ width: '1rem', height: '1rem' }} role="status" /> : <i className="feather-slash" />}
                            </button>
                          )}
                          {b.rawStatus === 'PENDING_REFUND' && (
                            <Link to="/manager/refunds" title="Xử lý hoàn tiền" className="btn btn-sm btn-outline-warning d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32, padding: 0 }}>
                              <i className="feather-dollar-sign" />
                            </Link>
                          )}
                          {b.rawStatus === 'PENDING_RECONCILIATION' && (
                            <Link to="/manager/refunds" title="Đối soát & hoàn tiền" className="btn btn-sm btn-outline-warning d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32, padding: 0 }}>
                              <i className="feather-dollar-sign" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>
                Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, processed.length)} / {processed.length}
              </span>
              <nav>
                <ul className="pagination mb-0">
                  <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
                    <button type="button" className="page-link" onClick={() => setPage(p => Math.max(1, p - 1))}>
                      <i className="feather-chevron-left" style={{ fontSize: 14 }} />
                    </button>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <li key={p} className={`page-item ${p === currentPage ? 'active' : ''}`}>
                      <button type="button" className="page-link" onClick={() => setPage(p)}>{p}</button>
                    </li>
                  ))}
                  <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                    <button type="button" className="page-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      <i className="feather-chevron-right" style={{ fontSize: 14 }} />
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <BookingDetailModal
        booking={detailModal}
        onClose={() => setDetailModal(null)}
        onAccept={handleAccept}
        onReject={b => { setDetailModal(null); setRejectModal(b); }}
        onCancel={b => { setDetailModal(null); setCancelModal(b); }}
      />
      <RejectModal
        booking={rejectModal}
        onConfirm={handleRejectConfirm}
        onClose={() => setRejectModal(null)}
      />
      <CancelModal
        booking={cancelModal}
        onConfirm={handleCancel}
        onClose={() => setCancelModal(null)}
      />
    </>
  );
}
