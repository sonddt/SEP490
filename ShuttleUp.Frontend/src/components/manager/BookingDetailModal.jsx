import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BOOKING_STATUSES } from '../../constants/bookingStatuses';
import { PAYMENT_METHODS } from '../../constants/paymentMethods';
import LongTermScheduleDisplay from '../common/LongTermScheduleDisplay';

function InfoRow({ label, value, valueClass = '' }) {
  return (
    <div className="bk-detail-row">
      <span className="bk-detail-label">{label}</span>
      <span className={`bk-detail-value ${valueClass}`}>{value}</span>
    </div>
  );
}

function isHttpProofUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

/* ── Payment proof lightbox ──────────────────────────────────────────── */
function PaymentProofSection({ proofImg }) {
  const [showFull, setShowFull] = useState(false);
  if (!proofImg) return null;

  if (!isHttpProofUrl(proofImg)) {
    return (
      <div className="bk-detail-section mt-3">
        <h6 className="bk-detail-section-title">
          <i className="feather-image me-1" />Ảnh minh chứng chuyển khoản
        </h6>
        <p className="mb-0 text-muted small" style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          Môi trường dev — chưa có ảnh minh chứng thật (cần cấu hình Cloudinary trên server).
        </p>
      </div>
    );
  }

  return (
    <div className="bk-detail-section mt-3">
      <h6 className="bk-detail-section-title">
        <i className="feather-image me-1" />Ảnh minh chứng chuyển khoản
      </h6>
      <div
        style={{
          position: 'relative', cursor: 'pointer', borderRadius: 10,
          overflow: 'hidden', border: '2px solid #d1fae5', background: '#f0fdf4',
        }}
        onClick={() => setShowFull(true)}
      >
        <img
          src={proofImg}
          alt="Minh chứng thanh toán"
          style={{
            width: '100%', maxHeight: 200, objectFit: 'contain',
            display: 'block',
          }}
          onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }}
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

      {/* Fullscreen lightbox */}
      {showFull && (
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
            src={proofImg}
            alt="Minh chứng thanh toán"
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
        </div>
      )}
    </div>
  );
}

