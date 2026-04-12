import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import axiosClient from '../../api/axiosClient';
import { notifyError, notifyInfo } from '../../hooks/useNotification';

const STATUS_MAP = {
  CONFIRMED: { label: 'Đã thu',         color: '#097E52', bg: '#e8f5ee', icon: 'feather-check-circle', badge: 'bg-success' },
  COMPLETED: { label: 'Đã thu',         color: '#097E52', bg: '#e8f5ee', icon: 'feather-check-circle', badge: 'bg-success' },
  PENDING:   { label: 'Chờ xử lý',      color: '#d97706', bg: '#fef3c7', icon: 'feather-clock',        badge: 'bg-warning text-dark' },
  CANCELLED: { label: 'Đã huỷ',         color: '#ef4444', bg: '#fff1f2', icon: 'feather-x-circle',     badge: 'bg-danger' },
};

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
  const [timeFilter, setTimeFilter] = useState('month');
  const [search, setSearch] = useState('');
  const [venueFilter, setVenueFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1, venues: [], totalRevInRange: 0, page: 1, pageSize: itemsPerPage });
  const [chart, setChart] = useState([]);

  const vnDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const buildRange = useCallback(() => {
    const now = new Date();
    if (timeFilter === 'week') {
      const day = now.getDay(); // 0 Sun..6 Sat
      const diffToMon = (day + 6) % 7;
      const start = new Date(now);
      start.setDate(now.getDate() - diffToMon);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { startDate: vnDateStr(start), endDate: vnDateStr(end) };
    }
    if (timeFilter === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { startDate: vnDateStr(start), endDate: vnDateStr(end) };
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: vnDateStr(start), endDate: vnDateStr(end) };
  }, [timeFilter]);

  const handleClearSearch = useCallback(() => setSearch(''), []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = buildRange();
      const params = new URLSearchParams({ page: String(page), pageSize: String(itemsPerPage) });
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search.trim()) params.append('search', search.trim());
      if (venueFilter && venueFilter !== 'ALL') params.append('venueId', venueFilter);
      params.append('startDate', startDate);
      params.append('endDate', endDate);

      const res = await axiosClient.get(`/manager/stats/earnings?${params.toString()}`);
      setData(res);

      const chartParams = new URLSearchParams({ days: '30' });
      if (venueFilter && venueFilter !== 'ALL') chartParams.append('venueId', venueFilter);
      const chartRes = await axiosClient.get(`/manager/stats/chart/daily?${chartParams.toString()}`);
      setChart(Array.isArray(chartRes) ? chartRes : []);
    } catch (e) {
      setData({ items: [], totalItems: 0, totalPages: 1, venues: [], totalRevInRange: 0, page: 1, pageSize: itemsPerPage });
      setChart([]);
      notifyError(e?.response?.data?.message || 'Oops… Không tải được báo cáo doanh thu.');
    } finally {
      setLoading(false);
    }
  }, [page, itemsPerPage, statusFilter, search, venueFilter, buildRange]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, search, timeFilter, venueFilter]);

  const totalPages = data?.totalPages ?? 1;
  const currentPage = Math.min(page, totalPages);
  const currentItems = data?.items || [];
  const totalRevenue = data?.totalRevInRange ?? 0;

  const paidCount = useMemo(
    () => currentItems.filter((x) => x.status === 'CONFIRMED' || x.status === 'COMPLETED').length,
    [currentItems],
  );
  const avgRevenue = paidCount > 0 ? Math.round(totalRevenue / paidCount) : 0;
  const unpaidAmount = useMemo(
    () => currentItems.filter((x) => x.status === 'PENDING').reduce((s, x) => s + (x.amount ?? 0), 0),
    [currentItems],
  );

  const STATS = useMemo(() => ([
    { icon: 'feather-trending-up', bg: '#e8f5ee', iconColor: '#097E52', label: 'Doanh thu (lọc hiện tại)', value: `${totalRevenue.toLocaleString('vi-VN')} ₫` },
    { icon: 'feather-calendar', bg: '#eff6ff', iconColor: '#2563eb', label: 'Số booking', value: (data?.totalItems ?? 0).toLocaleString('vi-VN') },
    { icon: 'feather-bar-chart-2', bg: '#fef3c7', iconColor: '#d97706', label: 'Trung bình / booking đã thu', value: paidCount > 0 ? `${avgRevenue.toLocaleString('vi-VN')} ₫` : '—' },
    { icon: 'feather-alert-circle', bg: '#fff1f2', iconColor: '#ef4444', label: 'Chờ xử lý (tạm tính)', value: unpaidAmount > 0 ? `${unpaidAmount.toLocaleString('vi-VN')} ₫` : '—' },
  ]), [totalRevenue, data?.totalItems, paidCount, avgRevenue, unpaidAmount]);

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
        'Tiền (VNĐ)': tx.amount ?? 0,
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
                  <p>{(data?.totalItems ?? 0).toLocaleString('vi-VN')} booking · Thu được {totalRevenue.toLocaleString('vi-VN')} ₫</p>
                </div>
              </div>
              <div className="col-md-7 d-flex justify-content-md-end mt-2 mt-md-0">
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: '#e8f5ee', color: '#097E52', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={handleExport}
                  disabled={loading || !(data?.items?.length > 0)}
                >
                  <i className="feather-download" style={{ fontSize: 14 }} /> Xuất Excel
                </button>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={{ marginTop: 14, marginBottom: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>Doanh thu 30 ngày gần nhất</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Theo giờ VN</div>
            </div>
            <div style={{ width: '100%', height: 220 }}>
              {loading ? (
                <div className="placeholder-glow">
                  <span className="placeholder col-12" style={{ height: 220 }} />
                </div>
              ) : !chart?.length ? (
                <div className="text-muted" style={{ padding: '24px 0', textAlign: 'center' }}>Chưa có dữ liệu biểu đồ.</div>
              ) : (
                <ResponsiveContainer>
                  <LineChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} width={60} />
                    <Tooltip
                      formatter={(v) => [`${Number(v || 0).toLocaleString('vi-VN')} ₫`, 'Doanh thu']}
                      labelFormatter={(l) => `Ngày ${l}`}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#097E52" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
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
            <select className="form-select" value={venueFilter} onChange={e => setVenueFilter(e.target.value)}>
              <option value="ALL">Tất cả cụm sân</option>
              {(data?.venues || []).map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="CONFIRMED">Đã thu</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="PENDING">Chờ xử lý</option>
              <option value="CANCELLED">Đã huỷ</option>
            </select>
            <span className="bk-filter-count">{(data?.totalItems ?? 0).toLocaleString('vi-VN')}</span>
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
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6}>
                        <div className="placeholder-glow">
                          <span className="placeholder col-12" style={{ height: 30 }} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : !currentItems.length ? (
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
                            <img className="avatar-img" src={'/assets/img/booking/booking-01.jpg'} alt="" onError={e => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
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
                            <img className="avatar-img rounded-circle" src={'/assets/img/profiles/avatar-01.jpg'} alt="" onError={e => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                          </span>
                          <span className="table-head-name flex-grow-1">
                            <a href="#!" onClick={e => e.preventDefault()}>{tx.player}</a>
                          </span>
                        </h2>
                      </td>
                      <td className="table-date-time">
                        <h4>{tx.date}<span>{tx.startTime ? `${fmtTime(tx.startTime)} – ${fmtTime(tx.endTime)}` : '—'}</span></h4>
                      </td>
                      <td>
                        <span className="pay-dark">{tx.amount.toLocaleString('vi-VN')} ₫</span>
                      </td>
                      <td>
                        <span className={`badge ${st.badge}`}><i className={st.icon} />{st.label}</span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end gap-2">
                          <button type="button" onClick={() => notifyInfo('Tải hoá đơn sẽ được bổ sung sớm.')} className="btn btn-sm btn-light d-inline-flex align-items-center justify-content-center border" style={{ width: 32, height: 32, borderRadius: 8, color: '#0ea5e9' }} title="Tải hoá đơn">
                            <i className="feather-download" style={{ fontSize: 13 }} />
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
