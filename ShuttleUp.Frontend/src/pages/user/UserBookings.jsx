import { useState } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';

const MOCK_BOOKINGS = [
  {
    id: 1,
    code: 'SU291045',
    court: 'Sân 1 – ShuttleUp Q7',
    courtImg: '/assets/img/booking/booking-01.jpg',
    venueAddress: '88 Quang Trung, Q.Gò Vấp, TP.HCM',
    date: '15/03/2026',
    time: '08:00 – 10:00',
    amount: 240000,
    paymentMethod: 'Chuyển khoản',
    status: 'UPCOMING',
  },
  {
    id: 2,
    code: 'SU291102',
    court: 'Sân 2 – ShuttleUp Q7',
    courtImg: '/assets/img/booking/booking-02.jpg',
    venueAddress: '88 Quang Trung, Q.Gò Vấp, TP.HCM',
    date: '20/03/2026',
    time: '10:00 – 12:00',
    amount: 360000,
    paymentMethod: 'Quét mã QR',
    status: 'UPCOMING',
  },
  {
    id: 3,
    code: 'SU281887',
    court: 'Sân 1 – ShuttleUp Bình Thạnh',
    courtImg: '/assets/img/booking/booking-03.jpg',
    venueAddress: '45 Đinh Tiên Hoàng, Q.Bình Thạnh, TP.HCM',
    date: '12/03/2026',
    time: '14:00 – 16:00',
    amount: 300000,
    paymentMethod: 'Chuyển khoản',
    status: 'COMPLETED',
  },
  {
    id: 4,
    code: 'SU271234',
    court: 'Sân 3 – ShuttleUp Q7',
    courtImg: '/assets/img/booking/booking-04.jpg',
    venueAddress: '88 Quang Trung, Q.Gò Vấp, TP.HCM',
    date: '10/03/2026',
    time: '16:00 – 18:00',
    amount: 480000,
    paymentMethod: 'Chuyển khoản',
    status: 'COMPLETED',
  },
  {
    id: 5,
    code: 'SU260999',
    court: 'Sân 2 – ShuttleUp Bình Thạnh',
    courtImg: '/assets/img/booking/booking-02.jpg',
    venueAddress: '45 Đinh Tiên Hoàng, Q.Bình Thạnh, TP.HCM',
    date: '08/03/2026',
    time: '06:00 – 08:00',
    amount: 240000,
    paymentMethod: 'Quét mã QR',
    status: 'CANCELLED',
  },
];

const TABS = [
  { key: 'UPCOMING',  label: 'Sắp tới',    color: 'primary' },
  { key: 'COMPLETED', label: 'Hoàn thành', color: 'success' },
  { key: 'CANCELLED', label: 'Đã huỷ',     color: 'danger'  },
];

const STATUS_BADGE = {
  UPCOMING:  <span className="badge bg-primary">Sắp tới</span>,
  COMPLETED: <span className="badge bg-success">Hoàn thành</span>,
  CANCELLED: <span className="badge bg-danger">Đã huỷ</span>,
};

