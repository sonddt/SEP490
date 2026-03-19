import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MOCK_BOOKINGS, BOOKING_STATUSES, PAYMENT_METHODS } from '../../data/bookingsMock';
import BookingDetailModal from '../../components/manager/BookingDetailModal';
import RejectModal from '../../components/manager/RejectModal';

/* ── Constants ──────────────────────────────────────────────────────────── */
const PAGE_SIZE = 8;

const TABS = [
  { key: 'PENDING',   label: 'Chờ duyệt',  icon: 'feather-clock' },
  { key: 'UPCOMING',  label: 'Sắp tới',     icon: 'feather-calendar' },
  { key: 'COMPLETED', label: 'Hoàn thành',  icon: 'feather-check-circle' },
  { key: 'REJECTED',  label: 'Từ chối',     icon: 'feather-x-circle' },
  { key: 'CANCELLED', label: 'Đã huỷ',      icon: 'feather-slash' },
];

/* ── Helpers ────────────────────────────────────────────────────────────── */
function isToday(d) { const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); }
function isThisWeek(d) { const n = new Date(); const s = new Date(n); s.setDate(n.getDate() - n.getDay()); s.setHours(0,0,0,0); const e = new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return d >= s && d <= e; }
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

/* ── Payment Proof Thumb ────────────────────────────────────────────────── */
function ProofThumb({ img }) {
  const [show, setShow] = useState(false);
  if (!img) return null;
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
  const [bookings, setBookings]   = useState(MOCK_BOOKINGS);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [search, setSearch]       = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [sortBy, setSortBy]       = useState('newest');
  const [page, setPage]           = useState(1);
  const [detailModal, setDetailModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [toastMsg, setToastMsg]   = useState(null);

  useEffect(() => { setPage(1); }, [activeTab, search, timeFilter, sortBy]);

  const counts = useMemo(() => bookings.reduce((a, b) => { a[b.status] = (a[b.status] || 0) + 1; return a; }, {}), [bookings]);

  const processed = useMemo(() => {
    let list = bookings.filter(b => b.status === activeTab);
    if (timeFilter === 'today') list = list.filter(b => isToday(new Date(b.date)));
    if (timeFilter === 'week')  list = list.filter(b => isThisWeek(new Date(b.date)));
    if (timeFilter === 'month') list = list.filter(b => isThisMonth(new Date(b.date)));
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(b => b.player.toLowerCase().includes(q) || b.court.toLowerCase().includes(q) || b.venue.toLowerCase().includes(q) || b.id.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'amount_high') return b.amount - a.amount;
      if (sortBy === 'amount_low')  return a.amount - b.amount;
      return 0;
    });
    return list;
  }, [bookings, activeTab, search, timeFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = processed.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const showToast = (msg, type = 'success') => { setToastMsg({ msg, type }); setTimeout(() => setToastMsg(null), 3000); };
  const handleAccept = useCallback((id) => { setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'UPCOMING' } : b)); showToast('Đã chấp nhận yêu cầu!'); }, []);
  const handleRejectConfirm = useCallback((id, reason) => { setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'REJECTED', rejectReason: reason } : b)); setRejectModal(null); showToast('Đã từ chối yêu cầu.', 'warning'); }, []);
  const handleCancel = useCallback((id) => { setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b)); showToast('Đã huỷ lịch.', 'info'); }, []);

  const tabRevenue = useMemo(() => bookings.filter(b => b.status === activeTab && b.paymentStatus === 'PAID').reduce((s, b) => s + b.amount, 0), [bookings, activeTab]);

  return (
    <>
      {/* Toast */}
      {toastMsg && (
        <div className={`bk-toast bk-toast--${toastMsg.type}`} style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, animation: 'bkToastIn 0.3s ease' }}>
          <i className={toastMsg.type === 'success' ? 'feather-check-circle' : toastMsg.type === 'warning' ? 'feather-alert-circle' : 'feather-info'} />
          {toastMsg.msg}
        </div>
      )}

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
        <div className="bk-stat-card">
          <i className="feather-list bk-stat-card__icon" />
          <div>
            <div className="bk-stat-card__label">Tổng ({TABS.find(t => t.key === activeTab)?.label})</div>
            <div className="bk-stat-card__value">{processed.length}</div>
          </div>
        </div>
        {(activeTab === 'UPCOMING' || activeTab === 'COMPLETED') && (
          <div className="bk-stat-card">
            <i className="feather-trending-up bk-stat-card__icon" style={{ color: '#097E52' }} />
            <div>
              <div className="bk-stat-card__label">Doanh thu đã TT</div>
              <div className="bk-stat-card__value" style={{ color: '#097E52' }}>{tabRevenue.toLocaleString('vi-VN')} ₫</div>
            </div>
          </div>
        )}
        {activeTab === 'PENDING' && (
          <div className="bk-stat-card">
            <i className="feather-clock bk-stat-card__icon" style={{ color: '#d97706' }} />
            <div>
              <div className="bk-stat-card__label">Chờ phê duyệt</div>
              <div className="bk-stat-card__value" style={{ color: '#d97706' }}>{counts.PENDING || 0}</div>
            </div>
          </div>
        )}
      </div>

      {/* Main card */}
      <div className="card card-tableset border-0">
        <div className="card-body">
          {/* Tabs + Filters header */}
          <div className="coache-head-blk">
            <div className="row align-items-center">
              <div className="col-lg-5">
                <div className="court-table-head">
                  <h4>Quản lý đặt sân</h4>
                  <p>{processed.length} lịch đặt · {pageItems.length} hiển thị</p>
                </div>
              </div>
              <div className="col-lg-7">
                <div className="coach-court-list">
                  <ul className="nav">
                    {TABS.map(tab => (
                      <li key={tab.key}>
                        <button
                          type="button"
                          className={activeTab === tab.key ? 'active' : ''}
                          onClick={() => setActiveTab(tab.key)}
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
          </div>

          {/* Filters */}
          <div className="bk-filters-row">
            <div className="bk-search-wrap">
              <i className="feather-search bk-search-icon" />
              <input
                type="text" className="form-control bk-search-input"
                placeholder="Tìm theo tên người đặt, tên sân, cụm sân..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
              {search && <button type="button" className="bk-search-clear" onClick={() => setSearch('')}><i className="feather-x" /></button>}
            </div>
            <select className="form-select" value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
              <option value="all">Tất cả thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
            </select>
            <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="amount_high">Tiền cao → thấp</option>
              <option value="amount_low">Tiền thấp → cao</option>
            </select>
            <span className="bk-filter-count">{processed.length} kết quả</span>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Sân</th>
                  <th>Người đặt</th>
                  <th>Ngày & Giờ</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="bk-empty">
                        <div className="bk-empty-icon"><i className={search ? 'feather-search' : 'feather-inbox'} /></div>
                        <p className="bk-empty-title">{search ? `Không tìm thấy "${search}"` : 'Không có dữ liệu'}</p>
                        <p className="bk-empty-sub">{search ? 'Thử tìm với từ khoá khác' : 'Lịch đặt sân sẽ xuất hiện tại đây'}</p>
                      </div>
                    </td>
                  </tr>
                ) : pageItems.map(b => {
                  const st = BOOKING_STATUSES[b.status] || BOOKING_STATUSES.PENDING;
                  const pm = PAYMENT_METHODS[b.paymentMethod] || PAYMENT_METHODS.CASH;
                  return (
                    <tr key={b.id}>
                      {/* Court */}
                      <td>
                        <h2 className="table-avatar">
                          <span className="avatar avatar-sm flex-shrink-0">
                            <img className="avatar-img" src={b.courtImg} alt="" onError={e => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
                          </span>
                          <span className="table-head-name flex-grow-1">
                            <a href="#!" onClick={e => { e.preventDefault(); setDetailModal(b); }}>{b.court}</a>
                            <span><i className="feather-map-pin" style={{ fontSize: 11, marginRight: 3 }} />{b.venue}</span>
                          </span>
                        </h2>
                      </td>
                      {/* Player */}
                      <td>
                        <h2 className="table-avatar">
                          <span className="avatar avatar-sm flex-shrink-0" style={{ borderRadius: '50%' }}>
                            <img className="avatar-img rounded-circle" src={b.playerImg} alt="" onError={e => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                          </span>
                          <span className="table-head-name flex-grow-1">
                            <a href="#!" onClick={e => e.preventDefault()}>{b.player}</a>
                            <span>{b.playerPhone}</span>
                          </span>
                        </h2>
                      </td>
                      {/* Date & Time */}
                      <td className="table-date-time">
                        <h4>{b.dateDisplay}<span>{b.timeStart} – {b.timeEnd}</span></h4>
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
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDetailModal(b)}>
                            <i className="feather-eye" /> Chi tiết
                          </button>
                          {b.status === 'PENDING' && (
                            <>
                              <button type="button" className="btn btn-sm btn-outline-success" onClick={() => handleAccept(b.id)}>
                                <i className="feather-check" /> Duyệt
                              </button>
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setRejectModal(b)}>
                                <i className="feather-x" /> Từ chối
                              </button>
                            </>
                          )}
                          {b.status === 'UPCOMING' && (
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleCancel(b.id)}>
                              <i className="feather-slash" /> Huỷ lịch
                            </button>
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
      />
      <RejectModal
        booking={rejectModal}
        onConfirm={handleRejectConfirm}
        onClose={() => setRejectModal(null)}
      />
    </>
  );
}
