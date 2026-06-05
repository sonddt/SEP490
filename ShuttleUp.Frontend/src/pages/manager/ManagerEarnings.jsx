import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import axiosClient from '../../api/axiosClient';
import { notifyError, notifyInfo } from '../../hooks/useNotification';
import ShuttleDateField from '../../components/ui/ShuttleDateField';
import LongTermScheduleDisplay from '../../components/common/LongTermScheduleDisplay';

const STATUS_MAP = {
  CONFIRMED: { label: 'Sắp tới',    color: '#097E52', bg: '#e8f5ee', icon: 'feather-check-circle', badge: 'bg-success' },
  COMPLETED: { label: 'Hoàn thành', color: '#097E52', bg: '#e8f5ee', icon: 'feather-check-circle', badge: 'bg-success' },
  PENDING:   { label: 'Chờ xử lý', color: '#d97706', bg: '#fef3c7', icon: 'feather-clock',        badge: 'bg-warning text-dark' },
  CANCELLED: { label: 'Đã huỷ',    color: '#ef4444', bg: '#fff1f2', icon: 'feather-x-circle',     badge: 'bg-danger' },
  PENDING_REFUND: { label: 'Chờ hoàn tiền', color: '#d97706', bg: '#fef3c7', icon: 'feather-clock', badge: 'bg-warning text-dark' },
  REFUNDED:  { label: 'Đã hoàn tiền', color: '#0ea5e9', bg: '#f0f9ff', icon: 'feather-check-circle', badge: 'bg-info text-white' },
};

