import { useEffect, useMemo, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import VenueAddressFields from '../../components/manager/VenueAddressFields';
import { getManagerVenueCheckoutSettings, putVenueCheckoutSettings } from '../../api/managerVenueApi';
import { notifySuccess, notifyError } from '../../hooks/useNotification';
import {
  loadVietnamDivisionTree,
  provinceByCode,
  districtByCode,
  wardByCode,
  normalizeKey,
} from '../../utils/vietnamDivisions';
import {
  buildPutBody,
  CANCEL_PRESETS,
  ConfirmModal,
  emptyForm as emptyPolicyForm,
  mapCheckoutToForm,
  REFUND_OPTIONS,
  Toast,
} from './managerCheckoutSettingsShared';

const MapPicker = lazy(() => import('../../components/common/MapPicker'));

const DEFAULT_RULES_TEMPLATE = `1. Vui lòng sử dụng giày chuyên dụng (đế keo) để bảo vệ mặt thảm.
2. Không mang đồ ăn, thức uống có màu hoặc kẹo cao su vào khu vực thảm đấu.
3. Không hút thuốc lá và sử dụng chất kích thích trong khuôn viên sân.
4. Vui lòng có mặt trước 10 phút để nhận sân và đảm bảo trật tự.
5. Tự bảo quản tài sản cá nhân; sân không chịu trách nhiệm nếu xảy ra mất mát.`;

export const AMENITIES_LIST = [
  { key: 'parking', label: 'Bãi đỗ xe', icon: 'feather-map-pin' },
  { key: 'water', label: 'Nước uống', icon: 'feather-droplet' },
  { key: 'locker', label: 'Tủ đồ & phòng thay đồ', icon: 'feather-briefcase' },
  { key: 'bathroom', label: 'Phòng tắm & nhà vệ sinh', icon: 'feather-wind' },
  { key: 'lighting', label: 'Đèn chiếu sáng', icon: 'feather-sun' },
  { key: 'security', label: 'Camera an ninh', icon: 'feather-camera' },
  { key: 'wifi', label: 'WiFi', icon: 'feather-wifi' },
  { key: 'rental_racket', label: 'Cho thuê vợt', icon: 'feather-activity' },
  { key: 'buy_shuttle', label: 'Mua cầu tại sân', icon: 'feather-shopping-bag' },
  { key: 'canteen', label: 'Căn tin / Quầy ăn uống', icon: 'feather-coffee' },
];

function SectionHeader({ icon, iconBg, iconColor, title, subtitle }) {
  return (
    <div className="d-flex align-items-center gap-3 mb-4">
      <div style={{ width: 42, height: 42, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={icon} style={{ color: iconColor, fontSize: 20 }} />
      </div>
      <div>
        <h5 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{title}</h5>
        {subtitle && <span style={{ fontSize: 13, color: '#64748b', marginTop: 2, display: 'block' }}>{subtitle}</span>}
      </div>
    </div>
  );
}

function EditableList({ items, onChange, placeholder, addLabel }) {
  const addItem = () => onChange([...items, '']);
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const updateItem = (idx, val) => onChange(items.map((it, i) => i === idx ? val : it));

  return (
    <div>
      {items.length === 0 && (
        <p className="text-muted mb-3" style={{ fontSize: 13 }}>Chưa có mục nào. Nhấn nút bên dưới để thêm.</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="d-flex align-items-center gap-2 mb-2">
          <input
            type="text"
            className="form-control bg-light border-0"
            style={{ fontSize: 14 }}
            placeholder={placeholder}
            value={item}
            onChange={(e) => updateItem(idx, e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="btn btn-light d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: 38, height: 38, borderRadius: 8, color: '#ef4444' }}
          >
            <i className="feather-x" style={{ fontSize: 16 }} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="btn d-flex align-items-center justify-content-center gap-2 w-100 mt-2"
        style={{ borderRadius: 10, border: '1.5px dashed #cbd5e1', height: 40, background: 'transparent', color: '#64748b', fontSize: 13, fontWeight: 600 }}
      >
        <i className="feather-plus" style={{ fontSize: 15 }} />
        {addLabel}
      </button>
    </div>
  );
}

function parseVenueAddress(tree, text) {
  const out = { p: '', d: '', w: '', street: text || '' };
  if (!tree?.length || !text) return out;
  const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return out;

  const fuzzy = (a, b) => {
    const na = normalizeKey(a), nb = normalizeKey(b);
    return na === nb || na.includes(nb) || nb.includes(na);
  };

  const remaining = [...parts];

  const prov = tree.find((p) => fuzzy(p.n, remaining[remaining.length - 1]));
  if (!prov) return out;
  out.p = String(prov.c);
  remaining.pop();

  if (remaining.length) {
    const dist = (prov.d || []).find((d) => fuzzy(d.n, remaining[remaining.length - 1]));
    if (dist) {
      out.d = String(dist.c);
      remaining.pop();

      if (remaining.length) {
        const ward = (dist.w || []).find((w) => fuzzy(w.n, remaining[remaining.length - 1]));
        if (ward) {
          out.w = String(ward.c);
          remaining.pop();
        }
      }
    }
  }

  out.street = remaining.join(', ');
  return out;
}

export default function ManagerAddVenue() {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = (searchParams.get('tab') || '').toLowerCase() === 'policies' ? 'POLICIES' : 'GENERAL';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = (searchParams.get('tab') || '').toLowerCase() === 'policies' ? 'POLICIES' : 'GENERAL';
    setActiveTab(tab);
  }, [searchParams]);

  const [form, setForm] = useState({
    name: '',
    address: '',
    contactName: '',
    contactPhone: '',
    lat: '',
    lng: '',
    weeklyDiscountPercent: '',
    monthlyDiscountPercent: '',
    description: '',
    includes: [],
    rules: [],
    amenities: [],
    slotDuration: 60,
  });

  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
  const TIME_SLOTS = [];
  for (let h = 5; h <= 23; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
  }
  const [dayHours, setDayHours] = useState(DAYS.map(() => ({ open: '06:00', close: '22:00', enabled: true })));

  const [thumbnailFiles, setThumbnailFiles] = useState([]);
  const [galleryFiles, setGalleryFiles] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [divisionTree, setDivisionTree] = useState(null);
  const [addrCodes, setAddrCodes] = useState({ p: '', d: '', w: '' });
  const [street, setStreet] = useState('');
  const [mapFlyQuery, setMapFlyQuery] = useState('');
  const [mapFlyZoom, setMapFlyZoom] = useState(14);
  const addressParsedRef = useRef(false);

  // Tab 2 — Policies & Rules
  const [policyForm, setPolicyForm] = useState(emptyPolicyForm);
  const [savedPolicyForm, setSavedPolicyForm] = useState(emptyPolicyForm);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState('');
  const [policyFieldErrors, setPolicyFieldErrors] = useState({});
  const [policyToast, setPolicyToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const getFieldError = (field) => {
    if (!fieldErrors) return null;
    const key = Object.keys(fieldErrors).find((k) => k.toLowerCase() === field.toLowerCase());
    if (!key) return null;
    const v = fieldErrors[key];
    if (!v) return null;
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === 'string') return v;
    return null;
  };

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const toggleDay = (i, key, val) => setDayHours((p) => p.map((d, idx) => idx === i ? { ...d, [key]: val } : d));

  const showPolicyToast = useCallback((msg, type = 'success') => setPolicyToast({ msg, type }), []);
  const getPolicyFieldError = useCallback((name) => policyFieldErrors[name] || '', [policyFieldErrors]);
  const setPolicyField = useCallback((key, val) => {
    setPolicyForm((p) => ({ ...p, [key]: val }));
    setPolicyFieldErrors((p) => ({ ...p, [key]: '' }));
  }, []);

  const toggleAmenity = (key) => {
    setForm(p => ({
      ...p,
      amenities: p.amenities.includes(key)
        ? p.amenities.filter(k => k !== key)
        : [...p.amenities, key],
    }));
  };

  useEffect(() => {
    loadVietnamDivisionTree().then(setDivisionTree);
  }, []);

  useEffect(() => {
    if (addressParsedRef.current || !divisionTree || !venueId) return;
    if (!form.address) return;
    addressParsedRef.current = true;
    const parsed = parseVenueAddress(divisionTree, form.address);
    if (parsed.p) {
      setAddrCodes({ p: parsed.p, d: parsed.d, w: parsed.w });
    }
    setStreet(parsed.street);
  }, [divisionTree, form.address, venueId]);

  const assembleAddress = () => {
    const parts = [];
    if (street.trim()) parts.push(street.trim());
    if (addrCodes.w && divisionTree) {
      const w = wardByCode(divisionTree, addrCodes.p, addrCodes.d, addrCodes.w);
      if (w) parts.push(w.n);
    }
    if (addrCodes.d && divisionTree) {
      const d = districtByCode(divisionTree, addrCodes.p, addrCodes.d);
      if (d) parts.push(d.n);
    }
    if (addrCodes.p && divisionTree) {
      const p = provinceByCode(divisionTree, addrCodes.p);
      if (p) parts.push(p.n);
    }
    return parts.join(', ');
  };

  const handleProvinceChange = (code) => {
    setAddrCodes({ p: code, d: '', w: '' });
    setMapFlyQuery('');
    setFieldErrors((p) => ({ ...p, address: null }));
  };

  const handleDistrictChange = (code) => {
    setAddrCodes((prev) => ({ ...prev, d: code, w: '' }));
    setFieldErrors((p) => ({ ...p, address: null }));
    if (!code || !divisionTree) return;
    const prov = provinceByCode(divisionTree, addrCodes.p);
    const dist = (prov?.d || []).find((x) => String(x.c) === code);
    if (prov && dist) {
      setMapFlyQuery(`${dist.n}, ${prov.n}, Vietnam`);
      setMapFlyZoom(14);
    }
  };

  const handleWardChange = (code) => {
    setAddrCodes((prev) => ({ ...prev, w: code }));
    setFieldErrors((p) => ({ ...p, address: null }));
    if (!code || !divisionTree) return;
    const prov = provinceByCode(divisionTree, addrCodes.p);
    const dist = districtByCode(divisionTree, addrCodes.p, addrCodes.d);
    const ward = (dist?.w || []).find((x) => String(x.c) === code);
    if (prov && dist && ward) {
      setMapFlyQuery(`${ward.n}, ${dist.n}, ${prov.n}, Vietnam`);
      setMapFlyZoom(16);
    }
  };

  useEffect(() => {
    if (!venueId) return;
    let mounted = true;
    const fetchVenue = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/venues/${venueId}`);
        if (!mounted) return;
        setForm(p => ({
          ...p,
          name: res?.name || res?.Name || '',
          address: res?.address || res?.Address || '',
          contactName: res?.contactName || res?.ContactName || '',
          contactPhone: res?.contactPhone || res?.ContactPhone || '',
          lat: res?.lat || res?.Lat || '',
          lng: res?.lng || res?.Lng || '',
          weeklyDiscountPercent: res?.weeklyDiscountPercent || res?.WeeklyDiscountPercent || '',
          monthlyDiscountPercent: res?.monthlyDiscountPercent || res?.MonthlyDiscountPercent || '',
          description: res?.description || res?.Description || '',
          includes: Array.isArray(res?.includes) ? res.includes : (Array.isArray(res?.Includes) ? res.Includes : []),
          rules: Array.isArray(res?.rules) ? res.rules : (Array.isArray(res?.Rules) ? res.Rules : []),
          amenities: Array.isArray(res?.amenities) ? res.amenities : (Array.isArray(res?.Amenities) ? res.Amenities : []),
          slotDuration: res?.slotDuration || res?.SlotDuration || 60,
        }));
      } catch (err) {
        console.error('Failed to load venue', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchVenue();
    return () => { mounted = false; };
  }, [venueId]);

  const handleMapPick = useCallback((pos) => {
    setForm((p) => ({
      ...p,
      lat: pos.lat.toFixed(8),
      lng: pos.lng.toFixed(8),
    }));
  }, []);

  const hasPolicyChanges = useMemo(() => (
    policyForm.cancelAllowed !== savedPolicyForm.cancelAllowed
    || policyForm.cancelBeforeMinutes !== savedPolicyForm.cancelBeforeMinutes
    || policyForm.refundType !== savedPolicyForm.refundType
    || policyForm.refundPercent !== savedPolicyForm.refundPercent
    || (policyForm.venueRules || '') !== (savedPolicyForm.venueRules || '')
  ), [policyForm, savedPolicyForm]);

  const policySummary = useMemo(() => {
    if (!policyForm.cancelAllowed) return 'Người chơi không được phép tự huỷ đặt sân trên app.';
    const mins = Number(policyForm.cancelBeforeMinutes);
    const timeStr = mins >= 1440 ? `${mins / 1440} ngày` : mins >= 60 ? `${mins / 60} giờ` : `${mins} phút`;
    const refund = (policyForm.refundType || 'NONE').toUpperCase();
    let refundStr = 'không hoàn tiền';
    if (refund === 'FULL') refundStr = 'hoàn 100%';
    else if (refund === 'PERCENT') refundStr = `hoàn ${policyForm.refundPercent ?? '?'}%`;
    return `Người chơi được huỷ trước ${timeStr}, ${refundStr} số tiền đã cọc.`;
  }, [policyForm.cancelAllowed, policyForm.cancelBeforeMinutes, policyForm.refundType, policyForm.refundPercent]);

  useEffect(() => {
    if (!venueId) {
      setPolicyForm(emptyPolicyForm());
      setSavedPolicyForm(emptyPolicyForm());
      return;
    }
    let cancelled = false;
    (async () => {
      setPolicyLoading(true);
      setPolicyError('');
      try {
        const data = await getManagerVenueCheckoutSettings(venueId, { amount: 250000, addInfo: 'XEM_TRUOC' });
        const mapped = mapCheckoutToForm(data);
        if (!cancelled) {
          setPolicyForm(mapped);
          setSavedPolicyForm(mapped);
        }
      } catch {
        if (!cancelled) {
          setPolicyError('Không tải được cài đặt chính sách.');
          setPolicyForm(emptyPolicyForm());
          setSavedPolicyForm(emptyPolicyForm());
        }
      } finally {
        if (!cancelled) setPolicyLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [venueId]);

  const validatePolicy = useCallback(() => {
    const errors = {};
    const rt = (policyForm.refundType || 'NONE').toUpperCase();
    if (rt === 'PERCENT') {
      const p = Number(policyForm.refundPercent);
      if (Number.isNaN(p) || p < 0 || p > 100) errors.refundPercent = 'Phần trăm hoàn phải từ 0 đến 100.';
    }
    return errors;
  }, [policyForm.refundType, policyForm.refundPercent]);

  const handleUseRulesTemplate = useCallback(() => {
    if ((policyForm.venueRules || '').trim()) {
      setConfirmModal({
        title: 'Ghi đè quy định?',
        message: 'Bạn đã có nội dung quy định. Sử dụng mẫu sẽ thay thế toàn bộ nội dung hiện tại.',
        confirmLabel: 'Dùng mẫu',
        onConfirm: () => { setPolicyField('venueRules', DEFAULT_RULES_TEMPLATE); setConfirmModal(null); },
        onCancel: () => setConfirmModal(null),
      });
      return;
    }
    setPolicyField('venueRules', DEFAULT_RULES_TEMPLATE);
  }, [policyForm.venueRules, setPolicyField]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const assembledAddr = assembleAddress();
      const errors = {};
      if (!form.name?.trim()) errors.name = ['Bạn chưa định danh tên cụm sân kìa!'];
      if (!addrCodes.p || !addrCodes.d) errors.address = ['Bạn chưa chọn đủ Tỉnh/TP và Quận/Huyện!'];
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setErrorMsg('Oops... Có vài chỗ chưa ổn, bạn kiểm tra lại bên dưới nhé!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setErrorMsg('');
      setFieldErrors({});
      setSubmitting(true);
      const request = {
        name: form.name,
        address: assembledAddr,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        weeklyDiscountPercent: form.weeklyDiscountPercent ? Number(form.weeklyDiscountPercent) : null,
        monthlyDiscountPercent: form.monthlyDiscountPercent ? Number(form.monthlyDiscountPercent) : null,
        description: form.description?.trim() || null,
        includes: form.includes.filter(s => s.trim()),
        rules: form.rules.filter(s => s.trim()),
        amenities: form.amenities,
        slotDuration: form.slotDuration ? Number(form.slotDuration) : 60,
      };

      let id = venueId;
      if (venueId) {
        await axiosClient.put(`/manager/venues/${venueId}`, request);
      } else {
        const created = await axiosClient.post('/manager/venues', request);
        id = created?.id || created?.Id || null;
      }

      if (id) {
        const policyErrors = validatePolicy();
        if (Object.keys(policyErrors).length > 0) {
          setPolicyFieldErrors(policyErrors);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'policies');
            return next;
          }, { replace: true });
          setErrorMsg('Oops… Bạn kiểm tra lại phần Chính sách & Quy định giúp mình nhé!');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        await putVenueCheckoutSettings(id, buildPutBody(policyForm));
        setSavedPolicyForm(policyForm);
      }

      navigate('/manager/venues');
      notifySuccess(venueId ? 'Cập nhật sân thành công!' : 'Tạo sân mới thành công!');
    } catch (err) {
      console.error('Submit venue failed', err);
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
        setErrorMsg('Oops... Hệ thống phát hiện vài phần nhập chưa chuẩn xác.');
        notifyError('Lưu thất bại. Vui lòng kiểm tra lại.');
      } else {
        setFieldErrors({});
        const msg = err.response?.data?.message || err.response?.data?.title || 'Rất tiếc! Đã xảy ra sự cố khi lưu Cụm sân. Bạn thử lại nha!';
        setErrorMsg(msg);
        notifyError(msg);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
      </div>
    );
  }

  return (
    <div className="container-fluid px-0 px-md-3 pb-5">
      {policyToast && <Toast msg={policyToast.msg} type={policyToast.type} onClose={() => setPolicyToast(null)} />}
      <ConfirmModal open={!!confirmModal} {...(confirmModal || {})} />

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom flex-wrap">
        <div className="d-flex align-items-center gap-3">
          <button onClick={() => navigate('/manager/venues')} className="btn btn-light shadow-sm d-flex align-items-center justify-content-center" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <i className="feather-arrow-left fs-5" />
          </button>
          <div>
            <h3 className="mb-0 fw-bold text-dark">{venueId ? 'Cập nhật Cụm sân' : 'Tạo mới Cụm sân'}</h3>
            <p className="text-secondary mb-0 mt-1" style={{ fontSize: 14 }}>Thiết lập thông tin chung cho cơ sở của bạn</p>
          </div>
        </div>

        {/* Nút xem bị ẩn đi theo yêu cầu */}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {errorMsg && (
          <div className="alert alert-danger d-flex align-items-center mb-4" style={{ borderRadius: 10, border: 'none', background: '#fef2f2', color: '#991b1b', padding: '14px 20px' }}>
            <i className="feather-alert-circle fs-5 me-2" />
            <span className="fw-medium">{errorMsg}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="d-flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'GENERAL' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('tab');
              return next;
            }, { replace: true })}
            style={{ borderRadius: 999 }}
          >
            <i className="feather-info me-1" />
            Thông tin cơ bản
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'POLICIES' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('tab', 'policies');
              return next;
            }, { replace: true })}
            style={{ borderRadius: 999 }}
          >
            <i className="feather-shield me-1" />
            Chính sách & Quy định
            {venueId && hasPolicyChanges && (
              <span className="badge bg-warning text-dark ms-2">Chưa lưu</span>
            )}
          </button>
        </div>

        {activeTab === 'GENERAL' && (
          <>
            <div className="row g-4">

              {/* LEFT COLUMN */}
              <div className="col-12 col-lg-6 d-flex flex-column gap-4">

                {/* Basic Info Card */}
                <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
                  <div className="card-body p-4 p-md-5">
                    <SectionHeader icon="feather-map" iconBg="#e8f5ee" iconColor="#097E52" title="1. Thông tin cơ bản" subtitle="Tên, địa chỉ và thông tin liên hệ" />
                    <div className="row g-4">
                      <div className="col-12">
                        <label className="form-label fw-semibold text-dark mb-2">Tên cụm sân <span className="text-danger">*</span></label>
                        <input type="text" className={`form-control form-control-lg bg-light border-0 ${getFieldError('name') ? 'is-invalid' : ''}`} placeholder="Ví dụ: ShuttleUp Quận 7" value={form.name} onChange={(e) => { setField('name', e.target.value); setFieldErrors(p => ({ ...p, name: null })); }} />
                        {getFieldError('name') && <div className="invalid-feedback">{getFieldError('name')}</div>}
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold text-dark mb-2">Địa chỉ cụ thể <span className="text-danger">*</span></label>
                        <VenueAddressFields
                          tree={divisionTree}
                          street={street}
                          onStreetChange={(v) => { setStreet(v); setFieldErrors((p) => ({ ...p, address: null })); }}
                          provinceCode={addrCodes.p}
                          districtCode={addrCodes.d}
                          wardCode={addrCodes.w}
                          onChangeProvince={handleProvinceChange}
                          onChangeDistrict={handleDistrictChange}
                          onChangeWard={handleWardChange}
                        />
                        {getFieldError('address') && <div className="text-danger small mt-2">{getFieldError('address')}</div>}
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold text-dark mb-2">Người đại diện</label>
                        <input type="text" className={`form-control form-control-lg bg-light border-0 ${getFieldError('contactName') ? 'is-invalid' : ''}`} placeholder="Nguyễn Văn A" value={form.contactName} onChange={(e) => setField('contactName', e.target.value)} />
                        {getFieldError('contactName') && <div className="invalid-feedback">{getFieldError('contactName')}</div>}
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold text-dark mb-2">Số điện thoại</label>
                        <input type="tel" className={`form-control form-control-lg bg-light border-0 ${getFieldError('contactPhone') ? 'is-invalid' : ''}`} placeholder="0901234567" value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} />
                        {getFieldError('contactPhone') && <div className="invalid-feedback">{getFieldError('contactPhone')}</div>}
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold text-dark mb-2">Đơn vị giờ chẵn (Booking Slot Increment) <span className="text-danger">*</span></label>
                        <select className="form-select form-select-lg bg-light border-0" value={form.slotDuration} onChange={(e) => setField('slotDuration', Number(e.target.value))}>
                          <option value={60}>1 Giờ (Mặc định)</option>
                          <option value={30}>30 Phút</option>
                          <option value={120}>2 Giờ</option>
                        </select>
                        <div className="form-text mt-2 text-muted">Hệ thống sẽ chia lưới hiển thị lịch chơi theo đơn vị được chọn.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location Card — Map picker */}
                <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
                  <div className="card-body p-4 p-md-5">
                    <SectionHeader icon="feather-map-pin" iconBg="#eff6ff" iconColor="#2563eb" title="2. Vị trí trên bản đồ" subtitle="Bản đồ tự bay đến khi bạn chọn quận/huyện — nhấn để ghim vị trí chính xác" />

                    <Suspense fallback={<div className="text-muted text-center py-5">Đang tải bản đồ…</div>}>
                      <MapPicker
                        lat={form.lat ? Number(form.lat) : null}
                        lng={form.lng ? Number(form.lng) : null}
                        onChange={handleMapPick}
                        flyToQuery={mapFlyQuery}
                        flyToZoom={mapFlyZoom}
                        height={340}
                      />
                    </Suspense>
                    <p className="text-muted mt-2 mb-3" style={{ fontSize: 13 }}>
                      <i className="feather-info me-1" />
                      Chọn Quận/Huyện ở trên để bản đồ bay đến khu vực đó, sau đó click chính xác vị trí sân.
                    </p>

                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: 13 }}>Vĩ độ (Lat)</label>
                        <input type="number" step="any" className={`form-control bg-light border-0 ${getFieldError('lat') ? 'is-invalid' : ''}`} placeholder="10.7769" value={form.lat} onChange={(e) => setField('lat', e.target.value)} />
                        {getFieldError('lat') && <div className="invalid-feedback">{getFieldError('lat')}</div>}
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold text-dark mb-1" style={{ fontSize: 13 }}>Kinh độ (Lng)</label>
                        <input type="number" step="any" className={`form-control bg-light border-0 ${getFieldError('lng') ? 'is-invalid' : ''}`} placeholder="106.7009" value={form.lng} onChange={(e) => setField('lng', e.target.value)} />
                        {getFieldError('lng') && <div className="invalid-feedback">{getFieldError('lng')}</div>}
                      </div>
                      {form.lat && form.lng && (
                        <div className="col-12">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => { setField('lat', ''); setField('lng', ''); }}
                          >
                            <i className="feather-x me-1" />Xóa tọa độ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN */}
              <div className="col-12 col-lg-6 d-flex flex-column gap-4">

                {/* Media Card */}
                <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
                  <div className="card-body p-4 p-md-5">
                    <SectionHeader icon="feather-image" iconBg="#fce7f3" iconColor="#db2777" title="3. Hình ảnh đại diện" subtitle="Tải lên ảnh đẹp nhất để thu hút khách" />
                    <div className="position-relative bg-light rounded-4 d-flex align-items-center justify-content-center border" style={{ height: 260, borderStyle: 'dashed !important' }}>
                      <input type="file" className="position-absolute top-0 start-0 w-100 h-100 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => setThumbnailFiles(Array.from(e.target.files || []))} />
                      {thumbnailFiles.length > 0 ? (
                        <img src={URL.createObjectURL(thumbnailFiles[0])} alt="thumb" className="w-100 h-100 rounded-4" style={{ objectFit: 'cover' }} />
                      ) : (
                        <div className="text-center text-muted">
                          <div className="bg-white shadow-sm d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 64, height: 64 }}>
                            <i className="feather-upload-cloud text-primary" style={{ fontSize: 28 }} />
                          </div>
                          <h6 className="fw-semibold text-dark">Nhấn hoặc Kéo thả ảnh vào đây</h6>
                          <span className="small text-secondary">Hỗ trợ JPG, PNG (Tối đa 5MB)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Schedule Card */}
                <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
                  <div className="card-body p-4 p-md-5">
                    <SectionHeader icon="feather-clock" iconBg="#fef3c7" iconColor="#d97706" title="4. Lịch hoạt động chung" subtitle="Cài đặt khung giờ làm việc tiêu chuẩn" />
                    <div className="px-2">
                      {DAYS.map((day, i) => (
                        <div key={day} className="row align-items-center py-3 border-bottom" style={{ opacity: dayHours[i].enabled ? 1 : 0.5, transition: '0.2s' }}>
                          <div className="col-3 col-sm-2 fw-bold text-dark" style={{ fontSize: 13 }}>{day}</div>
                          <div className="col-3 col-sm-4 px-1">
                            <select className="form-select form-select-sm bg-light border-0" value={dayHours[i].open} disabled={!dayHours[i].enabled} onChange={(e) => toggleDay(i, 'open', e.target.value)}>
                              {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                            </select>
                          </div>
                          <div className="col-3 col-sm-4 px-1">
                            <select className="form-select form-select-sm bg-light border-0" value={dayHours[i].close} disabled={!dayHours[i].enabled} onChange={(e) => toggleDay(i, 'close', e.target.value)}>
                              {TIME_SLOTS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                            </select>
                          </div>
                          <div className="col-3 col-sm-2 text-end">
                            <div className="form-check form-switch d-inline-block m-0" style={{ transform: 'scale(1.1)' }}>
                              <input className="form-check-input m-0 cursor-pointer" type="checkbox" checked={dayHours[i].enabled} onChange={(e) => toggleDay(i, 'enabled', e.target.checked)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* ===== ROW 2: Content sections ===== */}
            <div className="row g-4 mt-0">

              {/* Section 5: Description - full width */}
              <div className="col-12">
                <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
                  <div className="card-body p-4 p-md-5">
                    <SectionHeader
                      icon="feather-file-text"
                      iconBg="#f0fdf4"
                      iconColor="#16a34a"
                      title="5. Mô tả sân"
                      subtitle="Giới thiệu về cơ sở — hiển thị ở tab Tổng quan trang chi tiết sân"
                    />
                    <textarea
                      className="form-control bg-light border-0"
                      rows={5}
                      style={{ fontSize: 14, resize: 'vertical', lineHeight: 1.8 }}
                      placeholder="Ví dụ: Cụm sân cầu lông tiêu chuẩn thi đấu, hệ thống đèn LED cao cấp, thảm PVC chuyên dụng. Phù hợp cho cả người mới bắt đầu và vận động viên chuyên nghiệp. Đội ngũ hỗ trợ chuyên nghiệp, sẵn sàng phục vụ 7 ngày trong tuần..."
                      value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                    />
                    <div className="d-flex justify-content-end mt-2">
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{form.description.length} ký tự</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 6: Includes + Section 7: Rules - 2 columns */}
              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 16 }}>
                  <div className="card-body p-4 p-md-5">
                    <SectionHeader
                      icon="feather-check-square"
                      iconBg="#ecfdf5"
                      iconColor="#059669"
                      title="6. Bao gồm"
                      subtitle="Những gì khách được sử dụng khi thuê sân"
                    />
                    <EditableList
                      items={form.includes}
                      onChange={(val) => setField('includes', val)}
                      placeholder="VD: Vợt cầu lông miễn phí"
                      addLabel="Thêm hạng mục"
                    />
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 16 }}>
                  <div className="card-body p-4 p-md-5">
                    <SectionHeader
                      icon="feather-alert-octagon"
                      iconBg="#fff7ed"
                      iconColor="#ea580c"
                      title="7. Quy định"
                      subtitle="Các quy tắc khách cần tuân thủ tại cơ sở"
                    />
                    <EditableList
                      items={form.rules}
                      onChange={(val) => setField('rules', val)}
                      placeholder="VD: Mang giày chuyên dụng khi vào sân"
                      addLabel="Thêm quy định"
                    />
                  </div>
                </div>
              </div>

              {/* Section 8: Amenities - full width */}
              <div className="col-12">
                <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
                  <div className="card-body p-4 p-md-5">
                    <SectionHeader
                      icon="feather-star"
                      iconBg="#eff6ff"
                      iconColor="#3b82f6"
                      title="8. Tiện ích"
                      subtitle="Chọn các cơ sở vật chất & dịch vụ hiện có tại cơ sở"
                    />
                    <div className="row g-3">
                      {AMENITIES_LIST.map((a) => {
                        const selected = form.amenities.includes(a.key);
                        return (
                          <div key={a.key} className="col-6 col-md-4 col-xl-3">
                            <div
                              role="button"
                              onClick={() => toggleAmenity(a.key)}
                              className="d-flex align-items-center gap-2 p-3 rounded-3"
                              style={{
                                border: `1.5px solid ${selected ? '#097E52' : '#e2e8f0'}`,
                                background: selected ? '#f0fdf4' : '#f8fafc',
                                cursor: 'pointer',
                                transition: 'all .15s',
                                userSelect: 'none',
                                minHeight: 52,
                              }}
                            >
                              <i className={a.icon} style={{ fontSize: 17, color: selected ? '#097E52' : '#94a3b8', flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: selected ? '#065f3f' : '#475569', flex: 1 }}>{a.label}</span>
                              {selected && <i className="feather-check" style={{ fontSize: 14, color: '#097E52', flexShrink: 0 }} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {form.amenities.length > 0 && (
                      <p className="mb-0 mt-3" style={{ fontSize: 12, color: '#64748b' }}>
                        Đã chọn <strong>{form.amenities.length}</strong> tiện ích
                      </p>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </>
        )}

        {activeTab === 'POLICIES' && (
          <div className="row g-4">
            <div className="col-12 col-xl-8">
              {policyError && (
                <div className="alert alert-warning mb-4" role="alert">
                  <i className="feather-alert-circle me-2" />
                  {policyError}
                </div>
              )}

              {policyLoading ? (
                <div className="text-center text-muted py-5">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Đang tải cài đặt…
                </div>
              ) : (
                <div className="d-flex flex-column gap-4">
                  <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
                    <div className="card-header border-0 bg-transparent pt-4 pb-0">
                      <div className="d-flex align-items-center gap-3">
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="feather-book-open" style={{ color: '#7c3aed', fontSize: 20 }} />
                        </div>
                        <div>
                          <h5 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Quy định chung tại sân</h5>
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>Nội quy sẽ hiển thị cho người chơi trước khi thanh toán</span>
                        </div>
                      </div>
                      <hr className="mt-4 mb-0" style={{ borderColor: '#f1f5f9' }} />
                    </div>
                    <div className="card-body pt-4">
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Nội dung quy định</label>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          style={{ fontSize: 12, borderRadius: 6 }}
                          onClick={handleUseRulesTemplate}
                        >
                          <i className="feather-file-text me-1" style={{ fontSize: 12 }} />
                          Sử dụng mẫu quy định chung
                        </button>
                      </div>
                      <textarea
                        className="form-control mt-2"
                        rows={8}
                        maxLength={5000}
                        style={{
                          background: '#f8fafc',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          boxShadow: 'none',
                          border: '1px solid transparent',
                          resize: 'vertical',
                          fontFamily: '"Be Vietnam Pro", sans-serif',
                          lineHeight: 1.7,
                        }}
                        placeholder={'VD:\n1. Vui lòng sử dụng giày chuyên dụng...\n2. Không mang đồ ăn vào khu vực thảm đấu...'}
                        value={policyForm.venueRules || ''}
                        onChange={(e) => setPolicyField('venueRules', e.target.value)}
                      />
                      <div className="d-flex justify-content-between mt-1">
                        <small className="text-muted">Nội dung sẽ hiển thị nguyên trạng cho người chơi (không hỗ trợ HTML).</small>
                        <small className="text-muted">{(policyForm.venueRules || '').length}/5000</small>
                      </div>
                    </div>
                  </div>

                  <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
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
                        <input className="form-check-input" type="checkbox" id="cancelAllowedPolicy" checked={policyForm.cancelAllowed} onChange={(e) => setPolicyField('cancelAllowed', e.target.checked)} />
                        <label className="form-check-label" htmlFor="cancelAllowedPolicy" style={{ fontWeight: 600 }}>Cho phép người chơi tự huỷ trên app</label>
                      </div>

                      {policyForm.cancelAllowed ? (
                        <>
                          <div className="mb-3">
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Phải huỷ trước giờ đá ít nhất</label>
                            <div className="d-flex flex-wrap gap-2 mb-2">
                              {CANCEL_PRESETS.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  className={`btn btn-sm ${policyForm.cancelBeforeMinutes === m ? 'btn-primary' : 'btn-outline-secondary'}`}
                                  onClick={() => setPolicyField('cancelBeforeMinutes', m)}
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
                              style={{
                                background: '#f8fafc',
                                borderRadius: '8px',
                                padding: '12px 16px',
                                boxShadow: 'none',
                                border: '1px solid transparent',
                              }}
                              value={policyForm.cancelBeforeMinutes}
                              onChange={(e) => setPolicyField('cancelBeforeMinutes', Number(e.target.value))}
                            />
                            <small className="text-muted">Tính theo phút (tối đa 10080 = 7 ngày).</small>
                          </div>

                          <div className="mb-3">
                            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Hoàn tiền khi huỷ đúng hạn</label>
                            <select
                              className="form-select"
                              style={{
                                background: '#f8fafc',
                                borderRadius: '8px',
                                padding: '12px 16px',
                                boxShadow: 'none',
                                border: '1px solid transparent',
                              }}
                              value={policyForm.refundType}
                              onChange={(e) => setPolicyField('refundType', e.target.value)}
                            >
                              {REFUND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>

                          {(policyForm.refundType || '').toUpperCase() === 'PERCENT' && (
                            <div className="mb-0">
                              <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Phần trăm hoàn <span className="text-danger">*</span></label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                className={`form-control ${getPolicyFieldError('refundPercent') ? 'is-invalid' : ''}`}
                                style={{
                                  background: '#f8fafc',
                                  borderRadius: '8px',
                                  padding: '12px 16px',
                                  boxShadow: 'none',
                                  border: getPolicyFieldError('refundPercent') ? '1px solid #dc3545' : '1px solid transparent',
                                }}
                                value={policyForm.refundPercent ?? ''}
                                onChange={(e) => setPolicyField('refundPercent', e.target.value === '' ? null : Number(e.target.value))}
                              />
                              {getPolicyFieldError('refundPercent') && <div className="invalid-feedback">{getPolicyFieldError('refundPercent')}</div>}
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
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="col-12 col-xl-4">
              <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
                <div className="card-body">
                  <div className="d-flex align-items-start gap-2">
                    <i className="feather-info" style={{ color: '#0f766e', marginTop: 2 }} />
                    <div>
                      <div className="fw-semibold" style={{ color: '#0f172a' }}>Mẹo nhanh</div>
                      <div className="text-muted" style={{ fontSize: 13 }}>
                        Cấu hình các chính sách và quy định phù hợp với cụm sân của bạn.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sticky action bar */}
        <div style={{ height: 88 }} />
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1100,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid #e2e8f0',
            padding: '12px 14px',
          }}
        >
          <div className="container-fluid px-0 px-md-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <Link to="/manager/venues" className="btn btn-light fw-bold px-4 py-2 shadow-sm" style={{ borderRadius: 12 }}>
                Hủy bỏ
              </Link>
              <div className="d-flex align-items-center gap-2">
                {activeTab === 'POLICIES' && hasPolicyChanges && (
                  <span className="text-muted small">
                    <i className="feather-alert-triangle me-1" />
                    Có thay đổi chưa lưu
                  </span>
                )}
                <button type="submit" className="btn btn-primary fw-bold px-4 py-2 shadow" disabled={submitting} style={{ borderRadius: 12 }}>
                  {submitting ? 'ĐANG LƯU...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal preview removed */}

      </form>
    </div>
  );
}
