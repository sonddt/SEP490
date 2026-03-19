import { Link } from 'react-router-dom';

/* ── Mock data ─────────────────────────────────────────────────────────── */
const stats = [
  { label: 'Tổng cụm sân',       value: '3',             icon: 'feather-map-pin',     color: '#0d7c5f', bg: '#e8f5ee' },
  { label: 'Đặt sân hôm nay',    value: '8',             icon: 'feather-calendar',    color: '#2563eb', bg: '#eff6ff' },
  { label: 'Doanh thu tháng này', value: '12.400.000 ₫', icon: 'feather-trending-up', color: '#d97706', bg: '#fffbeb' },
  { label: 'Chờ phê duyệt',      value: '1',             icon: 'feather-clock',       color: '#ef4444', bg: '#fef2f2' },
];

const recentBookings = [
  { id: 1, player: 'Nguyễn Văn A', playerImg: '/assets/img/profiles/avatar-01.jpg', court: 'Sân 1 – ShuttleUp Quận 7', date: '12/03/2026', time: '08:00 – 10:00', amount: 120000, status: 'CONFIRMED' },
  { id: 2, player: 'Trần Thị B',   playerImg: '/assets/img/profiles/avatar-02.jpg', court: 'Sân 2 – ShuttleUp Quận 7', date: '12/03/2026', time: '10:00 – 12:00', amount: 120000, status: 'PENDING' },
  { id: 3, player: 'Lê Văn C',     playerImg: '/assets/img/profiles/avatar-03.jpg', court: 'Sân 1 – ShuttleUp Quận 7', date: '13/03/2026', time: '14:00 – 16:00', amount: 160000, status: 'CONFIRMED' },
  { id: 4, player: 'Phạm Thị D',   playerImg: '/assets/img/profiles/avatar-04.jpg', court: 'Sân 3 – ShuttleUp Quận 7', date: '13/03/2026', time: '16:00 – 18:00', amount: 200000, status: 'CANCELLED' },
];

const STATUS_MAP = {
  CONFIRMED: { label: 'Xác nhận',  badge: 'bg-success', icon: 'feather-check-circle' },
  PENDING:   { label: 'Chờ xử lý', badge: 'bg-warning', icon: 'feather-clock' },
  CANCELLED: { label: 'Đã huỷ',    badge: 'bg-danger',  icon: 'feather-x-circle' },
};

export default function ManagerDashboard() {
  return (
    <>
      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        {stats.map(s => (
          <div key={s.label} className="col-xl-3 col-sm-6">
            <div className="mgr-stat-card">
              <div className="mgr-stat-card__icon" style={{ background: s.bg }}>
                <i className={s.icon} style={{ color: s.color }} />
              </div>
              <div>
                <div className="mgr-stat-card__label">{s.label}</div>
                <div className="mgr-stat-card__value" style={{ color: s.color }}>{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        {/* Recent Bookings */}
        <div className="col-lg-8">
          <div className="card card-tableset border-0 h-100">
            <div className="card-body">
              <div className="coache-head-blk" style={{ borderBottom: 'none' }}>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="court-table-head">
                    <h4>Đặt sân gần đây</h4>
                    <p>Các lịch đặt sân mới nhất</p>
                  </div>
                  <Link to="/manager/bookings" className="btn btn-sm btn-outline-secondary">
                    Xem tất cả
                  </Link>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Người chơi</th>
                      <th>Sân</th>
                      <th>Ngày</th>
                      <th>Tiền</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map(b => {
                      const st = STATUS_MAP[b.status] || STATUS_MAP.PENDING;
                      return (
                        <tr key={b.id}>
                          <td>
                            <h2 className="table-avatar">
                              <span className="avatar avatar-sm flex-shrink-0" style={{ borderRadius: '50%' }}>
                                <img className="avatar-img rounded-circle" src={b.playerImg} alt="" onError={e => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                              </span>
                              <span className="table-head-name flex-grow-1">
                                <a href="#!" onClick={e => e.preventDefault()}>{b.player}</a>
                              </span>
                            </h2>
                          </td>
                          <td>
                            <span style={{ fontSize: 14, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200 }}>
                              {b.court}
                            </span>
                          </td>
                          <td className="table-date-time">
                            <h4>{b.date}<span><i className="feather-clock" style={{ fontSize: 11, marginRight: 3 }} />{b.time}</span></h4>
                          </td>
                          <td>
                            <span className="pay-dark">{b.amount.toLocaleString('vi-VN')} ₫</span>
                          </td>
                          <td>
                            <span className={`badge ${st.badge}`}><i className={st.icon} />{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-lg-4">
          <div className="card card-tableset border-0">
            <div className="card-body" style={{ padding: '20px' }}>
              <div className="court-table-head" style={{ marginBottom: 16 }}>
                <h4>Thao tác nhanh</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link to="/manager/venues/add" className="btn btn-secondary d-inline-flex align-items-center justify-content-center">
                  <i className="feather-plus-circle me-2" /> Thêm cụm sân mới
                </Link>
                <Link to="/manager/venues" className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center">
                  <i className="feather-map-pin me-2" /> Quản lý cụm sân
                </Link>
                <Link to="/manager/earnings" className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center">
                  <i className="feather-bar-chart-2 me-2" /> Báo cáo doanh thu
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
