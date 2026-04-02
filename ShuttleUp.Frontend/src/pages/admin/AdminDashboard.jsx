import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

function roleBadge(roles = []) {
  if (roles.includes('ADMIN'))   return <span className="badge bg-dark">Admin</span>;
  if (roles.includes('MANAGER')) return <span className="badge bg-success">Manager</span>;
  return <span className="badge bg-primary">Player</span>;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN');
}

const STAT_CONFIG = [
  { key: 'totalUsers',      label: 'Tổng người dùng',    icon: 'feather-users',       theme: 'indigo' },
  { key: 'activeVenues',    label: 'Tổng sân hoạt động', icon: 'feather-map-pin',     theme: 'green'  },
  { key: 'todayBookings',   label: 'Đặt sân hôm nay',    icon: 'feather-calendar',    theme: 'amber'  },
  { key: 'pendingRequests', label: 'Yêu cầu chờ duyệt', icon: 'feather-alert-circle', theme: 'red'    },
];

export default function AdminDashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await axiosClient.get('/admin/dashboard');
      setData(data);
    } catch (e) {
      setError(e.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      {/* Error banner */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center mb-3">
          <i className="feather-alert-circle me-2"></i>
          Không thể tải dữ liệu: {error}
          <button className="btn btn-sm btn-outline-danger ms-auto" onClick={load}>Thử lại</button>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20, marginBottom: 28 }}>
        {loading
          ? [0,1,2,3].map(i => (
              <div key={i} className="adm-stat-card">
                <div style={{ width: 56, height: 56, borderRadius: 14, background: '#f1f5f9' }} />
                <div style={{ flex: 1 }}>
                  <div className="placeholder-glow"><span className="placeholder col-8 mb-2"></span><br/><span className="placeholder col-5"></span></div>
                </div>
              </div>
            ))
          : STAT_CONFIG.map((s) => (
              <div key={s.key} className={`adm-stat-card adm-stat-card--${s.theme}`}>
                <div className="adm-stat-card__icon">
                  <i className={s.icon} />
                </div>
                <div>
                  <div className="adm-stat-card__label">{s.label}</div>
                  <div className="adm-stat-card__value">{(data?.[s.key] ?? 0).toLocaleString()}</div>
                </div>
              </div>
            ))
        }
      </div>

      <div className="row">
        {/* Recent Users */}
        <div className="col-lg-8">
          <div className="card card-tableset mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="mb-1">Người dùng mới đăng ký</h4>
                  <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>5 tài khoản gần đây nhất</p>
                </div>
                <Link to="/admin/accounts" className="btn btn-sm btn-outline-secondary">Xem tất cả</Link>
              </div>
              <div className="table-responsive">
                <table className="table table-borderless">
                  <thead className="thead-light">
                    <tr>
                      <th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Ngày đăng ký</th><th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? [0,1,2,3,4].map(i => (
                          <tr key={i}><td colSpan={5}><span className="placeholder-glow"><span className="placeholder col-12"></span></span></td></tr>
                        ))
                      : (data?.recentUsers || []).map((u) => (
                          <tr key={u.id}>
                            <td><strong>{u.fullName}</strong></td>
                            <td className="text-muted">{u.email}</td>
                            <td>{roleBadge(u.roles)}</td>
                            <td>{fmtDate(u.createdAt)}</td>
                            <td>
                              {u.isActive
                                ? <span className="badge bg-success">Hoạt động</span>
                                : <span className="badge bg-danger">Đã khoá</span>}
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Venue Requests */}
        <div className="col-lg-4">
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Yêu cầu duyệt chủ sân</h5>
                <Link to="/admin/manager-requests" className="btn btn-sm btn-outline-secondary">Xem tất cả</Link>
              </div>
              {loading
                ? <div className="placeholder-glow"><span className="placeholder col-12 mb-2"></span><span className="placeholder col-8"></span></div>
                : (data?.pendingVenues || []).length === 0
                  ? <p className="text-muted text-center py-2">Không có yêu cầu chờ duyệt.</p>
                  : (data.pendingVenues).map((r) => (
                      <div key={r.id} className="d-flex align-items-start border-bottom pb-2 mb-2">
                        <div className="rounded-circle bg-warning bg-opacity-10 p-2 me-2 flex-shrink-0">
                          <i className="feather-user-check" style={{ fontSize: 16, color: '#d97706' }} />
                        </div>
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <p className="mb-0 fw-semibold" style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.ownerName}</p>
                          <p className="text-muted mb-0" style={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
                          <p className="text-muted mb-0" style={{ fontSize: '0.75rem' }}>{fmtDate(r.createdAt)}</p>
                        </div>
                        <span className="badge bg-warning text-dark ms-1 flex-shrink-0">Chờ duyệt</span>
                      </div>
                    ))
              }
              <Link to="/admin/manager-requests" className="btn btn-secondary btn-sm w-100 mt-2">
                Xem &amp; Duyệt yêu cầu
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-body">
              <h5 className="mb-3">Truy cập nhanh</h5>
              <div className="d-grid gap-2">
                <Link to="/admin/accounts" className="btn btn-secondary d-inline-flex align-items-center justify-content-center">
                  <i className="feather-users me-2"></i> Quản lý Tài khoản
                </Link>
                <Link to="/admin/bookings-stats" className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center">
                  <i className="feather-bar-chart-2 me-2"></i> Thống kê Đặt sân
                </Link>
                <Link to="/admin/revenue-stats" className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center">
                  <i className="feather-dollar-sign me-2"></i> Thống kê Doanh thu
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
