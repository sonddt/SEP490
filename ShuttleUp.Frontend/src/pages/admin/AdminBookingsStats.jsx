import { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminDashboardMenu from '../../components/admin/AdminDashboardMenu';

// ── Mock data ──────────────────────────────────────────────────────────────
const summary = [
  { label: 'Tổng đặt sân',      value: '1,024', color: 'primary', icon: 'booking-icon.svg' },
  { label: 'Đặt thành công',    value: '896',   color: 'success', icon: 'court-icon.svg'   },
  { label: 'Đang chờ xác nhận', value: '68',    color: 'warning', icon: 'request-icon.svg' },
  { label: 'Đã huỷ',            value: '60',    color: 'danger',  icon: 'invoice-icon.svg' },
];

const mockBookings = [
  { id: 'BK001', player: 'Nguyễn Văn An',   venue: 'ShuttleUp Quận 7',    court: 'Sân 1', date: '17/03/2026', time: '08:00–09:00', amount: '80.000 ₫',  status: 'Confirmed' },
  { id: 'BK002', player: 'Trần Thị B',      venue: 'ShuttleUp Bình Thạnh', court: 'Sân 2', date: '17/03/2026', time: '10:00–11:00', amount: '80.000 ₫',  status: 'Pending'   },
  { id: 'BK003', player: 'Lê Văn C',        venue: 'Cầu lông Gò Vấp',     court: 'Sân 1', date: '16/03/2026', time: '14:00–16:00', amount: '160.000 ₫', status: 'Confirmed' },
  { id: 'BK004', player: 'Phạm Thị D',      venue: 'ShuttleUp Tân Bình',  court: 'Sân 3', date: '16/03/2026', time: '16:00–18:00', amount: '200.000 ₫', status: 'Cancelled' },
  { id: 'BK005', player: 'Đặng Quốc Huy',   venue: 'ShuttleUp Quận 7',    court: 'Sân 2', date: '15/03/2026', time: '07:00–08:00', amount: '80.000 ₫',  status: 'Confirmed' },
  { id: 'BK006', player: 'Vũ Thị Mai',      venue: 'Arena Badminton',      court: 'Sân 4', date: '15/03/2026', time: '09:00–10:00', amount: '100.000 ₫', status: 'Confirmed' },
  { id: 'BK007', player: 'Hoàng Bảo Khoa',  venue: 'Cầu lông Gò Vấp',     court: 'Sân 2', date: '14/03/2026', time: '18:00–20:00', amount: '200.000 ₫', status: 'Cancelled' },
];

const statusMap = {
  Confirmed: { label: 'Xác nhận', cls: 'bg-success' },
  Pending:   { label: 'Chờ xử lý', cls: 'bg-warning text-dark' },
  Cancelled: { label: 'Đã huỷ',   cls: 'bg-danger'  },
};

export default function AdminBookingsStats() {
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDate,   setFilterDate]   = useState('');

  const filtered = mockBookings.filter((b) => {
    const matchStatus = filterStatus === 'All' || b.status === filterStatus;
    const matchDate   = !filterDate || b.date.includes(filterDate);
    return matchStatus && matchDate;
  });

  return (
    <div className="main-wrapper content-below-header">
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
                <h4 className="mb-0">Chi tiết Đặt sân ({filtered.length})</h4>
                <div className="d-flex gap-2">
                  <select
                    className="form-select"
                    style={{ width: 180 }}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
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
                    onChange={(e) => setFilterDate(e.target.value)}
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
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-4">Không có dữ liệu.</td>
                      </tr>
                    )}
                    {filtered.map((b) => (
                      <tr key={b.id}>
                        <td><code>{b.id}</code></td>
                        <td><strong>{b.player}</strong></td>
                        <td>{b.venue}</td>
                        <td>{b.court}</td>
                        <td>{b.date}</td>
                        <td>{b.time}</td>
                        <td><strong>{b.amount}</strong></td>
                        <td>
                          <span className={`badge ${statusMap[b.status].cls}`}>
                            {statusMap[b.status].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
