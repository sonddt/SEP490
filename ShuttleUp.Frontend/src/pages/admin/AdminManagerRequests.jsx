import { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminDashboardMenu from '../../components/admin/AdminDashboardMenu';

// ── Mock data ──────────────────────────────────────────────────────────────
const mockRequests = [
  { id: 1, name: 'Võ Thành Long',    email: 'long.vt@gmail.com',  venue: 'ShuttleUp Bình Thạnh', address: '12 Đinh Tiên Hoàng, Q.Bình Thạnh', phone: '0901234567', date: '16/03/2026', status: 'Pending' },
  { id: 2, name: 'Ngô Sỹ Duy',      email: 'duy.ns@gmail.com',   venue: 'Cầu lông Gò Vấp',      address: '45 Quang Trung, Q.Gò Vấp',         phone: '0912345678', date: '15/03/2026', status: 'Pending' },
  { id: 3, name: 'Bùi Xuân Mạnh',   email: 'manh.bx@gmail.com',  venue: 'ShuttleUp Tân Bình',   address: '88 Hoàng Văn Thụ, Q.Tân Bình',    phone: '0923456789', date: '14/03/2026', status: 'Pending' },
  { id: 4, name: 'Trịnh Thu Hương',  email: 'huong.tt@gmail.com', venue: 'Cầu lông Quận 3',      address: '20 Võ Văn Tần, Q.3',               phone: '0934567890', date: '10/03/2026', status: 'Approved' },
  { id: 5, name: 'Nguyễn Tài Đức',  email: 'duc.nt@gmail.com',   venue: 'Arena Badminton',       address: '5 Lê Văn Lương, Q.7',              phone: '0945678901', date: '08/03/2026', status: 'Rejected' },
];

const statusMap = {
  Pending:  { label: 'Chờ duyệt',  cls: 'bg-warning text-dark' },
  Approved: { label: 'Đã duyệt',   cls: 'bg-success' },
  Rejected: { label: 'Đã từ chối', cls: 'bg-danger' },
};

export default function AdminManagerRequests() {
  const [requests, setRequests]         = useState(mockRequests);
  const [filterStatus, setFilterStatus] = useState('All');
  const [selected, setSelected]         = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { request, action }

  const filtered = filterStatus === 'All'
    ? requests
    : requests.filter((r) => r.status === filterStatus);

  const doAction = () => {
    if (!confirmAction) return;
    const { request, action } = confirmAction;
    setRequests((prev) =>
      prev.map((r) => r.id === request.id ? { ...r, status: action } : r)
    );
    setConfirmAction(null);
    setSelected(null);
  };

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Duyệt Chủ sân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/admin/dashboard">Quản trị</Link></li>
            <li>Duyệt Chủ sân</li>
          </ul>
        </div>
      </section>

      <AdminDashboardMenu />

      <div className="content court-bg">
        <div className="container">
          <div className="card card-tableset">
            <div className="card-body">
              {/* ── Toolbar ─────────────────────────────────── */}
              <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
                <h4 className="mb-0">Yêu cầu đăng ký Chủ sân ({filtered.length})</h4>
                <select
                  className="form-select"
                  style={{ width: 180 }}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">Tất cả trạng thái</option>
                  <option value="Pending">Chờ duyệt</option>
                  <option value="Approved">Đã duyệt</option>
                  <option value="Rejected">Đã từ chối</option>
                </select>
              </div>

              {/* ── Table ───────────────────────────────────── */}
              <div className="table-responsive">
                <table className="table table-borderless align-middle">
                  <thead className="thead-light">
                    <tr>
                      <th>#</th>
                      <th>Người gửi</th>
                      <th>Email</th>
                      <th>Tên sân đề xuất</th>
                      <th>Ngày gửi</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">Không có yêu cầu nào.</td>
                      </tr>
                    )}
                    {filtered.map((r, idx) => (
                      <tr key={r.id}>
                        <td className="text-muted">{idx + 1}</td>
                        <td><strong>{r.name}</strong></td>
                        <td className="text-muted">{r.email}</td>
                        <td>{r.venue}</td>
                        <td>{r.date}</td>
                        <td>
                          <span className={`badge ${statusMap[r.status].cls}`}>
                            {statusMap[r.status].label}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelected(r)}>
                              <i className="feather-eye"></i> Chi tiết
                            </button>
                            {r.status === 'Pending' && (
                              <>
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => setConfirmAction({ request: r, action: 'Approved' })}
                                >
                                  <i className="feather-check"></i> Duyệt
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => setConfirmAction({ request: r, action: 'Rejected' })}
                                >
                                  <i className="feather-x"></i> Từ chối
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

      {/* ── Modal: Detail ──────────────────────────────────── */}
      {selected && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSelected(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Chi tiết Yêu cầu</h5>
                <button className="btn-close" onClick={() => setSelected(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Người gửi</label>
                    <div><strong>{selected.name}</strong></div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Email</label>
                    <div>{selected.email}</div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Số điện thoại</label>
                    <div>{selected.phone}</div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Ngày gửi</label>
                    <div>{selected.date}</div>
                  </div>
                  <div className="col-12">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Tên sân đề xuất</label>
                    <div><strong>{selected.venue}</strong></div>
                  </div>
                  <div className="col-12">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Địa chỉ</label>
                    <div>{selected.address}</div>
                  </div>
                  <div className="col-12">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Trạng thái hiện tại</label>
                    <div>
                      <span className={`badge ${statusMap[selected.status].cls}`}>
                        {statusMap[selected.status].label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                {selected.status === 'Pending' && (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => { setConfirmAction({ request: selected, action: 'Approved' }); setSelected(null); }}
                    >
                      <i className="feather-check me-1"></i>Duyệt
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => { setConfirmAction({ request: selected, action: 'Rejected' }); setSelected(null); }}
                    >
                      <i className="feather-x me-1"></i>Từ chối
                    </button>
                  </>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirm ─────────────────────────────────── */}
      {confirmAction && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmAction(null)}>
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {confirmAction.action === 'Approved' ? '✅ Xác nhận duyệt' : '❌ Xác nhận từ chối'}
                </h5>
                <button className="btn-close" onClick={() => setConfirmAction(null)}></button>
              </div>
              <div className="modal-body">
                Bạn có chắc muốn{' '}
                <strong>{confirmAction.action === 'Approved' ? 'duyệt' : 'từ chối'}</strong>{' '}
                yêu cầu của <strong>{confirmAction.request.name}</strong>?
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setConfirmAction(null)}>Huỷ</button>
                <button
                  className={`btn btn-sm ${confirmAction.action === 'Approved' ? 'btn-success' : 'btn-danger'}`}
                  onClick={doAction}
                >
                  {confirmAction.action === 'Approved' ? 'Duyệt' : 'Từ chối'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
