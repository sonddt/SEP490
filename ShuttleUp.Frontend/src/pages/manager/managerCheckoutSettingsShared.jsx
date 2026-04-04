import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const BANK_BIN_MAP = {
  'Vietcombank': '970436', 'BIDV': '970418', 'VietinBank': '970415',
  'Techcombank': '970407', 'MB Bank': '970422', 'ACB': '970416',
  'Sacombank': '970403', 'VP Bank': '970432', 'TPBank': '970423',
  'HD Bank': '970437', 'SHB': '970443', 'OCB': '970448',
  'SeABank': '970440', 'LPBank': '970449', 'Eximbank': '970431',
  'Agribank': '970405', 'MSB': '970426', 'Nam A Bank': '970428',
  'Bắc Á Bank': '970409', 'VIB': '970441',
};

export const BANKS = [
  'Vietcombank', 'BIDV', 'VietinBank', 'Techcombank', 'MB Bank',
  'ACB', 'Sacombank', 'VP Bank', 'TPBank', 'HD Bank',
  'SHB', 'OCB', 'SeABank', 'LPBank', 'Eximbank',
  'Agribank', 'MSB', 'Nam A Bank', 'Bắc Á Bank', 'VIB',
  'Khác',
];

export const REFUND_OPTIONS = [
  { value: 'NONE', label: 'Không hoàn tiền khi huỷ' },
  { value: 'FULL', label: 'Hoàn 100% (nếu huỷ đúng hạn)' },
  { value: 'PERCENT', label: 'Hoàn một phần (%)' },
];

export const CANCEL_PRESETS = [30, 60, 120, 240, 1440, 2880, 10080];

export function emptyForm() {
  return {
    paymentBankName: '', paymentBankBin: '', paymentAccountNumber: '',
    paymentAccountHolder: '', paymentTransferNoteTemplate: '[SĐT] - [Tên sân] - [Ngày]',
    customBankName: '',
    cancelAllowed: true, cancelBeforeMinutes: 120, refundType: 'NONE', refundPercent: null,
  };
}

export function mapCheckoutToForm(data) {
  const c = data?.cancellation || {};
  return {
    paymentBankName: data?.bankName || '',
    paymentBankBin: data?.bankBin || '',
    paymentAccountNumber: data?.accountNumber || '',
    paymentAccountHolder: data?.accountHolder || '',
    paymentTransferNoteTemplate: data?.transferNoteTemplate || '[SĐT] - [Tên sân] - [Ngày]',
    customBankName: '',
    cancelAllowed: c.allowCancel !== false,
    cancelBeforeMinutes: Number(c.cancelBeforeMinutes ?? 120),
    refundType: (c.refundType || 'NONE').toUpperCase(),
    refundPercent: c.refundPercent != null ? Number(c.refundPercent) : null,
  };
}

export function buildPutBody(form) {
  const refundType = (form.refundType || 'NONE').toUpperCase();
  const bankName = form.paymentBankName === 'Khác'
    ? (form.customBankName?.trim() || 'Khác')
    : (form.paymentBankName?.trim() || null);
  return {
    paymentBankName: bankName || null,
    paymentBankBin: form.paymentBankBin?.trim() || null,
    paymentAccountNumber: form.paymentAccountNumber?.trim() || null,
    paymentAccountHolder: (form.paymentAccountHolder?.trim() || '').toUpperCase() || null,
    paymentTransferNoteTemplate: form.paymentTransferNoteTemplate?.trim() || null,
    cancelAllowed: !!form.cancelAllowed,
    cancelBeforeMinutes: Math.max(0, Math.min(10080, Number(form.cancelBeforeMinutes) || 0)),
    refundType,
    refundPercent: refundType === 'PERCENT' ? Number(form.refundPercent) : null,
  };
}

export function useDebounce(value, delay) {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return d;
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Tiếp tục', cancelLabel = 'Hủy bỏ', onConfirm, onCancel, variant = 'warning' }) {
  if (!open) return null;
  const colors = { warning: { bg: '#fef3c7', border: '#fde68a', icon: 'feather-alert-triangle', color: '#92400e' }, danger: { bg: '#fef2f2', border: '#fecaca', icon: 'feather-alert-circle', color: '#991b1b' } };
  const c = colors[variant] || colors.warning;
  return createPortal(
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1100 }} onClick={onCancel}>
      <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-content" style={{ borderRadius: 14 }}>
          <div className="modal-body text-center py-4">
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: c.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <i className={c.icon} style={{ color: c.color, fontSize: 22 }} />
            </div>
            {title && <h6 className="mb-2" style={{ color: '#1e293b' }}>{title}</h6>}
            <p className="small text-muted mb-0" style={{ whiteSpace: 'pre-line' }}>{message}</p>
          </div>
          <div className="modal-footer justify-content-center border-0 pt-0 pb-3" style={{ gap: 8 }}>
            <button className="btn btn-outline-secondary btn-sm px-3" onClick={onCancel}>{cancelLabel}</button>
            <button className="btn btn-warning btn-sm px-3" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Toast({ msg, type = 'success', onClose }) {
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
