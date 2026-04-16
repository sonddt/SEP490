import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

import axiosClient from '../../api/axiosClient';

function roleBadge(roles = []) {
  if (roles.includes('ADMIN'))   return <span className="badge bg-dark">Admin</span>;
  if (roles.includes('MANAGER')) return <span className="badge bg-success">Manager</span>;
  return <span className="badge bg-primary">Player</span>;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN');
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN');
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
  const [confirmAction, setConfirmAction] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [restoreVenues, setRestoreVenues] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError,   setActionError]   = useState(null);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: pg, pageSize: 10 });
      if (search)       params.append('search', search);
      if (filterRole)   params.append('role',   filterRole);
      if (filterStatus) params.append('status', filterStatus);

      const data = await axiosClient.get(`/admin/accounts?${params}`);
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

  const handleBanClick = async (user) => {
    setConfirmAction({ action: 'checking_ban', user });
    setActionError(null);
    try {
      const data = await axiosClient.get(`/admin/accounts/${user.id}/ban-check`);
      setConfirmAction({ action: 'confirm_ban', user, scenarioResult: data });
      setBlockReason('');
    } catch (e) {
      setActionError(e.message);
      setConfirmAction({ action: 'checking_ban_error', user });
    }
  };

  const doBan = async (forceHardBan = false) => {
    if (!confirmAction) return;
    const { user } = confirmAction;
    setActionLoading(true);
    setActionError(null);
    try {
      const body = { reason: blockReason || 'Vi phạm điều khoản.', forceHardBan };
      await axiosClient.post(`/admin/accounts/${user.id}/ban`, body);
      setConfirmAction(null);
      setBlockReason('');
      load(page);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const doUnblock = async () => {
    if (!confirmAction) return;
    const { user } = confirmAction;
    setActionLoading(true);
    setActionError(null);
    try {
      await axiosClient.post(`/admin/accounts/${user.id}/unblock`, { restoreVenues });
      setConfirmAction(null);
      setRestoreVenues(true);
      load(page);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
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
                  placeholder="Tìm theo tên/email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <button type="submit" className="btn btn-outline-secondary">
                  <i className="feather-search"></i>
                </button>
              </div>
              <select className="form-select" style={{ width: 150 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="">Tất cả vai trò</option>
                <option value="PLAYER">Player</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
              <select className="form-select" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="blocked">Đã bị khoá/Ân hạn</option>
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
                          <td title={u.fullName} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong>{u.fullName}</strong>
                          </td>
                          <td title={u.email} className="text-muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </td>
                          <td>{roleBadge(u.roles)}</td>
                          <td>{fmtDate(u.createdAt)}</td>
                          <td>
                            {u.isActive
                              ? <span className="badge bg-success">Hoạt động</span>
                              : u.banType === 'SOFT'
                                ? <span className="badge bg-warning text-dark">Ân hạn {u.softBanExpiresAt ? `(tới ${fmtDate(u.softBanExpiresAt)})` : ''}</span>
                                : <span className="badge bg-danger">Khóa vĩnh viễn</span>}
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelected(u)}>
                                <i className="feather-eye"></i> Chi tiết
                              </button>
                              
                              {/* 1. Nút Khóa: hiện khi đang Active hoặc đang Soft Ban */}
                              {(u.isActive || u.banType === 'SOFT') && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleBanClick(u)}
                                >
                                  <i className="feather-lock"></i> {u.banType === 'SOFT' ? 'Khóa ngay' : 'Khoá'}
                                </button>
                              )}

                              {/* 2. Nút Mở khóa: hiện khi đang Bị khóa hoặc đang Soft Ban */}
                              {(!u.isActive || u.banType === 'SOFT') && (
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => { setConfirmAction({ user: u, action: 'unblock' }); setActionError(null); setRestoreVenues(true); }}
                                >
                                  <i className="feather-unlock"></i> {u.banType === 'SOFT' ? 'Gỡ án' : 'Mở khoá'}
                                </button>
                              )}
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
                        : selected.banType === 'SOFT'
                          ? <>
                              <span className="badge bg-warning text-dark me-2">Đang ân hạn</span>
                              <small className="text-muted">Hết hạn vào {fmtDateTime(selected.softBanExpiresAt)}</small>
                            </>
                          : <>
                              <span className="badge bg-danger me-2">Khóa vĩnh viễn</span>
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

      {/* ── Modal: Block/Unblock Logic ─────────────────────────────── */}
      {confirmAction && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1055 }} onClick={() => !actionLoading && setConfirmAction(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              {confirmAction.action === 'checking_ban' && (
                <div className="modal-body text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status"></div>
                  <h5>Đang kiểm tra kịch bản khóa tài khoản...</h5>
                </div>
              )}
              {confirmAction.action === 'checking_ban_error' && (
                <div className="modal-body text-center py-5">
                  <div className="text-danger mb-3"><i className="feather-alert-circle" style={{ fontSize: 40 }}></i></div>
                  <h5>Lỗi kiểm tra</h5>
                  <p className="text-muted">{actionError}</p>
                  <button className="btn btn-outline-secondary" onClick={() => setConfirmAction(null)}>Đóng</button>
                </div>
              )}

              {confirmAction.action === 'unblock' && (
                <>
                  <div className="modal-header">
                    <h5 className="modal-title">🔓 Mở khoá tài khoản</h5>
                    <button className="btn-close" disabled={actionLoading} onClick={() => setConfirmAction(null)}></button>
                  </div>
                  <div className="modal-body">
                    <p>Mở khoá tài khoản <strong>{confirmAction.user.fullName}</strong>?</p>
                    {confirmAction.user.roles?.includes('MANAGER') && (
                      <div className="form-check mt-3">
                        <input className="form-check-input" type="checkbox" id="restoreVenues" checked={restoreVenues} onChange={e => setRestoreVenues(e.target.checked)} />
                        <label className="form-check-label" htmlFor="restoreVenues">
                          Khôi phục lại trạng thái hiển thị của các Sân thuộc quản lý
                        </label>
                      </div>
                    )}
                    {actionError && <div className="alert alert-danger mt-2 mb-0 py-1">{actionError}</div>}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" disabled={actionLoading} onClick={() => setConfirmAction(null)}>Huỷ</button>
                    <button className="btn btn-success" disabled={actionLoading} onClick={() => doUnblock()}>
                      {actionLoading ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                      Xác nhận Mở khoá
                    </button>
                  </div>
                </>
              )}

              {confirmAction.action === 'confirm_ban' && confirmAction.scenarioResult && (
                <>
                  <div className="modal-header">
                    <h5 className="modal-title text-danger">🔒 Xác nhận khóa tài khoản</h5>
                    <button className="btn-close" disabled={actionLoading} onClick={() => setConfirmAction(null)}></button>
                  </div>
                  <div className="modal-body">
                    <p>Khóa tài khoản <strong>{confirmAction.user.fullName}</strong>.</p>
                    
                    {confirmAction.scenarioResult.scenario === 'Immediate' && (
                      <div className="alert alert-secondary">
                        <i className="feather-info me-2"></i> Tài khoản này <strong>sẽ bị khóa vĩnh viễn lập tức</strong> và bị đăng xuất khỏi hệ thống.
                      </div>
                    )}

                    {confirmAction.scenarioResult.scenario === 'GracePeriod' && (
                      <div className="alert alert-warning">
                        <h6 className="alert-heading fw-bold"><i className="feather-alert-triangle me-1"></i> Tài khoản có {confirmAction.scenarioResult.ongoingBookingCount} lượt đặt sân sắp tới!</h6>
                        <p className="mb-0">Tài khoản này sẽ được đưa vào <strong>Giai đoạn ân hạn 3 ngày</strong> (Soft Ban).</p>
                        <p className="mb-0">Trong thời gian này, các sân sẽ bị ẩn nhưng Chủ sân vẫn có thể đăng nhập để xử lý lịch. Sau 3 ngày, tài khoản sẽ tự động chuyển sang khóa vĩnh viễn.</p>
                      </div>
                    )}

                    {confirmAction.scenarioResult.scenario === 'OverrideGrace' && (
                      <div className="alert alert-danger">
                        <h6 className="alert-heading fw-bold"><i className="feather-alert-octagon me-1"></i> Đang trong Giai đoạn ân hạn</h6>
                        <p className="mb-0">Tài khoản này hiện đang nằm trong thời gian ân hạn (sẽ tự động khóa vĩnh viễn vào {fmtDateTime(confirmAction.scenarioResult.softBanExpiresAt)}).</p>
                        <p className="mb-0 fw-bold mt-2">Bạn có chắc chắn muốn bỏ qua thời gian ân hạn và Khóa Vĩnh Viễn ngay lập tức?</p>
                      </div>
                    )}

                    <div className="mt-3">
                      <label className="form-label text-muted small">Lý do khóa (bắt buộc)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="VD: Vi phạm quy định hệ thống"
                        value={blockReason}
                        onChange={e => setBlockReason(e.target.value)}
                      />
                    </div>
                    {actionError && <div className="alert alert-danger mt-3 mb-0 py-2">{actionError}</div>}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-outline-secondary" disabled={actionLoading} onClick={() => setConfirmAction(null)}>Huỷ</button>
                    
                    {confirmAction.scenarioResult.scenario === 'OverrideGrace' ? (
                      <button className="btn btn-danger" disabled={actionLoading || !blockReason.trim()} onClick={() => doBan(true)}>
                        {actionLoading ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                        Khóa vĩnh viễn ngay lập tức
                      </button>
                    ) : confirmAction.scenarioResult.scenario === 'GracePeriod' ? (
                      <button className="btn btn-warning" disabled={actionLoading || !blockReason.trim()} onClick={() => doBan(false)}>
                        {actionLoading ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                        Đưa vào diện Ân hạn 3 ngày
                      </button>
                    ) : (
                      <button className="btn btn-danger" disabled={actionLoading || !blockReason.trim()} onClick={() => doBan(false)}>
                        {actionLoading ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                        Xác nhận Khóa vĩnh viễn
                      </button>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
