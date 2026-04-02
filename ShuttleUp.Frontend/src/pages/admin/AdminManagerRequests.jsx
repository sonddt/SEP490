import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

// ── Hooks & API ────────────────────────────────────────────────────────────
import axiosClient from '../../api/axiosClient';

const statusMap = {
  PENDING:  { label: 'Chờ duyệt',  cls: 'bg-warning text-dark' },
  APPROVED: { label: 'Đã duyệt',   cls: 'bg-success' },
  REJECTED: { label: 'Đã từ chối', cls: 'bg-danger' },
};

const requestTypeMap = {
  DANG_KY: 'Đăng ký',
  CAP_NHAT: 'Cập nhật'
};

export default function AdminManagerRequests() {
  const [requests, setRequests] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { request, action }
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10'
      });
      if (filterStatus) params.append('status', filterStatus);
      if (search) params.append('search', search);

      const data = await axiosClient.get(`/admin/manager-requests?${params}`);
      setRequests(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, search]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Handle Approve/Reject
  const doAction = async () => {
    if (!confirmAction) return;
    const { request, action } = confirmAction; // action = 'approve' | 'reject'
    
    // Yêu cầu nhập lý do nếu là reject
    if (action === 'reject' && !actionNote.trim()) {
      alert("Vui lòng nhập lý do từ chối.");
      return;
    }

    try {
      setActionLoading(true);
      await axiosClient.post(`/admin/manager-requests/${request.id}/${action}`, { note: actionNote });
      
      // Success: Close modals and refresh
      setConfirmAction(null);
      setSelected(null);
      setActionNote('');
      fetchRequests();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages, p + 1));

  return (
    <>
      <div className="card card-tableset">
        <div className="card-body">
              {/* ── Toolbar ─────────────────────────────────── */}
              <div className="row mb-3 align-items-center g-2">
                <div className="col-md-4">
                  <h4 className="mb-0">Yêu cầu đăng ký Chủ sân</h4>
                </div>
                <div className="col-md-8 text-md-end d-flex justify-content-md-end gap-2 flex-wrap">
                  <input
                    type="text"
                    className="form-control d-inline-block w-auto"
                    placeholder="Tìm tên sân, email..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                  <select
                    className="form-select d-inline-block w-auto"
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="PENDING">Chờ duyệt</option>
                    <option value="APPROVED">Đã duyệt</option>
                    <option value="REJECTED">Đã từ chối</option>
                  </select>
                </div>
              </div>

              {/* ── Error & Loading states ──────────────────── */}
              {error && (
                <div className="alert alert-danger d-flex justify-content-between align-items-center">
                  <span><i className="feather-alert-triangle me-2"></i>Không thể tải dữ liệu: {error}</span>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => fetchRequests()}>Thử lại</button>
                </div>
              )}

              {/* ── Table ───────────────────────────────────── */}
              <div className="table-responsive">
                <table className="table table-borderless align-middle">
                  <thead className="thead-light">
                    <tr>
                      <th>#</th>
                      <th>Họ tên</th>
                      <th>Email</th>
                      <th>Loại đơn</th>
                      <th>Mã số thuế</th>
                      <th>Ngày gửi</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan="7">
                            <div className="placeholder-glow">
                              <span className="placeholder col-12" style={{ height: '30px' }}></span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : requests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">Không có yêu cầu nào.</td>
                      </tr>
                    ) : (
                      requests.map((r, idx) => {
                        const rowNum = (page - 1) * 10 + idx + 1;
                        const dateObj = new Date(r.requestedAt);
                        const dateStr = dateObj.toLocaleDateString('vi-VN');
                        const statusObj = statusMap[r.status] || { label: r.status, cls: 'bg-secondary' };

                        return (
                          <tr key={r.id}>
                            <td className="text-muted">{rowNum}</td>
                            <td><strong>{r.ownerName || 'N/A'}</strong></td>
                            <td className="text-muted">{r.ownerEmail || 'N/A'}</td>
                            <td>{requestTypeMap[r.requestType] || r.requestType || 'N/A'}</td>
                            <td>{r.taxCode || 'N/A'}</td>
                            <td>{dateStr}</td>
                            <td>
                              <span className={`badge ${statusObj.cls}`}>
                                {statusObj.label}
                              </span>
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelected(r)}>
                                  <i className="feather-eye"></i> Chi tiết
                                </button>
                                {r.status === 'PENDING' && (
                                  <>
                                    <button
                                      className="btn btn-sm btn-outline-success"
                                      onClick={() => { setConfirmAction({ request: r, action: 'approve' }); setActionNote('Hồ sơ đủ điều kiện duyệt.'); }}
                                    >
                                      <i className="feather-check"></i> Duyệt
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => { setConfirmAction({ request: r, action: 'reject' }); setActionNote(''); }}
                                    >
                                      <i className="feather-x"></i> Từ chối
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

               {/* Pagination */}
               {!loading && requests.length > 0 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                    Trang {page} / {totalPages}
                  </span>
                  <div className="btn-group">
                    <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={handlePrevPage}>
                      <i className="feather-chevron-left"></i> Trước
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={handleNextPage}>
                      Sau <i className="feather-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}

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
                    <div className="text-break"><strong>{selected.ownerName || 'N/A'}</strong></div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Email</label>
                    <div className="text-break">{selected.ownerEmail || 'N/A'}</div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Ngày gửi (Tạo sân)</label>
                    <div>{new Date(selected.requestedAt).toLocaleDateString('vi-VN')}</div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Trạng thái</label>
                    <div>
                      <span className={`badge ${statusMap[selected.status]?.cls || 'bg-secondary'}`}>
                        {statusMap[selected.status]?.label || selected.status}
                      </span>
                    </div>
                  </div>
                  <div className="col-12 mt-3">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>CCCD / CMND</label>
                    {selected.cccdFrontUrl || selected.cccdBackUrl ? (
                      <div className="d-flex gap-2">
                        {selected.cccdFrontUrl && (
                          <img
                            src={selected.cccdFrontUrl}
                            alt="CCCD mặt trước"
                            style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8 }}
                          />
                        )}
                        {selected.cccdBackUrl && (
                          <img
                            src={selected.cccdBackUrl}
                            alt="CCCD mặt sau"
                            style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8 }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="text-break"><strong>N/A</strong></div>
                    )}
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Mã số thuế</label>
                    <div className="text-break"><strong>{selected.taxCode || 'N/A'}</strong></div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Giấy phép KD</label>
                    <div className="d-flex flex-column gap-2">
                      {selected.businessLicenseFiles && selected.businessLicenseFiles.length > 0 ? (
                        selected.businessLicenseFiles.map((f, idx) => {
                          const isImage = (f.mimeType || '').startsWith('image/');
                          return (
                            <div key={f.id ?? idx}>
                              {isImage ? (
                                <img src={f.url} alt={`Giấy phép ${idx + 1}`} style={{ width: 160, height: 110, objectFit: 'cover', borderRadius: 8 }} />
                              ) : (
                                <a href={f.url} target="_blank" rel="noreferrer">Xem PDF {idx + 1}</a>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-break"><strong>N/A</strong></div>
                      )}
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="text-muted" style={{ fontSize: '0.82rem' }}>Địa chỉ DOANH NGHIỆP / CÁ NHÂN</label>
                    <div className="text-break">{selected.address || 'N/A'}</div>
                  </div>

                  {selected.status !== 'PENDING' && (
                    <>
                      <div className="col-12"><hr className="my-1" /></div>
                      <div className="col-6">
                        <label className="text-muted" style={{ fontSize: '0.82rem' }}>Ngày xử lý</label>
                        <div>{new Date(selected.decisionAt).toLocaleString('vi-VN')}</div>
                      </div>
                      <div className="col-6">
                        <label className="text-muted" style={{ fontSize: '0.82rem' }}>Admin xử lý</label>
                        <div>{selected.adminName || 'N/A'}</div>
                      </div>
                      <div className="col-12">
                        <label className="text-muted" style={{ fontSize: '0.82rem' }}>Ghi chú / Quyết định</label>
                        <div className="bg-light p-2 rounded text-break" style={{ fontSize: '0.9rem' }}>
                          {selected.decisionNote || 'Không có ghi chú.'}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                {selected.status === 'PENDING' && (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => { setConfirmAction({ request: selected, action: 'approve' }); setActionNote('Hồ sơ đủ điều kiện duyệt.'); setSelected(null); }}
                    >
                      <i className="feather-check me-1"></i>Duyệt
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => { setConfirmAction({ request: selected, action: 'reject' }); setActionNote(''); setSelected(null); }}
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
                  {confirmAction.action === 'approve' ? '✅ Xác nhận duyệt' : '❌ Xác nhận từ chối'}
                </h5>
                <button className="btn-close" disabled={actionLoading} onClick={() => setConfirmAction(null)}></button>
              </div>
              <div className="modal-body">
                <p>
                  Bạn đang thao tác với yêu cầu của <strong>{confirmAction.request.ownerName}</strong> 
                  <br/>
                  (Mã số thuế: {confirmAction.request.taxCode || 'N/A'} | CCCD: {confirmAction.request.cccdFrontUrl || confirmAction.request.cccdBackUrl ? 'Đã upload' : 'N/A'}).
                </p>
                <div className="mb-0">
                  <label className="form-label mb-1">
                    Ghi chú / Lý do {confirmAction.action === 'reject' && <span className="text-danger">*</span>}
                  </label>
                  <textarea 
                    className="form-control" 
                    rows="3" 
                    placeholder="Nhập lý do..."
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    disabled={actionLoading}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" disabled={actionLoading} onClick={() => setConfirmAction(null)}>Huỷ</button>
                <button
                  className={`btn btn-sm ${confirmAction.action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                  onClick={doAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    confirmAction.action === 'approve' ? 'Duyệt' : 'Từ chối'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