export default function UserBookings() {
  const [activeTab,     setActiveTab]     = useState('UPCOMING');
  const [timeFilter,    setTimeFilter]    = useState('all');
  const [sortBy,        setSortBy]        = useState('newest');
  const [detailBooking, setDetailBooking] = useState(null);
  const [cancelTarget,  setCancelTarget]  = useState(null);
  const [bookings,      setBookings]      = useState(MOCK_BOOKINGS);

  const filtered = bookings
    .filter(b => b.status === activeTab)
    .sort((a, b) => {
      if (sortBy === 'newest') return b.id - a.id;
      if (sortBy === 'oldest') return a.id - b.id;
      if (sortBy === 'amount') return b.amount - a.amount;
      return 0;
    });

  const confirmCancel = () => {
    if (!cancelTarget) return;
    setBookings(prev =>
      prev.map(b => b.id === cancelTarget.id ? { ...b, status: 'CANCELLED' } : b)
    );
    setCancelTarget(null);
    setActiveTab('CANCELLED');
  };

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Lịch sử đặt sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Lịch sử đặt sân</li>
          </ul>
        </div>
      </section>

      <UserDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          {/* ── Filter bar ──────────────────────────────────────────────── */}
          <div className="row">
            <div className="col-lg-12">
              <div className="sortby-section court-sortby-section">
                <div className="sorting-info">
                  <div className="row d-flex align-items-center">
                    <div className="col-xl-6 col-lg-6 col-sm-12 col-12">
                      <div className="coach-court-list">
                        <ul className="nav">
                          {TABS.map(t => (
                            <li key={t.key}>
                              <a
                                href="#"
                                className={activeTab === t.key ? 'active' : ''}
                                onClick={e => { e.preventDefault(); setActiveTab(t.key); }}
                              >
                                {t.label}
                                <span className={`badge bg-${t.color} ms-2`}>
                                  {bookings.filter(b => b.status === t.key).length}
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
                            <select
                              className="form-control select"
                              value={timeFilter}
                              onChange={e => setTimeFilter(e.target.value)}
                            >
                              <option value="week">Tuần này</option>
                              <option value="month">Tháng này</option>
                              <option value="all">Tất cả</option>
                            </select>
                          </div>
                        </div>
                        <div className="sortbyset">
                          <span className="sortbytitle">Sắp xếp</span>
                          <div className="sorting-select">
                            <select
                              className="form-control select"
                              value={sortBy}
                              onChange={e => setSortBy(e.target.value)}
                            >
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

          {/* ── Table ───────────────────────────────────────────────────── */}
          <div className="row">
            <div className="col-sm-12">
              <div className="court-tab-content">
                <div className="card card-tableset">
                  <div className="card-body">
                    <div className="coache-head-blk">
                      <div className="row align-items-center">
                        <div className="col-md-6">
                          <div className="court-table-head">
                            <h4>Lịch sử đặt sân của tôi</h4>
                            <p>Xem và quản lý các lịch đặt sân của bạn</p>
                          </div>
                        </div>
                        <div className="col-md-6 text-end">
                          <Link to="/courts" className="btn btn-secondary btn-sm">
                            <i className="feather-plus me-1" />Đặt sân mới
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-borderless datatable">
                        <thead className="thead-light">
                          <tr>
                            <th>Sân</th>
                            <th>Mã đặt</th>
                            <th>Ngày</th>
                            <th>Giờ</th>
                            <th>Thanh toán</th>
                            <th>P.thức</th>
                            <th>Trạng thái</th>
                            <th>Chi tiết</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan={9} className="text-center text-muted py-5">
                                <i className="feather-calendar" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.4 }} />
                                Không có lịch đặt sân nào
                              </td>
                            </tr>
                          )}
                          {filtered.map(b => (
                            <tr key={b.id}>
                              {/* Court */}
                              <td>
                                <h2 className="table-avatar">
                                  <span className="avatar avatar-sm flex-shrink-0">
                                    <img className="avatar-img" src={b.courtImg} alt=""
                                      onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }} />
                                  </span>
                                  <span className="table-head-name flex-grow-1 ms-2">
                                    <span>{b.court}</span>
                                    <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>
                                      <i className="feather-map-pin me-1" />{b.venueAddress}
                                    </small>
                                  </span>
                                </h2>
                              </td>
                              {/* Code */}
                              <td>
                                <span className="badge"
                                  style={{ background: '#f0fdf4', color: 'var(--primary-color)', border: '1px solid #6ee7b7', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  #{b.code}
                                </span>
                              </td>
                              <td>{b.date}</td>
                              <td>{b.time}</td>
                              <td><strong>{b.amount.toLocaleString('vi-VN')} ₫</strong></td>
                              <td>
                                <span className="text-muted small">
                                  <i className={`${b.paymentMethod === 'Quét mã QR' ? 'feather-smartphone' : 'feather-credit-card'} me-1`} />
                                  {b.paymentMethod}
                                </span>
                              </td>
                              <td>{STATUS_BADGE[b.status]}</td>
                              {/* Detail btn */}
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => setDetailBooking(b)}
                                >
                                  <i className="feather-eye me-1" />Xem
                                </button>
                              </td>
                              {/* Actions */}
                              <td className="text-end">
                                <div className="dropdown dropdown-action table-drop-action">
                                  <button type="button" className="action-icon dropdown-toggle" data-bs-toggle="dropdown">
                                    <i className="fas fa-ellipsis-h" />
                                  </button>
                                  <ul className="dropdown-menu dropdown-menu-end">
                                    <li>
                                      <button type="button" className="dropdown-item"
                                        onClick={() => setDetailBooking(b)}>
                                        <i className="feather-eye me-2" />Xem chi tiết
                                      </button>
                                    </li>
                                    {b.status === 'UPCOMING' && (
                                      <li>
                                        <button
                                          type="button"
                                          className="dropdown-item text-danger"
                                          onClick={() => setCancelTarget(b)}
                                        >
                                          <i className="feather-x-circle me-2" />Huỷ lịch
                                        </button>
                                      </li>
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

      {/* ── Detail Modal ───────────────────────────────────────────────── */}
      {detailBooking && (
        <div
          className="modal fade show d-block"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDetailBooking(null)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Chi tiết đặt sân</h5>
                <button type="button" className="btn-close" onClick={() => setDetailBooking(null)} />
              </div>
              <div className="modal-body">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <img
                    src={detailBooking.courtImg}
                    alt=""
                    style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }}
                    onError={e => { e.target.src = '/assets/img/venues/venues-01.jpg'; }}
                  />
                  <div>
                    <h6 className="mb-1">{detailBooking.court}</h6>
                    <small className="text-muted">
                      <i className="feather-map-pin me-1" />{detailBooking.venueAddress}
                    </small>
                  </div>
                </div>
                <hr />
                <div className="row g-3">
                  <div className="col-6">
                    <small className="text-muted d-block">Mã đặt sân</small>
                    <strong style={{ fontFamily: 'monospace' }}>#{detailBooking.code}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Trạng thái</small>
                    {STATUS_BADGE[detailBooking.status]}
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Ngày</small>
                    <strong>{detailBooking.date}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Khung giờ</small>
                    <strong>{detailBooking.time}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Tổng tiền</small>
                    <strong className="text-success">{detailBooking.amount.toLocaleString('vi-VN')} ₫</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Phương thức</small>
                    <strong>{detailBooking.paymentMethod}</strong>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                {detailBooking.status === 'UPCOMING' && (
                  <button
                    type="button"
                    className="btn btn-outline-danger me-auto"
                    onClick={() => { setDetailBooking(null); setCancelTarget(detailBooking); }}
                  >
                    <i className="feather-x-circle me-1" />Huỷ lịch
                  </button>
                )}
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDetailBooking(null)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirm Modal ────────────────────────────────────────── */}
      {cancelTarget && (
        <div
          className="modal fade show d-block"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setCancelTarget(null)}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-content text-center p-4">
              <div style={{ fontSize: 44, marginBottom: 8 }}>⚠️</div>
              <h5 className="mb-2">Xác nhận huỷ lịch?</h5>
              <p className="text-muted small mb-4">
                Bạn có chắc muốn huỷ lịch đặt sân <strong>{cancelTarget.court}</strong> ngày{' '}
                <strong>{cancelTarget.date}</strong>, {cancelTarget.time}?
                <br />Hành động này không thể hoàn tác.
              </p>
              <div className="d-flex gap-2 justify-content-center">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setCancelTarget(null)}
                >
                  Giữ lại
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={confirmCancel}
                >
                  Huỷ lịch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
