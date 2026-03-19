import { useState } from 'react';
import { Link } from 'react-router-dom';
import ManagerDashboardMenu from '../../components/manager/ManagerDashboardMenu';

const MOCK_BOOKINGS = [
  { id: 1, court: 'Sân 1 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Nguyễn Văn A', playerImg: '/assets/img/profiles/avatar-01.jpg', date: '15/03/2026', time: '08:00 – 10:00', guests: 2, amount: 240000, status: 'UPCOMING' },
  { id: 2, court: 'Sân 2 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Trần Thị B', playerImg: '/assets/img/profiles/avatar-02.jpg', date: '15/03/2026', time: '10:00 – 12:00', guests: 3, amount: 360000, status: 'UPCOMING' },
  { id: 3, court: 'Sân 1 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Lê Văn C', playerImg: '/assets/img/profiles/avatar-03.jpg', date: '12/03/2026', time: '14:00 – 16:00', guests: 1, amount: 120000, status: 'COMPLETED' },
  { id: 4, court: 'Sân 3 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-03.jpg', player: 'Phạm Thị D', playerImg: '/assets/img/profiles/avatar-04.jpg', date: '11/03/2026', time: '16:00 – 18:00', guests: 4, amount: 480000, status: 'CANCELLED' },
  { id: 5, court: 'Sân 2 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Hoàng Văn E', playerImg: '/assets/img/profiles/avatar-01.jpg', date: '14/03/2026', time: '06:00 – 08:00', guests: 2, amount: 240000, status: 'COMPLETED' },
  { id: 6, court: 'Sân 1 – Bình Thạnh', courtImg: '/assets/img/booking/booking-04.jpg', player: 'Võ Minh F', playerImg: '/assets/img/profiles/avatar-02.jpg', date: '16/03/2026', time: '18:00 – 20:00', guests: 2, amount: 300000, status: 'UPCOMING' },
];

const TABS = [
  { key: 'UPCOMING', label: 'Sắp tới', color: 'primary' },
  { key: 'COMPLETED', label: 'Hoàn thành', color: 'success' },
  { key: 'CANCELLED', label: 'Đã huỷ', color: 'danger' },
];

const statusBadge = {
  UPCOMING:  <span className="badge bg-primary">Sắp tới</span>,
  COMPLETED: <span className="badge bg-success">Hoàn thành</span>,
  CANCELLED: <span className="badge bg-danger">Đã huỷ</span>,
};