export default function BookingDetailModal({ booking, onClose, onAccept, onReject, onCancel }) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!booking) return null;

  const st = BOOKING_STATUSES[booking.status] || BOOKING_STATUSES.PENDING;
  const pm = PAYMENT_METHODS[booking.paymentMethod] || PAYMENT_METHODS.NONE;

  const getPaymentStatusInfo = () => {
    if (booking.status === 'REFUNDED') return { label: 'Đã hoàn tiền', color: '#0ea5e9' };
    if (booking.status === 'PENDING_REFUND' || booking.status === 'PENDING_RECONCILIATION') return { label: 'Đã TT (Chờ hoàn)', color: '#d97706' };
    if (booking.paymentStatus === 'PAID' || booking.status === 'CONFIRMED' || booking.status === 'COMPLETED' || booking.status === 'UPCOMING') return { label: 'Đã thanh toán', color: '#097E52' };
    if (booking.paymentStatus === 'FAILED') return { label: 'Thất bại', color: '#ef4444' };
    return { label: 'Chưa thanh toán', color: '#94a3b8' };
  };
  const paymentStatusInfo = getPaymentStatusInfo();

  return createPortal(
    <div className="bk-modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div className="bk-modal bk-modal--lg" style={{ maxWidth: '1140px', width: '95%' }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="bk-modal-header">
          <div className="d-flex align-items-center gap-3">
            <div className="bk-modal-icon">
              <i className="feather-file-text" />
            </div>
            <div>
              <h5 className="bk-modal-title mb-0">Chi tiết đặt sân</h5>
              <p className="bk-modal-sub mb-0">Mã đặt sân: <strong>{booking.bookingCode ?? booking.id}</strong></p>
            </div>
          </div>
          <button type="button" className="bk-modal-close" onClick={onClose}>
            <i className="feather-x" />
          </button>
        </div>

        {/* Body */}
        <div className="bk-modal-body">
          <div className="row g-4">

            {/* Left: Court + Player */}
            <div className="col-md-6">
              {/* Court card */}
              <div className="bk-detail-card mb-3">
                <div className="bk-detail-card__img-wrap">
                  <img src={booking.courtImg} alt="" className="bk-detail-card__img" />
                </div>
                <div className="bk-detail-card__body">
                  <div className="bk-detail-card__title">{booking.court}</div>
                  <div className="bk-detail-card__sub">
                    <i className="feather-map-pin" />
                    {booking.venue}
                  </div>
                </div>
              </div>

              {/* Player card */}
              <div className="bk-detail-card">
                <img src={booking.playerImg} alt="" className="bk-detail-card__avatar rounded-circle"
                  onError={(e) => { e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
                <div className="bk-detail-card__body">
                  <div className="bk-detail-card__title">{booking.player}</div>
                  {booking.playerAccountSub && (
                    <div className="bk-detail-card__sub text-muted" style={{ fontSize: 12 }}>
                      <i className="feather-user" /> TK: {booking.playerAccountSub}
                    </div>
                  )}
                  <div className="bk-detail-card__sub">
                    <i className="feather-phone" />
                    {booking.playerPhone}
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bk-detail-section mt-3">
                <h6 className="bk-detail-section-title">
                  <i className="feather-dollar-sign me-1" style={{ color: '#10b981' }} />Thanh toán
                </h6>
                <InfoRow label="Tổng tiền" value={
                  <strong style={{ color: '#097E52', fontSize: '18px' }}>
                    {booking.amount.toLocaleString('vi-VN')} ₫
                  </strong>
                } />
                <InfoRow label="Hình thức" value={
                  <span>
                    <i className={pm.icon} style={{ fontSize: '12px', marginRight: '4px', color: '#64748b' }} />
                    {pm.label}
                  </span>
                } />

              </div>

              {/* Payment proof image */}
              <PaymentProofSection proofImg={booking.paymentProofImg} />


            </div>

            {/* Right: booking details */}
            <div className="col-md-6">
              {!booking.isLongTerm ? (
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
                          {booking.dateDisplay}
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="d-flex align-items-center text-muted mb-1" style={{ fontSize: '12px' }}>
                          <i className="feather-clock me-1" />Giờ chơi
                        </div>
                        <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                          {`${booking.timeStart} – ${booking.timeEnd}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <LongTermScheduleDisplay items={booking.items} />
              )}

              <div className="bk-detail-section">
                <h6 className="bk-detail-section-title">
                  <i className="feather-info me-1" style={{ color: '#3b82f6' }} />Thông tin bổ sung
                </h6>
                <InfoRow label="Số khách" value={`${booking.guests} người`} />
                <InfoRow
                  label="Trạng thái"
                  value={
                    <span className="bk-badge" style={{ color: st.color, background: st.bg, borderColor: st.border }}>
                      <i className={st.icon} />{st.label}
                    </span>
                  }
                />
                <InfoRow label="Ngày đặt" value={booking.createdAt} />
              </div>

              {booking.note && (
                <div className="bk-detail-section mt-3">
                  <h6 className="bk-detail-section-title">
                    <i className="feather-message-square me-1" style={{ color: '#64748b' }} />Ghi chú của khách
                  </h6>
                  <p className="mb-0" style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                    "{booking.note}"
                  </p>
                </div>
              )}

              {booking.rejectReason && (
                <div className="bk-detail-section mt-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' }}>
                  <h6 className="bk-detail-section-title" style={{ color: '#ef4444' }}>
                    <i className="feather-alert-circle me-1" />Lý do từ chối / huỷ
                  </h6>
                  <p className="mb-0" style={{ fontSize: 13, color: '#ef4444' }}>
                    {booking.rejectReason}
                  </p>
                </div>
              )}

              {booking.refundStatus && (
                <div className="bk-detail-section mt-3" style={{ background: booking.refundStatus === 'COMPLETED' ? '#f0f9ff' : (booking.refundStatus === 'REJECTED' ? '#fef2f2' : '#fffbeb'), border: `1px solid ${booking.refundStatus === 'COMPLETED' ? '#bae6fd' : (booking.refundStatus === 'REJECTED' ? '#fca5a5' : '#fcd34d')}`, borderRadius: 10, padding: '14px 16px' }}>
                  <h6 className="bk-detail-section-title" style={{ color: booking.refundStatus === 'COMPLETED' ? '#0284c7' : (booking.refundStatus === 'REJECTED' ? '#ef4444' : '#d97706') }}>
                    <i className={`feather-${booking.refundStatus === 'COMPLETED' ? 'check-circle' : (booking.refundStatus === 'REJECTED' ? 'x-circle' : 'clock')} me-1`} />
                    {booking.refundStatus === 'COMPLETED' ? 'Thông tin hoàn tiền' : (booking.refundStatus === 'REJECTED' ? 'Đã từ chối hoàn' : 'Đang chờ hoàn tiền')}
                  </h6>
                  <div className="bk-detail-row">
                    <span className="bk-detail-label">Khách đã thanh toán</span>
                    <span className="bk-detail-value" style={{ fontWeight: 700 }}>{Number(booking.paidAmount || 0).toLocaleString('vi-VN')} ₫</span>
                  </div>
                  <div className="bk-detail-row">
                    <span className="bk-detail-label">{booking.refundStatus === 'REJECTED' ? 'Không hoàn tiền' : 'Cần hoàn lại cho khách'}</span>
                    <span className="bk-detail-value" style={{ fontWeight: 700, color: booking.refundStatus === 'REJECTED' ? '#94a3b8' : '#ef4444' }}>
                      {booking.refundStatus === 'REJECTED' ? '0 ₫' : `– ${Number(booking.refundAmount || 0).toLocaleString('vi-VN')} ₫`}
                    </span>
                  </div>
                  {booking.paidAmount != null && booking.refundAmount != null && booking.paidAmount > booking.refundAmount && booking.refundStatus !== 'REJECTED' && (
                    <>
                      <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />
                      <div className="bk-detail-row">
                        <span className="bk-detail-label" style={{ fontWeight: 700, color: '#0f172a' }}>Bạn giữ lại (phí phạt)</span>
                        <span className="bk-detail-value" style={{ fontWeight: 800, color: '#097E52', fontSize: 15 }}>
                          {(booking.paidAmount - booking.refundAmount).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                        * Áp dụng theo chính sách hoàn tiền đã được cấu hình cho sân.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bk-modal-footer">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Đóng
          </button>
          {booking.status === 'PENDING' && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm d-flex align-items-center gap-2"
                disabled={isProcessing}
                onClick={async () => {
                  try {
                    setIsProcessing(true);
                    await onAccept(booking.id);
                    onClose();
                  } catch {
                    /* lỗi đã toast ở parent */
                  } finally {
                    setIsProcessing(false);
                  }
                }}
              >
                {isProcessing ? <div className="spinner-border spinner-border-sm" role="status" /> : <i className="feather-check-circle" />}
                Chấp nhận
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm d-flex align-items-center gap-2"
                disabled={isProcessing}
                onClick={() => { onClose(); onReject(booking); }}
              >
                <i className="feather-x-circle" />Từ chối
              </button>
            </>
          )}
          {booking.status === 'UPCOMING' && onCancel && (
            <button
              type="button"
              className="btn btn-danger btn-sm d-flex align-items-center gap-2"
              onClick={() => onCancel(booking)}
            >
              <i className="feather-slash" />Huỷ lịch
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
