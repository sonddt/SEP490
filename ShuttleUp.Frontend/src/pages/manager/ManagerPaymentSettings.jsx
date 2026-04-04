import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getVenueCheckoutSettings } from '../../api/bookingApi';
import { getManagedVenues, putVenueCheckoutSettings } from '../../api/managerVenueApi';
import {
  BANK_BIN_MAP,
  BANKS,
  emptyForm,
  mapCheckoutToForm,
  buildPutBody,
  useDebounce,
  ConfirmModal,
  Toast,
} from './managerCheckoutSettingsShared';

export default function ManagerPaymentSettings() {
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [savedForm, setSavedForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [previewQr, setPreviewQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const initialVenuePicked = useRef(false);

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);
  const getFieldError = (name) => fieldErrors[name] || '';
  const setField = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setFieldErrors((p) => ({ ...p, [key]: '' }));
  };

  const hasPaymentChanges = useMemo(() => {
    const keys = ['paymentBankName', 'paymentBankBin', 'paymentAccountNumber', 'paymentAccountHolder', 'paymentTransferNoteTemplate', 'customBankName'];
    return keys.some((k) => (form[k] || '') !== (savedForm[k] || ''));
  }, [form, savedForm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingVenues(true); setPageError('');
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
    setLoadingSettings(true); setPageError(''); setSettingsError(false);
    try {
      const data = await getVenueCheckoutSettings(id, { amount: 250000, addInfo: 'XEM_TRUOC' });
      const mapped = mapCheckoutToForm(data);
      setForm(mapped); setSavedForm(mapped);
    } catch {
      setSettingsError(true);
      setForm(emptyForm()); setSavedForm(emptyForm());
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => { if (venueId) loadSettings(venueId); }, [venueId, loadSettings]);

  const previewNote = useMemo(() => {
    const t = form.paymentTransferNoteTemplate || '[SĐT] - [Tên sân] - [Ngày]';
    return t.replace('[SĐT]', '0901234567').replace('[Tên sân]', 'Tên cụm sân').replace('[Ngày]', '26/03/2026');
  }, [form.paymentTransferNoteTemplate]);
  const debouncedNote = useDebounce(previewNote, 600);

  useEffect(() => {
    if (!venueId) { setPreviewQr(null); return; }
    let cancelled = false;
    setQrLoading(true);
    (async () => {
      try {
        const data = await getVenueCheckoutSettings(venueId, { amount: 250000, addInfo: debouncedNote });
        if (!cancelled) setPreviewQr(data?.vietQrImageUrl || null);
      } catch { if (!cancelled) setPreviewQr(null); }
      finally { if (!cancelled) setQrLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [venueId, debouncedNote]);

  const handleVenueChange = (newId) => {
    if (!hasPaymentChanges) { setVenueId(newId); return; }
    setConfirmModal({
      title: 'Thay đổi chưa lưu',
      message: 'Bạn có thay đổi chưa được lưu.\nNếu chuyển sang cụm sân khác, các thay đổi sẽ bị mất.',
      confirmLabel: 'Chuyển cụm sân',
      onConfirm: () => { setConfirmModal(null); setVenueId(newId); },
      onCancel: () => setConfirmModal(null),
    });
  };

  const validatePayment = () => {
    const errors = {};
    const effectiveName = form.paymentBankName === 'Khác' ? form.customBankName?.trim() : form.paymentBankName?.trim();
    if (!effectiveName) errors.paymentBankName = 'Chọn hoặc nhập tên ngân hàng.';
    const acctNum = form.paymentAccountNumber?.trim() || '';
    if (!acctNum) errors.paymentAccountNumber = 'Nhập số tài khoản.';
    else if (!/^\d+$/.test(acctNum)) errors.paymentAccountNumber = 'Số tài khoản chỉ được chứa chữ số.';
    else if (acctNum.length < 6 || acctNum.length > 19) errors.paymentAccountNumber = 'Số tài khoản phải từ 6 đến 19 chữ số.';
    if (!form.paymentAccountHolder?.trim()) errors.paymentAccountHolder = 'Nhập tên chủ tài khoản.';
    return errors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!venueId) return;
    const errors = validatePayment();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setFieldErrors({}); setSubmitting(true);
    try {
      await putVenueCheckoutSettings(venueId, buildPutBody(form));
      setPageError('');
      showToast('Đã lưu thông tin tài khoản nhận tiền.');
      await loadSettings(venueId);
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Lưu thất bại.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVenueName = venues.find((v) => v.id === venueId)?.name || '';

  const inputStyle = (name) => ({
    background: '#f8fafc', borderRadius: '8px', padding: '12px 16px', boxShadow: 'none',
    border: getFieldError(name) ? '1px solid #dc3545' : '1px solid transparent',
  });

  return (
    <div className="mgr-page">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal open={!!confirmModal} {...(confirmModal || {})} />

      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="mb-1" style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>Cài đặt thanh toán</h1>
          <p className="text-muted mb-0">Tài khoản nhận tiền và VietQR cho từng cụm sân. Chính sách huỷ/ hoàn tiền nằm ở mục <strong>Chính sách sân và hoàn tiền</strong> trên menu.</p>
        </div>
        {hasPaymentChanges && (
          <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8, padding: '5px 14px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="feather-alert-triangle" style={{ fontSize: 14 }} /> Có thay đổi chưa lưu
          </span>
        )}
      </div>

      {pageError && <div className="alert alert-warning mb-4" role="alert"><i className="feather-alert-circle me-2" />{pageError}</div>}

      <div className="mb-4">
        <label className="form-label fw-semibold" style={{ color: '#334155' }}>Chọn cụm sân</label>
        <select className="form-select" style={{ maxWidth: 480, borderRadius: 8 }} value={venueId} disabled={loadingVenues || venues.length === 0}
          onChange={(e) => handleVenueChange(e.target.value)}>
          {venues.length === 0 && !loadingVenues && <option value="">Chưa có cụm sân — hãy tạo venue trước</option>}
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}{v.isActive === false ? ' (ẩn)' : ''}</option>)}
        </select>
      </div>

      {settingsError && !loadingSettings && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 12 }}>
          <div className="card-body text-center py-5">
            <i className="feather-wifi-off" style={{ fontSize: 40, color: '#94a3b8', display: 'block', marginBottom: 12 }} />
            <h5 style={{ color: '#334155' }}>Không tải được cài đặt</h5>
            <p className="text-muted small mb-3">Vui lòng kiểm tra kết nối hoặc thử lại.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => loadSettings(venueId)}>
              <i className="feather-refresh-cw me-1" />Thử lại
            </button>
          </div>
        </div>
      )}

      {!settingsError && (
        <form onSubmit={handleSave} noValidate>
          <div className="row g-4 d-flex align-items-stretch">
            <div className="col-xl-8 col-lg-7 d-flex flex-column gap-4">
              {loadingSettings && (
                <div className="text-center text-muted py-5">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />Đang tải cài đặt…
                </div>
              )}

              {!loadingSettings && (
                <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
                  <div className="card-header border-0 bg-transparent pt-4 pb-0">
                    <div className="d-flex align-items-center gap-3">
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="feather-credit-card" style={{ color: '#097E52', fontSize: 20 }} />
                      </div>
                      <div>
                        <h5 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Chuyển khoản ngân hàng</h5>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>Tài khoản nhận tiền từ người chơi</span>
                      </div>
                    </div>
                    <hr className="mt-4 mb-0" style={{ borderColor: '#f1f5f9' }} />
                  </div>
                  <div className="card-body pt-4">
                    <div className="mb-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <i className="feather-info" style={{ color: '#3b82f6', fontSize: 16, flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 13, color: '#1e40af' }}>
                        Mã QR VietQR <strong>được tạo tự động</strong> từ thông tin bên dưới — bạn <strong>không cần tải ảnh QR</strong>.
                      </div>
                    </div>

                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Ngân hàng <span className="text-danger">*</span></label>
                      <select className={`form-select ${getFieldError('paymentBankName') ? 'is-invalid' : ''}`} style={inputStyle('paymentBankName')} value={form.paymentBankName}
                        onChange={(e) => { const b = e.target.value; setForm((p) => ({ ...p, paymentBankName: b, paymentBankBin: BANK_BIN_MAP[b] || '', customBankName: '' })); setFieldErrors((p) => ({ ...p, paymentBankName: '' })); }}>
                        <option value="">-- Chọn ngân hàng --</option>
                        {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                      {getFieldError('paymentBankName') && <div className="invalid-feedback d-block">{getFieldError('paymentBankName')}</div>}
                    </div>

                    {form.paymentBankName === 'Khác' && (
                      <div className="mb-4">
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Nhập tên ngân hàng <span className="text-danger">*</span></label>
                        <input type="text" className={`form-control ${getFieldError('paymentBankName') ? 'is-invalid' : ''}`} style={inputStyle('paymentBankName')} placeholder="VD: Bắc Á Bank, Agribank…"
                          value={form.customBankName || ''} onChange={(e) => setField('customBankName', e.target.value)} />
                        <div className="mt-3">
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Mã BIN ngân hàng <span className="text-muted fw-normal">(tùy chọn — dùng để tạo VietQR)</span></label>
                          <input type="text" inputMode="numeric" maxLength={8} className="form-control" style={inputStyle('paymentBankBin')} placeholder="VD: 970436"
                            value={form.paymentBankBin} onChange={(e) => setField('paymentBankBin', e.target.value.replace(/\D/g, '').slice(0, 8))} />
                          <small className="text-muted">Tra mã BIN tại <a href="https://vietqr.io/danh-sach-ngan-hang" target="_blank" rel="noreferrer">vietqr.io</a></small>
                        </div>
                      </div>
                    )}

                    {form.paymentBankName && form.paymentBankName !== 'Khác' && form.paymentBankBin && (
                      <div className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#059669' }}>
                        <i className="feather-check-circle" style={{ fontSize: 15 }} />
                        <span>Mã BIN: <strong>{form.paymentBankBin}</strong> (tự động từ ngân hàng đã chọn)</span>
                      </div>
                    )}

                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Số tài khoản <span className="text-danger">*</span></label>
                      <input type="text" inputMode="numeric" className={`form-control ${getFieldError('paymentAccountNumber') ? 'is-invalid' : ''}`} style={inputStyle('paymentAccountNumber')} placeholder="0123456789"
                        value={form.paymentAccountNumber} onChange={(e) => setField('paymentAccountNumber', e.target.value.replace(/\D/g, ''))} />
                      {getFieldError('paymentAccountNumber') ? <div className="invalid-feedback">{getFieldError('paymentAccountNumber')}</div> : <small className="text-muted">Chỉ nhập chữ số, không nhập dấu cách hoặc ký tự đặc biệt.</small>}
                    </div>

                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Chủ tài khoản <span className="text-danger">*</span></label>
                      <input type="text" className={`form-control text-uppercase ${getFieldError('paymentAccountHolder') ? 'is-invalid' : ''}`} style={inputStyle('paymentAccountHolder')} placeholder="NGUYEN VAN A"
                        value={form.paymentAccountHolder} onChange={(e) => setField('paymentAccountHolder', e.target.value.toUpperCase())} />
                      {getFieldError('paymentAccountHolder') && <div className="invalid-feedback">{getFieldError('paymentAccountHolder')}</div>}
                    </div>

                    <div className="mb-0">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Mẫu nội dung chuyển khoản</label>
                      <input type="text" className="form-control" style={inputStyle('paymentTransferNoteTemplate')} value={form.paymentTransferNoteTemplate}
                        onChange={(e) => setField('paymentTransferNoteTemplate', e.target.value)} />
                      <small className="text-muted">Placeholder: [SĐT], [Tên sân], [Ngày]</small>
                    </div>
                  </div>
                </div>
              )}

              {!loadingSettings && (
                <div className="mt-1">
                  <button type="submit" className="btn btn-primary px-4 py-2" style={{ borderRadius: 8, fontSize: 15, fontWeight: 500 }}
                    disabled={submitting || !venueId || loadingSettings || !hasPaymentChanges}>
                    {submitting ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" /> : <i className="feather-save me-2" />}
                    Lưu tài khoản
                  </button>
                  {!hasPaymentChanges && (
                    <span className="text-muted small ms-3"><i className="feather-check me-1" />Không có thay đổi cần lưu.</span>
                  )}
                </div>
              )}
            </div>

            <div className="col-xl-4 col-lg-5">
              <div className="card shadow-sm border-0" style={{ position: 'sticky', top: 24, borderRadius: 12 }}>
                <div className="card-header border-0 bg-transparent pt-4 pb-0 text-center">
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Xem trước (VietQR)</h4>
                </div>
                <div className="card-body pt-3">
                  <p className="text-muted text-center" style={{ fontSize: 13, marginBottom: 16 }}>
                    {selectedVenueName || 'Chọn cụm sân'} — mẫu 250.000&nbsp;₫
                  </p>
                  <div className="p-4 rounded-3 d-flex flex-column align-items-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div className="text-center mb-3">
                      <div className="bg-white p-3 rounded-4 d-inline-block shadow-sm" style={{ border: '1px solid #e2e8f0', minWidth: 158, minHeight: 158, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {qrLoading ? (
                          <div className="text-muted" style={{ fontSize: 13 }}><span className="spinner-border spinner-border-sm me-1" role="status" />Đang tải…</div>
                        ) : previewQr ? (
                          <img src={previewQr} alt="VietQR" style={{ width: 130, height: 130, objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 10 }}>
                            <i className="feather-image" style={{ fontSize: 32, display: 'block', marginBottom: 6 }} />Chưa đủ thông tin<br />để tạo QR
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-center" style={{ fontSize: 14, color: '#166534', width: '100%' }}>
                      <div className="mb-2 d-flex justify-content-between w-100">
                        <span className="opacity-75">Ngân hàng:</span>
                        <strong className="text-end">{form.paymentBankName === 'Khác' ? (form.customBankName || '…') : (form.paymentBankName || '…')}</strong>
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
                      <div className="text-muted" style={{ fontSize: 12, color: '#14532d' }}>
                        Nội dung CK:
                        <strong className="d-block mt-1" style={{ background: '#dcfce7', padding: '6px 8px', borderRadius: 6, color: '#166534' }}>{previewNote}</strong>
                      </div>
                    </div>
                  </div>

                  <p className="text-center mt-3 mb-0" style={{ fontSize: 11, color: '#94a3b8' }}>
                    <i className="feather-info" style={{ fontSize: 11, marginRight: 4 }} />
                    QR được tạo từ dữ liệu <strong>đã lưu gần nhất</strong>, không phải bản nháp.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
