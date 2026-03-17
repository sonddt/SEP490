import { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminDashboardMenu from '../../components/admin/AdminDashboardMenu';

// ── Mock data ──────────────────────────────────────────────────────────────
const mockAccounts = [
  { id: 1,  name: 'Nguyễn Văn An',    email: 'an.nv@gmail.com',     role: 'Player',  status: 'Active', date: '01/01/2026' },
  { id: 2,  name: 'Trần Phúc Hùng',  email: 'hung.tp@gmail.com',   role: 'Manager', status: 'Active', date: '05/01/2026' },
  { id: 3,  name: 'Lê Minh Đức',     email: 'duc.lm@gmail.com',    role: 'Player',  status: 'Banned', date: '07/01/2026' },
  { id: 4,  name: 'Phạm Thị Lan',    email: 'lan.pt@gmail.com',    role: 'Player',  status: 'Active', date: '10/01/2026' },
  { id: 5,  name: 'Đặng Quốc Huy',   email: 'huy.dq@gmail.com',    role: 'Manager', status: 'Active', date: '12/01/2026' },
  { id: 6,  name: 'Vũ Thị Mai',      email: 'mai.vt@gmail.com',    role: 'Player',  status: 'Active', date: '15/01/2026' },
  { id: 7,  name: 'Hoàng Bảo Khoa',  email: 'khoa.hb@gmail.com',   role: 'Player',  status: 'Active', date: '18/01/2026' },
  { id: 8,  name: 'Đinh Đắc Trường', email: 'truong.dd@fpt.edu.vn', role: 'Admin',   status: 'Active', date: '01/01/2026' },
  { id: 9,  name: 'Bùi Phúc Hưng',   email: 'hung.bp@fpt.edu.vn',  role: 'Admin',   status: 'Active', date: '01/01/2026' },
  { id: 10, name: 'Cao Thị Hoa',     email: 'hoa.ct@gmail.com',    role: 'Player',  status: 'Banned', date: '20/01/2026' },
];

const roleBadge = {
  Player:  <span className="badge bg-primary">Player</span>,
  Manager: <span className="badge bg-success">Manager</span>,
  Admin:   <span className="badge bg-dark">Admin</span>,
};

export default function AdminAccounts() {
  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [accounts, setAccounts]       = useState(mockAccounts);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { user, action }

  // ── Filter ───────────────────────────────────────────────
  const filtered = accounts.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase())
      || a.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = filterRole   === 'All' || a.role   === filterRole;
    const matchStatus = filterStatus === 'All' || a.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  // ── Ban / Unban ──────────────────────────────────────────
  const doToggleBan = () => {
    if (!confirmAction) return;
    const { user, action } = confirmAction;
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === user.id ? { ...a, status: action === 'Ban' ? 'Banned' : 'Active' } : a
      )
    );
    setConfirmAction(null);
  };

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Quản lý Tài khoản</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/admin/dashboard">Quản trị</Link></li>
            <li>Tài khoản</li>
          </ul>
        </div>
      </section>

      <AdminDashboardMenu />

      <div className="content court-bg">
        <div className="container">
          <div className="card card-tableset">
            <div className="card-body">
              {/* ── Toolbar ──────────────────────────────────── */}
              <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
                <h4 className="mb-0">Danh sách Tài khoản ({filtered.length})</h4>
                <div className="d-flex flex-wrap gap-2">
                  {/* Search */}
                  <div className="input-group" style={{ width: 240 }}>
                    <span className="input-group-text"><i className="feather-search"></i></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Tìm theo tên hoặc email…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {/* Role filter */}
                  <select
                    className="form-select"
                    style={{ width: 140 }}
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                  >
                    <option value="All">Tất cả vai trò</option>
                    <option value="Player">Player</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                  {/* Status filter */}
                  <select
                    className="form-select"
                    style={{ width: 150 }}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="All">Tất cả trạng thái</option>
                    <option value="Active">Hoạt động</option>
                    <option value="Banned">Đã khoá</option>
                  </select>
                </div>
              </div>

              {/* ── Table ───────────────────────────────────── */}
              <div className="table-responsive">
                <table className="table table-borderless align-middle">
                  <thead className="thead-light">
                    <tr>
                      <th>#</th>
                      <th>Họ tên</th>
                      <th>Email</th>
                      <th>Vai trò</th>
                      <th>Ngày tạo</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">
                          Không tìm thấy tài khoản nào.
                        </td>
                      </tr>
                    )}
                    {filtered.map((u, idx) => (
                      <tr key={u.id}>
                        <td className="text-muted">{idx + 1}</td>
                        <td><strong>{u.name}</strong></td>
                        <td className="text-muted">{u.email}</td>
                        <td>{roleBadge[u.role]}</td>
                        <td>{u.date}</td>
                        <td>
                          {u.status === 'Active'
                            ? <span className="badge bg-success">Hoạt động</span>
                            : <span className="badge bg-danger">Đã khoá</span>
                          }
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setSelectedUser(u)}
                            >
                              <i className="feather-eye"></i> Chi tiết
                            </button>
                            {u.role !== 'Admin' && (
                              <button
                                className={`btn btn-sm ${u.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                onClick={() => setConfirmAction({ user: u, action: u.status === 'Active' ? 'Ban' : 'Unban' })}
                              >
                                {u.status === 'Active' ? (
                                  <><i className="feather-slash"></i> Khoá</>
                                ) : (
                                  <><i className="feather-check-circle"></i> Mở khoá</>
                                )}
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
        </div>
      </div>

      {/* ── Modal: User Detail ─────────────────────────────── */}
      {selectedUser && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSelectedUser(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Chi tiết Tài khoản</h5>
                <button className="btn-close" onClick={() => setSelectedUser(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 text-center">
                    <div className="rounded-circle bg-secondary bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-2"
                      style={{ width: 72, height: 72 }}>
                      <i className="feather-user" style={{ fontSize: 32, color: '#6c757d' }}></i>
                    </div>
                    <h5 className="mb-0">{selectedUser.name}</h5>
                    <p className="text-muted">{selectedUser.email}</p>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Vai trò</label>
                    <div>{roleBadge[selectedUser.role]}</div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Trạng thái</label>
                    <div>
                      {selectedUser.status === 'Active'
                        ? <span className="badge bg-success">Hoạt động</span>
                        : <span className="badge bg-danger">Đã khoá</span>
                      }
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Ngày tạo tài khoản</label>
                    <div>{selectedUser.date}</div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedUser(null)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirm Ban / Unban ──────────────────────── */}
      {confirmAction && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmAction(null)}>
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {confirmAction.action === 'Ban' ? '🔒 Khoá tài khoản' : '✅ Mở khoá tài khoản'}
                </h5>
                <button className="btn-close" onClick={() => setConfirmAction(null)}></button>
              </div>
              <div className="modal-body">
                Bạn có chắc muốn{' '}
                <strong>{confirmAction.action === 'Ban' ? 'khoá' : 'mở khoá'}</strong>{' '}
                tài khoản của <strong>{confirmAction.user.name}</strong>?
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setConfirmAction(null)}>Huỷ</button>
                <button
                  className={`btn btn-sm ${confirmAction.action === 'Ban' ? 'btn-danger' : 'btn-success'}`}
                  onClick={doToggleBan}
                >
                  {confirmAction.action === 'Ban' ? 'Khoá tài khoản' : 'Mở khoá'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
