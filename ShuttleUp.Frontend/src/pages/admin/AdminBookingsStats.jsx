import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminDashboardMenu from '../../components/admin/AdminDashboardMenu';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5079';

const statusMap = {
  Confirmed: { label: 'Xác nhận', cls: 'bg-success' },
  Pending:   { label: 'Chờ xử lý', cls: 'bg-warning text-dark' },
  Cancelled: { label: 'Đã huỷ',   cls: 'bg-danger'  },
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
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10'
      });
      if (filterStatus && filterStatus !== 'All') params.append('status', filterStatus);
      if (filterDate) params.append('date', filterDate);

      const res = await fetch(`${API}/api/admin/stats/bookings?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const result = await res.json();
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

  const summary = [
    { label: 'Tổng đặt sân',      value: data?.summary?.total?.toLocaleString() || '0', color: 'primary', icon: 'booking-icon.svg' },
    { label: 'Đặt thành công',    value: data?.summary?.confirmed?.toLocaleString() || '0',   color: 'success', icon: 'court-icon.svg'   },
    { label: 'Đang chờ xác nhận', value: data?.summary?.pending?.toLocaleString() || '0',    color: 'warning', icon: 'request-icon.svg' },
    { label: 'Đã huỷ',            value: data?.summary?.cancelled?.toLocaleString() || '0',    color: 'danger',  icon: 'invoice-icon.svg' },
  ];

  return (
    <div className="main-wrapper">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Thống kê Đặt sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/admin/dashboard">Quản trị</Link></li>
            <li>Thống kê Đặt sân</li>
          </ul>
        </div>
      </section>

      <AdminDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {error && (
            <div className="alert alert-danger d-flex justify-content-between align-items-center">
              <span><i className="feather-alert-triangle me-2"></i>Không thể tải dữ liệu: {error}</span>
              <button className="btn btn-sm btn-outline-danger" onClick={fetchStats}>Thử lại</button>
            </div>
          )}

          {/* ── Summary Cards ─────────────────────────────── */}
          <div className="row mb-4">
            {summary.map((s) => (
              <div key={s.label} className="col-xl-3 col-sm-6 col-12 d-flex">
                <div className="card w-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>{s.label}</p>
                        <h4 className={`mb-0 text-${s.color}`}>{s.value}</h4>
                      </div>
                      <div className={`rounded-circle bg-${s.color} bg-opacity-10 p-2`}>
                        <img src={`/assets/img/icons/${s.icon}`} alt="" style={{ width: 28 }} />
                      </div>
                    </div>
                  </div>
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
                        <td><strong>{b.player}</strong></td>
                        <td>{b.venue}</td>
                        <td>{b.court}</td>
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
        </div>
      </div>
    </div>
  );
}
