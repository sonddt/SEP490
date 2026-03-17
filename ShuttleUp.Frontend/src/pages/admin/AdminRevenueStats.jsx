import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminDashboardMenu from '../../components/admin/AdminDashboardMenu';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5079';

export default function AdminRevenueStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/stats/revenue`, {
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
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const revenueSummary = [
    { label: 'Tổng doanh thu',        value: data?.summary?.totalRevenue || '0 ₫', color: 'primary', icon: 'invoice-icon.svg' },
    { label: 'Doanh thu tháng này',   value: data?.summary?.monthRevenue || '0 ₫',  color: 'success', icon: 'invoice-icon.svg' },
    { label: 'Doanh thu hôm nay',     value: data?.summary?.todayRevenue || '0 ₫',   color: 'warning', icon: 'invoice-icon.svg' },
    { label: 'Số sân đang hoạt động', value: data?.summary?.activeVenues?.toString() || '0', color: 'info', icon: 'court-icon.svg' },
  ];
  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Thống kê Doanh thu</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/admin/dashboard">Quản trị</Link></li>
            <li>Thống kê Doanh thu</li>
          </ul>
        </div>
      </section>

      <AdminDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {/* ── Revenue Summary Cards ─────────────────────── */}
          <div className="row mb-4">
            {revenueSummary.map((s) => (
              <div key={s.label} className="col-xl-3 col-sm-6 col-12 d-flex">
                <div className="card w-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>{s.label}</p>
                        <h5 className={`mb-0 text-${s.color}`}>{s.value}</h5>
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

          {/* ── Revenue by Venue Table ────────────────────── */}
          <div className="card card-tableset">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <h4 className="mb-1">Doanh thu theo Sân</h4>
                  <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>Tổng hợp doanh thu của từng địa điểm</p>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-borderless align-middle">
                  <thead className="thead-light">
                    <tr>
                      <th>#</th>
                      <th>Tên Sân</th>
                      <th>Chủ sân</th>
                      <th>Tổng đặt sân</th>
                      <th>Doanh thu</th>
                      <th>Tăng trưởng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan="6">
                            <div className="placeholder-glow">
                              <span className="placeholder col-12" style={{ height: '30px' }}></span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : !data?.venuesData || data.venuesData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">Không có dữ liệu.</td>
                      </tr>
                    ) : (data.venuesData.map((v, idx) => (
                      <tr key={v.id}>
                        <td className="text-muted">{idx + 1}</td>
                        <td><strong>{v.venue}</strong></td>
                        <td>{v.owner}</td>
                        <td>{v.totalBookings.toLocaleString()} lượt</td>
                        <td><strong className="text-success">{v.revenue.toLocaleString()} ₫</strong></td>
                        <td>
                          <span className={`badge ${v.growth.startsWith('+') ? 'bg-success' : 'bg-secondary'}`}>
                            {v.growth}
                          </span>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                  {!loading && data?.venuesData && data.venuesData.length > 0 && (
                    <tfoot>
                      <tr className="table-light fw-bold">
                        <td colSpan={3}>Tổng cộng</td>
                        <td>{data.venuesData.reduce((a, v) => a + v.totalBookings, 0).toLocaleString()} lượt</td>
                        <td className="text-success">{data.summary?.totalRevenue}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
