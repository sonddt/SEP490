import { useEffect } from 'react';

export default function MatchingScheduleModal({
  open,
  onClose,
  range,
  courtsText,
  loading = false,
  errorMessage = null,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1080,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="matching-schedule-title"
        style={{
          backgroundColor: '#fff',
          borderRadius: '20px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
          }}
        >
          <h5 id="matching-schedule-title" style={{ margin: 0, fontWeight: '800', fontSize: '17px', color: '#1e293b' }}>
            <i className="feather-calendar me-2" style={{ color: '#ea580c' }}></i>
            Lịch chơi
          </h5>
          <button
            type="button"
            className="btn btn-sm btn-link text-muted p-0"
            onClick={onClose}
            aria-label="Đóng"
            style={{ fontSize: '22px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '22px 22px 24px', fontSize: '14px', color: '#1e293b', lineHeight: 1.55 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontWeight: '600', color: '#64748b' }}>Đang tải lịch…</div>
          ) : errorMessage ? (
            <div style={{ color: '#b45309', fontWeight: '600', marginBottom: '22px' }}>{errorMessage}</div>
          ) : (
            <>
              <div style={{ fontWeight: '700', color: '#b45309', marginBottom: '8px' }}>Tổng quãng thời gian chơi</div>
              <div style={{ fontWeight: '600', marginBottom: '18px' }}>
                {range || 'Chưa có thông tin lịch.'}
              </div>
              <div style={{ fontWeight: '700', color: '#b45309', marginBottom: '8px' }}>Các sân đã đăng ký</div>
              <div style={{ fontWeight: '600', marginBottom: '22px' }}>{courtsText ?? '—'}</div>
            </>
          )}
          <button
            type="button"
            className="btn w-100"
            onClick={onClose}
            style={{ borderRadius: '12px', fontWeight: '700', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '12px' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
