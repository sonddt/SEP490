import { useState } from 'react';

const INITIAL_BOOKINGS = [
  { id: 1, court: 'Sân 1 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Nguyễn Văn A', playerImg: '/assets/img/profiles/avatar-01.jpg', date: '17/03/2026', time: '08:00 – 10:00', guests: 2, amount: 240000, status: 'PENDING' },
  { id: 2, court: 'Sân 2 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Trần Thị B', playerImg: '/assets/img/profiles/avatar-02.jpg', date: '17/03/2026', time: '14:00 – 16:00', guests: 4, amount: 480000, status: 'PENDING' },
  { id: 3, court: 'Sân 1 – Bình Thạnh', courtImg: '/assets/img/booking/booking-03.jpg', player: 'Lê Văn C', playerImg: '/assets/img/profiles/avatar-03.jpg', date: '18/03/2026', time: '18:00 – 20:00', guests: 2, amount: 300000, status: 'PENDING' },
  { id: 4, court: 'Sân 3 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Phạm Thị D', playerImg: '/assets/img/profiles/avatar-04.jpg', date: '15/03/2026', time: '08:00 – 10:00', guests: 2, amount: 240000, status: 'UPCOMING' },
  { id: 5, court: 'Sân 2 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-02.jpg', player: 'Hoàng Văn E', playerImg: '/assets/img/profiles/avatar-01.jpg', date: '14/03/2026', time: '06:00 – 08:00', guests: 2, amount: 240000, status: 'COMPLETED' },
  { id: 6, court: 'Sân 1 – Bình Thạnh', courtImg: '/assets/img/booking/booking-04.jpg', player: 'Võ Minh F', playerImg: '/assets/img/profiles/avatar-02.jpg', date: '16/03/2026', time: '18:00 – 20:00', guests: 2, amount: 300000, status: 'UPCOMING' },
  { id: 7, court: 'Sân 1 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-01.jpg', player: 'Đỗ Văn G', playerImg: '/assets/img/profiles/avatar-03.jpg', date: '12/03/2026', time: '10:00 – 12:00', guests: 1, amount: 120000, status: 'REJECTED', rejectReason: 'Sân đang bảo trì' },
  { id: 8, court: 'Sân 3 – ShuttleUp Q7', courtImg: '/assets/img/booking/booking-03.jpg', player: 'Lê Thị H', playerImg: '/assets/img/profiles/avatar-04.jpg', date: '11/03/2026', time: '16:00 – 18:00', guests: 4, amount: 480000, status: 'CANCELLED' },
];

const TABS = [
  { key: 'PENDING',   label: 'Chờ duyệt',   color: 'warning', icon: 'feather-clock' },
  { key: 'UPCOMING',  label: 'Sắp tới',      color: 'primary', icon: 'feather-calendar' },
  { key: 'COMPLETED', label: 'Hoàn thành',   color: 'success', icon: 'feather-check-circle' },
  { key: 'REJECTED',  label: 'Đã từ chối',   color: 'danger',  icon: 'feather-x-circle' },
  { key: 'CANCELLED', label: 'Đã huỷ',       color: 'secondary', icon: 'feather-slash' },
];

const statusBadge = {
  PENDING:   <span className="badge bg-warning text-dark">Chờ duyệt</span>,
  UPCOMING:  <span className="badge bg-primary">Sắp tới</span>,
  COMPLETED: <span className="badge bg-success">Hoàn thành</span>,
  REJECTED:  <span className="badge bg-danger">Đã từ chối</span>,
  CANCELLED: <span className="badge bg-secondary">Đã huỷ</span>,
};

