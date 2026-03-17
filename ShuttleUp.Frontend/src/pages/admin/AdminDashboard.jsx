import { Link } from 'react-router-dom';
import AdminDashboardMenu from '../../components/admin/AdminDashboardMenu';

// ── Mock data ──────────────────────────────────────────────────────────────
const stats = [
  { label: 'Tổng người dùng',      value: '1,248',  icon: 'profile-icon.svg',  color: 'primary' },
  { label: 'Tổng sân hoạt động',   value: '87',     icon: 'court-icon.svg',    color: 'success' },
  { label: 'Đặt sân hôm nay',      value: '34',     icon: 'booking-icon.svg',  color: 'warning' },
  { label: 'Yêu cầu chờ duyệt',   value: '5',      icon: 'request-icon.svg',  color: 'danger'  },
];

const recentUsers = [
  { id: 1, name: 'Nguyễn Văn An',    email: 'an.nv@gmail.com',    role: 'Player',  date: '17/03/2026', status: 'Active' },
  { id: 2, name: 'Trần Phúc Hùng',  email: 'hung.tp@gmail.com',  role: 'Manager', date: '16/03/2026', status: 'Active' },
  { id: 3, name: 'Lê Minh Đức',     email: 'duc.lm@gmail.com',   role: 'Player',  date: '15/03/2026', status: 'Banned' },
  { id: 4, name: 'Phạm Thị Lan',    email: 'lan.pt@gmail.com',   role: 'Player',  date: '14/03/2026', status: 'Active' },
  { id: 5, name: 'Đặng Quốc Huy',   email: 'huy.dq@gmail.com',   role: 'Manager', date: '13/03/2026', status: 'Active' },
];

const pendingRequests = [
  { id: 1, name: 'Võ Thành Long',   email: 'long.vt@gmail.com',  venue: 'ShuttleUp Bình Thạnh', date: '16/03/2026' },
  { id: 2, name: 'Ngô Sỹ Duy',     email: 'duy.ns@gmail.com',   venue: 'Cầu lông Gò Vấp',      date: '15/03/2026' },
  { id: 3, name: 'Bùi Xuân Mạnh',  email: 'manh.bx@gmail.com',  venue: 'ShuttleUp Tân Bình',   date: '14/03/2026' },
];

const roleBadge = {
  Player:  <span className="badge bg-primary">Player</span>,
  Manager: <span className="badge bg-success">Manager</span>,
  Admin:   <span className="badge bg-dark">Admin</span>,
};
const statusBadge = {
  Active: <span className="badge bg-success">Hoạt động</span>,
  Banned: <span className="badge bg-danger">Đã khoá</span>,
};

export default function AdminDashboard() {
  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Admin – Tổng quan</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Quản trị hệ thống</li>
          </ul>
        </div>
      </section>

      <AdminDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {/* ── Stats Cards ──────────────────────────────────── */}
          <div className="row mb-4">
            {stats.map((s) => (
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

          <div className="row">
            {/* ── New Users ───────────────────────────────────── */}
            <div className="col-lg-8">
              <div className="card card-tableset mb-4">
                <div className="card-body">
                  <div className="coache-head-blk d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h4 className="mb-1">Người dùng mới đăng ký</h4>
                      <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>5 tài khoản gần đây nhất</p>
                    </div>
                    <Link to="/admin/accounts" className="btn btn-sm btn-outline-secondary">
                      Xem tất cả
                    </Link>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-borderless">
                      <thead className="thead-light">
                        <tr>
                          <th>Họ tên</th>
                          <th>Email</th>
                          <th>Vai trò</th>
                          <th>Ngày đăng ký</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentUsers.map((u) => (
                          <tr key={u.id}>
                            <td><strong>{u.name}</strong></td>
                            <td className="text-muted">{u.email}</td>
                            <td>{roleBadge[u.role]}</td>
                            <td>{u.date}</td>
                            <td>{statusBadge[u.status]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Pending Manager Requests ─────────────────────── */}
            <div className="col-lg-4">
              <div className="card mb-4">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">Yêu cầu duyệt chủ sân</h5>
                    <Link to="/admin/manager-requests" className="btn btn-sm btn-outline-secondary">Xem tất cả</Link>
                  </div>
                  {pendingRequests.map((r) => (
                    <div key={r.id} className="d-flex align-items-start border-bottom pb-2 mb-2">
                      <div className="rounded-circle bg-warning bg-opacity-10 p-2 me-2 flex-shrink-0">
                        <img src="/assets/img/icons/request-icon.svg" alt="" style={{ width: 20 }} />
                      </div>
                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <p className="mb-0 fw-semibold" style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
                        <p className="text-muted mb-0" style={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.venue}</p>
                        <p className="text-muted mb-0" style={{ fontSize: '0.75rem' }}>{r.date}</p>
                      </div>
                      <span className="badge bg-warning text-dark ms-1 flex-shrink-0">Chờ duyệt</span>
                    </div>
                  ))}
                  <Link to="/admin/manager-requests" className="btn btn-secondary btn-sm w-100 mt-2">
                    Xem & Duyệt yêu cầu
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

        </div>
      </div>
    </div>
  );
}