export default function ManagerBookings() {
  const [activeTab, setActiveTab] = useState('UPCOMING');
  const [timeFilter, setTimeFilter] = useState('week');
  const [sortBy, setSortBy] = useState('newest');
  const [detailBooking, setDetailBooking] = useState(null);

  const filtered = MOCK_BOOKINGS.filter((b) => b.status === activeTab);

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Lịch đặt sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/manager/dashboard">Quản lý sân</Link></li>
            <li>Lịch đặt sân</li>
          </ul>
        </div>
      </section>

      <ManagerDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {/* Filter bar */}
          <div className="row">
            <div className="col-lg-12">
              <div className="sortby-section court-sortby-section">
                <div className="sorting-info">
                  <div className="row d-flex align-items-center">
                    <div className="col-xl-6 col-lg-6 col-sm-12 col-12">
                      <div className="coach-court-list">
                        <ul className="nav">
                          {TABS.map((t) => (
                            <li key={t.key}>
                              <a
                                href="#"
                                className={activeTab === t.key ? 'active' : ''}
                                onClick={(e) => { e.preventDefault(); setActiveTab(t.key); }}
                              >
                                {t.label}
                                <span className={`badge bg-${t.color} ms-2`}>
                                  {MOCK_BOOKINGS.filter((b) => b.status === t.key).length}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="col-xl-6 col-lg-6 col-sm-12 col-12">
                      <div className="sortby-filter-group court-sortby">
                        <div className="sortbyset week-bg">
                          <div className="sorting-select">
                            <select className="form-control select" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                              <option value="week">Tuần này</option>
                              <option value="month">Tháng này</option>
                              <option value="all">Tất cả</option>
                            </select>
                          </div>
                        </div>
                        <div className="sortbyset">
                          <span className="sortbytitle">Sắp xếp</span>
                          <div className="sorting-select">
                            <select className="form-control select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                              <option value="newest">Mới nhất</option>
                              <option value="oldest">Cũ nhất</option>
                              <option value="amount">Theo giá</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="row">
            <div className="col-sm-12">
              <div className="court-tab-content">
                <div className="card card-tableset">
                  <div className="card-body">
                    <div className="coache-head-blk">
                      <div className="row align-items-center">
                        <div className="col-md-6">
                          <div className="court-table-head">
                            <h4>Danh sách đặt sân</h4>
                            <p>Quản lý các lịch đặt sân của bạn</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-borderless datatable">
                        <thead className="thead-light">
                          <tr>
                            <th>Sân</th>
                            <th>Người đặt</th>
                            <th>Ngày</th>
                            <th>Giờ</th>
                            <th>Khách</th>
                            <th>Thanh toán</th>
                            <th>Trạng thái</th>
                            <th>Chi tiết</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 && (
                            <tr><td colSpan={9} className="text-center text-muted py-4">Không có dữ liệu</td></tr>
                          )}
                          {filtered.map((b) => (
                            <tr key={b.id}>
                              <td>
                                <h2 className="table-avatar">
                                  <span className="avatar avatar-sm flex-shrink-0">
                                    <img className="avatar-img" src={b.courtImg} alt="" />
                                  </span>
                                  <span className="table-head-name flex-grow-1 ms-2">
                                    <span>{b.court}</span>
                                  </span>
                                </h2>
                              </td>
                              <td>
                                <h2 className="table-avatar">
                                  <span className="avatar avatar-sm flex-shrink-0">
                                    <img className="avatar-img rounded-circle" src={b.playerImg} alt="" />
                                  </span>
                                  <span className="ms-2">{b.player}</span>
                                </h2>
                              </td>
                              <td>{b.date}</td>
                              <td>{b.time}</td>
                              <td>{b.guests}</td>
                              <td><strong>{b.amount.toLocaleString('vi-VN')} ₫</strong></td>
                              <td>{statusBadge[b.status]}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => setDetailBooking(b)}
                                >
                                  <i className="feather-eye me-1" />Xem
                                </button>
                              </td>
                              <td className="text-end">
                                <div className="dropdown dropdown-action table-drop-action">
                                  <button type="button" className="action-icon dropdown-toggle" data-bs-toggle="dropdown">
                                    <i className="fas fa-ellipsis-h" />
                                  </button>
                                  <ul className="dropdown-menu dropdown-menu-end">
                                    <li><button type="button" className="dropdown-item"><i className="feather-message-square me-2" />Nhắn tin</button></li>
                                    {b.status === 'UPCOMING' && (
                                      <li><button type="button" className="dropdown-item text-danger"><i className="feather-x-circle me-2" />Huỷ lịch</button></li>
                                    )}
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
        </div>
      </div>

      {/* Detail Modal */}
      {detailBooking && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDetailBooking(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Chi tiết đặt sân</h5>
                <button type="button" className="btn-close" onClick={() => setDetailBooking(null)} />
              </div>
              <div className="modal-body">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <img src={detailBooking.courtImg} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                  <div>
                    <h6 className="mb-1">{detailBooking.court}</h6>
                    <small className="text-muted">{detailBooking.date} | {detailBooking.time}</small>
                  </div>
                </div>
                <hr />
                <div className="row g-3">
                  <div className="col-6">
                    <small className="text-muted d-block">Người đặt</small>
                    <strong>{detailBooking.player}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Số khách</small>
                    <strong>{detailBooking.guests} người</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Thanh toán</small>
                    <strong className="text-success">{detailBooking.amount.toLocaleString('vi-VN')} ₫</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Trạng thái</small>
                    {statusBadge[detailBooking.status]}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDetailBooking(null)}>Đóng</button>
                <button type="button" className="btn btn-secondary"><i className="feather-message-square me-2" />Nhắn tin</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
