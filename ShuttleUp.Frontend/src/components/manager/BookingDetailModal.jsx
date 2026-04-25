import { useState } from 'react';
import { BOOKING_STATUSES, PAYMENT_METHODS } from '../../data/bookingsMock';
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

export default function BookingDetailModal({ booking, onClose, onAccept, onReject }) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!booking) return null;

  const st = BOOKING_STATUSES[booking.status] || BOOKING_STATUSES.PENDING;
  const pm = PAYMENT_METHODS[booking.paymentMethod] || PAYMENT_METHODS.NONE;

  const paymentStatusLabel = booking.paymentStatus === 'PAID'
    ? 'Đã thanh toán'
    : booking.paymentStatus === 'REFUNDED'
      ? 'Đã hoàn tiền'
      : 'Chưa thanh toán';

  const paymentStatusColor = booking.paymentStatus === 'PAID'
    ? '#097E52'
    : booking.paymentStatus === 'REFUNDED'
      ? '#f59e0b'
      : '#94a3b8';

  return (
    <div className="bk-modal-overlay" onClick={onClose}>
      <div className="bk-modal bk-modal--lg" onClick={(e) => e.stopPropagation()}>

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

              {/* Payment proof image */}
              <PaymentProofSection proofImg={booking.paymentProofImg} />
            </div>

            <div className="col-md-6">
              <div className="bk-detail-section">
                <h6 className="bk-detail-section-title">Thông tin lịch đặt</h6>
                {!booking.isLongTerm ? (
                  <>
                    <InfoRow label="Ngày" value={booking.dateDisplay} />
                    <InfoRow label="Giờ" value={`${booking.timeStart} – ${booking.timeEnd}`} />
                  </>
                ) : (
                  <LongTermScheduleDisplay items={booking.items} />
                )}
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

              <div className="bk-detail-section mt-3">
                <h6 className="bk-detail-section-title">Thanh toán</h6>
                <InfoRow label="Số tiền" value={
                  <strong style={{ color: '#097E52', fontSize: 15 }}>
                    {booking.amount.toLocaleString('vi-VN')} ₫
                  </strong>
                } />
                <InfoRow label="Hình thức" value={
                  <span>
                    <i className={pm.icon} style={{ fontSize: 12, marginRight: 4, color: '#64748b' }} />
                    {pm.label}
                  </span>
                } />
                <InfoRow label="Trạng thái TT" value={
                  <strong style={{ color: paymentStatusColor }}>{paymentStatusLabel}</strong>
                } />
              </div>

              {booking.note && (
                <div className="bk-detail-section mt-3">
                  <h6 className="bk-detail-section-title">Ghi chú của khách</h6>
                  <p className="mb-0" style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                    "{booking.note}"
                  </p>
                </div>
              )}

              {booking.rejectReason && (
                <div className="bk-detail-section mt-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' }}>
                  <h6 className="bk-detail-section-title" style={{ color: '#ef4444' }}>
                    <i className="feather-alert-circle me-1" />Lý do từ chối
                  </h6>
                  <p className="mb-0" style={{ fontSize: 13, color: '#ef4444' }}>
                    {booking.rejectReason}
                  </p>
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
        </div>
      </div>
    </div>
  );
}
