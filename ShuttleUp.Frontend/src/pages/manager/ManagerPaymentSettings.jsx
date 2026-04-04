import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getVenueCheckoutSettings } from '../../api/bookingApi';
import { getManagedVenues, putVenueCheckoutSettings } from '../../api/managerVenueApi';

// Map bank name → BIN (for VietQR auto-generation)
const BANK_BIN_MAP = {
  'Vietcombank':  '970436',
  'BIDV':         '970418',
  'VietinBank':   '970415',
  'Techcombank':  '970407',
  'MB Bank':      '970422',
  'ACB':          '970416',
  'Sacombank':    '970403',
  'VP Bank':      '970432',
  'TPBank':       '970423',
  'HD Bank':      '970437',
  'SHB':          '970443',
  'OCB':          '970448',
  'SeABank':      '970440',
  'LPBank':       '970449',
  'Eximbank':     '970431',
  'Agribank':     '970405',
  'MSB':          '970426',
  'Nam A Bank':   '970428',
  'Bắc Á Bank':  '970409',
  'VIB':          '970441',
};

const BANKS = [
  'Vietcombank', 'BIDV', 'VietinBank', 'Techcombank', 'MB Bank',
  'ACB', 'Sacombank', 'VP Bank', 'TPBank', 'HD Bank',
  'SHB', 'OCB', 'SeABank', 'LPBank', 'Eximbank',
  'Agribank', 'MSB', 'Nam A Bank', 'Bắc Á Bank', 'VIB',
  'Khác',
];

const REFUND_OPTIONS = [
  { value: 'NONE', label: 'Không hoàn tiền khi huỷ' },
  { value: 'FULL', label: 'Hoàn 100% (nếu huỷ đúng hạn)' },
  { value: 'PERCENT', label: 'Hoàn một phần (%)' },
];

const CANCEL_PRESETS = [30, 60, 120, 240, 1440, 2880, 10080];

function emptyForm() {
  return {
    paymentBankName: '',
    paymentBankBin: '',
    paymentAccountNumber: '',
    paymentAccountHolder: '',
    paymentTransferNoteTemplate: '[SĐT] - [Tên sân] - [Ngày]',
    cancelAllowed: true,
    cancelBeforeMinutes: 120,
    refundType: 'NONE',
    refundPercent: null,
  };
}

function mapCheckoutToForm(data) {
  const c = data?.cancellation || {};
  return {
    paymentBankName: data?.bankName || '',
    paymentBankBin: data?.bankBin || '',
    paymentAccountNumber: data?.accountNumber || '',
    paymentAccountHolder: data?.accountHolder || '',
    paymentTransferNoteTemplate: data?.transferNoteTemplate || '[SĐT] - [Tên sân] - [Ngày]',
    cancelAllowed: c.allowCancel !== false,
    cancelBeforeMinutes: Number(c.cancelBeforeMinutes ?? 120),
    refundType: (c.refundType || 'NONE').toUpperCase(),
    refundPercent: c.refundPercent != null ? Number(c.refundPercent) : null,
  };
}