export default function ManagerBookings() {
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [timeFilter, setTimeFilter] = useState('all');
  const [detailModal, setDetailModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const filtered = bookings.filter((b) => b.status === activeTab);

  const handleAccept = (id) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'UPCOMING' } : b));
  };

  const handleReject = () => {
    if (!rejectModal) return;
    setBookings((prev) => prev.map((b) => b.id === rejectModal.id ? { ...b, status: 'REJECTED', rejectReason } : b));
    setRejectModal(null);
    setRejectReason('');
  };

  const handleCancel = (id) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'CANCELLED' } : b));
  };

  return (
    <>
      {/* Summary stats */}
      <div className="row g-3 mb-4">
        {TABS.map((t) => {
          const count = bookings.filter((b) => b.status === t.key).length;
          return (
            <div key={t.key} className="col">
              <div
                className={`card border-0 shadow-sm h-100${activeTab === t.key ? ' ring-active' : ''}`}
                style={{
                  cursor: 'pointer',
                  borderLeft: activeTab === t.key ? `3px solid var(--bs-${t.color})` : '3px solid transparent',
                  transition: 'border-color 0.2s',
                }}
                onClick={() => setActiveTab(t.key)}
              >
                <div className="card-body py-3 d-flex align-items-center gap-3">
                  <i className={t.icon} style={{ fontSize: 18, opacity: 0.6 }} />
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{t.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{count}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex gap-2 flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`btn btn-sm ${activeTab === t.key ? `btn-${t.color}` : `btn-outline-${t.color}`}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                  <span className="ms-1 badge bg-white text-dark" style={{ fontSize: 10 }}>
                    {bookings.filter((b) => b.status === t.key).length}
                  </span>
                </button>
              ))}
            </div>
            <select className="form-select form-select-sm" style={{ width: 'auto' }} value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr style={{ fontSize: 13, color: '#64748b' }}>
                  <th>Sân</th>
                  <th>Người đặt</th>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th>Khách</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th className="text-end">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-5">
                      <i className="feather-inbox d-block mb-2" style={{ fontSize: 32, opacity: 0.4 }} />
                      Không có đặt sân nào
                    </td>
                  </tr>
                ) : filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <img src={b.courtImg} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{b.court}</span>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <img src={b.playerImg} alt="" className="rounded-circle" style={{ width: 28, height: 28, objectFit: 'cover' }} />
                        <span style={{ fontSize: 13 }}>{b.player}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{b.date}</td>
                    <td style={{ fontSize: 13 }}>{b.time}</td>
                    <td style={{ fontSize: 13 }}>{b.guests}</td>
                    <td><strong style={{ fontSize: 13 }}>{b.amount.toLocaleString('vi-VN')} ₫</strong></td>
                    <td>{statusBadge[b.status]}</td>
                    <td className="text-end">
                      <div className="d-flex gap-1 justify-content-end">
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDetailModal(b)} title="Chi tiết">
                          <i className="feather-eye" />
                        </button>
                        {b.status === 'PENDING' && (
                          <>
                            <button type="button" className="btn btn-sm btn-success" onClick={() => handleAccept(b.id)} title="Duyệt">
                              <i className="feather-check" />
                            </button>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => setRejectModal(b)} title="Từ chối">
                              <i className="feather-x" />
                            </button>
                          </>
                        )}
                        {b.status === 'UPCOMING' && (
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleCancel(b.id)} title="Huỷ">
                            <i className="feather-slash" />
                          </button>
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

      {/* Detail Modal */}
      {detailModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDetailModal(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0">
              <div className="modal-header">
                <h5 className="modal-title">Chi tiết đặt sân</h5>
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
                  {detailModal.rejectReason && (
                    <div className="col-12">
                      <small className="text-muted d-block">Lý do từ chối</small>
                      <span className="text-danger">{detailModal.rejectReason}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDetailModal(null)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setRejectModal(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0">
              <div className="modal-header">
                <h5 className="modal-title">Từ chối yêu cầu</h5>
                <button type="button" className="btn-close" onClick={() => setRejectModal(null)} />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-3">
                  Từ chối yêu cầu đặt <strong>{rejectModal.court}</strong> của <strong>{rejectModal.player}</strong>
                </p>
                <label className="form-label">Lý do từ chối <span className="text-danger">*</span></label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Nhập lý do từ chối..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Huỷ</button>
                <button type="button" className="btn btn-danger" disabled={!rejectReason.trim()} onClick={handleReject}>
                  Xác nhận từ chối
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
