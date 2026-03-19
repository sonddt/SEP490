import { useState, useRef, useEffect, useCallback } from 'react';

/* ── Mock data ─────────────────────────────────────────────────────────── */
const MOCK = [
  { id: 1, refId: 'INV-001', court: 'Sân 1',  venue: 'ShuttleUp Q7',      courtImg: '/assets/img/booking/booking-01.jpg', player: 'Nguyễn Văn A', playerImg: '/assets/img/profiles/avatar-01.jpg', dateDisplay: 'Th 5, 12/03/2026', timeRange: '08:00 – 10:00', amount: 240000, paidOn: '12/03/2026', status: 'PAID' },
  { id: 2, refId: 'INV-002', court: 'Sân 2',  venue: 'ShuttleUp Q7',      courtImg: '/assets/img/booking/booking-02.jpg', player: 'Trần Thị B',   playerImg: '/assets/img/profiles/avatar-02.jpg', dateDisplay: 'Th 5, 12/03/2026', timeRange: '10:00 – 12:00', amount: 240000, paidOn: '12/03/2026', status: 'PAID' },
  { id: 3, refId: 'INV-003', court: 'Sân 1',  venue: 'ShuttleUp Q7',      courtImg: '/assets/img/booking/booking-01.jpg', player: 'Lê Văn C',     playerImg: '/assets/img/profiles/avatar-03.jpg', dateDisplay: 'Th 4, 11/03/2026', timeRange: '14:00 – 16:00', amount: 320000, paidOn: '11/03/2026', status: 'PAID' },
  { id: 4, refId: 'INV-004', court: 'Sân 3',  venue: 'ShuttleUp Q7',      courtImg: '/assets/img/booking/booking-03.jpg', player: 'Phạm Thị D',  playerImg: '/assets/img/profiles/avatar-04.jpg', dateDisplay: 'Th 4, 11/03/2026', timeRange: '16:00 – 18:00', amount: 400000, paidOn: '—',          status: 'PENDING' },
  { id: 5, refId: 'INV-005', court: 'Sân 2',  venue: 'ShuttleUp Q7',      courtImg: '/assets/img/booking/booking-02.jpg', player: 'Hoàng Văn E', playerImg: '/assets/img/profiles/avatar-01.jpg', dateDisplay: 'Th 3, 10/03/2026', timeRange: '06:00 – 08:00', amount: 240000, paidOn: '10/03/2026', status: 'PAID' },
  { id: 6, refId: 'INV-006', court: 'Sân 1',  venue: 'ShuttleUp Bình Thạnh', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Mai Thị F', playerImg: '/assets/img/profiles/avatar-02.jpg', dateDisplay: 'Th 3, 10/03/2026', timeRange: '08:00 – 10:00', amount: 280000, paidOn: '10/03/2026', status: 'PAID' },
  { id: 7, refId: 'INV-007', court: 'Sân 2',  venue: 'ShuttleUp Bình Thạnh', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Vũ Văn G',  playerImg: '/assets/img/profiles/avatar-03.jpg', dateDisplay: 'Th 2, 09/03/2026', timeRange: '10:00 – 12:00', amount: 280000, paidOn: '—',          status: 'CANCELLED' },
];

const STATUS_MAP = {
  PAID:      { label: 'Đã thanh toán', color: '#097E52', bg: '#e8f5ee', icon: 'feather-check-circle' },
  PENDING:   { label: 'Chờ thanh toán', color: '#d97706', bg: '#fef3c7', icon: 'feather-clock'       },
  CANCELLED: { label: 'Đã huỷ',         color: '#ef4444', bg: '#fff1f2', icon: 'feather-x-circle'    },
};

const STATS = [
  { icon: 'feather-trending-up',  bg: '#e8f5ee', iconColor: '#097E52', label: 'Tổng doanh thu tháng', value: '12.400.000 ₫' },
  { icon: 'feather-calendar',     bg: '#eff6ff', iconColor: '#2563eb', label: 'Số lượt đặt sân',      value: '42'           },
  { icon: 'feather-bar-chart-2',  bg: '#fef3c7', iconColor: '#d97706', label: 'Trung bình / lượt',    value: '295.000 ₫'    },
  { icon: 'feather-alert-circle', bg: '#fff1f2', iconColor: '#ef4444', label: 'Chưa thu',             value: '400.000 ₫'    },
];

/* ── 3-dot Action Dropdown ─────────────────────────────────────────────── */
function ActionMenu({ onDownload, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="earn-action-wrap" ref={ref}>
      <button
        type="button"
        className="earn-dot-btn"
        onClick={() => setOpen((v) => !v)}
        title="Tuỳ chọn"
      >
        <i className="feather-more-horizontal" />
      </button>
      {open && (
        <div className="earn-dropdown">
          <button type="button" className="earn-dropdown__item" onClick={() => { onDownload(); setOpen(false); }}>
            <i className="feather-download" />Tải hoá đơn
          </button>
          <button type="button" className="earn-dropdown__item earn-dropdown__item--danger" onClick={() => { onDelete(); setOpen(false); }}>
            <i className="feather-trash-2" />Xoá
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Status Badge ──────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.PENDING;
  return (
    <span className="bk-badge" style={{ color: s.color, background: s.bg, borderColor: s.bg }}>
      <i className={s.icon} />{s.label}
    </span>
  );
}

/* ── Desktop table row ─────────────────────────────────────────────────── */
function EarningsRow({ tx }) {
  const { refId, court, venue, courtImg, player, playerImg, dateDisplay, timeRange, amount, paidOn, status } = tx;
  return (
    <tr className="bk-row">
      <td>
        <div className="bk-cell-flex">
          <div className="bk-thumb-wrap">
            <img src={courtImg} alt="" className="bk-thumb"
              onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
          </div>
          <div className="bk-cell-text">
            <span className="bk-cell-primary">{court}</span>
            <span className="bk-cell-secondary"><i className="feather-map-pin" />{venue}</span>
            <span className="bk-cell-secondary">{refId}</span>
          </div>
        </div>
      </td>
      <td>
        <div className="bk-cell-flex">
          <img src={playerImg} alt={player} className="bk-avatar"
            onError={(e) => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
          <span className="bk-cell-primary">{player}</span>
        </div>
      </td>
      <td>
        <div className="bk-cell-text">
          <span className="bk-cell-primary"><i className="feather-calendar bk-cell-icon" />{dateDisplay}</span>
          <span className="bk-cell-secondary"><i className="feather-clock bk-cell-icon" />{timeRange}</span>
        </div>
      </td>
      <td>
        <strong className="bk-amount">{amount.toLocaleString('vi-VN')} ₫</strong>
        {paidOn !== '—' && (
          <div className="bk-cell-secondary" style={{ marginTop: 2 }}>Thu: {paidOn}</div>
        )}
      </td>
      <td><StatusBadge status={status} /></td>
      <td>
        <ActionMenu
          onDownload={() => alert(`Tải hoá đơn ${refId}`)}
          onDelete={() => alert(`Xoá ${refId}`)}
        />
      </td>
    </tr>
  );
}

/* ── Mobile card ───────────────────────────────────────────────────────── */
function EarningsCard({ tx }) {
  const { refId, court, venue, courtImg, player, playerImg, dateDisplay, timeRange, amount, status } = tx;
  const s = STATUS_MAP[status] || STATUS_MAP.PENDING;
  return (
    <div className="bk-mobile-card">
      <div className="bk-mobile-card__header">
        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img src={courtImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{court}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
              <i className="feather-map-pin" style={{ fontSize: 11 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venue}</span>
            </div>
          </div>
        </div>
        <span className="bk-badge" style={{ color: s.color, background: s.bg, borderColor: s.bg, flexShrink: 0 }}>
          <i className={s.icon} />{s.label}
        </span>
      </div>
      <div className="bk-mobile-card__body">
        <div className="bk-mobile-card__row">
          <span className="bk-mobile-card__label"><i className="feather-hash" />Mã HĐ</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>{refId}</span>
        </div>
        <div className="bk-mobile-card__row">
          <span className="bk-mobile-card__label"><i className="feather-user" />Người đặt</span>
          <div className="d-flex align-items-center gap-2">
            <img src={playerImg} alt="" className="rounded-circle"
              style={{ width: 22, height: 22, objectFit: 'cover', flexShrink: 0 }}
              onError={(e) => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>{player}</span>
          </div>
        </div>
        <div className="bk-mobile-card__row">
          <span className="bk-mobile-card__label"><i className="feather-calendar" />Thời gian</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{dateDisplay}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{timeRange}</div>
          </div>
        </div>
        <div className="bk-mobile-card__row">
          <span className="bk-mobile-card__label"><i className="feather-dollar-sign" />Thanh toán</span>
          <strong style={{ fontSize: 15, color: '#097E52' }}>{amount.toLocaleString('vi-VN')} ₫</strong>
        </div>
      </div>
      <div className="bk-mobile-card__actions">
        <button type="button" className="bk-btn bk-btn-view" style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => alert(`Tải hoá đơn ${refId}`)}>
          <i className="feather-download" /><span>Tải HĐ</span>
        </button>
        <button type="button" className="bk-btn bk-btn-reject" style={{ justifyContent: 'center', padding: '6px 12px' }}
          onClick={() => alert(`Xoá ${refId}`)}>
          <i className="feather-trash-2" />
        </button>
      </div>
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr>
      {[170, 110, 120, 80, 90].map((w, i) => (
        <td key={i}><div className="bk-skeleton" style={{ width: w, height: 15, borderRadius: 4 }} /></td>
      ))}
      <td className="text-end">
        <div className="bk-skeleton" style={{ width: 28, height: 28, borderRadius: 6, marginLeft: 'auto' }} />
      </td>
    </tr>
  );
}

/* ── Main Export ───────────────────────────────────────────────────────── */
export default function ManagerEarnings() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [timeFilter, setTimeFilter]     = useState('month');
  const [search, setSearch]             = useState('');

  const filtered = MOCK.filter((t) => {
    const ms = statusFilter === 'ALL' || t.status === statusFilter;
    const mq = t.player.toLowerCase().includes(search.toLowerCase())
            || t.court.toLowerCase().includes(search.toLowerCase())
            || t.refId.toLowerCase().includes(search.toLowerCase())
            || t.venue.toLowerCase().includes(search.toLowerCase());
    return ms && mq;
  });

  const totalRevenue = MOCK.filter((t) => t.status === 'PAID').reduce((a, b) => a + b.amount, 0);

  const handleClearSearch = useCallback(() => setSearch(''), []);

  return (
    <>

      {/* ── Stats (Bootstrap grid — matches /manager/venues pattern) ─── */}
      <div className="row g-3 mb-4">
        {STATS.map((s) => (
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

      {/* ── Table card ───────────────────────────────────────────────── */}
      <div className="card border-0 bk-table-card">

        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Lịch sử doanh thu</h4>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {filtered.length} giao dịch · Thu được {totalRevenue.toLocaleString('vi-VN')} ₫
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bk-filters-row">
          <div className="bk-search-wrap">
            <i className="feather-search bk-search-icon" />
            <input
              type="text"
              className="form-control bk-search-input"
              placeholder="Tìm theo tên, sân, mã HĐ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="bk-search-clear" onClick={handleClearSearch}>
                <i className="feather-x" />
              </button>
            )}
          </div>
          <select className="form-select" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
            <option value="year">Năm này</option>
          </select>
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="PENDING">Chờ thanh toán</option>
            <option value="CANCELLED">Đã huỷ</option>
          </select>
          <span className="bk-filter-count">{filtered.length}/{MOCK.length}</span>
        </div>

        {/* Desktop table */}
        <div className="bk-table-wrap">
            <table className="bk-table">
              <colgroup>
                <col className="bk-col-court" />
                <col className="bk-col-player" />
                <col className="bk-col-datetime" />
                <col className="bk-col-amount" />
                <col className="bk-col-status" />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Sân / Mã hoá đơn</th>
                  <th>Người đặt</th>
                  <th>Ngày &amp; Giờ</th>
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
                ) : (
                  filtered.map((tx) => <EarningsRow key={tx.id} tx={tx} />)
                )}
              </tbody>
            </table>
        </div>

        {/* Mobile cards */}
        <div className="bk-cards-wrap">
          {filtered.length === 0 ? (
            <div className="bk-empty">
              <div className="bk-empty-icon"><i className={search ? 'feather-search' : 'feather-inbox'} /></div>
              <p className="bk-empty-title">{search ? `Không tìm thấy "${search}"` : 'Không có dữ liệu'}</p>
            </div>
          ) : (
            filtered.map((tx) => <EarningsCard key={tx.id} tx={tx} />)
          )}
        </div>
      </div>
    </>
  );
}
