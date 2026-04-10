import { useState, useEffect, useCallback } from 'react';

import axiosClient from '../../api/axiosClient';

const statusMap = {
  Confirmed: { label: 'Xác nhận', cls: 'bg-success' },
  Pending:   { label: 'Chờ xử lý', cls: 'bg-warning text-dark' },
  Cancelled: { label: 'Đã huỷ',   cls: 'bg-danger'  },
  CONFIRMED: { label: 'Xác nhận', cls: 'bg-success' },
  PENDING:   { label: 'Chờ xử lý', cls: 'bg-warning text-dark' },
  CANCELLED: { label: 'Đã huỷ',   cls: 'bg-danger'  },
};

export default function AdminBookingsStats() {
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDate,   setFilterDate]   = useState('');
  
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10'
      });
      if (filterStatus && filterStatus !== 'All') params.append('status', filterStatus);
      if (filterDate) params.append('date', filterDate);

      const result = await axiosClient.get(`/admin/stats/bookings?${params}`);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const STAT_CONFIG = [
    { key: 'total',     label: 'Tổng đặt sân',      icon: 'feather-calendar',     theme: 'indigo' },
    { key: 'confirmed', label: 'Đặt thành công',    icon: 'feather-check-circle', theme: 'green'  },
    { key: 'pending',   label: 'Đang chờ xác nhận', icon: 'feather-clock',        theme: 'amber'  },
    { key: 'cancelled', label: 'Đã huỷ',            icon: 'feather-x-circle',     theme: 'red'    },
  ];

  return (
    <>
      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span><i className="feather-alert-triangle me-2"></i>Không thể tải dữ liệu: {error}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={fetchStats}>Thử lại</button>
        </div>
      )}

      {/* ── Summary Cards ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
        {STAT_CONFIG.map((s) => (
          <div key={s.key} className={`adm-stat-card adm-stat-card--${s.theme}`}>
            <div className="adm-stat-card__icon">
              <i className={s.icon} />
            </div>
            <div>
              <div className="adm-stat-card__label">{s.label}</div>
              <div className="adm-stat-card__value">{(data?.summary?.[s.key] ?? 0).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Detail Table ───────────────────────────────── */}
      <div className="card card-tableset">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
            <h4 className="mb-0">Chi tiết Đặt sân {data && `(${data.totalItems})`}</h4>
            <div className="d-flex gap-2">
              <select
                className="form-select"
                style={{ width: 180 }}
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              >
                <option value="All">Tất cả trạng thái</option>
                <option value="Confirmed">Xác nhận</option>
                <option value="Pending">Chờ xử lý</option>
                <option value="Cancelled">Đã huỷ</option>
              </select>
              <input
                type="text"
                className="form-control"
                style={{ width: 150 }}
                placeholder="Lọc theo ngày (dd/mm)"
                value={filterDate}
                onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
              />
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-borderless align-middle">
              <thead className="thead-light">
                <tr>
                  <th>Mã đặt</th>
                  <th>Người chơi</th>
                  <th>Sân</th>
                  <th>Số sân</th>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th>Tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan="8">
                        <div className="placeholder-glow">
                          <span className="placeholder col-12" style={{ height: '30px' }}></span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : !data || !data.items || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">Không có dữ liệu.</td>
                  </tr>
                ) : (data.items.map((b) => (
                  <tr key={b.id}>
                    <td><code>{b.id}</code></td>
                    <td title={b.player} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>{b.player}</strong>
                    </td>
                    <td title={b.venue} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.venue}
                    </td>
                    <td title={b.court} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.court}
                    </td>
                    <td>{b.date}</td>
                    <td>{b.time}</td>
                    <td><strong>{b.amount}</strong></td>
                    <td>
                      <span className={`badge ${statusMap[b.status]?.cls || 'bg-secondary'}`}>
                        {statusMap[b.status]?.label || b.status}
                      </span>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

           {/* Pagination */}
           {!loading && data && data.items && data.items.length > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                Trang {page} / {data.totalPages}
              </span>
              <div className="btn-group">
                <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <i className="feather-chevron-left"></i> Trước
                </button>
                <button className="btn btn-sm btn-outline-secondary" disabled={page === data.totalPages} onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}>
                  Sau <i className="feather-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
