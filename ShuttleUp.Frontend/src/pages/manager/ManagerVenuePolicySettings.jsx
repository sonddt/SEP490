import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getManagedVenues, getManagerVenueCheckoutSettings, putVenueCheckoutSettings } from '../../api/managerVenueApi';
import {
  emptyForm,
  mapCheckoutToForm,
  buildPutBody,
  REFUND_OPTIONS,
  CANCEL_PRESETS,
  ConfirmModal,
  Toast,
} from './managerCheckoutSettingsShared';

export default function ManagerVenuePolicySettings() {
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
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const initialVenuePicked = useRef(false);

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);
  const getFieldError = (name) => fieldErrors[name] || '';
  const setField = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setFieldErrors((p) => ({ ...p, [key]: '' }));
  };

  const hasPolicyChanges = useMemo(() => (
    form.cancelAllowed !== savedForm.cancelAllowed
    || form.cancelBeforeMinutes !== savedForm.cancelBeforeMinutes
    || form.refundType !== savedForm.refundType
    || form.refundPercent !== savedForm.refundPercent
  ), [form, savedForm]);

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
      const data = await getManagerVenueCheckoutSettings(id, { amount: 250000, addInfo: 'XEM_TRUOC' });
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

  const handleVenueChange = (newId) => {
    if (!hasPolicyChanges) { setVenueId(newId); return; }
    setConfirmModal({
      title: 'Thay đổi chưa lưu',
      message: 'Bạn có thay đổi chưa được lưu.\nNếu chuyển sang cụm sân khác, các thay đổi sẽ bị mất.',
      confirmLabel: 'Chuyển cụm sân',
      onConfirm: () => { setConfirmModal(null); setVenueId(newId); },
      onCancel: () => setConfirmModal(null),
    });
  };

  const validatePolicy = () => {
    const errors = {};
    const rt = (form.refundType || 'NONE').toUpperCase();
    if (rt === 'PERCENT') {
      const p = Number(form.refundPercent);
      if (Number.isNaN(p) || p < 0 || p > 100) errors.refundPercent = 'Phần trăm hoàn phải từ 0 đến 100.';
    }
    return errors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!venueId) return;
    const errors = validatePolicy();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setFieldErrors({}); setSubmitting(true);
    try {
      await putVenueCheckoutSettings(venueId, buildPutBody(form));
      setPageError('');
      showToast('Đã lưu chính sách sân và hoàn tiền.');
      await loadSettings(venueId);
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Lưu thất bại.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const policySummary = useMemo(() => {
    if (!form.cancelAllowed) return 'Người chơi không được phép tự huỷ đặt sân trên app.';
    const mins = Number(form.cancelBeforeMinutes);
    const timeStr = mins >= 1440 ? `${mins / 1440} ngày` : mins >= 60 ? `${mins / 60} giờ` : `${mins} phút`;
    const refund = (form.refundType || 'NONE').toUpperCase();
    let refundStr = 'không hoàn tiền';
    if (refund === 'FULL') refundStr = 'hoàn 100%';
    else if (refund === 'PERCENT') refundStr = `hoàn ${form.refundPercent ?? '?'}%`;
    return `Người chơi được huỷ trước ${timeStr}, ${refundStr} số tiền đã cọc.`;
  }, [form.cancelAllowed, form.cancelBeforeMinutes, form.refundType, form.refundPercent]);

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
          <h1 className="mb-1" style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>Chính sách sân và hoàn tiền</h1>
          <p className="text-muted mb-0">Thời hạn huỷ và mức hoàn tiền cho từng cụm sân (áp dụng đơn đặt mới).</p>
        </div>
        {hasPolicyChanges && (
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
          {venues.map((v) => (
            <option key={v.id} value={v.id}>{v.name}{v.isActive === false ? ' (ẩn)' : ''}</option>
          ))}
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
          {loadingSettings && (
            <div className="text-center text-muted py-5">
              <span className="spinner-border spinner-border-sm me-2" role="status" />Đang tải cài đặt…
            </div>
          )}

          {!loadingSettings && (
            <div className="card border-0 shadow-sm" style={{ borderRadius: 12, maxWidth: 720 }}>
              <div className="card-header border-0 bg-transparent pt-4 pb-0">
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="feather-shield" style={{ color: '#d97706', fontSize: 20 }} />
                  </div>
                  <div>
                    <h5 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Huỷ đặt & hoàn tiền (người chơi)</h5>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>Áp dụng cho đơn đặt sân <strong>mới</strong> tại venue này</span>
                  </div>
                </div>
                <hr className="mt-4 mb-0" style={{ borderColor: '#f1f5f9' }} />
              </div>
              <div className="card-body pt-4">
                <div className="mb-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <i className="feather-info" style={{ color: '#3b82f6', fontSize: 16, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 13, color: '#1e40af' }}>
                    Thay đổi chỉ áp dụng cho <strong>đơn đặt mới</strong>. Đơn đã đặt giữ nguyên chính sách lúc đặt (snapshot).
                  </div>
                </div>

                <div className="form-check form-switch mb-4">
                  <input className="form-check-input" type="checkbox" id="cancelAllowedPolicy" checked={form.cancelAllowed} onChange={(e) => setField('cancelAllowed', e.target.checked)} />
                  <label className="form-check-label" htmlFor="cancelAllowedPolicy" style={{ fontWeight: 600 }}>Cho phép người chơi tự huỷ trên app</label>
                </div>

                {form.cancelAllowed ? (
                  <>
                    <div className="mb-3">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Phải huỷ trước giờ đá ít nhất</label>
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        {CANCEL_PRESETS.map((m) => (
                          <button key={m} type="button" className={`btn btn-sm ${form.cancelBeforeMinutes === m ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setField('cancelBeforeMinutes', m)}>
                            {m >= 1440 ? `${m / 1440} ngày` : m >= 60 ? `${m / 60}h` : `${m} phút`}
                          </button>
                        ))}
                      </div>
                      <input type="number" min={0} max={10080} className="form-control" style={inputStyle('cancelBeforeMinutes')} value={form.cancelBeforeMinutes}
                        onChange={(e) => setField('cancelBeforeMinutes', Number(e.target.value))} />
                      <small className="text-muted">Tính theo phút (tối đa 10080 = 7 ngày).</small>
                    </div>

                    <div className="mb-3">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Hoàn tiền khi huỷ đúng hạn</label>
                      <select className="form-select" style={inputStyle('refundType')} value={form.refundType} onChange={(e) => setField('refundType', e.target.value)}>
                        {REFUND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>

                    {(form.refundType || '').toUpperCase() === 'PERCENT' && (
                      <div className="mb-0">
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Phần trăm hoàn <span className="text-danger">*</span></label>
                        <input type="number" min={0} max={100} step={1} className={`form-control ${getFieldError('refundPercent') ? 'is-invalid' : ''}`} style={inputStyle('refundPercent')}
                          value={form.refundPercent ?? ''} onChange={(e) => setField('refundPercent', e.target.value === '' ? null : Number(e.target.value))} />
                        {getFieldError('refundPercent') && <div className="invalid-feedback">{getFieldError('refundPercent')}</div>}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', color: '#991b1b', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <i className="feather-lock" style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} />
                    <span>Người chơi <strong>không thể tự huỷ</strong> đặt sân. Chỉ quản lý sân mới có quyền huỷ đơn.</span>
                  </div>
                )}

                <div style={{
                  marginTop: 20, background: '#f0fdf4', border: '1px dashed #86efac',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <i className="feather-file-text" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                  <span><strong>Tóm tắt:</strong> {policySummary}</span>
                </div>

                <div className="mt-4">
                  <button type="submit" className="btn btn-primary px-4 py-2" style={{ borderRadius: 8, fontSize: 15, fontWeight: 500 }}
                    disabled={submitting || !venueId || loadingSettings || !hasPolicyChanges}>
                    {submitting ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" /> : <i className="feather-save me-2" />}
                    Lưu chính sách
                  </button>
                  {!hasPolicyChanges && (
                    <span className="text-muted small ms-3"><i className="feather-check me-1" />Không có thay đổi cần lưu.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
