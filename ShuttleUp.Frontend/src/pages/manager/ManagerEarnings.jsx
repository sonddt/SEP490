import { useState } from 'react';
import { Link } from 'react-router-dom';
import ManagerDashboardMenu from '../../components/manager/ManagerDashboardMenu';

// Mock data – thay bằng API call sau
const mockTransactions = [
  { id: 1, refId: 'INV-001', court: 'Sân 1 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Nguyễn Văn A', playerImg: '/assets/img/profiles/user-01.jpg', dateTime: '12/03/2026 08:00 – 10:00', amount: 240000, guests: 2, paidOn: '12/03/2026', status: 'COMPLETED' },
  { id: 2, refId: 'INV-002', court: 'Sân 2 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Trần Thị B', playerImg: '/assets/img/profiles/user-02.jpg', dateTime: '12/03/2026 10:00 – 12:00', amount: 240000, guests: 3, paidOn: '12/03/2026', status: 'COMPLETED' },
  { id: 3, refId: 'INV-003', court: 'Sân 1 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Lê Văn C', playerImg: '/assets/img/profiles/user-03.jpg', dateTime: '11/03/2026 14:00 – 16:00', amount: 320000, guests: 1, paidOn: '11/03/2026', status: 'COMPLETED' },
  { id: 4, refId: 'INV-004', court: 'Sân 3 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-03.jpg', player: 'Phạm Thị D', playerImg: '/assets/img/profiles/user-04.jpg', dateTime: '11/03/2026 16:00 – 18:00', amount: 400000, guests: 4, paidOn: '—', status: 'PENDING' },
  { id: 5, refId: 'INV-005', court: 'Sân 2 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Hoàng Văn E', playerImg: '/assets/img/profiles/user-01.jpg', dateTime: '10/03/2026 06:00 – 08:00', amount: 240000, guests: 2, paidOn: '10/03/2026', status: 'COMPLETED' },
];

const statusBadge = {
  COMPLETED: <span className="badge bg-success">Đã thanh toán</span>,
  PENDING:   <span className="badge bg-warning text-dark">Chờ thanh toán</span>,
  CANCELLED: <span className="badge bg-danger">Đã huỷ</span>,
};

const summaryStats = [
  { label: 'Tổng doanh thu tháng', value: '12.400.000 ₫', color: 'success' },
  { label: 'Số lượt đặt sân', value: '42', color: 'primary' },
  { label: 'Trung bình/lượt', value: '295.000 ₫', color: 'info' },
  { label: 'Chưa thu', value: '400.000 ₫', color: 'warning' },
];

export default function ManagerEarnings() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('week');
  const [search, setSearch] = useState('');

  const filtered = mockTransactions.filter((t) => {
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchSearch = t.player.toLowerCase().includes(search.toLowerCase())
      || t.court.toLowerCase().includes(search.toLowerCase())
      || t.refId.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Doanh thu</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/manager/dashboard">Quản lý sân</Link></li>
            <li>Doanh thu</li>
          </ul>
        </div>
      </section>

      <ManagerDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {/* ── Summary stats ─────────────────────────────── */}
          <div className="row mb-4">
            {summaryStats.map((s) => (
              <div key={s.label} className="col-xl-3 col-sm-6 col-12 d-flex">
                <div className="card w-100">
                  <div className="card-body">
                    <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>{s.label}</p>
                    <h5 className={`mb-0 text-${s.color}`}>{s.value}</h5>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Filters ───────────────────────────────────── */}
          <div className="card card-tableset">
            <div className="card-body">
              <div className="coache-head-blk mb-3">
                <div className="row align-items-center">
                  <div className="col-md-6">
                    <h4 className="mb-1">Lịch sử doanh thu</h4>
                    <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>Danh sách các lượt đặt sân đã hoàn thành</p>
                  </div>
                  <div className="col-md-6 d-flex gap-2 justify-content-md-end mt-2 mt-md-0 flex-wrap">
                    <select
                      className="form-control form-control-sm" style={{ width: 'auto' }}
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                    >
                      <option value="week">Tuần này</option>
                      <option value="month">Tháng này</option>
                      <option value="year">Năm này</option>
                    </select>
                    <select
                      className="form-control form-control-sm" style={{ width: 'auto' }}
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="COMPLETED">Đã thanh toán</option>
                      <option value="PENDING">Chờ thanh toán</option>
                      <option value="CANCELLED">Đã huỷ</option>
                    </select>
                    <input
                      type="text" className="form-control form-control-sm" style={{ width: 180 }}
                      placeholder="Tìm kiếm..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* ── Table ─────────────────────────────────── */}
              <div className="table-responsive">
                <table className="table table-borderless datatable">
                  <thead className="thead-light">
                    <tr>
                      <th>Mã hoá đơn</th>
                      <th>Sân</th>
                      <th>Người đặt</th>
                      <th>Ngày & Giờ</th>
                      <th>Thanh toán</th>
                      <th>Khách thêm</th>
                      <th>Ngày thu tiền</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center text-muted py-4">Không có dữ liệu</td>
                      </tr>
                    )}
                    {filtered.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <span className="text-primary fw-semibold">{t.refId}</span>
                        </td>
                        <td>
                          <h2 className="table-avatar">
                            <Link to="/venue-details" className="avatar avatar-sm flex-shrink-0">
                              <img className="avatar-img" src={t.courtImg} alt="" />
                            </Link>
                            <span className="table-head-name flex-grow-1 ms-2">
                              <Link to="/venue-details">{t.court}</Link>
                            </span>
                          </h2>
                        </td>
                        <td>
                          <h2 className="table-avatar">
                            <span className="avatar avatar-sm flex-shrink-0">
                              <img className="avatar-img rounded-circle" src={t.playerImg} alt="" />
                            </span>
                            <span className="ms-2">{t.player}</span>
                          </h2>
                        </td>
                        <td>{t.dateTime}</td>
                        <td><strong>{t.amount.toLocaleString('vi-VN')} ₫</strong></td>
                        <td>{t.guests}</td>
                        <td>{t.paidOn}</td>
                        <td>{statusBadge[t.status]}</td>
                        <td className="text-end">
                          <div className="dropdown dropdown-action table-drop-action">
                            <button type="button" className="action-icon dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                              <i className="fas fa-ellipsis-h"></i>
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end">
                              <li>
                                <button type="button" className="dropdown-item">
                                  <i className="feather-download me-2"></i>Tải hoá đơn
                                </button>
                              </li>
                              <li>
                                <button type="button" className="dropdown-item text-danger">
                                  <i className="feather-trash-2 me-2"></i>Xoá
                                </button>
                              </li>
                            </ul>
                          </div>
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