const PIE_COLORS = ['#097E52', '#2563eb', '#d97706', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b'];

const fmtVnd = (v) => `${Number(v || 0).toLocaleString('vi-VN')} ₫`;
const fmtVndShort = (v) => {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
};

function formatCourtNames(items, rawCourt) {
  if (!items || !items.length) return rawCourt;
  const uniqueNames = [...new Set(items.map(i => i.courtName))];
  return uniqueNames.join(', ');
}

function getGroupedModalItems(items) {
  if (!items || !items.length) return [];
  const grouped = {};
  items.forEach(i => {
    const key = `${i.courtName}_${i.price}`;
    if (!grouped[key]) grouped[key] = { name: i.courtName, count: 0, unitPrice: (i.price || 0), totalPrice: 0 };
    grouped[key].count += 1;
    grouped[key].totalPrice += (i.price || 0);
  });
  return Object.values(grouped);
}

/* ── Pagination ──────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  return (
    <div className="d-flex align-items-center justify-content-center gap-2 mt-4">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="mgr-btn-lift"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, color: page <= 1 ? '#cbd5e1' : '#334155', cursor: page <= 1 ? 'default' : 'pointer', transition: 'all .15s' }}>
        <i className="feather-chevron-left" style={{ fontSize: 15 }} /> Trước
      </button>
      {pages.map((p) => (
        <button key={p} type="button" onClick={() => onChange(p)} className="mgr-btn-lift"
          style={{ width: 38, height: 38, borderRadius: 8, border: 'none', background: page === p ? 'var(--mgr-accent)' : '#f1f5f9', color: page === p ? '#fff' : '#334155', fontWeight: page === p ? 800 : 500, fontSize: 14, cursor: 'pointer', transition: 'all .15s', boxShadow: page === p ? '0 2px 8px rgba(9,126,82,.35)' : 'none' }}>
          {p}
        </button>
      ))}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="mgr-btn-lift"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, color: page >= totalPages ? '#cbd5e1' : '#334155', cursor: page >= totalPages ? 'default' : 'pointer', transition: 'all .15s' }}>
        Sau <i className="feather-chevron-right" style={{ fontSize: 15 }} />
      </button>
    </div>
  );
}



/* ═══ MAIN ═══════════════════════════════════════════════════════════════ */
export default function ManagerEarnings() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [venueFilter, setVenueFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const [detailModal, setDetailModal] = useState(null);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1, venues: [], totalRevInRange: 0, page: 1, pageSize: itemsPerPage });

  const handleClearSearch = useCallback(() => setSearch(''), []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), pageSize: String(itemsPerPage) });
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (venueFilter) params.append('venueId', venueFilter);
      if (search.trim()) params.append('search', search.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await axiosClient.get(`/manager/stats/earnings?${params.toString()}`);
      setData(res);
    } catch (e) {
      setData({ items: [], totalItems: 0, totalPages: 1, venues: [], totalRevInRange: 0, page: 1, pageSize: itemsPerPage });
      notifyError(e?.response?.data?.message || 'Oops… Không tải được báo cáo doanh thu.');
    } finally {
      setLoading(false);
    }
  }, [page, itemsPerPage, statusFilter, venueFilter, search, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, venueFilter, search, startDate, endDate]);

  const filteredItems = useMemo(() => {
    return (data?.items || []).filter(tx => {
      if (tx.status === 'CONFIRMED' || tx.status === 'COMPLETED') return true;
      if (tx.status === 'REFUNDED' && (tx.penaltyAmount || 0) > 0) return true;
      return false;
    });
  }, [data?.items]);

  const totalPages = data?.totalPages ?? 1;
  const currentPage = Math.min(page, totalPages);
  const currentItems = filteredItems;
  
  // Notice user requested: "Doanh thu sẽ hiện theo tổng toàn bộ doanh thu dựa theo tổng thanh toán của toàn bộ đơn trạng thái Đã thu và Hoàn thành dựa theo filter thời gian, cả Số booking cũng sẽ đếm dựa theo filter thời gian"
  // Wait, if totalRevInRange already only calculates PaidStatuses, we can use it. But wait, if they change statusFilter to "Chờ xử lý", totalRevInRange would become 0 from backend. 
  // Wait, the API GET /manager/stats/earnings?status=PENDING will only return PENDING items.
  // The backend sums revenue of PAID statuses intersecting with the status filter.
  // Since we want the Top Cards to ONLY reflect the time filter (and search), we should probably make a separate API call, OR just let it be. But wait, we can't change the backend.
  // Wait, I can fetch the total dynamically on the client side? No, it's paginated.
  // Actually, I'll use the analytics data or just let the backend handle it and maybe use another way, OR since the user said "hơi tương tự bên Thống kê doanh thu của admin", maybe they are okay with it. Wait! The user said in feedback: "Tôi cần có thể ảnh hưởng bởi filter theo thời gian nhé (giống với ô Tổng doanh thu của bên Thống kê doanh thu của admin). Ô Số Booking cũng sẽ thay đổi theo filter các sân theo thời gian luôn".
  // The user says "ảnh hưởng bởi filter thời gian". So if they just change the date, it should change.
  // The data.totalRevInRange from the backend already does this! It considers startDate and endDate.
  const totalRevenue = data?.overallTotalRev ?? data?.totalRevInRange ?? 0;
  const totalBookingsCard = data?.overallTotalItems ?? data?.totalItems ?? 0;

  const STATS = useMemo(() => ([
    { icon: 'feather-trending-up', bg: '#e8f5ee', iconColor: '#097E52', label: 'Doanh thu', value: fmtVnd(totalRevenue) },
    { icon: 'feather-calendar',    bg: '#eff6ff', iconColor: '#2563eb', label: 'Số booking', value: (totalBookingsCard).toLocaleString('vi-VN') },
  ]), [totalRevenue, totalBookingsCard]);

  const fmtTime = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const handleExport = () => {
    try {
      const rows = (data?.items || []).map((tx, i) => ({
        'STT': i + 1,
        'Mã booking': tx.refId,
        'Người đặt': tx.player,
        'Cụm sân': tx.venue,
        'Sân con': tx.court,
        'Ngày': tx.date,
        'Giờ': tx.startTime ? `${fmtTime(tx.startTime)} – ${fmtTime(tx.endTime)}` : '—',
        'Tiền (VNĐ)': tx.status === 'REFUNDED' ? (tx.penaltyAmount ?? 0) : (tx.amount ?? 0),
        'Trạng thái': STATUS_MAP[tx.status]?.label || tx.status,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Doanh thu');
      XLSX.writeFile(wb, `bao-cao-doanh-thu-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      notifyInfo('Oops… Chưa xuất được file lúc này.');
    }
  };



  return (
    <>
      {/* ── Stats Cards ─────────────────────────────────── */}
      <div className="row g-3 mb-4">
        {STATS.map(s => (
          <div key={s.label} className="col-xl-3 col-sm-6">
            <div className="mgr-stat-card" style={{ transition: 'transform .2s, box-shadow .2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
              <div className="mgr-stat-card__icon" style={{ background: s.bg }}>
                <i className={s.icon} style={{ color: s.iconColor }} />
              </div>
              <div>
                <div className="mgr-stat-card__label">{s.label}</div>
                <div className="mgr-stat-card__value" style={{ color: s.iconColor }}>{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

            {/* ── Transaction Table ──────────────────────────── */}
      <div className="card card-tableset border-0 mb-4" style={{ borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
        <div className="card-body">
          <div className="coache-head-blk" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div className="row align-items-center">
              <div className="col-md-5">
                <div className="court-table-head">
                  <h4>Lịch sử doanh thu</h4>
                  <p>{(data?.totalItems ?? 0).toLocaleString('vi-VN')} booking · Thu được {fmtVnd(totalRevenue)}</p>
                </div>
              </div>
              <div className="col-md-7 d-flex justify-content-md-end mt-2 mt-md-0">
                <button type="button" className="btn btn-sm"
                  style={{ background: '#e8f5ee', color: '#097E52', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={handleExport} disabled={loading || !(data?.items?.length > 0)}>
                  <i className="feather-download" style={{ fontSize: 14 }} /> Xuất Excel
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="d-flex flex-wrap gap-2 mb-3 mt-3 align-items-center">
            <select
              className="form-select"
              style={{ width: 180 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="CONFIRMED">Sắp tới</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
            <select
              className="form-select"
              style={{ width: 180 }}
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
            >
              <option value="">Tất cả cụm sân</option>
              {(data?.venues || []).map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
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
                type="text"
                className="form-control"
                style={{ paddingLeft: 32 }}
                placeholder="Tìm người đặt, sân, mã HĐ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                  onClick={handleClearSearch}
                ><i className="feather-x" /></button>
              )}
            </div>
            {(startDate || endDate || search || statusFilter !== 'ALL') && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => { setStatusFilter('ALL'); setStartDate(''); setEndDate(''); setSearch(''); }}
              >
                <i className="feather-refresh-cw" style={{ fontSize: 13 }} /> Xóa lọc
              </button>
            )}
          </div>

          {/* Table */}
          <div className="table-responsive" style={{ minHeight: 640 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mã đặt sân</th>
                  <th>Sân</th>
                  <th>Người đặt</th>
                  <th>Ngày & Giờ</th>
                  <th>Doanh thu</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7}>
                        <div className="placeholder-glow">
                          <span className="placeholder col-12" style={{ height: 30 }} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : !currentItems.length ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="bk-empty">
                        <div className="bk-empty-icon"><i className={search ? 'feather-search' : 'feather-inbox'} /></div>
                        <p className="bk-empty-title">{search ? `Không tìm thấy "${search}"` : 'Không có dữ liệu'}</p>
                        <p className="bk-empty-sub">{search ? 'Thử tìm với từ khóa khác' : 'Giao dịch sẽ xuất hiện tại đây'}</p>
                      </div>
                    </td>
                  </tr>
                ) : currentItems.map(tx => {
                  const st = STATUS_MAP[tx.status] || STATUS_MAP.PENDING;
                  return (
                    <tr key={tx.id}>
                      <td>
                        <span
                          className="badge"
                          title={`Mã đặt: #${tx.refId}`}
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
                          #{tx.refId}
                        </span>
                      </td>
                      <td style={{ minWidth: 200 }}>
                        <div className="d-flex align-items-center gap-3">
                          <div className="flex-shrink-0" style={{ width: 56, height: 56 }}>
                            <img className="rounded shadow-sm" src={tx.courtImg || '/assets/img/booking/booking-01.jpg'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }} />
                          </div>
                          <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <a href="#!" onClick={e => { e.preventDefault(); setDetailModal(tx); }} style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.3, display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.court}>
                              {formatCourtNames(tx.items, tx.court)}
                            </a>
                            {tx.isLongTerm ? (
                                  <span className="badge" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, marginTop: 4, display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: '#fff' }}><i className="feather-calendar me-1" style={{ fontSize: 10 }} />Lịch dài hạn</span>
                                ) : (
                                  <span className="badge" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, marginTop: 4, display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' }}><i className="feather-clock me-1" style={{ fontSize: 10 }} />Lịch đơn</span>
                                )}
                            <span style={{ display: 'block', fontSize: 12, marginTop: 4, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.venue}>
                              <i className="feather-map-pin me-1" style={{ fontSize: 10 }} />{tx.venue}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: 180 }}>
                        <h2 className="table-avatar">
                          <span className="avatar avatar-sm flex-shrink-0" style={{ borderRadius: '50%' }}>
                            <img className="avatar-img rounded-circle" src={tx.playerImg || '/assets/img/profiles/avatar-01.jpg'} alt="" onError={e => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                          </span>
                          <span className="table-head-name flex-grow-1" style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3', marginBottom: '2px', color: '#0f172a' }} title={tx.player}>
                              {tx.player}
                            </strong>
                            <span style={{ display: 'block', fontSize: 13, color: '#64748b' }}>{tx.playerPhone || '—'}</span>
                          </span>
                        </h2>
                      </td>
                      <td className="table-date-time">
                        <h4>{tx.date}<span>{tx.startTime ? `${fmtTime(tx.startTime)} – ${fmtTime(tx.endTime)}` : '—'}</span></h4>
                      </td>
                      <td>
                        <span className="pay-dark">{(tx.status === 'REFUNDED' ? (tx.penaltyAmount ?? 0) : tx.amount).toLocaleString('vi-VN')} ₫</span>
                      </td>
                      <td>
                        <span className={`badge ${st.badge}`}><i className={st.icon} />{st.label}</span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end gap-2">
                          <button type="button" onClick={() => setDetailModal(tx)} className="btn btn-sm btn-light d-inline-flex align-items-center justify-content-center border" style={{ width: 32, height: 32, borderRadius: 8, color: '#0ea5e9' }} title="Chi tiết doanh thu">
                            <i className="feather-eye" style={{ fontSize: 13 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="card-footer bg-white border-0 pb-4 pt-2">
            <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>



      {/* Detail Modal — Styled like BookingDetailModal */}
      {detailModal && (() => {
        const tx = detailModal;
        const st = STATUS_MAP[tx.status] || STATUS_MAP.PENDING;
        const fmtTime = (dt) => {
          if (!dt) return '';
          return new Date(dt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        };
        const fmtDate = (dt) => {
          if (!dt) return '';
          const d = new Date(dt);
          const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
          return `${days[d.getDay()]}, ${d.toLocaleDateString('vi-VN')}`;
        };
        return (
          <div className="bk-modal-overlay" onClick={() => setDetailModal(null)}>
            <div className="bk-modal bk-modal--lg" style={{ maxWidth: 850, width: '95%' }} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="bk-modal-header">
                <div className="d-flex align-items-center gap-3">
                  <div className="bk-modal-icon"><i className="feather-file-text" /></div>
                  <div>
                    <h5 className="bk-modal-title mb-0">Chi tiết doanh thu</h5>
                    <p className="bk-modal-sub mb-0">Mã đặt sân: <strong>{tx.refId}</strong></p>
                  </div>
                </div>
                <button type="button" className="bk-modal-close" onClick={() => setDetailModal(null)}>
                  <i className="feather-x" />
                </button>
              </div>

              {/* Body */}
              <div className="bk-modal-body">
                <div className="row g-4">

                  {/* Left: Court + Player + Payment */}
                  <div className="col-md-6">
                    {/* Court card */}
                    <div className="bk-detail-card mb-3">
                      <div className="bk-detail-card__img-wrap">
                        <img src={tx.courtImg || '/assets/img/booking/booking-01.jpg'} alt="" className="bk-detail-card__img" onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }} />
                      </div>
                      <div className="bk-detail-card__body">
                        <div className="bk-detail-card__title">{formatCourtNames(tx.items, tx.court)}</div>
                        <div className="bk-detail-card__sub">
                          <i className="feather-map-pin" /> {tx.venue}
                        </div>
                      </div>
                    </div>

                    {/* Player card */}
                    <div className="bk-detail-card mb-3">
                      <img src={tx.playerImg || '/assets/img/profiles/avatar-01.jpg'} alt="" className="bk-detail-card__avatar rounded-circle" onError={e => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                      <div className="bk-detail-card__body">
                        <div className="bk-detail-card__title">{tx.player}</div>
                        <div className="bk-detail-card__sub">
                          <i className="feather-phone" /> {tx.playerPhone || '—'}
                        </div>
                      </div>
                    </div>

                    {/* Payment Info */}
                    <div className="bk-detail-section mt-3">
                      <h6 className="bk-detail-section-title">
                        <i className="feather-dollar-sign me-1" style={{ color: '#10b981' }} />Thanh toán
                      </h6>
                      <div className="bk-detail-row">
                        <span className="bk-detail-label">Số tiền</span>
                        <span className="bk-detail-value">
                          <strong style={{ color: '#097E52', fontSize: '18px' }}>{fmtVnd(tx.amount)}</strong>
                        </span>
                      </div>
                      <div className="bk-detail-row">
                        <span className="bk-detail-label">Hình thức</span>
                        <span className="bk-detail-value">
                          <span>
                            <i className={tx.paymentMethod === 'VNPAY' ? 'feather-credit-card' : 'feather-briefcase'} style={{ fontSize: '12px', marginRight: '4px', color: '#64748b' }} />
                            {tx.paymentMethod === 'VNPAY' ? 'Thanh toán VNPay' : tx.paymentMethod === 'BANK' ? 'Chuyển khoản' : tx.paymentMethod || '—'}
                          </span>
                        </span>
                      </div>
                      <div className="bk-detail-row">
                        <span className="bk-detail-label">Trạng thái TT</span>
                        <span className="bk-detail-value">
                          <strong style={{ color: tx.paymentStatus === 'PAID' ? '#097E52' : tx.paymentStatus === 'REFUNDED' ? '#f59e0b' : '#94a3b8' }}>
                            {tx.paymentStatus === 'PAID' ? 'Đã thanh toán' : tx.paymentStatus === 'REFUNDED' ? 'Đã hoàn tiền' : tx.paymentStatus === 'FAILED' ? 'Thất bại' : 'Chưa thanh toán'}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Payment Proof */}
                    <div className="bk-detail-section mt-3">
                      <h6 className="bk-detail-section-title">
                        <i className="feather-image me-1" />Ảnh minh chứng chuyển khoản
                      </h6>
                      {!tx.paymentProofImg || !/^https?:\/\//i.test(tx.paymentProofImg.trim()) ? (
                        <p className="mb-0 text-muted small" style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                          Môi trường dev — chưa có ảnh minh chứng thật (cần cấu hình Cloudinary trên server).
                        </p>
                      ) : (
                        <div style={{ position: 'relative', cursor: 'pointer', borderRadius: 10, overflow: 'hidden', border: '2px solid #d1fae5', background: '#f0fdf4' }}>
                          <img src={tx.paymentProofImg} alt="Minh chứng" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }} onError={e => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Schedule + Status + Refund Info */}
                  <div className="col-md-6">
                    {/* Schedule */}
                    {!tx.isLongTerm ? (
                      <div className="bk-schedule-wrapper mt-2 mb-3">
                        <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div className="d-flex align-items-center mb-3">
                            <i className="feather-calendar me-2" style={{ color: '#10b981', fontSize: '18px' }} />
                            <span className="fw-semibold" style={{ color: '#0f172a', fontSize: '14px' }}>Thông tin lịch đặt</span>
                          </div>
                          <div className="row g-2">
                            <div className="col-6">
                              <div className="d-flex align-items-center text-muted mb-1" style={{ fontSize: '12px' }}>
                                <i className="feather-calendar me-1" />Ngày chơi
                              </div>
                              <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                                {tx.date}
                              </div>
                            </div>
                            <div className="col-6">
                              <div className="d-flex align-items-center text-muted mb-1" style={{ fontSize: '12px' }}>
                                <i className="feather-clock me-1" />Giờ chơi
                              </div>
                              <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                                {tx.startTime ? `${fmtTime(tx.startTime)} – ${fmtTime(tx.endTime)}` : '—'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <LongTermScheduleDisplay items={tx.items} />
                    )}

                    {/* Status */}
                    <div className="bk-detail-section mb-3">
                      <h6 className="bk-detail-section-title">
                        <i className="feather-info me-1" style={{ color: '#3b82f6' }} />Thông tin bổ sung
                      </h6>
                      <div className="bk-detail-row">
                        <span className="bk-detail-label">Số khách</span>
                        <span className="bk-detail-value">{tx.guests || 2} người</span>
                      </div>
                      <div className="bk-detail-row">
                        <span className="bk-detail-label">Trạng thái</span>
                        <span className="bk-detail-value">
                          <span className={`badge ${st.badge}`} style={{ fontSize: 12 }}>
                            <i className={st.icon} /> {st.label}
                          </span>
                        </span>
                      </div>
                      <div className="bk-detail-row">
                        <span className="bk-detail-label">Ngày đặt</span>
                        <span className="bk-detail-value">{tx.dateIso ? new Date(tx.dateIso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
                      </div>
                    </div>

                    {/* Refund Info — chỉ hiện khi đơn REFUNDED hoặc PENDING_REFUND */}
                    {(tx.status === 'REFUNDED' || tx.status === 'PENDING_REFUND') && (
                      <div className="bk-detail-section mb-3" style={{ background: tx.status === 'REFUNDED' ? '#f0f9ff' : '#fffbeb', border: `1px solid ${tx.status === 'REFUNDED' ? '#bae6fd' : '#fcd34d'}`, borderRadius: 10, padding: '14px 16px' }}>
                        <h6 className="bk-detail-section-title" style={{ color: tx.status === 'REFUNDED' ? '#0284c7' : '#d97706' }}>
                          <i className={`feather-${tx.status === 'REFUNDED' ? 'check-circle' : 'clock'} me-1`} />
                          {tx.status === 'REFUNDED' ? 'Thông tin hoàn tiền' : 'Đang chờ hoàn tiền'}
                        </h6>
                        <div className="bk-detail-row">
                          <span className="bk-detail-label">Khách đã thanh toán</span>
                          <span className="bk-detail-value" style={{ fontWeight: 700 }}>{fmtVnd(tx.paidAmount || tx.amount)}</span>
                        </div>
                        <div className="bk-detail-row">
                          <span className="bk-detail-label">Đã hoàn lại cho khách</span>
                          <span className="bk-detail-value" style={{ fontWeight: 700, color: '#ef4444' }}>
                            – {fmtVnd(tx.refundedAmount || 0)}
                          </span>
                        </div>
                        <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />
                        <div className="bk-detail-row">
                          <span className="bk-detail-label" style={{ fontWeight: 700, color: '#0f172a' }}>Bạn giữ lại (phí phạt)</span>
                          <span className="bk-detail-value" style={{ fontWeight: 800, color: '#097E52', fontSize: 15 }}>
                            {fmtVnd(tx.penaltyAmount || 0)}
                          </span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                          * Áp dụng theo chính sách hoàn tiền đã được cấu hình cho sân.
                        </div>
                      </div>
                    )}

                    {/* Guest note */}
                    {tx.note && (
                      <div className="bk-detail-section">
                        <h6 className="bk-detail-section-title">Ghi chú của khách</h6>
                        <p className="mb-0" style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                          "{tx.note}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bk-modal-footer">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setDetailModal(null)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
