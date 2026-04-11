import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { normalizeSearchText } from '../../utils/searchNormalize';

/* ── Mock data ─────────────────────────────────────────────────────────── */
const MOCK = [
  { id: 1, refId: 'INV-001', court: 'Sân 1', venue: 'ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Nguyễn Văn A', playerImg: '/assets/img/profiles/avatar-01.jpg', dateDisplay: 'Th 5, 12/03/2026', timeRange: '08:00 – 10:00', amount: 240000, paidOn: '12/03/2026', status: 'PAID' },
  { id: 2, refId: 'INV-002', court: 'Sân 2', venue: 'ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Trần Thị B', playerImg: '/assets/img/profiles/avatar-02.jpg', dateDisplay: 'Th 5, 12/03/2026', timeRange: '10:00 – 12:00', amount: 240000, paidOn: '12/03/2026', status: 'PAID' },
  { id: 3, refId: 'INV-003', court: 'Sân 1', venue: 'ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Lê Văn C', playerImg: '/assets/img/profiles/avatar-03.jpg', dateDisplay: 'Th 4, 11/03/2026', timeRange: '14:00 – 16:00', amount: 320000, paidOn: '11/03/2026', status: 'PAID' },
  { id: 4, refId: 'INV-004', court: 'Sân 3', venue: 'ShuttleUp Q7', courtImg: '/assets/img/booking/booking-03.jpg', player: 'Phạm Thị D', playerImg: '/assets/img/profiles/avatar-04.jpg', dateDisplay: 'Th 4, 11/03/2026', timeRange: '16:00 – 18:00', amount: 400000, paidOn: '—', status: 'PENDING' },
  { id: 5, refId: 'INV-005', court: 'Sân 2', venue: 'ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Hoàng Văn E', playerImg: '/assets/img/profiles/avatar-01.jpg', dateDisplay: 'Th 3, 10/03/2026', timeRange: '06:00 – 08:00', amount: 240000, paidOn: '10/03/2026', status: 'PAID' },
  { id: 6, refId: 'INV-006', court: 'Sân 1', venue: 'ShuttleUp Bình Thạnh', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Mai Thị F', playerImg: '/assets/img/profiles/avatar-02.jpg', dateDisplay: 'Th 3, 10/03/2026', timeRange: '08:00 – 10:00', amount: 280000, paidOn: '10/03/2026', status: 'PAID' },
  { id: 7, refId: 'INV-007', court: 'Sân 2', venue: 'ShuttleUp Bình Thạnh', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Vũ Văn G', playerImg: '/assets/img/profiles/avatar-03.jpg', dateDisplay: 'Th 2, 09/03/2026', timeRange: '10:00 – 12:00', amount: 280000, paidOn: '—', status: 'CANCELLED' },
];

const STATUS_MAP = {
  PAID:      { label: 'Đã thanh toán', color: '#097E52', bg: '#e8f5ee', icon: 'feather-check-circle', badge: 'bg-success' },
  PENDING:   { label: 'Chờ thanh toán', color: '#d97706', bg: '#fef3c7', icon: 'feather-clock',       badge: 'bg-warning' },
  CANCELLED: { label: 'Đã huỷ',         color: '#ef4444', bg: '#fff1f2', icon: 'feather-x-circle',    badge: 'bg-danger' },
};

const STATS = [
  { icon: 'feather-trending-up', bg: '#e8f5ee', iconColor: '#097E52', label: 'Tổng doanh thu tháng', value: '12.400.000 ₫' },
  { icon: 'feather-calendar',    bg: '#eff6ff', iconColor: '#2563eb', label: 'Số lượt đặt sân',      value: '42' },
  { icon: 'feather-bar-chart-2', bg: '#fef3c7', iconColor: '#d97706', label: 'Trung bình / lượt',    value: '295.000 ₫' },
  { icon: 'feather-alert-circle',bg: '#fff1f2', iconColor: '#ef4444', label: 'Chưa thu',             value: '400.000 ₫' },
];

// Pagination Component
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className="d-flex align-items-center justify-content-center gap-2 mt-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="mgr-btn-lift"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px',
          border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13,
          fontWeight: 600, color: page <= 1 ? '#cbd5e1' : '#334155',
          cursor: page <= 1 ? 'default' : 'pointer', transition: 'all .15s',
        }}
      >
        <i className="feather-chevron-left" style={{ fontSize: 15 }} /> Trước
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className="mgr-btn-lift"
          style={{
            width: 38, height: 38, borderRadius: 8, border: 'none',
            background: page === p ? 'var(--mgr-accent)' : '#f1f5f9',
            color: page === p ? '#fff' : '#334155',
            fontWeight: page === p ? 800 : 500, fontSize: 14,
            cursor: 'pointer', transition: 'all .15s',
            boxShadow: page === p ? '0 2px 8px rgba(9,126,82,.35)' : 'none',
          }}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="mgr-btn-lift"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px',
          border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13,
          fontWeight: 600, color: page >= totalPages ? '#cbd5e1' : '#334155',
          cursor: page >= totalPages ? 'default' : 'pointer', transition: 'all .15s',
        }}
      >
        Sau <i className="feather-chevron-right" style={{ fontSize: 15 }} />
      </button>
    </div>
  );
}

