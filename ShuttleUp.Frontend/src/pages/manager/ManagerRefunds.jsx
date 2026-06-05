import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getManagerRefunds, reconcileRefund, completeRefund, uploadRefundEvidence } from '../../api/managerRefundsApi';
import LongTermScheduleDisplay from '../../components/common/LongTermScheduleDisplay';

function InfoRow({ label, value, valueClass = '' }) {
  return (
    <div className="bk-detail-row">
      <span className="bk-detail-label">{label}</span>
      <span className={`bk-detail-value ${valueClass}`}>{value}</span>
    </div>
  );
}

function ImageLightboxSection({ title, icon, src, alt, borderStyle }) {
  const [showFull, setShowFull] = useState(false);
  if (!src) return null;

  return (
    <div className="bk-detail-section mt-3">
      <h6 className="bk-detail-section-title">
        {icon && <i className={`${icon} me-1`} />}
        {title}
      </h6>
      <div
        style={{
          position: 'relative', cursor: 'pointer', borderRadius: 8,
          overflow: 'hidden', border: borderStyle || '1px solid #e2e8f0', background: '#f8fafc'
        }}
        onClick={() => setShowFull(true)}
      >
        <img
          src={src}
          alt={alt}
          style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }}
          onError={(e) => { e.target.parentElement.style.display = 'none'; }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(transparent 50%, rgba(0,0,0,.4))',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: 10,
          }}
        >
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="feather-maximize-2" style={{ fontSize: 14 }} />
            Nhấn để phóng to
          </span>
        </div>
      </div>

      {showFull && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,.7)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowFull(false)}
        >
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,.4)', objectFit: 'contain',
              background: '#fff',
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setShowFull(false)}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,.9)', border: 'none',
              fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#1e293b',
            }}
          >
            <i className="feather-x" />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

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
                      <td title={r.venueName} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.venueName}</td>
                      <td title={r.playerName} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <div className="bk-modal-overlay" onClick={() => setDetail(null)} style={{ zIndex: 1100 }}>
          <div className="bk-modal bk-modal--lg" style={{ maxWidth: '1140px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bk-modal-header">
              <div className="d-flex align-items-center gap-3">
                <div className="bk-modal-icon">
                  <i className="feather-dollar-sign" />
                </div>
                <div>
                  <h5 className="bk-modal-title mb-0">Chi tiết hoàn tiền</h5>
                  <p className="bk-modal-sub mb-0">Mã đặt sân: <strong>{detail.bookingCode}</strong></p>
                </div>
              </div>
              <button type="button" className="bk-modal-close" onClick={() => setDetail(null)}>
                <i className="feather-x" />
              </button>
            </div>

            {/* Body */}
            <div className="bk-modal-body">
              <div className="row g-4">
                {/* Left: Court + Player + Proof */}
                <div className="col-md-6">
                  {/* Court card */}
                  <div className="bk-detail-card mb-3">
                    <div className="bk-detail-card__img-wrap" style={{ background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src="/assets/img/booking/booking-01.jpg" alt="" className="bk-detail-card__img" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <div className="bk-detail-card__body">
                      <div className="bk-detail-card__title">{detail.courtName || detail.venueName}</div>
                      <div className="bk-detail-card__sub">
                        <i className="feather-map-pin" />
                        {detail.venueName}
                      </div>
                    </div>
                  </div>

                  {/* Player card */}
                  <div className="bk-detail-card mb-3">
                    <img src="/assets/img/profiles/avatar-01.jpg" alt="" className="bk-detail-card__avatar rounded-circle" />
                    <div className="bk-detail-card__body">
                      <div className="bk-detail-card__title">{detail.playerName}</div>
                      <div className="bk-detail-card__sub">
                        <i className="feather-phone" />
                        {detail.playerPhone}
                      </div>
                    </div>
                  </div>

                  {/* Financial Info */}
                  <div className="bk-detail-section mt-3">
                    <h6 className="bk-detail-section-title">
                      <i className="feather-dollar-sign me-1" style={{ color: '#10b981' }} />Thanh toán
                    </h6>
                    <div className="bk-detail-row">
                      <span className="bk-detail-label">Tổng đơn</span>
                      <span className="bk-detail-value">
                        <strong style={{ color: '#097E52', fontSize: '18px' }}>{Number(detail.finalAmount || 0).toLocaleString('vi-VN')} ₫</strong>
                      </span>
                    </div>
                    <div className="bk-detail-row">
                      <span className="bk-detail-label">Đã thu</span>
                      <span className="bk-detail-value">
                        <strong style={{ fontSize: '16px' }}>{detail.paidAmount != null ? `${Number(detail.paidAmount).toLocaleString('vi-VN')} ₫` : '—'}</strong>
                      </span>
                    </div>
                    {detail.paymentMethod && (
                      <div className="bk-detail-row">
                        <span className="bk-detail-label">Hình thức</span>
                        <span className="bk-detail-value">
                          <i className={detail.paymentMethod === 'VNPAY' ? 'feather-credit-card' : 'feather-briefcase'} style={{ fontSize: 12, marginRight: 4, color: '#64748b' }} />
                          {detail.paymentMethod === 'VNPAY' ? 'Thanh toán VNPay' : detail.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : detail.paymentMethod}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Payment proof image */}
                  <ImageLightboxSection
                    title="Ảnh chứng từ (người chơi nộp)"
                    icon="feather-image"
                    src={detail.paymentProofUrl}
                    alt="CK proof"
                  />

                  {detail.playerNote && (
                    <div className="bk-detail-section mt-3">
                      <h6 className="bk-detail-section-title">
                        <i className="feather-message-square me-1" style={{ color: '#64748b' }} />Lý do huỷ sân (từ người chơi)
                      </h6>
                      <p className="mb-0" style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                        "{detail.playerNote}"
                      </p>
                    </div>
                  )}



                  {(detail.refundBankName || detail.refundAccountNumber) && (
                    <div className="bk-detail-section mt-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
                      <h6 className="bk-detail-section-title" style={{ color: '#166534' }}>
                        <i className="feather-credit-card me-1" />Thông tin nhận hoàn
                      </h6>
                      <p className="mb-0 small" style={{ color: '#166534' }}>
                        NH: <strong>{detail.refundBankName || '—'}</strong><br/>
                        STK: <strong>{detail.refundAccountNumber || '—'}</strong><br/>
                        Chủ TK: <strong>{detail.refundAccountHolder || '—'}</strong>
                      </p>
                    </div>
                  )}

                  {/* QR Image */}
                  <ImageLightboxSection
                    title="Ảnh mã QR nhận hoàn tiền"
                    src={detail.refundQrImageUrl}
                    alt="Refund QR"
                    borderStyle="2px solid #10b981"
                  />
                </div>

                {/* Right: Booking Details & Actions */}
                <div className="col-md-6">
                  {!detail.isLongTerm ? (
                    <div className="bk-schedule-wrapper mt-2 mb-3">
                      <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div className="d-flex align-items-center mb-3">
                          <i className="feather-calendar me-2" style={{ color: '#10b981', fontSize: '18px' }} />
                          <span className="fw-semibold" style={{ color: '#0f172a', fontSize: '14px' }}>Thông tin lịch đặt</span>
                        </div>
                        <div className="row g-2">
                          <div className="col-6">
                            <div className="d-flex align-items-center text-muted mb-1" style={{ fontSize: '12px' }}>
                              <i className="feather-calendar me-1" />Ngày chơi
                            </div>
                            <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                              {detail.bookingDate ? new Date(detail.bookingDate).toLocaleDateString('vi-VN') : '—'}
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="d-flex align-items-center text-muted mb-1" style={{ fontSize: '12px' }}>
                              <i className="feather-clock me-1" />Giờ chơi
                            </div>
                            <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                              {detail.bookingTime ? new Date(detail.bookingTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <LongTermScheduleDisplay items={detail.bookingItems || []} />
                  )}

                  <div className="bk-detail-section mt-3 mb-3">
                    <h6 className="bk-detail-section-title">
                      <i className="feather-info me-1" style={{ color: '#3b82f6' }} />Thông tin bổ sung
                    </h6>
                    <div className="bk-detail-row">
                      <span className="bk-detail-label">Trạng thái</span>
                      <span className="bk-detail-value">{badge(detail.refundStatus)}</span>
                    </div>
                    <div className="bk-detail-row">
                      <span className="bk-detail-label">Ngày yêu cầu</span>
                      <span className="bk-detail-value">{detail.requestedAt ? new Date(detail.requestedAt).toLocaleString('vi-VN') : '—'}</span>
                    </div>
                  </div>

                  {/* Refund Info Colored Block */}
                  <div className="bk-detail-section mb-3" style={{ background: detail.refundStatus === 'COMPLETED' ? '#f0f9ff' : (detail.refundStatus === 'REJECTED' ? '#fef2f2' : '#fffbeb'), border: `1px solid ${detail.refundStatus === 'COMPLETED' ? '#bae6fd' : (detail.refundStatus === 'REJECTED' ? '#fca5a5' : '#fcd34d')}`, borderRadius: 10, padding: '14px 16px' }}>
                    <h6 className="bk-detail-section-title" style={{ color: detail.refundStatus === 'COMPLETED' ? '#0284c7' : (detail.refundStatus === 'REJECTED' ? '#ef4444' : '#d97706') }}>
                      <i className={`feather-${detail.refundStatus === 'COMPLETED' ? 'check-circle' : (detail.refundStatus === 'REJECTED' ? 'x-circle' : 'clock')} me-1`} />
                      {detail.refundStatus === 'COMPLETED' ? 'Thông tin hoàn tiền' : (detail.refundStatus === 'REJECTED' ? 'Đã từ chối hoàn' : 'Đang chờ hoàn tiền')}
                    </h6>
                    <div className="bk-detail-row">
                      <span className="bk-detail-label">Khách đã thanh toán</span>
                      <span className="bk-detail-value" style={{ fontWeight: 700 }}>{Number(detail.paidAmount || 0).toLocaleString('vi-VN')} ₫</span>
                    </div>
                    <div className="bk-detail-row">
                      <span className="bk-detail-label">{detail.refundStatus === 'REJECTED' ? 'Không hoàn tiền' : 'Cần hoàn lại cho khách'}</span>
                      <span className="bk-detail-value" style={{ fontWeight: 700, color: detail.refundStatus === 'REJECTED' ? '#94a3b8' : '#ef4444' }}>
                        {detail.refundStatus === 'REJECTED' ? '0 ₫' : `– ${Number(detail.requestedAmount || 0).toLocaleString('vi-VN')} ₫`}
                      </span>
                    </div>
                    {detail.paidAmount != null && detail.requestedAmount != null && detail.paidAmount > detail.requestedAmount && detail.refundStatus !== 'REJECTED' && (
                      <>
                        <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />
                        <div className="bk-detail-row">
                          <span className="bk-detail-label" style={{ fontWeight: 700, color: '#0f172a' }}>Bạn giữ lại (phí phạt)</span>
                          <span className="bk-detail-value" style={{ fontWeight: 800, color: '#097E52', fontSize: 15 }}>
                            {(detail.paidAmount - detail.requestedAmount).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                          * Áp dụng theo chính sách hoàn tiền đã được cấu hình cho sân.
                        </div>
                      </>
                    )}
                  </div>

                  <ImageLightboxSection
                    title="Bill CK hoàn tiền (của bạn)"
                    src={detail.managerEvidenceUrl}
                    alt="Evidence"
                  />

                  {detail.managerStatusNote && !detail.managerStatusNote.startsWith('[Người chơi huỷ]:') && (
                    <div className="bk-detail-section mt-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' }}>
                      <h6 className="bk-detail-section-title" style={{ color: '#ef4444' }}>
                        <i className="feather-alert-circle me-1" />Lý do huỷ sân (của bạn)
                      </h6>
                      <p className="mb-0" style={{ fontSize: 13, color: '#ef4444' }}>
                        {detail.managerStatusNote}
                      </p>
                    </div>
                  )}

                  {detail.rejectionReason && (
                    <div className="bk-detail-section mt-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' }}>
                      <h6 className="bk-detail-section-title" style={{ color: '#ef4444' }}>
                        <i className="feather-alert-circle me-1" />Lý do từ chối (của bạn)
                      </h6>
                      <p className="mb-0" style={{ fontSize: 13, color: '#ef4444' }}>
                        {detail.rejectionReason}
                      </p>
                    </div>
                  )}

                  {/* ── Reconciliation ──────────────────────────────────────── */}
                  {detail.refundStatus === 'PENDING_RECONCILIATION' && (
                    <div className="bk-detail-section mt-4" style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '16px' }}>
                      <h6 className="mb-2" style={{ color: '#92400e' }}><i className="feather-alert-circle me-1" />Đối soát chuyển khoản</h6>
                      <div className="alert alert-warning small mb-3 p-2" style={{ background: '#fffbeb', border: 'none', borderLeft: '3px solid #d97706', borderRadius: 0 }}>
                        <i className="feather-info me-1" />Người chơi đã hủy khi bạn <strong>chưa xác nhận</strong> thanh toán. 
                        Nếu bạn xác nhận đã nhận tiền, hệ thống sẽ yêu cầu bạn hoàn lại <strong>100%</strong> số tiền này.
                      </div>
                      <p className="small text-muted mb-3">Kiểm tra xem bạn đã nhận được khoản chuyển khoản từ người chơi chưa. Nếu đã nhận, bấm &quot;Đã nhận tiền&quot;. Nếu không, bấm &quot;Từ chối&quot;.</p>
                      <div className="d-flex gap-2">
                        <button className="btn btn-success btn-sm" disabled={submitting} onClick={() => handleReconcileConfirm(detail)}>
                          {submitting ? '…' : <><i className="feather-check me-1" />Đã nhận tiền</>}
                        </button>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => { setShowReject(detail); setRejectReason(''); setRejectError(''); }}>
                          <i className="feather-x me-1" />Từ chối (chưa nhận tiền)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Complete refund ─────────────────────────────────────── */}
                  {detail.refundStatus === 'PENDING_REFUND' && (
                    <div className="bk-detail-section mt-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '16px' }}>
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
              </div>
            </div>

            {/* Footer */}
            <div className="bk-modal-footer">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setDetail(null)}>Đóng</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Reject Reason Modal (portal) ────────────────────────────────── */}
      {showReject && createPortal(
        <div className="bk-modal-overlay" style={{ zIndex: 1200 }}
          onClick={() => setShowReject(null)}>
          <div className="bk-modal bk-modal--sm" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bk-modal-header bk-modal-header--danger">
              <div className="d-flex align-items-center gap-3">
                <div className="bk-modal-icon bk-modal-icon--danger">
                  <i className="feather-x-circle" />
                </div>
                <div>
                  <h5 className="bk-modal-title mb-0">Từ chối hoàn tiền</h5>
                  <p className="bk-modal-sub mb-0">Xác nhận không hoàn tiền cho đơn này</p>
                </div>
              </div>
              <button type="button" className="bk-modal-close" onClick={() => setShowReject(null)}>
                <i className="feather-x" />
              </button>
            </div>

            {/* Body */}
            <div className="bk-modal-body">
              <div className="alert alert-warning d-flex align-items-start gap-2 mb-3" style={{ fontSize: 13, borderRadius: 10 }}>
                <i className="feather-alert-triangle" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <strong>Lưu ý:</strong> Khi từ chối, đơn sẽ chuyển thành <strong>Đã hủy</strong> và người chơi sẽ <strong>không được hoàn tiền</strong>. Lý do từ chối sẽ được gửi đến người chơi.
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold mb-2" style={{ fontSize: 13 }}>
                  Chọn lý do nhanh
                </label>
                <div className="bk-quick-reasons">
                  {['Đơn chuyển khoản không hợp lệ / Bill giả', 'Chưa nhận được tiền chuyển khoản', 'Thông tin chuyển khoản sai', 'Lý do khác'].map(r => (
                    <button key={r} type="button"
                      className={`bk-quick-reason${rejectReason === r ? ' active' : ''}`}
                      onClick={() => { setRejectReason(r); setRejectError(''); }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label fw-semibold mb-1" style={{ fontSize: 13 }}>
                  {rejectReason === 'Lý do khác' ? (
                    <>Nhập lý do <span className="text-danger">*</span></>
                  ) : (
                    <>Ghi chú thêm <span className="text-muted fw-normal">(tuỳ chọn)</span></>
                  )}
                </label>
                <textarea
                  className={`form-control ${rejectError ? 'is-invalid' : ''}`}
                  rows={3}
                  placeholder="VD: Không nhận được chuyển khoản nào…"
                  value={rejectReason === 'Lý do khác' ? '' : rejectReason}
                  onChange={e => { setRejectReason(e.target.value); setRejectError(''); }}
                  style={{ fontSize: 13, resize: 'vertical' }}
                />
                {rejectError && <div className="invalid-feedback d-block">{rejectError}</div>}
                <small className="text-muted d-block mt-1" style={{ fontSize: 11 }}>
                  Lý do này sẽ được gửi đến người chơi qua thông báo
                </small>
              </div>
            </div>

            {/* Footer */}
            <div className="bk-modal-footer">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowReject(null)}>
                Huỷ bỏ
              </button>
              <button type="button" className="btn btn-danger btn-sm d-flex align-items-center gap-2"
                disabled={submitting || !rejectReason.trim()} onClick={handleReconcileReject}>
                {submitting ? (
                  <><span className="spinner-border spinner-border-sm" />Đang xử lý…</>
                ) : (
                  <><i className="feather-x-circle" />Xác nhận từ chối</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
