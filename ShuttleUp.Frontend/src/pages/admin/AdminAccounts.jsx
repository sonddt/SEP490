import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminDashboardMenu from '../../components/admin/AdminDashboardMenu';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5108';

function roleBadge(roles = []) {
  if (roles.includes('ADMIN'))   return <span className="badge bg-dark">Admin</span>;
  if (roles.includes('MANAGER')) return <span className="badge bg-success">Manager</span>;
  return <span className="badge bg-primary">Player</span>;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN');
}

export default function AdminAccounts() {
  const [items,       setItems]       = useState([]);
  const [totalItems,  setTotalItems]  = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // Filters
  const [search,      setSearch]      = useState('');
  const [filterRole,  setFilterRole]  = useState('');
  const [filterStatus,setFilterStatus]= useState('');

  // Modal: view detail
  const [selected,    setSelected]    = useState(null);
  // Confirm: block / unblock
  const [confirmAction, setConfirmAction] = useState(null); // { user, action }
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,   setActionError]   = useState(null);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: pg, pageSize: 10 });
      if (search)       params.append('search', search);
      if (filterRole)   params.append('role',   filterRole);
      if (filterStatus) params.append('status', filterStatus);

      const res = await fetch(`${API}/api/admin/accounts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items);
      setTotalItems(data.totalItems);
      setTotalPages(data.totalPages);
      setPage(pg);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterStatus]);

  useEffect(() => { load(1); }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    load(1);
  };

  const doAction = async () => {
    if (!confirmAction) return;
    const { user, action } = confirmAction;
    setActionLoading(true);
    setActionError(null);
    try {
      const token = localStorage.getItem('token');
      const body  = action === 'block' ? JSON.stringify({ reason: blockReason || 'Vi phạm điều khoản.' }) : null;
      const res   = await fetch(`${API}/api/admin/accounts/${user.id}/${action}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      setConfirmAction(null);
      setBlockReason('');
      load(page); // reload current page
    } catch (e) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="main-wrapper">
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

              {/* ── Toolbar ──────────────────────────────────────── */}
              <form className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3" onSubmit={handleSearch}>
                <h4 className="mb-0">Danh sách Tài khoản ({totalItems})</h4>
                <div className="d-flex flex-wrap gap-2">
                  <div className="input-group" style={{ width: 240 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Tìm theo tên hoặc email..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    <button type="submit" className="btn btn-outline-secondary">
                      <i className="feather-search"></i>
                    </button>
                  </div>
                  <select className="form-select" style={{ width: 150 }} value={filterRole} onChange={e => { setFilterRole(e.target.value); }}>
                    <option value="">Tất cả vai trò</option>
                    <option value="PLAYER">Player</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <select className="form-select" style={{ width: 160 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); }}>
                    <option value="">Tất cả trạng thái</option>
                    <option value="active">Hoạt động</option>
                    <option value="blocked">Đã khoá</option>
                  </select>
                </div>
              </form>

              {error && (
                <div className="alert alert-danger">
                  Lỗi: {error} <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => load(page)}>Thử lại</button>
                </div>
              )}

              {/* ── Table ─────────────────────────────────────────── */}
              <div className="table-responsive">
                <table className="table table-borderless align-middle">
                  <thead className="thead-light">
                    <tr>
                      <th>#</th><th>Họ tên</th><th>Email</th><th>Vai trò</th>
                      <th>Ngày tạo</th><th>Trạng thái</th><th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? [0,1,2,3,4].map(i => (
                          <tr key={i}><td colSpan={7}><span className="placeholder-glow"><span className="placeholder col-12"></span></span></td></tr>
                        ))
                      : items.length === 0
                        ? <tr><td colSpan={7} className="text-center text-muted py-4">Không có kết quả.</td></tr>
                        : items.map((u, idx) => (
                            <tr key={u.id}>
                              <td className="text-muted">{(page - 1) * 10 + idx + 1}</td>
                              <td><strong>{u.fullName}</strong></td>
                              <td className="text-muted">{u.email}</td>
                              <td>{roleBadge(u.roles)}</td>
                              <td>{fmtDate(u.createdAt)}</td>
                              <td>
                                {u.isActive
                                  ? <span className="badge bg-success">Hoạt động</span>
                                  : <span className="badge bg-danger">Đã khoá</span>}
                              </td>
                              <td>
                                <div className="d-flex gap-1">
                                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelected(u)}>
                                    <i className="feather-eye"></i> Chi tiết
                                  </button>
                                  {u.isActive
                                    ? (
                                        <button
                                          className="btn btn-sm btn-outline-danger"
                                          onClick={() => { setConfirmAction({ user: u, action: 'block' }); setBlockReason(''); setActionError(null); }}
                                        >
                                          <i className="feather-lock"></i> Khoá
                                        </button>
                                      )
                                    : (
                                        <button
                                          className="btn btn-sm btn-outline-success"
                                          onClick={() => { setConfirmAction({ user: u, action: 'unblock' }); setActionError(null); }}
                                        >
                                          <i className="feather-unlock"></i> Mở khoá
                                        </button>
                                      )
                                  }
                                </div>
                              </td>
                            </tr>
                          ))
                    }
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ─────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-center gap-1 mt-3">
                  <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => load(page - 1)}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`btn btn-sm ${p === page ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => load(p)}>{p}</button>
                  ))}
                  <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => load(page + 1)}>›</button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Detail ──────────────────────────────────────────────── */}
      {selected && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setSelected(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Chi tiết Tài khoản</h5>
                <button className="btn-close" onClick={() => setSelected(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-6"><label className="text-muted small">Họ tên</label><div><strong>{selected.fullName}</strong></div></div>
                  <div className="col-6"><label className="text-muted small">Email</label><div>{selected.email}</div></div>
                  <div className="col-6"><label className="text-muted small">Điện thoại</label><div>{selected.phoneNumber || '—'}</div></div>
                  <div className="col-6"><label className="text-muted small">Giới tính</label><div>{selected.gender || '—'}</div></div>
                  <div className="col-6"><label className="text-muted small">Ngày sinh</label><div>{selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString('vi-VN') : '—'}</div></div>
                  <div className="col-6"><label className="text-muted small">Ngày tạo</label><div>{fmtDate(selected.createdAt)}</div></div>
                  <div className="col-12"><label className="text-muted small">Vai trò</label><div className="d-flex gap-1">{roleBadge(selected.roles)}</div></div>
                  <div className="col-12">
                    <label className="text-muted small">Trạng thái</label>
                    <div>
                      {selected.isActive
                        ? <span className="badge bg-success">Hoạt động</span>
                        : <>
                            <span className="badge bg-danger me-2">Đã khoá</span>
                            <small className="text-muted">{selected.blockedReason} – {fmtDate(selected.blockedAt)}</small>
                          </>
                      }
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirm Block/Unblock ─────────────────────────────── */}
      {confirmAction && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => !actionLoading && setConfirmAction(null)}>
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {confirmAction.action === 'block' ? '🔒 Khoá tài khoản' : '🔓 Mở khoá tài khoản'}
                </h5>
                <button className="btn-close" disabled={actionLoading} onClick={() => setConfirmAction(null)}></button>
              </div>
              <div className="modal-body">
                <p>
                  {confirmAction.action === 'block' ? 'Khoá' : 'Mở khoá'} tài khoản{' '}
                  <strong>{confirmAction.user.fullName}</strong>?
                </p>
                {confirmAction.action === 'block' && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Lý do khoá (tuỳ chọn)"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                  />
                )}
                {actionError && <div className="alert alert-danger mt-2 mb-0 py-1">{actionError}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" disabled={actionLoading} onClick={() => setConfirmAction(null)}>Huỷ</button>
                <button
                  className={`btn btn-sm ${confirmAction.action === 'block' ? 'btn-danger' : 'btn-success'}`}
                  disabled={actionLoading}
                  onClick={doAction}
                >
                  {actionLoading ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                  {confirmAction.action === 'block' ? 'Khoá' : 'Mở khoá'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
