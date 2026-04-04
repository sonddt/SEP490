import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getManagerRefunds, reconcileRefund, completeRefund, uploadRefundEvidence } from '../../api/managerRefundsApi';

const STATUS_TABS = [
  { key: '',                       label: 'Tất cả',       color: 'secondary' },
  { key: 'PENDING_RECONCILIATION', label: 'Chờ đối soát', color: 'warning'   },
  { key: 'PENDING_REFUND',         label: 'Chờ hoàn tiền', color: 'info'     },
  { key: 'COMPLETED',              label: 'Đã hoàn',      color: 'success'   },
  { key: 'REJECTED',               label: 'Từ chối',      color: 'danger'    },
];

const STATUS_BADGE = {
  PENDING_RECONCILIATION: { text: 'Chờ đối soát', cls: 'bg-warning text-dark' },
  PENDING_REFUND:         { text: 'Chờ hoàn tiền', cls: 'bg-info'             },
  COMPLETED:              { text: 'Đã hoàn',       cls: 'bg-success'          },
  REJECTED:               { text: 'Từ chối',       cls: 'bg-danger'           },
};

/* ─── Toast (portal) ──────────────────────────────────────────────── */
function Toast({ msg, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const isErr = type === 'error';
  return createPortal(
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: isErr ? '#991b1b' : '#166534', color: '#fff',
      padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxWidth: 420,
    }}>
      <i className={isErr ? 'feather-x-circle' : 'feather-check-circle'} style={{ fontSize: 17 }} />
      <span>{msg}</span>
    </div>,
    document.body,
  );
}

