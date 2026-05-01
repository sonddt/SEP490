import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const QUICK_REASONS = [
  'Sân đang bảo trì trong ngày này',
  'Cụm sân tạm thời đóng cửa',
  'Trùng lịch với sự kiện khác',
  'Lý do khác',
];

export default function CancelModal({ booking, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setReason('');
    setCustomReason('');
    setSubmitting(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [booking]);

  const finalReason = reason === 'Lý do khác' ? customReason.trim() : reason;
  const canSubmit = finalReason.length > 0 && !submitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm(booking.bookingId ?? booking.id, finalReason);
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking) return null;

  const hasPaid = booking.paymentStatus === 'PAID';

  return createPortal(
    <div className="bk-modal-overlay" onClick={onClose}>
      <div className="bk-modal bk-modal--sm" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="bk-modal-header bk-modal-header--danger">
          <div className="d-flex align-items-center gap-3">
            <div className="bk-modal-icon bk-modal-icon--danger">
              <i className="feather-slash" />
            </div>
            <div>
              <h5 className="bk-modal-title mb-0">Huỷ lịch đã duyệt</h5>
              <p className="bk-modal-sub mb-0">Vui lòng cho biết lý do huỷ lịch</p>
            </div>
          </div>
          <button type="button" className="bk-modal-close" onClick={onClose}>
            <i className="feather-x" />
          </button>
        </div>

        {/* Body */}
        <div className="bk-modal-body">
          {/* Booking summary */}
          <div className="bk-reject-summary">
            <img src={booking.courtImg} alt="" className="bk-reject-summary__img" />
            <div>
              <div className="bk-reject-summary__court">{booking.court}</div>
              <div className="bk-reject-summary__meta">
                <i className="feather-map-pin" />
                {booking.venue}
              </div>
              <div className="bk-reject-summary__meta">
                <i className="feather-user" />
                {booking.player} &nbsp;·&nbsp;
                <i className="feather-calendar" />
                {booking.dateDisplay} &nbsp;{booking.timeStart}–{booking.timeEnd}
              </div>
            </div>
          </div>

          {/* Refund notice */}
          {hasPaid && (
            <div className="alert alert-warning d-flex align-items-start gap-2 mb-3" style={{ fontSize: 13, borderRadius: 10 }}>
              <i className="feather-alert-triangle" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong>Lưu ý:</strong> Đơn này đã thanh toán{' '}
                <strong style={{ color: '#d97706' }}>{booking.amount?.toLocaleString('vi-VN')} ₫</strong>.
                Sau khi huỷ, hệ thống sẽ tạo yêu cầu hoàn tiền và gửi email thông báo cho người chơi để cung cấp thông tin tài khoản nhận tiền hoàn.
              </div>
            </div>
          )}

          {/* Quick reasons */}
          <div className="mb-3">
            <label className="form-label fw-semibold mb-2" style={{ fontSize: 13 }}>
              Chọn lý do nhanh
            </label>
            <div className="bk-quick-reasons">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`bk-quick-reason${reason === r ? ' active' : ''}`}
                  onClick={() => setReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Custom reason */}
          <div>
            <label className="form-label fw-semibold mb-1" style={{ fontSize: 13 }}>
              {reason === 'Lý do khác' ? (
                <>Nhập lý do <span className="text-danger">*</span></>
              ) : (
                <>Ghi chú thêm <span className="text-muted fw-normal">(tuỳ chọn)</span></>
              )}
            </label>
            <textarea
              ref={textareaRef}
              className="form-control"
              rows={3}
              placeholder="Nhập lý do huỷ lịch cho người đặt biết..."
              value={reason === 'Lý do khác' ? customReason : reason !== '' ? reason : customReason}
              onChange={(e) => {
                if (reason === 'Lý do khác') {
                  setCustomReason(e.target.value);
                } else {
                  setReason('');
                  setCustomReason(e.target.value);
                }
              }}
              onFocus={() => { if (reason !== 'Lý do khác') setReason(''); }}
              style={{ fontSize: 13, resize: 'vertical' }}
            />
            <small className="text-muted d-block mt-1" style={{ fontSize: 11 }}>
              Lý do này sẽ được gửi đến người đặt sân qua thông báo và email
            </small>
          </div>
        </div>

        {/* Footer */}
        <div className="bk-modal-footer">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Huỷ bỏ
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm d-flex align-items-center gap-2"
            disabled={!canSubmit}
            onClick={handleConfirm}
          >
            {submitting ? (
              <><span className="spinner-border spinner-border-sm" />Đang xử lý...</>
            ) : (
              <><i className="feather-slash" />Xác nhận huỷ lịch</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
