import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { getCourtBlocks, createCourtBlock, deleteCourtBlock } from '../../api/managerVenueApi';
import ShuttleDateField from '../../components/ui/ShuttleDateField';
import { normalizeSearchText } from '../../utils/searchNormalize';

const BLOCK_REASONS = [
  { value: 'MAINTENANCE', label: 'Bảo trì' },
  { value: 'WEATHER', label: 'Thời tiết / môi trường' },
  { value: 'OTHER', label: 'Khác' },
];

function SectionHeader({ icon, iconBg, iconColor, title, subtitle, rightElement }) {
  return (
    <div className="d-flex align-items-start align-items-sm-center justify-content-between mb-4 gap-3">
      <div className="d-flex align-items-center gap-3">
        <div style={{ width: 42, height: 42, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={icon} style={{ color: iconColor, fontSize: 20 }} />
        </div>
        <div>
          <h5 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{title}</h5>
          {subtitle && <span style={{ fontSize: 13, color: '#64748b', marginTop: 2, display: 'block' }}>{subtitle}</span>}
        </div>
      </div>
      {rightElement && <div>{rightElement}</div>}
    </div>
  );
}

export default function ManagerAddCourt() {
  const { venueId, courtId } = useParams();
  const navigate = useNavigate();

  const SURFACE_TYPES = ['Gỗ PU', 'Thảm nhựa PVC', 'Xi-măng', 'Thảm cao su'];
  
  const [form, setForm] = useState({
    name: '',
    surface: 'Gỗ PU',
    maxGuests: 4,
    priceWeekday: '',
    priceWeekend: '',
    description: '',
    groupName: ''
  });

  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
  // DAYS[i] → C# DayOfWeek value: T2=1, T3=2, T4=3, T5=4, T6=5, T7=6, CN=0
  const DAY_MAP = [1, 2, 3, 4, 5, 6, 0];
  // C# DayOfWeek → DAYS index: 0(CN)→6, 1(T2)→0, 2(T3)→1, ..., 6(T7)→5
  const DAY_MAP_REVERSE = { 0:6, 1:0, 2:1, 3:2, 4:3, 5:4, 6:5 };
  const TIME_SLOTS = [];
  for (let h = 5; h <= 23; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
  }
  const [dayHours, setDayHours] = useState(DAYS.map(() => ({ open: '06:00', close: '22:00', enabled: true })));

  const [existingImages, setExistingImages] = useState([]);
  const [newImageFiles, setNewImageFiles] = useState([]);

  const [isBulkCreate, setIsBulkCreate] = useState(false);
  const [bulkCount, setBulkCount] = useState('1');
  const [bulkStartNumber, setBulkStartNumber] = useState('1');
  const [progressMsg, setProgressMsg] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [courtBlocks, setCourtBlocks] = useState([]);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockForm, setBlockForm] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '10:00',
    reasonCode: 'MAINTENANCE',
    reasonDetail: '',
    internalNote: '',
  });
  const [blockError, setBlockError] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);
  const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState(null);

  const loadCourtBlocks = useCallback(async () => {
    if (!courtId || !venueId) return;
    setBlockLoading(true);
    setBlockError('');
    try {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 60);
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];
      const rows = await getCourtBlocks(venueId, courtId, { from: fromStr, to: toStr });
      setCourtBlocks(Array.isArray(rows) ? rows : []);
    } catch {
      setBlockError('Không tải được danh sách khóa lịch.');
      setCourtBlocks([]);
    } finally {
      setBlockLoading(false);
    }
  }, [courtId, venueId]);

  useEffect(() => {
    loadCourtBlocks();
  }, [loadCourtBlocks]);

  const handleAddBlock = async () => {
    if (!courtId || !venueId) return;
    setBlockError('');
    if (!blockForm.date?.trim() || !blockForm.startTime || !blockForm.endTime) {
      setBlockError('Oops… Vui lòng chọn đủ ngày và khung giờ.');
      return;
    }
    const startStr = `${blockForm.date}T${blockForm.startTime}:00`;
    const endStr = `${blockForm.date}T${blockForm.endTime}:00`;
    if (new Date(endStr) <= new Date(startStr)) {
      setBlockError('Oops… Giờ kết thúc phải sau giờ bắt đầu (cùng ngày).');
      return;
    }
    setBlockSaving(true);
    try {
      await createCourtBlock(venueId, courtId, {
        startTime: startStr,
        endTime: endStr,
        reasonCode: blockForm.reasonCode,
        reasonDetail: blockForm.reasonDetail?.trim() || null,
        internalNote: blockForm.internalNote?.trim() || null,
      });
      setBlockForm((p) => ({
        ...p,
        reasonDetail: '',
        internalNote: '',
      }));
      await loadCourtBlocks();
    } catch (err) {
      setBlockError(err.response?.data?.message || err.message || 'Không tạo được khóa lịch.');
    } finally {
      setBlockSaving(false);
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!courtId || !venueId || !blockId) return;
    setBlockError('');
    try {
      await deleteCourtBlock(venueId, courtId, blockId);
      setPendingDeleteBlockId(null);
      await loadCourtBlocks();
    } catch (err) {
      setBlockError(err.response?.data?.message || err.message || 'Không xóa được.');
      setBlockError(err.response?.data?.message || err.message || 'Không xóa được.');
    }
  };

  const [venueData, setVenueData] = useState(null);
  const [groupSuggestions, setGroupSuggestions] = useState([]);
  const GROUP_NAME_MAX_LEN = 100;
  const venueGroupStorageKey = useMemo(() => `mgr_court_groups_${venueId || 'unknown'}`, [venueId]);
  const venueGroupHiddenStorageKey = useMemo(() => `mgr_court_groups_hidden_${venueId || 'unknown'}`, [venueId]);
  const normalizeGroupName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const activeGroupValue = useMemo(() => {
    const current = normalizeGroupName(form.groupName);
    if (!current) return '';
    const matched = groupSuggestions.find((name) => normalizeSearchText(name) === normalizeSearchText(current));
    return matched || '';
  }, [form.groupName, groupSuggestions]);

  useEffect(() => {
    if (!venueId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await axiosClient.get(`/venues/${venueId}`);
        if (mounted) setVenueData(res);
      } catch (err) {
        console.warn('Failed to load venue data for slot config', err);
      }
    })();
    return () => { mounted = false; };
  }, [venueId]);

  useEffect(() => {
    if (!venueId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await axiosClient.get(`/manager/venues/${venueId}/courts?page=1&pageSize=500`);
        if (!mounted) return;
        const rows = res?.data?.items || res?.items || [];
        const map = new Map();
        const hiddenKeys = (() => {
          try {
            const raw = localStorage.getItem(venueGroupHiddenStorageKey);
            const arr = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
            return new Set(arr.map((x) => normalizeSearchText(x)));
          } catch {
            return new Set();
          }
        })();
        rows.forEach((r) => {
          const id = r.id || r.Id;
          if (courtId && id === courtId) return;
          const raw = String(r.groupName ?? r.GroupName ?? r.group_name ?? '').trim();
          if (!raw) return;
          const key = normalizeSearchText(raw);
          if (!key) return;
          if (hiddenKeys.has(key)) return;
          if (!map.has(key)) map.set(key, raw);
        });
        try {
          const rawLocal = localStorage.getItem(venueGroupStorageKey);
          const localGroups = Array.isArray(JSON.parse(rawLocal || '[]')) ? JSON.parse(rawLocal || '[]') : [];
          localGroups.forEach((name) => {
            const cleaned = normalizeGroupName(name).slice(0, GROUP_NAME_MAX_LEN);
            if (!cleaned) return;
            const key = normalizeSearchText(cleaned);
            if (hiddenKeys.has(key)) return;
            if (!map.has(key)) map.set(key, cleaned);
          });
        } catch {}
        setGroupSuggestions(Array.from(map.values()));
      } catch {
        if (mounted) setGroupSuggestions([]);
      }
    })();
    return () => { mounted = false; };
  }, [venueId, courtId, venueGroupStorageKey, venueGroupHiddenStorageKey]);

  const removeCurrentGroupSuggestion = () => {
    if (!activeGroupValue) return;
    const normalized = normalizeSearchText(activeGroupValue);
    const next = groupSuggestions.filter((name) => normalizeSearchText(name) !== normalized);
    setGroupSuggestions(next);
    if (normalizeSearchText(form.groupName) === normalized) {
      setField('groupName', '');
    }
    try {
      const raw = localStorage.getItem(venueGroupHiddenStorageKey);
      const arr = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
      const merged = Array.from(new Set([...arr, activeGroupValue]));
      localStorage.setItem(venueGroupHiddenStorageKey, JSON.stringify(merged));
      localStorage.setItem(venueGroupStorageKey, JSON.stringify(next));
    } catch {}
  };

  const getFieldError = (field) => fieldErrors[field] || '';

  const setField = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setFieldErrors(p => ({ ...p, [key]: null }));
  };
  const toggleDay = (i, key, val) => setDayHours((p) => p.map((d, idx) => idx === i ? { ...d, [key]: val } : d));

  const handleApplyToAllDays = () => {
    const monday = dayHours[0]; // Thứ 2 is index 0
    setDayHours(dayHours.map(() => ({ ...monday })));
    setSuccessMsg('Đã sao chép lịch Thứ 2 cho tất cả các ngày.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  useEffect(() => {
    if (!courtId) return;
    let mounted = true;
    const fetchCourt = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/manager/venues/${venueId}/courts/${courtId}`);
        if (!mounted) return;
        
        const name = res?.name || res?.Name || '';
        const surface = res?.surface || res?.Surface || 'Gỗ PU';
        const maxGuest = res?.maxGuest || res?.MaxGuest || 4;
        
        const priceSlots = res?.priceSlots || res?.PriceSlots || [];
        let pWeek = '', pEnd = '';
        if (priceSlots.length) {
           pWeek = priceSlots.find(p => !p.isWeekend && !p.IsWeekend)?.price || priceSlots[0].price;
           pEnd = priceSlots.find(p => p.isWeekend || p.IsWeekend)?.price || pWeek;
        }
        
        const hours = res?.openHours || res?.OpenHours || [];
        const isLegacy = hours.length === 0;
        const mappedHours = DAYS.map((_, i) => {
          if (isLegacy) {
            return { enabled: true, open: '05:00', close: '23:00' };
          }
          const dbDow = DAY_MAP[i]; // convert DAYS index to C# DayOfWeek
          const matched = hours.find(h => (h.dayOfWeek ?? h.DayOfWeek) === dbDow);
          if (matched && (matched.enabled ?? matched.Enabled)) {
            return { enabled: true, open: matched.openTime || matched.OpenTime || '06:00', close: matched.closeTime || matched.CloseTime || '22:00' };
          }
          return { enabled: false, open: '06:00', close: '22:00' };
        });

        setForm(p => ({
          ...p,
          name,
          surface,
          maxGuests: maxGuest,
          priceWeekday: typeof pWeek === 'number' ? String(pWeek) : '',
          priceWeekend: typeof pEnd === 'number' ? String(pEnd) : '',
          description: res?.description || res?.Description || '',
          groupName: res?.groupName || res?.GroupName || ''
        }));
        
        setDayHours(mappedHours);
        
        if (res?.Images || res?.images) {
           setExistingImages(res.Images || res.images);
        }
      } catch (err) {
        console.error('Failed to load court', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCourt();
    return () => { mounted = false; };
  }, [courtId, venueId]);

  const handleSubmit = async (e, addAnother = false) => {
    if (e) e.preventDefault();
    try {
      const errors = {};
      if (!form.name?.trim()) errors.name = 'Bạn chưa đặt tên cho sân này!';
      if (!form.priceWeekday) errors.priceWeekday = 'Bạn quên thiết lập giá ngày thường rồi!';
      
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setErrorMsg('Oops... Có vẻ vài thông tin chưa ổn, bạn kiểm tra lại bên dưới nhé!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setErrorMsg('');
      setFieldErrors({});
      setSubmitting(true);
      
      const priceSlots = [];
      const pw = Number(form.priceWeekday) || 0;
      const pe = Number(form.priceWeekend) || pw;
      
      priceSlots.push({ startTime: '05:00', endTime: '23:59', price: pw, isWeekend: false });
      priceSlots.push({ startTime: '05:00', endTime: '23:59', price: pe, isWeekend: true });
      
      const openHours = dayHours.map((d, i) => ({
        dayOfWeek: DAY_MAP[i], // convert DAYS index to C# DayOfWeek
        enabled: d.enabled,
        openTime: d.enabled ? d.open : null,
        closeTime: d.enabled ? d.close : null
      }));

      const request = {
        // Reuse existing canonical group label if user typed the same group with different casing/spaces.
        groupName: (() => {
          const typed = normalizeGroupName(form.groupName);
          if (!typed) return '';
          const safeTyped = typed.slice(0, GROUP_NAME_MAX_LEN);
          const typedKey = normalizeSearchText(safeTyped);
          const matched = groupSuggestions.find((name) => normalizeSearchText(name) === typedKey);
          return normalizeGroupName(matched || safeTyped).slice(0, GROUP_NAME_MAX_LEN);
        })(),
        name: form.name,
        surface: form.surface,
        maxGuests: Number(form.maxGuests),
        description: form.description,
        status: "ACTIVE", // based on new BE plan
        isActive: true,
        priceSlots,
        openHours
      };

      if (!courtId && isBulkCreate) {
        const count = Number(bulkCount) || 1;
        const startNum = Number(bulkStartNumber) || 1;
        setProgressMsg(`Đang khởi tạo ${count} sân...`);
        const prefix = form.name.trim() || 'Sân';
        let successCount = 0;
        
        for (let i = 0; i < count; i++) {
          const currentNumber = startNum + i;
          const courtName = `${prefix} ${currentNumber}`;
          setProgressMsg(`Đang tạo sân: ${courtName} (${i + 1}/${count})...`);
          
          try {
             const req = { ...request, name: courtName };
             const created = await axiosClient.post(`/manager/venues/${venueId}/courts`, req);
             const savedCourtId = created?.id || created?.Id;
             
             if (newImageFiles.length > 0 && savedCourtId) {
                const fd = new FormData();
                for (const file of newImageFiles) { fd.append('imageFiles', file); }
                await axiosClient.post(`/manager/venues/${venueId}/courts/${savedCourtId}/files`, fd);
             }
             successCount++;
          } catch (err) {
             console.error(`Failed to create ${courtName}`, err);
          }
        }
        
        setProgressMsg('');
        if (successCount < count) {
           setErrorMsg(`Oops... Chỉ tạo thành công ${successCount}/${count} sân. Hãy kiểm tra lại trong danh sách.`);
           return; 
        } else {
           navigate(`/manager/venues/${venueId}/courts`);
           return;
        }
      } else {
        let savedCourtId = courtId;
        if (courtId) {
          await axiosClient.put(`/manager/venues/${venueId}/courts/${courtId}`, request);
        } else {
          const created = await axiosClient.post(`/manager/venues/${venueId}/courts`, request);
          savedCourtId = created?.id || created?.Id;
        }

        if (request.groupName) {
          const merged = new Map();
          [...groupSuggestions, request.groupName].forEach((name) => {
            const cleaned = normalizeGroupName(name).slice(0, GROUP_NAME_MAX_LEN);
            if (!cleaned) return;
            const key = normalizeSearchText(cleaned);
            if (!merged.has(key)) merged.set(key, cleaned);
          });
          const nextGroups = Array.from(merged.values());
          setGroupSuggestions(nextGroups);
          try {
            localStorage.setItem(venueGroupStorageKey, JSON.stringify(nextGroups));
          } catch {}
        }

        if (newImageFiles.length > 0 && savedCourtId) {
          const fd = new FormData();
          for (const file of newImageFiles) {
            fd.append('imageFiles', file);
          }
          await axiosClient.post(`/manager/venues/${venueId}/courts/${savedCourtId}/files`, fd);
        }

        if (addAnother) {
           setForm(p => ({ ...p, name: '' }));
           setNewImageFiles([]);
           setSuccessMsg('Lưu thành công! Bạn có thể tiếp tục thêm sân khác với cấu hình tương tự.');
           setTimeout(() => setSuccessMsg(''), 5000);
           window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
           navigate(`/manager/venues/${venueId}/courts`);
        }
      }
    } catch (err) {
      console.error('Submit court failed', err);
      setProgressMsg('');
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
        setErrorMsg('Oops... Hệ thống phát hiện vài phần nhập chưa chuẩn xác.');
      } else {
        setFieldErrors({});
        setErrorMsg(err.response?.data?.message || err.response?.data?.title || 'Rất tiếc! Đã xảy ra sự cố khi lưu Sân. Bạn thử lại nha!');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      if (!isBulkCreate) {
         setSubmitting(false);
      } else if (progressMsg === '') {
         setSubmitting(false);
      }
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
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4 border-bottom pb-4 flex-wrap">
        <button onClick={() => navigate(`/manager/venues/${venueId}/courts`)} className="btn btn-light shadow-sm d-flex align-items-center justify-content-center" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <i className="feather-arrow-left fs-5" />
        </button>
        <div>
          <h3 className="mb-0 fw-bold text-dark">{courtId ? 'Cập nhật Sân con' : 'Đăng ký Sân con'}</h3>
          <p className="text-secondary mb-0 mt-1" style={{ fontSize: 14 }}>Thiết lập thông tin, giá và lịch trống riêng cho sân này</p>
        </div>
        {!courtId && (
          <div className="ms-auto bg-light rounded-pill p-1 d-flex align-items-center shadow-sm border mt-3 mt-sm-0">
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 ${!isBulkCreate ? 'btn-white fw-bold shadow-sm text-dark' : 'text-secondary'}`}
              style={{ border: !isBulkCreate ? '1px solid #dee2e6' : 'none', background: !isBulkCreate ? '#fff' : 'transparent' }}
              onClick={() => setIsBulkCreate(false)}
            >
              Tạo 1 sân
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 ${isBulkCreate ? 'btn-white fw-bold shadow-sm text-dark' : 'text-secondary'}`}
              style={{ border: isBulkCreate ? '1px solid #dee2e6' : 'none', background: isBulkCreate ? '#fff' : 'transparent' }}
              onClick={() => setIsBulkCreate(true)}
            >
              Tạo nhiều sân
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {errorMsg && (
          <div className="alert alert-danger d-flex align-items-center mb-4 shadow-sm" style={{ borderRadius: 10, border: 'none', background: '#fef2f2', color: '#991b1b', padding: '14px 20px' }}>
            <i className="feather-alert-circle fs-5 me-2" />
            <span className="fw-medium">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success d-flex align-items-center mb-4 shadow-sm" style={{ borderRadius: 10, border: 'none', background: '#f0fdf4', color: '#166534', padding: '14px 20px' }}>
            <i className="feather-check-circle fs-5 me-2" />
            <span className="fw-medium">{successMsg}</span>
          </div>
        )}
        {progressMsg && (
          <div className="alert alert-primary d-flex align-items-center mb-4 shadow-sm" style={{ borderRadius: 10, border: 'none', background: '#eff6ff', color: '#1e40af', padding: '14px 20px' }}>
            <div className="spinner-border spinner-border-sm me-2" role="status" />
            <span className="fw-medium">{progressMsg}</span>
          </div>
        )}
        <div className="row g-4">

          {/* ================= LEFT COLUMN ================= */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-4">
            
            {/* Basic Info */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-target" iconBg="#e8f5ee" iconColor="#097E52" title="1. Đặc tả sân đấu" subtitle="Định dạng tên, mã nội bộ và tiêu chuẩn mặt sân" />
                
                <div className="row g-4">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">
                      {isBulkCreate ? 'Tiền tố tên sân' : 'Tên hiển thị'} <span className="text-danger">*</span>
                    </label>
                    <input type="text" className={`form-control form-control-lg bg-light border-0 ${getFieldError('name') ? 'is-invalid' : ''}`} placeholder={isBulkCreate ? "Ví dụ: Sân" : "Ví dụ: Sân số 1"} value={form.name} onChange={(e) => setField('name', e.target.value)} />
                    {getFieldError('name') && <div className="invalid-feedback">{getFieldError('name')}</div>}
                  </div>
                  {isBulkCreate && (
                    <>
                      <div className="col-6 col-md-3">
                        <label className="form-label fw-semibold text-dark mb-2">Bắt đầu từ số <span className="text-danger">*</span></label>
                        <input type="number" min={1} className="form-control form-control-lg bg-light border-0" value={bulkStartNumber} onChange={(e) => setBulkStartNumber(e.target.value)} />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label fw-semibold text-dark mb-2">Số lượng sân <span className="text-danger">*</span></label>
                        <input type="number" min={1} max={50} className="form-control form-control-lg bg-light border-0" value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} />
                      </div>
                      <div className="col-12 mt-2">
                        <div className="alert alert-info py-2 small mb-0 d-flex align-items-center">
                          <i className="feather-info me-2 fs-5 flex-shrink-0" />
                          <span>
                            Hệ thống sẽ tạo <strong>{Number(bulkCount) || 1}</strong> sân, tên từ <strong>"{form.name.trim() || 'Sân'} {Number(bulkStartNumber) || 1}"</strong> đến <strong>"{form.name.trim() || 'Sân'} {(Number(bulkStartNumber) || 1) + (Number(bulkCount) || 1) - 1}"</strong>.
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Loại mặt thảm</label>
                    <select className="form-select form-select-lg bg-light border-0" value={form.surface} onChange={(e) => setField('surface', e.target.value)}>
                      {SURFACE_TYPES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Khuyến cáo số người tối đa</label>
                    <input type="number" min={1} max={20} className={`form-control form-control-lg bg-light border-0 ${getFieldError('maxGuests') ? 'is-invalid' : ''}`} placeholder="4" value={form.maxGuests} onChange={(e) => setField('maxGuests', e.target.value)} />
                    {getFieldError('maxGuests') && <div className="invalid-feedback">{getFieldError('maxGuests')}</div>}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Tên nhóm (Tùy chọn)</label>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <select
                        className="form-select bg-light border-0"
                        style={{ height: 44, borderRadius: 12 }}
                        value={activeGroupValue}
                        onChange={(e) => {
                          const picked = e.target.value;
                          if (picked) {
                            setField('groupName', picked.slice(0, GROUP_NAME_MAX_LEN));
                            return;
                          }
                          setField('groupName', '');
                        }}
                      >
                        <option value="">Tạo nhóm mới (nhập bên dưới)…</option>
                        {groupSuggestions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn d-flex align-items-center justify-content-center"
                        disabled={!activeGroupValue}
                        onClick={removeCurrentGroupSuggestion}
                        title="Xóa lựa chọn khỏi dropdown"
                        aria-label="Xóa lựa chọn khỏi dropdown"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          border: '1px solid #fecaca',
                          background: activeGroupValue ? '#fff5f5' : '#f8fafc',
                          color: activeGroupValue ? '#ef4444' : '#94a3b8',
                          padding: 0,
                        }}
                      >
                        <i className="feather-trash-2" style={{ fontSize: 14 }} />
                      </button>
                    </div>
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control form-control-lg bg-light border-0"
                        placeholder="Nhập nhóm mới nếu chưa có trong dropdown"
                        maxLength={GROUP_NAME_MAX_LEN}
                        value={form.groupName}
                        onChange={(e) => setField('groupName', e.target.value.slice(0, GROUP_NAME_MAX_LEN))}
                        style={{ borderRadius: '12px 0 0 12px' }}
                      />
                      <button
                        type="button"
                        className="btn d-flex align-items-center justify-content-center"
                        style={{
                          width: '44px',
                          padding: 0,
                          borderRadius: '0 12px 12px 0',
                          border: '1px solid #e5e7eb',
                          background: '#ffffff',
                          color: '#6b7280',
                        }}
                        onClick={() => setField('groupName', '')}
                        title="Xóa nhóm"
                        aria-label="Xóa nhóm"
                      >
                        <i className="feather-x" style={{ fontSize: 14 }} />
                      </button>
                    </div>
                    <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                      Tối đa {GROUP_NAME_MAX_LEN} ký tự. Có thể chọn nhanh hoặc nhập nhóm mới.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-dollar-sign" iconBg="#fff3cd" iconColor="#d97706" title="2. Quy định biểu giá" subtitle={`Bảng giá thuê sân tính theo đơn vị ${venueData?.slotDuration === 30 ? '30 phút' : venueData?.slotDuration === 120 ? '2 giờ' : '1 giờ'}`} />
                
                <div className="row g-4 align-items-end">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Giá ngày thường <span className="text-danger">*</span></label>
                    <div className="input-group input-group-lg">
                      <input type="number" min={0} className={`form-control bg-light border-0 ${getFieldError('priceWeekday') ? 'is-invalid' : ''}`} placeholder="100000" value={form.priceWeekday} onChange={(e) => setField('priceWeekday', e.target.value)} />
                      <span className="input-group-text bg-light border-0 text-muted">đ / {venueData?.slotDuration === 30 ? '30 phút' : venueData?.slotDuration === 120 ? '2 giờ' : 'giờ'}</span>
                      {getFieldError('priceWeekday') && <div className="invalid-feedback">{getFieldError('priceWeekday')}</div>}
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Giá cuối tuần (T7, CN)</label>
                    <div className="input-group input-group-lg">
                      <input type="number" min={0} className={`form-control bg-light border-0 ${getFieldError('priceWeekend') ? 'is-invalid' : ''}`} placeholder="120000" value={form.priceWeekend} onChange={(e) => setField('priceWeekend', e.target.value)} />
                      <span className="input-group-text bg-light border-0 text-muted">đ / {venueData?.slotDuration === 30 ? '30 phút' : venueData?.slotDuration === 120 ? '2 giờ' : 'giờ'}</span>
                      {getFieldError('priceWeekend') && <div className="invalid-feedback">{getFieldError('priceWeekend')}</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-4">
            
            {/* Schedule */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-calendar" iconBg="#e0e7ff" iconColor="#4f46e5" title="3. Khung giờ nhận khách" subtitle="Tự động hủy đặt sân đối với những giờ đóng cửa" />
                
                <div className="px-2">
                  {DAYS.map((day, i) => (
                    <div key={day} className="row align-items-center py-3 border-bottom" style={{ opacity: dayHours[i].enabled ? 1 : 0.6, transition: '0.2s' }}>
                      <div className="col-3 col-sm-2 fw-bold text-dark d-flex align-items-center pe-3">
                        {day}
                      </div>
                      
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
                        <div className="d-flex align-items-center justify-content-end gap-2">
                          {i === 0 && (
                            <button type="button" className="btn btn-sm btn-light p-1 shadow-sm border d-flex align-items-center justify-content-center text-primary" style={{ width: 24, height: 24 }} onClick={handleApplyToAllDays} title="Áp dụng giờ Thứ 2 cho tất cả các ngày">
                              <i className="feather-copy" style={{ fontSize: 12 }} />
                            </button>
                          )}
                          <div className="form-check form-switch d-inline-block m-0" style={{ transform: 'scale(1.1)' }}>
                            <input className="form-check-input m-0 cursor-pointer" type="checkbox" checked={dayHours[i].enabled} onChange={(e) => toggleDay(i, 'enabled', e.target.checked)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Media */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-image" iconBg="#fce7f3" iconColor="#db2777" title="4. Bộ sưu tập ảnh" subtitle="Góc chụp thực tế sân đấu (tối đa 5 ảnh)" />
                
                <div className="bg-light rounded-4 p-4 border" style={{ borderStyle: 'dashed !important', minHeight: 220 }}>
                  <input type="file" multiple className="d-none" id="galleryUpload" accept="image/*" onChange={(e) => setNewImageFiles(p => [...p, ...Array.from(e.target.files || [])])} />
                  
                  <div className="d-flex flex-wrap gap-3 mb-3">
                    {/* Existing Images */}
                    {existingImages.map((src, i) => (
                      <div key={'ex_'+i} className="position-relative rounded-3 overflow-hidden shadow-sm border" style={{ width: 84, height: 84 }}>
                        <img src={src} alt="gal" className="w-100 h-100 object-fit-cover" />
                      </div>
                    ))}
                    
                    {/* New Images */}
                    {newImageFiles.map((file, i) => (
                      <div key={'new_'+i} className="position-relative rounded-3 overflow-hidden shadow-sm" style={{ width: 84, height: 84 }}>
                        <img src={URL.createObjectURL(file)} alt="gal" className="w-100 h-100 object-fit-cover" />
                        <div className="position-absolute top-0 end-0 p-1">
                          <button type="button" className="btn btn-sm btn-danger p-0 d-flex align-items-center justify-content-center shadow" style={{ width: 20, height: 20, borderRadius: '50%' }} onClick={() => setNewImageFiles(p => p.filter((_, idx) => idx !== i))}>
                            <i className="feather-x" style={{ fontSize: 10 }} />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Upload Trigger */}
                    <label htmlFor="galleryUpload" className="d-flex flex-column align-items-center justify-content-center bg-white border border-secondary text-secondary rounded-3 cursor-pointer" style={{ width: 84, height: 84, borderStyle: 'dashed !important' }}>
                      <i className="feather-plus mb-1" style={{ fontSize: 20 }} />
                      <span style={{ fontSize: 11, fontWeight: 500 }}>Upload</span>
                    </label>
                  </div>
                  
                  {(existingImages.length === 0 && newImageFiles.length === 0) && (
                    <div className="text-secondary small mt-3"><i className="feather-info me-1" />Khuyến nghị tải hình ảnh sắc nét, định dạng JPG/PNG.</div>
                  )}
                </div>
              </div>
            </div>

          </div>

        {courtId && (
          <div className="col-12">
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-lock" iconBg="#fef3c7" iconColor="#d97706" title="5. Khóa lịch tạm" subtitle="Bảo trì, thời tiết — người chơi sẽ thấy ô không đặt được và nhận thông báo nếu có đơn trùng giờ" />
                <p className="text-muted small mb-3">Không thể tạo khóa nếu đã có đơn đặt trùng khung giờ. Hãy xử lý đơn trước hoặc chọn giờ khác.</p>
                {blockError && <div className="alert alert-warning py-2 small mb-3" role="alert">{blockError}</div>}
                <div className="row g-3 align-items-end mb-4">
                  <div className="col-12 col-md-3">
                    <label className="form-label fw-semibold small mb-1">Ngày</label>
                    <ShuttleDateField
                      value={blockForm.date}
                      onChange={(ymd) => setBlockForm((p) => ({ ...p, date: ymd }))}
                      placeholder="Chọn ngày khóa"
                    />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label fw-semibold small mb-1">Từ</label>
                    <input type="time" className="form-control bg-light border-0" value={blockForm.startTime} onChange={(e) => setBlockForm((p) => ({ ...p, startTime: e.target.value }))} />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label fw-semibold small mb-1">Đến</label>
                    <input type="time" className="form-control bg-light border-0" value={blockForm.endTime} onChange={(e) => setBlockForm((p) => ({ ...p, endTime: e.target.value }))} />
                  </div>
                  <div className="col-12 col-md-5">
                    <label className="form-label fw-semibold small mb-1">Lý do</label>
                    <select className="form-select bg-light border-0" value={blockForm.reasonCode} onChange={(e) => setBlockForm((p) => ({ ...p, reasonCode: e.target.value }))}>
                      {BLOCK_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold small mb-1">Ghi chú hiển thị cho người chơi (tùy chọn)</label>
                    <input type="text" className="form-control bg-light border-0" placeholder="VD: Sơn lại sân, dự kiến xong trong ca sáng" maxLength={500} value={blockForm.reasonDetail} onChange={(e) => setBlockForm((p) => ({ ...p, reasonDetail: e.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold small mb-1 text-muted">Ghi chú nội bộ (tùy chọn)</label>
                    <input type="text" className="form-control bg-light border-0" maxLength={500} value={blockForm.internalNote} onChange={(e) => setBlockForm((p) => ({ ...p, internalNote: e.target.value }))} />
                  </div>
                  <div className="col-12">
                    <button type="button" className="btn fw-semibold px-4 text-white border-0" disabled={blockSaving || blockLoading} style={{ borderRadius: 10, background: '#097E52' }} onClick={handleAddBlock}>
                      {blockSaving ? 'Đang lưu…' : 'Thêm khóa lịch'}
                    </button>
                  </div>
                </div>
                <div className="border-top pt-3">
                  <div className="fw-semibold mb-2 small text-secondary">Khóa đã đặt (60 ngày tới)</div>
                  {blockLoading ? (
                    <p className="text-muted small mb-0">Đang tải…</p>
                  ) : courtBlocks.length === 0 ? (
                    <p className="text-muted small mb-0">Chưa có khóa lịch.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead><tr><th>Thời gian</th><th>Lý do</th><th>Ghi chú</th><th className="text-end">Thao tác</th></tr></thead>
                        <tbody>
                          {courtBlocks.map((b) => {
                            const id = b.id || b.Id;
                            const st = b.startTime || b.StartTime;
                            const en = b.endTime || b.EndTime;
                            const rc = b.reasonCode || b.ReasonCode;
                            const rd = b.reasonDetail || b.ReasonDetail;
                            const label = BLOCK_REASONS.find((x) => x.value === rc)?.label || rc;
                            return (
                              <tr key={id}>
                                <td style={{ fontSize: 13 }}>{st && en ? `${new Date(st).toLocaleString('vi-VN')} → ${new Date(en).toLocaleString('vi-VN')}` : '—'}</td>
                                <td style={{ fontSize: 13 }}>{label}</td>
                                <td style={{ fontSize: 12 }} className="text-muted">{rd || '—'}</td>
                                <td className="text-end">
                                  {pendingDeleteBlockId === id ? (
                                    <span className="d-inline-flex gap-1">
                                      <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteBlock(id)}>Xác nhận xóa</button>
                                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPendingDeleteBlockId(null)}>Huỷ</button>
                                    </span>
                                  ) : (
                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setPendingDeleteBlockId(id)}>Xóa</button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Action Buttons */}
        <div className="d-flex justify-content-end gap-3 mt-4 mb-4 flex-wrap">
          <Link to={`/manager/venues/${venueId}/courts`} className="btn btn-light fw-bold px-4 py-3 shadow-sm" style={{ borderRadius: 12 }}>
            Hủy bỏ
          </Link>
          {!courtId && !isBulkCreate && (
             <button type="button" className="btn btn-outline-primary fw-bold px-4 py-3 shadow-sm bg-white" disabled={submitting || progressMsg !== ''} style={{ borderRadius: 12 }} onClick={(e) => handleSubmit(e, true)}>
               LƯU VÀ THÊM SÂN KHÁC
             </button>
          )}
          <button type="submit" className="btn btn-primary fw-bold px-5 py-3 shadow" disabled={submitting || progressMsg !== ''} style={{ borderRadius: 12 }}>
             {(submitting || progressMsg !== '') ? 'ĐANG LƯU...' : 'LƯU VÀ XUẤT BẢN'}
          </button>
        </div>

      </form>
    </div>
  );
}
