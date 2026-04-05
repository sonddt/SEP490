import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getVenueCheckoutSettings } from '../../api/bookingApi';
import { getManagedVenues, putVenueCheckoutSettings, lookupBankAccount } from '../../api/managerVenueApi';
import {
  POPULAR_BANK_BINS,
  TRANSFER_VARIABLES,
  emptyForm,
  mapCheckoutToForm,
  buildPutBody,
  fetchVietqrBanks,
  localBanksAsFallback,
  useDebounce,
  ConfirmModal,
  Toast,
} from './managerCheckoutSettingsShared';

/* ──────────────────────────────────────────────
   BankPicker — searchable dropdown with logos
   ────────────────────────────────────────────── */

function BankPicker({ banks, value, onSelect, error, loading }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return banks;
    const s = search.toLowerCase();
    return banks.filter(
      (b) =>
        b.shortName.toLowerCase().includes(s) ||
        b.name.toLowerCase().includes(s) ||
        b.code.toLowerCase().includes(s) ||
        b.bin.includes(s),
    );
  }, [banks, search]);

  const popular = useMemo(() => filtered.filter((b) => POPULAR_BANK_BINS.includes(b.bin)), [filtered]);
  const others = useMemo(() => filtered.filter((b) => !POPULAR_BANK_BINS.includes(b.bin)), [filtered]);

  const selected = banks.find((b) => b.shortName === value);

  const triggerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#f8fafc', borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
    border: error ? '1px solid #dc3545' : open ? '1px solid #097E52' : '1px solid #e2e8f0',
    transition: 'border-color 0.15s',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={triggerStyle} onClick={() => { if (!loading) setOpen(!open); }}>
        {loading ? (
          <span className="text-muted" style={{ fontSize: 14 }}>
            <span className="spinner-border spinner-border-sm me-2" role="status" />Đang tải danh sách…
          </span>
        ) : selected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selected.logo && (
              <img src={selected.logo} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} onError={(e) => { e.target.style.display = 'none'; }} />
            )}
            <span style={{ fontWeight: 500, color: '#1e293b' }}>{selected.shortName}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>({selected.bin})</span>
          </div>
        ) : value === 'Khác' ? (
          <span style={{ color: '#1e293b', fontWeight: 500 }}>Khác (nhập thủ công)</span>
        ) : (
          <span style={{ color: '#94a3b8' }}>-- Chọn ngân hàng --</span>
        )}
        <i className={`feather-chevron-${open ? 'up' : 'down'}`} style={{ color: '#94a3b8', fontSize: 16 }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              ref={searchRef}
              type="text"
              className="form-control form-control-sm"
              placeholder="Tìm ngân hàng…"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {popular.length > 0 && (
              <>
                <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Phổ biến
                </div>
                {popular.map((b) => (
                  <BankItem key={b.bin} bank={b} onClick={() => { onSelect(b.shortName, b.bin, b.logo); setOpen(false); setSearch(''); }} />
                ))}
              </>
            )}
            {others.length > 0 && (
              <>
                <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, borderTop: popular.length > 0 ? '1px solid #f1f5f9' : 'none' }}>
                  {search ? 'Kết quả' : 'Tất cả ngân hàng'}
                </div>
                {others.map((b) => (
                  <BankItem key={b.bin} bank={b} onClick={() => { onSelect(b.shortName, b.bin, b.logo); setOpen(false); setSearch(''); }} />
                ))}
              </>
            )}
            {popular.length === 0 && others.length === 0 && (
              <div style={{ padding: '16px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Không tìm thấy ngân hàng
              </div>
            )}
            <div
              style={{
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: 14,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { onSelect('Khác', '', null); setOpen(false); setSearch(''); }}
            >
              <i className="feather-edit-3" style={{ fontSize: 16, color: '#94a3b8' }} />
              <span>Khác (nhập thủ công)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BankItem({ bank, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {bank.logo ? (
        <img src={bank.logo} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, border: '1px solid #f1f5f9' }} onError={(e) => { e.target.style.display = 'none'; }} />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: 4, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="feather-credit-card" style={{ fontSize: 14, color: '#94a3b8' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: '#1e293b' }}>{bank.shortName}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bank.name}
        </div>
      </div>
      <span style={{ fontSize: 11, color: '#cbd5e1', fontFamily: 'monospace' }}>{bank.bin}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────
   VariableChips — clickable template placeholders
   ────────────────────────────────────────────── */

function VariableChips({ inputRef, onInsert }) {
  const handleClick = (varKey) => {
    const el = inputRef?.current;
    if (!el) { onInsert(varKey); return; }

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newVal = before + varKey + after;
    onInsert(newVal, start + varKey.length);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + varKey.length, start + varKey.length);
    });
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {TRANSFER_VARIABLES.map((v) => (
        <button
          key={v.key}
          type="button"
          title={v.desc}
          onClick={() => handleClick(v.key)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#e8f5ee', color: '#097E52', border: '1px solid #bbf7d0',
            borderRadius: 16, padding: '3px 12px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#d1fae5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#e8f5ee'; }}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main page component
   ────────────────────────────────────────────── */

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

  const [vietqrBanks, setVietqrBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(true);

  const [verifyStatus, setVerifyStatus] = useState('idle');
  const [verifiedName, setVerifiedName] = useState('');

  const [applyToAll, setApplyToAll] = useState(false);

  const transferInputRef = useRef(null);

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);
  const getFieldError = (name) => fieldErrors[name] || '';
  const setField = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setFieldErrors((p) => ({ ...p, [key]: '' }));
    if (key === 'paymentAccountNumber' || key === 'paymentBankBin') {
      setVerifyStatus('idle');
      setVerifiedName('');
    }
  };

  const hasPaymentChanges = useMemo(() => {
    const keys = ['paymentBankName', 'paymentBankBin', 'paymentAccountNumber', 'paymentAccountHolder', 'paymentTransferNoteTemplate', 'paymentNote', 'customBankName'];
    return keys.some((k) => (form[k] || '') !== (savedForm[k] || ''));
  }, [form, savedForm]);

  // ── Fetch VietQR bank list ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBanksLoading(true);
      const banks = await fetchVietqrBanks();
      if (!cancelled) { setVietqrBanks(banks); setBanksLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Load managed venues ──
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

  // ── Load checkout settings for selected venue ──
  const loadSettings = useCallback(async (id) => {
    if (!id) return;
    setLoadingSettings(true); setPageError(''); setSettingsError(false);
    setVerifyStatus('idle'); setVerifiedName('');
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

  // ── Transfer note preview ──
  const previewNote = useMemo(() => {
    const t = form.paymentTransferNoteTemplate || '[SĐT] - [Tên sân] - [Ngày]';
    return t
      .replace(/\[SĐT\]/g, '0901234567')
      .replace(/\[Mã đơn\]/g, 'ORD-A1B2C3')
      .replace(/\[Tên sân\]/g, 'Tên cụm sân')
      .replace(/\[Ngày\]/g, '26/03/2026');
  }, [form.paymentTransferNoteTemplate]);
  const debouncedNote = useDebounce(previewNote, 600);

  // ── QR preview ──
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

  // ── Venue switch with unsaved warning ──
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

  // ── Bank select from BankPicker ──
  const handleBankSelect = (shortName, bin, _logo) => {
    setForm((p) => ({
      ...p,
      paymentBankName: shortName,
      paymentBankBin: bin,
      customBankName: '',
    }));
    setFieldErrors((p) => ({ ...p, paymentBankName: '' }));
    setVerifyStatus('idle');
    setVerifiedName('');
  };

  // ── Auto-verify account holder ──
  const canVerify = useMemo(() => {
    const bin = form.paymentBankBin?.trim();
    const acct = form.paymentAccountNumber?.trim();
    return bin && acct && /^\d{6,19}$/.test(acct) && verifyStatus !== 'loading';
  }, [form.paymentBankBin, form.paymentAccountNumber, verifyStatus]);

  const handleVerify = async () => {
    if (!canVerify) return;
    setVerifyStatus('loading');
    try {
      const res = await lookupBankAccount({
        bin: form.paymentBankBin.trim(),
        accountNumber: form.paymentAccountNumber.trim(),
      });
      if (res.configured === false) {
        setVerifyStatus('unavailable');
      } else if (res.found) {
        setVerifiedName(res.accountName || '');
        setField('paymentAccountHolder', (res.accountName || '').toUpperCase());
        setVerifyStatus('success');
      } else {
        setVerifyStatus('not_found');
      }
    } catch {
      setVerifyStatus('error');
    }
  };

  // ── Validation ──
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

  // ── Save ──
  const handleSave = async (e) => {
    e.preventDefault();
    if (!venueId) return;
    const errors = validatePayment();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setFieldErrors({}); setSubmitting(true);
    try {
      const body = buildPutBody(form, { applyToAll });
      const res = await putVenueCheckoutSettings(venueId, body);
      setPageError('');
      const bulkMsg = res?.bulkApplied > 0
        ? ` (đã áp dụng cho thêm ${res.bulkApplied} cụm sân khác)`
        : '';
      showToast(`Đã lưu thông tin tài khoản nhận tiền${bulkMsg}.`);
      setApplyToAll(false);
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

  const verifyBadge = () => {
    if (verifyStatus === 'success') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#059669', fontWeight: 600 }}>
        <i className="feather-check-circle" style={{ fontSize: 14 }} /> Đã xác minh
      </span>
    );
    if (verifyStatus === 'not_found') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#d97706' }}>
        <i className="feather-alert-triangle" style={{ fontSize: 14 }} /> Không tìm thấy — hãy nhập thủ công
      </span>
    );
    if (verifyStatus === 'unavailable') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
        <i className="feather-info" style={{ fontSize: 14 }} /> Tra cứu chưa cấu hình — nhập thủ công
      </span>
    );
    if (verifyStatus === 'error') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#dc3545' }}>
        <i className="feather-x-circle" style={{ fontSize: 14 }} /> Lỗi tra cứu — nhập thủ công
      </span>
    );
    return null;
  };

  return (
    <div className="mgr-page">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmModal open={!!confirmModal} {...(confirmModal || {})} />

      {/* ── Page header ── */}
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

      {/* ── Venue selector ── */}
      <div className="mb-4">
        <label className="form-label fw-semibold" style={{ color: '#334155' }}>Chọn cụm sân</label>
        <select className="form-select" style={{ maxWidth: 480, borderRadius: 8 }} value={venueId} disabled={loadingVenues || venues.length === 0}
          onChange={(e) => handleVenueChange(e.target.value)}>
          {venues.length === 0 && !loadingVenues && <option value="">Chưa có cụm sân — hãy tạo venue trước</option>}
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}{v.isActive === false ? ' (ẩn)' : ''}</option>)}
        </select>
      </div>

      {/* ── Error state ── */}
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
            {/* ── Left column — form ── */}
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
                    {/* Info banner */}
                    <div className="mb-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <i className="feather-info" style={{ color: '#3b82f6', fontSize: 16, flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 13, color: '#1e40af' }}>
                        Mã QR VietQR <strong>được tạo tự động</strong> từ thông tin bên dưới — bạn <strong>không cần tải ảnh QR</strong>.
                      </div>
                    </div>

                    {/* ── 1. Smart Bank Picker ── */}
                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'block' }}>Ngân hàng <span className="text-danger">*</span></label>
                      <BankPicker
                        banks={vietqrBanks}
                        value={form.paymentBankName}
                        onSelect={handleBankSelect}
                        error={getFieldError('paymentBankName')}
                        loading={banksLoading}
                      />
                      {getFieldError('paymentBankName') && <div className="text-danger mt-1" style={{ fontSize: 13 }}>{getFieldError('paymentBankName')}</div>}
                    </div>

                    {/* Custom bank name + BIN when "Khác" */}
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

                    {/* Auto BIN confirmation */}
                    {form.paymentBankName && form.paymentBankName !== 'Khác' && form.paymentBankBin && (
                      <div className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#059669' }}>
                        <i className="feather-check-circle" style={{ fontSize: 15 }} />
                        <span>Mã BIN: <strong>{form.paymentBankBin}</strong> (tự động từ ngân hàng đã chọn)</span>
                      </div>
                    )}

                    {/* ── Account Number + Verify Button ── */}
                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'block' }}>Số tài khoản <span className="text-danger">*</span></label>
                      <div className="d-flex gap-2 align-items-start">
                        <div style={{ flex: 1 }}>
                          <input type="text" inputMode="numeric" className={`form-control ${getFieldError('paymentAccountNumber') ? 'is-invalid' : ''}`} style={inputStyle('paymentAccountNumber')} placeholder="0123456789"
                            value={form.paymentAccountNumber} onChange={(e) => setField('paymentAccountNumber', e.target.value.replace(/\D/g, ''))} />
                          {getFieldError('paymentAccountNumber') ? <div className="invalid-feedback">{getFieldError('paymentAccountNumber')}</div> : <small className="text-muted">Chỉ nhập chữ số, từ 6 đến 19 ký tự.</small>}
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          style={{ borderRadius: 8, padding: '10px 16px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 13 }}
                          disabled={!canVerify}
                          onClick={handleVerify}
                        >
                          {verifyStatus === 'loading' ? (
                            <span className="spinner-border spinner-border-sm" role="status" />
                          ) : (
                            <><i className="feather-search me-1" style={{ fontSize: 13 }} />Xác minh</>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ── 2. Account Holder + Verify Badge ── */}
                    <div className="mb-4">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Chủ tài khoản <span className="text-danger">*</span></label>
                        {verifyBadge()}
                      </div>
                      <input type="text" className={`form-control text-uppercase ${getFieldError('paymentAccountHolder') ? 'is-invalid' : ''}`}
                        style={{
                          ...inputStyle('paymentAccountHolder'),
                          ...(verifyStatus === 'success' ? { border: '1px solid #059669', background: '#f0fdf4' } : {}),
                        }}
                        placeholder="NGUYEN VAN A"
                        value={form.paymentAccountHolder}
                        onChange={(e) => { setField('paymentAccountHolder', e.target.value.toUpperCase()); if (verifyStatus === 'success') setVerifyStatus('idle'); }}
                      />
                      {getFieldError('paymentAccountHolder') && <div className="invalid-feedback">{getFieldError('paymentAccountHolder')}</div>}
                    </div>

                    {/* ── 3. Transfer Note Template + Variable Chips ── */}
                    <div className="mb-4">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8, display: 'block' }}>Mẫu nội dung chuyển khoản</label>
                      <input
                        ref={transferInputRef}
                        type="text"
                        className="form-control"
                        style={inputStyle('paymentTransferNoteTemplate')}
                        value={form.paymentTransferNoteTemplate}
                        onChange={(e) => setField('paymentTransferNoteTemplate', e.target.value)}
                      />
                      <VariableChips
                        inputRef={transferInputRef}
                        onInsert={(newVal, _cursorPos) => {
                          if (typeof newVal === 'string' && newVal.startsWith('[')) {
                            setField('paymentTransferNoteTemplate', (form.paymentTransferNoteTemplate || '') + newVal);
                          } else {
                            setField('paymentTransferNoteTemplate', newVal);
                          }
                        }}
                      />
                    </div>

                    {/* ── 4. Payment Note (instructions for player) ── */}
                    <div className="mb-0">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4, display: 'block' }}>
                        Ghi chú cho người chơi
                        <span className="text-muted fw-normal ms-1" style={{ fontSize: 12 }}>(tùy chọn)</span>
                      </label>
                      <small className="text-muted d-block mb-2">Hướng dẫn thêm cho người chơi khi thanh toán (VD: gửi biên lai qua Zalo…)</small>
                      <textarea
                        className="form-control"
                        rows={3}
                        maxLength={1000}
                        style={{ ...inputStyle('paymentNote'), resize: 'vertical' }}
                        placeholder="VD: Vui lòng gửi ảnh chụp biên lai chuyển khoản qua Zalo 09xx để được duyệt nhanh hơn."
                        value={form.paymentNote || ''}
                        onChange={(e) => setField('paymentNote', e.target.value)}
                      />
                      <div className="d-flex justify-content-end mt-1">
                        <small className="text-muted">{(form.paymentNote || '').length}/1000</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 5. Bulk Apply + Save ── */}
              {!loadingSettings && (
                <div className="mt-1">
                  {venues.length > 1 && (
                    <div className="mb-3">
                      <label
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                          background: applyToAll ? '#eff6ff' : '#f8fafc', border: applyToAll ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          borderRadius: 10, padding: '12px 16px', transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input mt-0"
                          style={{ flexShrink: 0 }}
                          checked={applyToAll}
                          onChange={(e) => setApplyToAll(e.target.checked)}
                        />
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                            Áp dụng cài đặt ngân hàng cho tất cả cụm sân
                          </span>
                          <span className="d-block mt-1" style={{ fontSize: 12, color: '#64748b' }}>
                            Thông tin tài khoản ngân hàng, mẫu nội dung CK và ghi chú sẽ được cập nhật cho {venues.length - 1} cụm sân còn lại. Chính sách huỷ/hoàn tiền không bị ảnh hưởng.
                          </span>
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="d-flex align-items-center gap-3 flex-wrap">
                    <button type="submit" className="btn btn-primary px-4 py-2" style={{ borderRadius: 8, fontSize: 15, fontWeight: 500 }}
                      disabled={submitting || !venueId || loadingSettings || !hasPaymentChanges}>
                      {submitting ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" /> : <i className="feather-save me-2" />}
                      {applyToAll ? 'Lưu & áp dụng tất cả' : 'Lưu tài khoản'}
                    </button>
                    {!hasPaymentChanges && (
                      <span className="text-muted small"><i className="feather-check me-1" />Không có thay đổi cần lưu.</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right column — QR Preview ── */}
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

                  {/* Payment note preview */}
                  {form.paymentNote?.trim() && (
                    <div className="mt-3" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Ghi chú cho người chơi
                      </div>
                      <div style={{ fontSize: 13, color: '#78350f', whiteSpace: 'pre-line' }}>
                        {form.paymentNote.trim()}
                      </div>
                    </div>
                  )}

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