/* ═══ MAIN ═══════════════════════════════════════════════════════════════ */
export default function ManagerEarnings() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [timeFilter, setTimeFilter]     = useState('month');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const itemsPerPage = 8;

  const filtered = useMemo(() => {
    const nq = normalizeSearchText(search);
    return MOCK.filter((t) => {
      const ms = statusFilter === 'ALL' || t.status === statusFilter;
      if (!nq) return ms;
      const mq =
        normalizeSearchText(t.player).includes(nq) ||
        normalizeSearchText(t.court).includes(nq) ||
        normalizeSearchText(t.refId).includes(nq) ||
        normalizeSearchText(t.venue).includes(nq);
      return ms && mq;
    });
  }, [statusFilter, search]);

  const totalRevenue = MOCK.filter(t => t.status === 'PAID').reduce((a, b) => a + b.amount, 0);
  const handleClearSearch = useCallback(() => setSearch(''), []);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const currentItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setPage(1); }, [statusFilter, search, timeFilter]);

  return (
    <>
      {/* Stats */}
      <div className="row g-3 mb-4">
        {STATS.map(s => (
          <div key={s.label} className="col-xl-3 col-sm-6">
            <div className="mgr-stat-card">
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

      {/* Table card */}
      <div className="card card-tableset border-0">
        <div className="card-body">
          {/* Header */}
          <div className="coache-head-blk" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div className="row align-items-center">
              <div className="col-md-5">
                <div className="court-table-head">
                  <h4>Lịch sử doanh thu</h4>
                  <p>{filtered.length} giao dịch · Thu được {totalRevenue.toLocaleString('vi-VN')} ₫</p>
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
                placeholder="Tìm theo tên, sân, mã HĐ..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
              {search && <button type="button" className="bk-search-clear" onClick={handleClearSearch}><i className="feather-x" /></button>}
            </div>
            <select className="form-select" value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
              <option value="year">Năm này</option>
            </select>
            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="PENDING">Chờ thanh toán</option>
              <option value="CANCELLED">Đã huỷ</option>
            </select>
            <span className="bk-filter-count">{filtered.length}/{MOCK.length}</span>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Sân / Mã HĐ</th>
                  <th>Người đặt</th>
                  <th>Ngày & Giờ</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
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
                        <h2 className="table-avatar">
                          <span className="avatar avatar-sm flex-shrink-0">
                            <img className="avatar-img" src={tx.courtImg} alt="" onError={e => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
                          </span>
                          <span className="table-head-name flex-grow-1">
                            <a href="#!" onClick={e => e.preventDefault()}>{tx.court}</a>
                            <span><i className="feather-map-pin" style={{ fontSize: 11, marginRight: 3 }} />{tx.venue}</span>
                            <span style={{ color: '#2563eb', fontWeight: 600 }}>{tx.refId}</span>
                          </span>
                        </h2>
                      </td>
                      <td>
                        <h2 className="table-avatar">
                          <span className="avatar avatar-sm flex-shrink-0" style={{ borderRadius: '50%' }}>
                            <img className="avatar-img rounded-circle" src={tx.playerImg} alt="" onError={e => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                          </span>
                          <span className="table-head-name flex-grow-1">
                            <a href="#!" onClick={e => e.preventDefault()}>{tx.player}</a>
                          </span>
                        </h2>
                      </td>
                      <td className="table-date-time">
                        <h4>{tx.dateDisplay}<span>{tx.timeRange}</span></h4>
                      </td>
                      <td>
                        <span className="pay-dark">{tx.amount.toLocaleString('vi-VN')} ₫</span>
                        {tx.paidOn !== '—' && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Thu: {tx.paidOn}</div>}
                      </td>
                      <td>
                        <span className={`badge ${st.badge}`}><i className={st.icon} />{st.label}</span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end gap-2">
                          <button type="button" onClick={() => alert(`Tải hoá đơn ${tx.refId}`)} className="btn btn-sm btn-light d-inline-flex align-items-center justify-content-center border" style={{ width: 32, height: 32, borderRadius: 8, color: '#0ea5e9' }} title="Tải hoá đơn">
                            <i className="feather-download" style={{ fontSize: 13 }} />
                          </button>
                          <button type="button" onClick={() => alert(`Xoá ${tx.refId}`)} className="btn btn-sm btn-light d-inline-flex align-items-center justify-content-center border" style={{ width: 32, height: 32, borderRadius: 8, color: '#ef4444' }} title="Xóa">
                            <i className="feather-trash-2" style={{ fontSize: 13 }} />
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
    </>
  );
}