function buildPutBody(form) {
  const refundType = (form.refundType || 'NONE').toUpperCase();
  // Resolve actual bank name: if "Khác" was selected, use the customBankName
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

function showToastSuccess(msg) {
  const existing = document.querySelector('.ps-toast-container');
  const container = existing || (() => {
    const el = document.createElement('div');
    el.className = 'ps-toast-container';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(el);
    return el;
  })();

  const toast = document.createElement('div');
  toast.style.cssText = `
    background:#166534;color:#fff;padding:12px 18px;border-radius:10px;
    font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;
    box-shadow:0 4px 16px rgba(0,0,0,0.18);animation:slideInRight .25s ease;
  `;
  toast.innerHTML = `<span style="font-size:18px">✓</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => {
      toast.remove();
      if (!container.children.length) container.remove();
    }, 300);
  }, 3000);
}

// Simple debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function ManagerPaymentSettings() {
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [savedForm, setSavedForm] = useState(emptyForm); // track last saved state
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [previewQr, setPreviewQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const initialVenuePicked = useRef(false);

  const getFieldError = (name) => fieldErrors[name] || '';

  const setField = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setFieldErrors((p) => ({ ...p, [key]: '' }));
  };

  // Detect unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(savedForm);
  }, [form, savedForm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingVenues(true);
      setPageError('');
      try {
        const res = await getManagedVenues({ page: 1, pageSize: 100, sortBy: 'name', sortDir: 'asc' });
        const items = res.items || res.Items || [];
        if (!cancelled) {
          setVenues(items);
          if (items.length && !initialVenuePicked.current) {
            initialVenuePicked.current = true;
            setVenueId(items[0].id);
          }
        }
      } catch {
        if (!cancelled) setPageError('Không tải được danh sách cụm sân.');
      } finally {
        if (!cancelled) setLoadingVenues(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadSettings = useCallback(async (id) => {
    if (!id) return;
    setLoadingSettings(true);
    setPageError('');
    try {
      const data = await getVenueCheckoutSettings(id, { amount: 250000, addInfo: 'XEM_TRUOC' });
      const mapped = mapCheckoutToForm(data);
      setForm(mapped);
      setSavedForm(mapped); // sync saved state
    } catch {
      setPageError('Không tải được cài đặt thanh toán (đã chạy migration DB chưa?).');
      setForm(emptyForm());
      setSavedForm(emptyForm());
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (venueId) loadSettings(venueId);
  }, [venueId, loadSettings]);

  const previewNote = useMemo(() => {
    const t = form.paymentTransferNoteTemplate || '[SĐT] - [Tên sân] - [Ngày]';
    return t
      .replace('[SĐT]', '0901234567')
      .replace('[Tên sân]', 'Tên cụm sân')
      .replace('[Ngày]', '26/03/2026');
  }, [form.paymentTransferNoteTemplate]);

  // Debounce the previewNote so we don't fire API on every keystroke
  const debouncedPreviewNote = useDebounce(previewNote, 600);

  useEffect(() => {
    if (!venueId) {
      setPreviewQr(null);
      return;
    }
    let cancelled = false;
    setQrLoading(true);
    (async () => {
      try {
        const data = await getVenueCheckoutSettings(venueId, {
          amount: 250000,
          addInfo: debouncedPreviewNote,
        });
        if (!cancelled) setPreviewQr(data?.vietQrImageUrl || null);
      } catch {
        if (!cancelled) setPreviewQr(null);
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [venueId, debouncedPreviewNote]);

  const getInputStyle = (fieldName) => ({
    background: '#f8fafc',
    border: getFieldError(fieldName) ? '1px solid #dc3545' : '1px solid transparent',
    borderRadius: '8px',
    padding: '12px 16px',
    boxShadow: 'none',
  });

  // Handle venue change with unsaved-changes guard
  const handleVenueChange = (newVenueId) => {
    if (hasUnsavedChanges) {
      const ok = window.confirm(
        'Bạn có thay đổi chưa được lưu.\nNếu chuyển sang cụm sân khác, các thay đổi sẽ bị mất.\nBạn có muốn tiếp tục không?'
      );
      if (!ok) return;
    }
    setVenueId(newVenueId);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!venueId) return;

    const errors = {};

    // Resolve effective bank name for validation
    const effectiveBankName = form.paymentBankName === 'Khác'
      ? form.customBankName?.trim()
      : form.paymentBankName?.trim();

    if (!effectiveBankName) errors.paymentBankName = 'Chọn hoặc nhập tên ngân hàng.';

    // Account number: digits only, 6–19 chars
    const acctNum = form.paymentAccountNumber?.trim() || '';
    if (!acctNum) {
      errors.paymentAccountNumber = 'Nhập số tài khoản.';
    } else if (!/^\d+$/.test(acctNum)) {
      errors.paymentAccountNumber = 'Số tài khoản chỉ được chứa chữ số.';
    } else if (acctNum.length < 6 || acctNum.length > 19) {
      errors.paymentAccountNumber = 'Số tài khoản phải từ 6 đến 19 chữ số.';
    }

    if (!form.paymentAccountHolder?.trim()) errors.paymentAccountHolder = 'Nhập tên chủ tài khoản.';

    const rt = (form.refundType || 'NONE').toUpperCase();
    if (rt === 'PERCENT') {
      const p = Number(form.refundPercent);
      if (Number.isNaN(p) || p < 0 || p > 100) {
        errors.refundPercent = 'Phần trăm hoàn phải từ 0 đến 100.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await putVenueCheckoutSettings(venueId, buildPutBody(form));
      setPageError('');
      showToastSuccess('Đã lưu cài đặt thanh toán & chính sách huỷ.');
      await loadSettings(venueId); // này sẽ sync lại savedForm
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Lưu thất bại.';
      setPageError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVenueName = venues.find((v) => v.id === venueId)?.name || '';

  // Policy summary in plain language
  const policySummary = useMemo(() => {
    if (!form.cancelAllowed) return 'Người chơi không được phép tự huỷ đặt sân trên app.';
    const mins = Number(form.cancelBeforeMinutes);
    let timeStr = '';
    if (mins >= 1440) timeStr = `${mins / 1440} ngày`;
    else if (mins >= 60) timeStr = `${mins / 60} giờ`;
    else timeStr = `${mins} phút`;

    const refund = (form.refundType || 'NONE').toUpperCase();
    let refundStr = '';
    if (refund === 'NONE') refundStr = 'không hoàn tiền';
    else if (refund === 'FULL') refundStr = 'hoàn 100%';
    else if (refund === 'PERCENT') refundStr = `hoàn ${form.refundPercent ?? '?'}%`;

    return `Người chơi được huỷ trước ${timeStr}, ${refundStr} số tiền đã cọc.`;
  }, [form.cancelAllowed, form.cancelBeforeMinutes, form.refundType, form.refundPercent]);

  return (
    <div className="mgr-page">
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="mb-1" style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
            Cài đặt thanh toán
          </h1>
          <p className="text-muted mb-0">
            Thông tin nhận tiền và chính sách huỷ cho từng cụm sân (theo venue).
          </p>
        </div>
        {hasUnsavedChanges && (
          <span style={{
            background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
            borderRadius: 8, padding: '5px 14px', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>⚠</span> Có thay đổi chưa lưu
          </span>
        )}
      </div>

      {pageError && (
        <div className="alert alert-warning mb-4" role="alert">
          {pageError}
        </div>
      )}

      <div className="mb-4">
        <label className="form-label fw-semibold" style={{ color: '#334155' }}>
          Chọn cụm sân
        </label>
        <select
          className="form-select"
          style={{ maxWidth: 480, borderRadius: 8 }}
          value={venueId}
          disabled={loadingVenues || venues.length === 0}
          onChange={(e) => handleVenueChange(e.target.value)}
        >
          {venues.length === 0 && !loadingVenues && (
            <option value="">Chưa có cụm sân — hãy tạo venue trước</option>
          )}
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.isActive === false ? ' (ẩn)' : ''}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSave} noValidate>
        <div className="row g-4 d-flex align-items-stretch">
          <div className="col-xl-8 col-lg-7 d-flex flex-column gap-4">
            {/* Info banner */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <i className="feather-info" style={{ color: '#3b82f6', fontSize: 17, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: '#1e40af' }}>
                Mã QR VietQR <strong>được tạo tự động</strong> từ thông tin tài khoản ngân hàng bạn nhập bên dưới — bạn <strong>không cần tải ảnh QR lên thủ công</strong>.
                Người chơi sẽ thấy QR này khi thanh toán đặt sân.
              </div>
            </div>

            {loadingSettings && (
              <div className="text-muted small">
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Đang tải cài đặt…
              </div>
            )}

            <div className="row g-4 flex-grow-1">
              {/* ===== Card: Bank Info ===== */}
              <div className="col-md-6 d-flex flex-column">
                <div className="card flex-grow-1 border-0 shadow-sm" style={{ borderRadius: 12 }}>
                  <div className="card-header border-0 bg-transparent pt-4 pb-0">
                    <div className="d-flex align-items-center gap-3">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="feather-credit-card" style={{ color: '#097E52', fontSize: 20 }} />
                      </div>
                      <div>
                        <h5 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Chuyển khoản ngân hàng</h5>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>Tài khoản nhận tiền</span>
                      </div>
                    </div>
                    <hr className="mt-4 mb-0" style={{ borderColor: '#f1f5f9' }} />
                  </div>
                  <div className="card-body pt-4">
                    {/* Bank select — auto-fills BIN */}
                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                        Ngân hàng <span className="text-danger">*</span>
                      </label>
                      <select
                        className={`form-select ${getFieldError('paymentBankName') ? 'is-invalid' : ''}`}
                        style={getInputStyle('paymentBankName')}
                        value={form.paymentBankName}
                        onChange={(e) => {
                          const bank = e.target.value;
                          const autoBin = BANK_BIN_MAP[bank] || '';
                          setForm((p) => ({ ...p, paymentBankName: bank, paymentBankBin: autoBin, customBankName: '' }));
                          setFieldErrors((p) => ({ ...p, paymentBankName: '' }));
                        }}
                      >
                        <option value="">-- Chọn ngân hàng --</option>
                        {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                      {getFieldError('paymentBankName') && <div className="invalid-feedback d-block">{getFieldError('paymentBankName')}</div>}
                    </div>

                    {/* Custom bank name input when "Khác" is selected */}
                    {form.paymentBankName === 'Khác' && (
                      <div className="mb-4">
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                          Nhập tên ngân hàng <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className={`form-control ${getFieldError('paymentBankName') ? 'is-invalid' : ''}`}
                          style={getInputStyle('paymentBankName')}
                          placeholder="VD: Bắc Á Bank, Agribank…"
                          value={form.customBankName || ''}
                          onChange={(e) => setField('customBankName', e.target.value)}
                        />
                        {/* Manual BIN input only when bank is not in the list */}
                        <div className="mt-3">
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                            Mã BIN ngân hàng <span className="text-muted fw-normal">(tùy chọn — dùng để tạo VietQR)</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={8}
                            className="form-control"
                            style={getInputStyle('paymentBankBin')}
                            placeholder="VD: 970436"
                            value={form.paymentBankBin}
                            onChange={(e) => setField('paymentBankBin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                          />
                          <small className="text-muted">Tra mã BIN tại <a href="https://vietqr.io/danh-sach-ngan-hang" target="_blank" rel="noreferrer">vietqr.io</a> nếu ngân hàng của bạn chưa có trong danh sách.</small>
                        </div>
                      </div>
                    )}

                    {/* Show auto-filled BIN as readonly badge (not editable) */}
                    {form.paymentBankName && form.paymentBankName !== 'Khác' && form.paymentBankBin && (
                      <div className="mb-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#059669' }}>
                          <i className="feather-check-circle" style={{ fontSize: 15 }} />
                          <span>Mã BIN ngân hàng: <strong>{form.paymentBankBin}</strong> (tự động điền từ ngân hàng đã chọn)</span>
                        </div>
                      </div>
                    )}

                    {/* Account number — digits only */}
                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                        Số tài khoản <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`form-control ${getFieldError('paymentAccountNumber') ? 'is-invalid' : ''}`}
                        style={getInputStyle('paymentAccountNumber')}
                        placeholder="0123456789"
                        value={form.paymentAccountNumber}
                        onChange={(e) => setField('paymentAccountNumber', e.target.value.replace(/\D/g, ''))}
                      />
                      {getFieldError('paymentAccountNumber')
                        ? <div className="invalid-feedback">{getFieldError('paymentAccountNumber')}</div>
                        : <small className="text-muted">Chỉ nhập chữ số, không nhập dấu cách hoặc ký tự đặc biệt.</small>
                      }
                    </div>

                    {/* Account holder */}
                    <div className="mb-2">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                        Chủ tài khoản <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-control text-uppercase ${getFieldError('paymentAccountHolder') ? 'is-invalid' : ''}`}
                        style={getInputStyle('paymentAccountHolder')}
                        placeholder="NGUYEN VAN A"
                        value={form.paymentAccountHolder}
                        onChange={(e) => setField('paymentAccountHolder', e.target.value.toUpperCase())}
                      />
                      {getFieldError('paymentAccountHolder') && <div className="invalid-feedback">{getFieldError('paymentAccountHolder')}</div>}
                    </div>

                    {/* Transfer note template */}
                    <div className="mb-0">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                        Mẫu nội dung chuyển khoản
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        style={getInputStyle('paymentTransferNoteTemplate')}
                        value={form.paymentTransferNoteTemplate}
                        onChange={(e) => setField('paymentTransferNoteTemplate', e.target.value)}
                      />
                      <small className="text-muted">Placeholder: [SĐT], [Tên sân], [Ngày]</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== Card: Cancellation Policy ===== */}
              <div className="col-md-6 d-flex flex-column">
                <div className="card flex-grow-1 border-0 shadow-sm" style={{ borderRadius: 12 }}>
                  <div className="card-header border-0 bg-transparent pt-4 pb-0">
                    <div className="d-flex align-items-center gap-3">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="feather-x-circle" style={{ color: '#d97706', fontSize: 20 }} />
                      </div>
                      <div>
                        <h5 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Chính sách huỷ (người chơi)</h5>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>Áp dụng cho đơn tại venue này</span>
                      </div>
                    </div>
                    <hr className="mt-4 mb-0" style={{ borderColor: '#f1f5f9' }} />
                  </div>
                  <div className="card-body pt-4">
                    {/* Toggle */}
                    <div className="form-check form-switch mb-4">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="cancelAllowed"
                        checked={form.cancelAllowed}
                        onChange={(e) => setField('cancelAllowed', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="cancelAllowed" style={{ fontWeight: 600 }}>
                        Cho phép người chơi tự huỷ trên app
                      </label>
                    </div>

                    {/* Only show cancel policy details when cancelAllowed = true */}
                    {form.cancelAllowed ? (
                      <>
                        {/* Cancel deadline presets */}
                        <div className="mb-3">
                          <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                            Phải huỷ trước giờ đá ít nhất
                          </label>
                          <div className="d-flex flex-wrap gap-2 mb-2">
                            {CANCEL_PRESETS.map((m) => (
                              <button
                                key={m}
                                type="button"
                                className={`btn btn-sm ${form.cancelBeforeMinutes === m ? 'btn-primary' : 'btn-outline-secondary'}`}
                                onClick={() => setField('cancelBeforeMinutes', m)}
                              >
                                {m >= 1440 ? `${m / 1440} ngày` : m >= 60 ? `${m / 60}h` : `${m} phút`}
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={10080}
                            className="form-control"
                            style={getInputStyle('cancelBeforeMinutes')}
                            value={form.cancelBeforeMinutes}
                            onChange={(e) => setField('cancelBeforeMinutes', Number(e.target.value))}
                          />
                          <small className="text-muted">Tính theo phút trước giờ bắt đầu sân (tối đa 10080 = 7 ngày).</small>
                        </div>

                        {/* Refund type */}
                        <div className="mb-3">
                          <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                            Hoàn tiền khi huỷ đúng hạn
                          </label>
                          <select
                            className="form-select"
                            style={getInputStyle('refundType')}
                            value={form.refundType}
                            onChange={(e) => setField('refundType', e.target.value)}
                          >
                            {REFUND_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Refund percent — only when PERCENT */}
                        {(form.refundType || '').toUpperCase() === 'PERCENT' && (
                          <div className="mb-0">
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                              Phần trăm hoàn <span className="text-danger">*</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              className={`form-control ${getFieldError('refundPercent') ? 'is-invalid' : ''}`}
                              style={getInputStyle('refundPercent')}
                              value={form.refundPercent ?? ''}
                              onChange={(e) => setField('refundPercent', e.target.value === '' ? null : Number(e.target.value))}
                            />
                            {getFieldError('refundPercent') && <div className="invalid-feedback">{getFieldError('refundPercent')}</div>}
                          </div>
                        )}
                      </>
                    ) : (
                      // Disabled state explanation
                      <div style={{
                        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                        padding: '14px 16px', color: '#991b1b', fontSize: 13,
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                      }}>
                        <i className="feather-lock" style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} />
                        <span>Người chơi <strong>không thể tự huỷ</strong> đặt sân. Chỉ quản lý sân mới có quyền huỷ đơn.</span>
                      </div>
                    )}

                    {/* Policy summary in plain language */}
                    <div style={{
                      marginTop: 20, background: '#f0fdf4', border: '1px dashed #86efac',
                      borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534',
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <i className="feather-file-text" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                      <span><strong>Tóm tắt:</strong> {policySummary}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <div className="col-12 mt-2">
                <button
                  type="submit"
                  className="btn btn-primary px-4 py-2"
                  style={{ borderRadius: 8, fontSize: 15, fontWeight: 500 }}
                  disabled={submitting || !venueId || loadingSettings}
                >
                  {submitting ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  ) : (
                    <i className="feather-save me-2" />
                  )}
                  Lưu cài đặt
                </button>
              </div>
            </div>
          </div>

          {/* ===== Preview Panel ===== */}
          <div className="col-xl-4 col-lg-5">
            <div className="card shadow-sm border-0" style={{ position: 'sticky', top: '24px', borderRadius: 12 }}>
              <div className="card-header border-0 bg-transparent pt-4 pb-0 text-center">
                <h4 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Xem trước (VietQR)</h4>
              </div>
              <div className="card-body pt-3">
                <p className="text-muted text-center" style={{ fontSize: '13px', marginBottom: 16 }}>
                  {selectedVenueName || 'Chọn cụm sân'} — mẫu 250.000&nbsp;₫
                </p>
                <div className="p-4 rounded-3 d-flex flex-column align-items-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div className="text-center mb-3">
                    <div className="bg-white p-3 rounded-4 d-inline-block shadow-sm" style={{ border: '1px solid #e2e8f0', minWidth: 158, minHeight: 158, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {qrLoading ? (
                        <div className="text-muted" style={{ fontSize: 13 }}>
                          <span className="spinner-border spinner-border-sm me-1" role="status" />
                          Đang tải…
                        </div>
                      ) : previewQr ? (
                        <img
                          src={previewQr}
                          alt="VietQR"
                          style={{ width: '130px', height: '130px', objectFit: 'contain' }}
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                        />
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '10px' }}>
                          <i className="feather-image" style={{ fontSize: 32, display: 'block', marginBottom: 6 }} />
                          Chưa đủ thông tin<br />để tạo QR
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-center" style={{ fontSize: '14px', color: '#166534', width: '100%' }}>
                    <div className="mb-2 d-flex justify-content-between w-100">
                      <span className="opacity-75">Ngân hàng:</span>
                      <strong className="text-end">
                        {form.paymentBankName === 'Khác'
                          ? (form.customBankName || '…')
                          : (form.paymentBankName || '…')}
                      </strong>
                    </div>
                    <div className="mb-2 d-flex justify-content-between w-100">
                      <span className="opacity-75">Số TK:</span>
                      <strong className="text-end">{form.paymentAccountNumber || '…'}</strong>
                    </div>
                    <div className="mb-2 d-flex justify-content-between w-100">
                      <span className="opacity-75">Chủ TK:</span>
                      <strong className="text-end">{form.paymentAccountHolder || '…'}</strong>
                    </div>
                    <hr className="my-3 mx-auto" style={{ width: '80%', borderColor: '#bbf7d0' }} />
                    <div className="text-muted" style={{ fontSize: '12px', color: '#14532d' }}>
                      Nội dung CK:
                      <strong className="d-block mt-1" style={{ background: '#dcfce7', padding: '6px 8px', borderRadius: 6, color: '#166534' }}>
                        {previewNote}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
