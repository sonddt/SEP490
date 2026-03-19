import { useState } from 'react';
import { Link } from 'react-router-dom';
import ManagerDashboardMenu from '../../components/manager/ManagerDashboardMenu';

const INITIAL_REQUESTS = [
  { id: 1, court: 'Sân 1 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Nguyễn Văn A', playerImg: '/assets/img/profiles/avatar-01.jpg', date: '17/03/2026', time: '08:00 – 10:00', guests: 2, amount: 240000, status: 'PENDING' },
  { id: 2, court: 'Sân 2 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Trần Thị B', playerImg: '/assets/img/profiles/avatar-02.jpg', date: '17/03/2026', time: '14:00 – 16:00', guests: 4, amount: 480000, status: 'PENDING' },
  { id: 3, court: 'Sân 1 – Bình Thạnh', courtImg: '/assets/img/booking/booking-03.jpg', player: 'Lê Văn C', playerImg: '/assets/img/profiles/avatar-03.jpg', date: '18/03/2026', time: '18:00 – 20:00', guests: 2, amount: 300000, status: 'PENDING' },
  { id: 4, court: 'Sân 3 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Phạm Thị D', playerImg: '/assets/img/profiles/avatar-04.jpg', date: '16/03/2026', time: '06:00 – 08:00', guests: 1, amount: 120000, status: 'ACCEPTED' },
  { id: 5, court: 'Sân 2 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Hoàng Văn E', playerImg: '/assets/img/profiles/avatar-01.jpg', date: '15/03/2026', time: '10:00 – 12:00', guests: 2, amount: 240000, status: 'REJECTED' },
];

const statusBadge = {
  PENDING:  <span className="badge bg-warning text-dark">Chờ duyệt</span>,
  ACCEPTED: <span className="badge bg-success">Đã chấp nhận</span>,
  REJECTED: <span className="badge bg-danger">Đã từ chối</span>,
};

export default function ManagerRequests() {
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [filterTab, setFilterTab] = useState('PENDING');
  const [timeFilter, setTimeFilter] = useState('week');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detailModal, setDetailModal] = useState(null);

  const filtered = requests.filter((r) => r.status === filterTab);

  const handleAccept = (id) => {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'ACCEPTED' } : r));
  };

  const handleReject = () => {
    if (!rejectModal) return;
    setRequests((prev) => prev.map((r) => r.id === rejectModal.id ? { ...r, status: 'REJECTED', rejectReason } : r));
    setRejectModal(null);
    setRejectReason('');
  };

  const tabs = [
    { key: 'PENDING', label: 'Chờ duyệt', color: 'warning' },
    { key: 'ACCEPTED', label: 'Đã chấp nhận', color: 'success' },
    { key: 'REJECTED', label: 'Đã từ chối', color: 'danger' },
  ];

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Yêu cầu đặt sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/manager/dashboard">Quản lý sân</Link></li>
            <li>Yêu cầu</li>
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
                          {tabs.map((t) => (
                            <li key={t.key}>
                              <a
                                href="#"
                                className={filterTab === t.key ? 'active' : ''}
                                onClick={(e) => { e.preventDefault(); setFilterTab(t.key); }}
                              >
                                {t.label}
                                <span className={`badge bg-${t.color} ms-2`}>
                                  {requests.filter((r) => r.status === t.key).length}
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
                            <h4>Danh sách yêu cầu</h4>
                            <p>Xét duyệt các yêu cầu đặt sân từ người chơi</p>
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
                            <th>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 && (
                            <tr><td colSpan={8} className="text-center text-muted py-4">Không có yêu cầu nào</td></tr>
                          )}
                          {filtered.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <h2 className="table-avatar">
                                  <span className="avatar avatar-sm flex-shrink-0">
                                    <img className="avatar-img" src={r.courtImg} alt="" />
                                  </span>
                                  <span className="table-head-name flex-grow-1 ms-2"><span>{r.court}</span></span>
                                </h2>
                              </td>
                              <td>
                                <h2 className="table-avatar">
                                  <span className="avatar avatar-sm flex-shrink-0">
                                    <img className="avatar-img rounded-circle" src={r.playerImg} alt="" />
                                  </span>
                                  <span className="ms-2">{r.player}</span>
                                </h2>
                              </td>
                              <td>{r.date}</td>
                              <td>{r.time}</td>
                              <td>{r.guests}</td>
                              <td><strong>{r.amount.toLocaleString('vi-VN')} ₫</strong></td>
                              <td>{statusBadge[r.status]}</td>
                              <td>
                                <div className="d-flex gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => setDetailModal(r)}
                                  >
                                    <i className="feather-eye" />
                                  </button>
                                  {r.status === 'PENDING' && (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-success"
                                        onClick={() => handleAccept(r.id)}
                                      >
                                        <i className="feather-check me-1" />Duyệt
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        onClick={() => setRejectModal(r)}
                                      >
                                        <i className="feather-x me-1" />Từ chối
                                      </button>
                                    </>
                                  )}
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

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setRejectModal(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Từ chối yêu cầu</h5>
                <button type="button" className="btn-close" onClick={() => setRejectModal(null)} />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-3">
                  Từ chối yêu cầu đặt sân <strong>{rejectModal.court}</strong> của <strong>{rejectModal.player}</strong>
                </p>
                <label className="form-label">Lý do từ chối <span className="text-danger">*</span></label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Nhập lý do từ chối..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Huỷ</button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!rejectReason.trim()}
                  onClick={handleReject}
                >
                  Xác nhận từ chối
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDetailModal(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Chi tiết yêu cầu</h5>
                <button type="button" className="btn-close" onClick={() => setDetailModal(null)} />
              </div>
              <div className="modal-body">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <img src={detailModal.courtImg} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                  <div>
                    <h6 className="mb-1">{detailModal.court}</h6>
                    <small className="text-muted">{detailModal.date} | {detailModal.time}</small>
                  </div>
                </div>
                <hr />
                <div className="row g-3">
                  <div className="col-6">
                    <small className="text-muted d-block">Người đặt</small>
                    <div className="d-flex align-items-center gap-2 mt-1">
                      <img src={detailModal.playerImg} alt="" className="rounded-circle" style={{ width: 28, height: 28, objectFit: 'cover' }} />
                      <strong>{detailModal.player}</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Số khách</small>
                    <strong>{detailModal.guests} người</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Thanh toán</small>
                    <strong className="text-success">{detailModal.amount.toLocaleString('vi-VN')} ₫</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Trạng thái</small>
                    {statusBadge[detailModal.status]}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDetailModal(null)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
