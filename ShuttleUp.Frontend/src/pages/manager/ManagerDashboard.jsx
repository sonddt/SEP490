import { Link } from 'react-router-dom';
import ManagerDashboardMenu from '../../components/manager/ManagerDashboardMenu';

// Mock data — sẽ thay bằng API call sau
const stats = [
  { label: 'Tổng sân đã đăng ký', value: '3', icon: 'court-icon.svg', color: 'primary' },
  { label: 'Đặt sân hôm nay', value: '8', icon: 'booking-icon.svg', color: 'success' },
  { label: 'Doanh thu tháng này', value: '12.400.000 ₫', icon: 'invoice-icon.svg', color: 'warning' },
  { label: 'Chờ phê duyệt', value: '1', icon: 'request-icon.svg', color: 'danger' },
];

const recentBookings = [
  { id: 1, player: 'Nguyễn Văn A', court: 'Sân 1 – ShuttleUp Quận 7', date: '12/03/2026', time: '08:00 – 10:00', amount: '120.000 ₫', status: 'CONFIRMED' },
  { id: 2, player: 'Trần Thị B', court: 'Sân 2 – ShuttleUp Quận 7', date: '12/03/2026', time: '10:00 – 12:00', amount: '120.000 ₫', status: 'PENDING' },
  { id: 3, player: 'Lê Văn C', court: 'Sân 1 – ShuttleUp Quận 7', date: '13/03/2026', time: '14:00 – 16:00', amount: '160.000 ₫', status: 'CONFIRMED' },
  { id: 4, player: 'Phạm Thị D', court: 'Sân 3 – ShuttleUp Quận 7', date: '13/03/2026', time: '16:00 – 18:00', amount: '200.000 ₫', status: 'CANCELLED' },
];

const statusBadge = {
  CONFIRMED: <span className="badge bg-success">Xác nhận</span>,
  PENDING:   <span className="badge bg-warning text-dark">Chờ xử lý</span>,
  CANCELLED: <span className="badge bg-danger">Đã huỷ</span>,
};

export default function ManagerDashboard() {
  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Tổng quan</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Quản lý sân</li>
          </ul>
        </div>
      </section>

      <ManagerDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {/* ── Stats Cards ─────────────────────────────────── */}
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
            {/* ── Recent Bookings ─────────────────────────────── */}
            <div className="col-lg-8">
              <div className="card card-tableset mb-4">
                <div className="card-body">
                  <div className="coache-head-blk d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h4 className="mb-1">Đặt sân gần đây</h4>
                      <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>Các lịch đặt sân mới nhất</p>
                    </div>
                    <Link to="/manager/bookings" className="btn btn-sm btn-outline-secondary">
                      Xem tất cả
                    </Link>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-borderless">
                      <thead className="thead-light">
                        <tr>
                          <th>Người chơi</th>
                          <th>Sân</th>
                          <th>Ngày</th>
                          <th>Giờ</th>
                          <th>Tiền</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.map((b) => (
                          <tr key={b.id}>
                            <td>{b.player}</td>
                            <td style={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.court}</td>
                            <td>{b.date}</td>
                            <td>{b.time}</td>
                            <td><strong>{b.amount}</strong></td>
                            <td>{statusBadge[b.status]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right column ────────────────────────────────── */}
            <div className="col-lg-4">
              {/* Wallet summary */}
              <div className="card mb-4">
                <div className="card-body">
                  <h5 className="mb-3">Ví của tôi</h5>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Số dư hiện tại</span>
                    <strong>4.544.000 ₫</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Thu tháng này</span>
                    <strong className="text-success">+12.400.000 ₫</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-3">
                    <span className="text-muted">Chi phí</span>
                    <strong className="text-danger">-500.000 ₫</strong>
                  </div>
                  <Link to="/manager/wallet" className="btn btn-secondary btn-sm w-100">
                    Xem ví chi tiết
                  </Link>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card">
                <div className="card-body">
                  <h5 className="mb-3">Thao tác nhanh</h5>
                  <div className="d-grid gap-2">
                    <Link to="/manager/courts/add" className="btn btn-secondary d-inline-flex align-items-center justify-content-center">
                      <i className="feather-plus-circle me-2"></i> Thêm sân mới
                    </Link>
                    <Link to="/manager/availability" className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center">
                      <i className="feather-clock me-2"></i> Cài đặt giờ hoạt động
                    </Link>
                    <Link to="/manager/earnings" className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center">
                      <i className="feather-bar-chart-2 me-2"></i> Xem doanh thu
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
