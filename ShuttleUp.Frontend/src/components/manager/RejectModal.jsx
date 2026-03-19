import { useState, useEffect, useRef } from 'react';

const QUICK_REASONS = [
  'Khung giờ này đã được đặt trước',
  'Sân đang bảo trì trong ngày này',
  'Cụm sân tạm thời đóng cửa',
  'Số lượng khách vượt quá giới hạn',
  'Lý do khác',
];

export default function RejectModal({ booking, onConfirm, onClose }) {
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
    await new Promise((r) => setTimeout(r, 400)); // simulate async
    onConfirm(booking.id, finalReason);
    setSubmitting(false);
  };

  if (!booking) return null;

  return (
    <div className="bk-modal-overlay" onClick={onClose}>
      <div className="bk-modal bk-modal--sm" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="bk-modal-header bk-modal-header--danger">
          <div className="d-flex align-items-center gap-3">
            <div className="bk-modal-icon bk-modal-icon--danger">
              <i className="feather-x-circle" />
            </div>
            <div>
              <h5 className="bk-modal-title mb-0">Từ chối yêu cầu</h5>
              <p className="bk-modal-sub mb-0">Vui lòng cho biết lý do từ chối</p>
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
              placeholder="Nhập lý do hoặc ghi chú thêm cho người đặt..."
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
              Lý do này sẽ được gửi đến người đặt sân
            </small>
          </div>
        </div>

        {/* Footer */}
        <div className="bk-modal-footer">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Huỷ
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
              <><i className="feather-x-circle" />Xác nhận từ chối</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