export default function ManagerRefunds() {
  const [tab, setTab] = useState('');
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [showReject, setShowReject] = useState(null);
  const [managerNote, setManagerNote] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [evidenceUploaded, setEvidenceUploaded] = useState(false);

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const data = await getManagerRefunds(tab ? { status: tab } : {});
      setRefunds(Array.isArray(data) ? data : []);
    } catch {
      setRefunds([]); setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const openDetail = (r) => {
    setDetail(r); setManagerNote(''); setEvidenceFile(null);
    setEvidenceUploaded(false);
  };

  const handleReconcileConfirm = async (r) => {
    setSubmitting(true);
    try {
      await reconcileRefund(r.refundRequestId, { confirmed: true });
      showToast('Đã xác nhận nhận tiền. Đơn chuyển sang chờ hoàn.');
      setDetail(null);
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Thất bại.', 'error');
    } finally { setSubmitting(false); }
  };

  const handleReconcileReject = async () => {
    if (!showReject) return;
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối.');
      return;
    }
    setRejectError('');
    setSubmitting(true);
    try {
      await reconcileRefund(showReject.refundRequestId, { confirmed: false, reason: rejectReason });
      showToast('Đã từ chối — đơn chuyển sang Đã hủy.');
      setShowReject(null); setRejectReason(''); setDetail(null);
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Thất bại.', 'error');
    } finally { setSubmitting(false); }
  };

  const handleComplete = async (r) => {
    setSubmitting(true);
    try {
      if (evidenceFile && !evidenceUploaded) {
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append('file', evidenceFile);
          await uploadRefundEvidence(r.refundRequestId, fd);
          setEvidenceUploaded(true);
        } catch (uploadErr) {
          showToast(uploadErr?.response?.data?.message || 'Tải ảnh bill thất bại. Vui lòng thử lại.', 'error');
          setSubmitting(false); setUploading(false);
          return;
        } finally { setUploading(false); }
      }
      await completeRefund(r.refundRequestId, { managerNote });
      showToast('Đã hoàn tiền thành công.');
      setDetail(null); setManagerNote(''); setEvidenceFile(null); setEvidenceUploaded(false);
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Hoàn tất thất bại.', 'error');
    } finally { setSubmitting(false); }
  };

  const badge = (status) => {
    const s = STATUS_BADGE[status] || { text: status, cls: 'bg-secondary' };
    return <span className={`badge ${s.cls}`}>{s.text}</span>;
  };

  const hasEvidence = !!(detail?.managerEvidenceUrl || evidenceFile || evidenceUploaded);

  return (
    <div className="mgr-page">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="mb-1" style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>Quản lý hoàn tiền</h1>
          <p className="text-muted mb-0">Xử lý các yêu cầu hoàn tiền từ người chơi.</p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" disabled={loading} onClick={load}>
          <i className="feather-refresh-cw me-1" />{loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>

      {/* Status tabs */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        {STATUS_TABS.map(t => (
          <button key={t.key} type="button"
            className={`btn btn-sm ${tab === t.key ? `btn-${t.color}` : `btn-outline-${t.color}`}`}
            onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === '' && <span className="badge bg-dark ms-1">{refunds.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Load Error State ────────────────────────────────────────────── */}
      {loadError && !loading && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
          <div className="card-body text-center py-5">
            <i className="feather-wifi-off" style={{ fontSize: 40, color: '#94a3b8', display: 'block', marginBottom: 12 }} />
            <h5 style={{ color: '#334155' }}>Không tải được danh sách hoàn tiền</h5>
            <p className="text-muted small mb-3">Vui lòng kiểm tra kết nối hoặc thử lại.</p>
            <button className="btn btn-primary btn-sm" onClick={load}>
              <i className="feather-refresh-cw me-1" />Thử lại
            </button>
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {!loadError && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '14px 16px' }}>Mã đơn</th>
                    <th>Sân</th>
                    <th>Người chơi</th>
                    <th className="text-end">Đã thu</th>
                    <th className="text-end">Hoàn</th>
                    <th>Trạng thái</th>
                    <th>Ngày yêu cầu</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={8} className="text-center text-muted py-5">
                      <div className="spinner-border spinner-border-sm text-secondary mb-2" role="status" />
                      <div>Đang tải…</div>
                    </td></tr>
                  )}
                  {!loading && refunds.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-muted py-5">
                      <i className="feather-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.4 }} />
                      Không có yêu cầu hoàn tiền
                    </td></tr>
                  )}
                  {!loading && refunds.map(r => (
                    <tr key={r.refundRequestId} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                      <td style={{ padding: '14px 16px' }}>
                        <span className="badge" style={{ background: '#f0fdf4', color: 'var(--primary-color)', border: '1px solid #6ee7b7', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          #{r.bookingCode}
                        </span>
                      </td>
                      <td>{r.venueName}</td>
                      <td>
                        <div>{r.playerName}</div>
                        <small className="text-muted">{r.playerPhone}</small>
                      </td>
                      <td className="text-end">{Number(r.paidAmount || r.finalAmount || 0).toLocaleString('vi-VN')} ₫</td>
                      <td className="text-end fw-semibold text-success">{Number(r.requestedAmount || 0).toLocaleString('vi-VN')} ₫</td>
                      <td>{badge(r.refundStatus)}</td>
                      <td><small className="text-muted">{r.requestedAt ? new Date(r.requestedAt).toLocaleDateString('vi-VN') : '—'}</small></td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={e => { e.stopPropagation(); openDetail(r); }}>
                          <i className="feather-eye" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail / Action Modal (portal) ─────────────────────────────── */}
      {detail && createPortal(
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1100 }}
          onClick={() => setDetail(null)}>
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: 14 }}>
              <div className="modal-header">
                <h5 className="modal-title">Chi tiết hoàn tiền — #{detail.bookingCode}</h5>
                <button type="button" className="btn-close" onClick={() => setDetail(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <small className="text-muted d-block">Sân</small>
                    <strong>{detail.venueName}</strong>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted d-block">Trạng thái</small>
                    {badge(detail.refundStatus)}
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted d-block">Người chơi</small>
                    <strong>{detail.playerName}</strong>
                    <div className="small text-muted">{detail.playerPhone}</div>
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted d-block">Tổng đơn / Đã thu</small>
                    <strong>{Number(detail.finalAmount || 0).toLocaleString('vi-VN')} ₫</strong>
                    {detail.paidAmount != null && <span className="ms-1 text-muted">/ {Number(detail.paidAmount).toLocaleString('vi-VN')} ₫</span>}
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted d-block">Số tiền hoàn</small>
                    <strong className="text-success">{Number(detail.requestedAmount || 0).toLocaleString('vi-VN')} ₫</strong>
                  </div>
                </div>

                {detail.paymentProofUrl && (
                  <div className="mb-3">
                    <small className="text-muted d-block mb-1">Chứng từ CK từ người chơi</small>
                    <img src={detail.paymentProofUrl} alt="CK proof" style={{ maxHeight: 200, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                )}

                {(detail.refundBankName || detail.refundAccountNumber) && (
                  <div className="p-3 rounded mb-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <small className="fw-semibold d-block mb-1" style={{ color: '#166534' }}>
                      <i className="feather-credit-card me-1" />Thông tin nhận hoàn (từ người chơi)
                    </small>
                    <div className="small">NH: <strong>{detail.refundBankName || '—'}</strong> | STK: <strong>{detail.refundAccountNumber || '—'}</strong> | Chủ TK: <strong>{detail.refundAccountHolder || '—'}</strong></div>
                  </div>
                )}

                {detail.playerNote && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Ghi chú từ người chơi</small>
                    <p className="small mb-0">{detail.playerNote}</p>
                  </div>
                )}

                {detail.rejectionReason && (
                  <div className="alert alert-danger small mb-3">
                    <i className="feather-x-circle me-1" />Lý do từ chối: {detail.rejectionReason}
                  </div>
                )}

                {detail.managerEvidenceUrl && (
                  <div className="mb-3">
                    <small className="text-muted d-block mb-1">Bill CK hoàn tiền (Manager)</small>
                    <img src={detail.managerEvidenceUrl} alt="Evidence" style={{ maxHeight: 200, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  </div>
                )}

                <hr />

                {/* ── Reconciliation ──────────────────────────────────────── */}
                {detail.refundStatus === 'PENDING_RECONCILIATION' && (
                  <div className="p-3 rounded" style={{ background: '#fefce8', border: '1px solid #fde68a' }}>
                    <h6 className="mb-2" style={{ color: '#92400e' }}><i className="feather-alert-circle me-1" />Đối soát chuyển khoản</h6>
                    <p className="small text-muted mb-3">Kiểm tra xem bạn đã nhận được khoản chuyển khoản từ người chơi chưa. Nếu đã nhận, bấm &quot;Đã nhận tiền&quot;. Nếu không, bấm &quot;Từ chối&quot;.</p>
                    <div className="d-flex gap-2">
                      <button className="btn btn-success btn-sm" disabled={submitting} onClick={() => handleReconcileConfirm(detail)}>
                        {submitting ? '…' : <><i className="feather-check me-1" />Đã nhận tiền</>}
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => { setShowReject(detail); setRejectReason(''); setRejectError(''); }}>
                        <i className="feather-x me-1" />Từ chối
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Complete refund ─────────────────────────────────────── */}
                {detail.refundStatus === 'PENDING_REFUND' && (
                  <div className="p-3 rounded" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    <h6 className="mb-2" style={{ color: '#1e40af' }}><i className="feather-dollar-sign me-1" />Hoàn tiền cho người chơi</h6>
                    <p className="small text-muted mb-3">
                      Chuyển khoản <strong className="text-success">{Number(detail.requestedAmount || 0).toLocaleString('vi-VN')} ₫</strong> vào
                      {detail.refundBankName ? ` ${detail.refundBankName} — ${detail.refundAccountNumber} (${detail.refundAccountHolder})` : ' tài khoản người chơi đã cung cấp'}.
                      Tải ảnh bill CK hoàn tiền, sau đó bấm &quot;Đã chuyển khoản hoàn tiền&quot;.
                    </p>

                    {/* Evidence upload */}
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Ảnh bill CK hoàn <span className="text-danger">*</span></label>
                      {evidenceUploaded ? (
                        <div className="small text-success"><i className="feather-check-circle me-1" />Ảnh bill đã được tải lên thành công.</div>
                      ) : (
                        <>
                          <input type="file" accept="image/*" className="form-control form-control-sm"
                            onChange={e => { setEvidenceFile(e.target.files?.[0] || null); setEvidenceUploaded(false); }} />
                          {uploading && <div className="small text-info mt-1"><span className="spinner-border spinner-border-sm me-1" />Đang tải ảnh lên…</div>}
                          {!hasEvidence && <div className="small text-danger mt-1">Oops… Cần có ảnh bill trước khi hoàn tất.</div>}
                        </>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Ghi chú (tùy chọn)</label>
                      <input type="text" className="form-control form-control-sm" placeholder="VD: Đã CK lúc 14:30"
                        value={managerNote} onChange={e => setManagerNote(e.target.value)} />
                    </div>
                    <button className="btn btn-primary btn-sm" disabled={submitting || !hasEvidence} onClick={() => handleComplete(detail)}>
                      {submitting ? 'Đang xử lý…' : <><i className="feather-check-circle me-1" />Đã chuyển khoản hoàn tiền</>}
                    </button>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDetail(null)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Reject Reason Modal (portal) ────────────────────────────────── */}
      {showReject && createPortal(
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1200 }}
          onClick={() => setShowReject(null)}>
          <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: 14 }}>
              <div className="modal-header">
                <h5 className="modal-title"><i className="feather-x-circle me-2 text-danger" />Lý do từ chối</h5>
                <button type="button" className="btn-close" onClick={() => setShowReject(null)} />
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-2">Người chơi sẽ nhận được lý do này trong thông báo.</p>
                <textarea className={`form-control ${rejectError ? 'is-invalid' : ''}`} rows={3} placeholder="VD: Không nhận được chuyển khoản nào…"
                  value={rejectReason} onChange={e => { setRejectReason(e.target.value); setRejectError(''); }} />
                {rejectError && <div className="invalid-feedback d-block">{rejectError}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowReject(null)}>Hủy</button>
                <button className="btn btn-danger btn-sm" disabled={submitting} onClick={handleReconcileReject}>
                  {submitting ? '…' : 'Xác nhận từ chối'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
