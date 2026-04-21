import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profileApi';
import { managerProfileApi } from '../../api/managerProfileApi';
import axiosClient from '../../api/axiosClient';
import ShuttleDateField from '../../components/ui/ShuttleDateField';

/* ── Compact section header (same pattern as ManagerAddVenue) ──────────── */
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

/* ── Read-only info row ─────────────────────────────────────────────────── */
function InfoRow({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: value ? '#1e293b' : '#94a3b8', fontWeight: value ? 500 : 400 }}>{value || 'Chưa cập nhật'}</div>
    </div>
  );
}

/* ── CCCD preview ───────────────────────────────────────────────────────── */
function CccdPreviewImg({ src, label }) {
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{label}</p>
      <img src={src} alt={label} style={{ width: 140, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0' }} />
    </div>
  );
}

/* ── File upload zone ───────────────────────────────────────────────────── */
function FileUploadZone({ label, hint, multiple, accept, files, onFiles, existingUrl }) {
  const inputRef = useRef(null);
  const preview = files?.length > 0 ? URL.createObjectURL(files[0]) : existingUrl;
  return (
    <div>
      {label && <label className="form-label fw-semibold text-dark mb-2">{label}</label>}
      <div
        className="position-relative bg-light rounded-4 d-flex flex-column align-items-center justify-content-center border"
        style={{ minHeight: 130, cursor: 'pointer', borderStyle: 'dashed' }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept || 'image/*,.pdf'}
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={(e) => onFiles(Array.from(e.target.files || []))}
        />
        {preview ? (
          <img src={preview} alt="Preview" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 14 }} />
        ) : (
          <div className="text-center text-muted py-3">
            <i className="feather-upload-cloud text-primary" style={{ fontSize: 28 }} />
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>{hint || 'Nhấn để chọn file'}</p>
          </div>
        )}
      </div>
      {files?.length > 0 && (
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
          {multiple ? `${files.length} file đã chọn` : files[0].name}
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function ManagerProfile() {
  const { user: authUser, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  /* Edit mode */
  const [editing, setEditing] = useState(false);
  const [submittingPersonal, setSubmittingPersonal] = useState(false);
  const [submittingBiz, setSubmittingBiz] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  /* Personal info form */
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    gender: '',
    dateOfBirth: '',
    about: '',
    address: '',
    province: '',
  });

  /* Avatar upload (personal) */
  const [avatarFile, setAvatarFile] = useState(null);

  /* Business info form */
  const [bizForm, setBizForm] = useState({
    taxCode: '',
    bizAddress: '',
  });
  const [cccdFront, setCccdFront] = useState([]);
  const [cccdBack, setCccdBack] = useState([]);
  const [licenseFiles, setLicenseFiles] = useState([]);
  const [existingLicenseFiles, setExistingLicenseFiles] = useState([]);
  const [licensePreviews, setLicensePreviews] = useState([]);
  const [licensesDirty, setLicensesDirty] = useState(false);

  /* License File Previews */
  useEffect(() => {
    if (!licenseFiles || licenseFiles.length === 0) {
      setLicensePreviews([]);
      return;
    }
    const previews = licenseFiles.map((f) => ({
      url: URL.createObjectURL(f),
      name: f.name,
      mimeType: f.type,
      id: null,
    }));
    setLicensePreviews(previews);
    return () => previews.forEach(p => URL.revokeObjectURL(p.url));
  }, [licenseFiles]);

  const handleRemoveExistingLicense = (id) => {
    setExistingLicenseFiles(prev => prev.filter(f => f.id !== id));
    setLicensesDirty(true);
  };
  
  const handleRemoveNewLicense = (idx) => {
    setLicenseFiles(prev => prev.filter((_, i) => i !== idx));
    setLicensesDirty(true);
  };

  /* ── Load profile ──────────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await profileApi.getMe();
        if (!mounted) return;
        setProfile(data);
        const u = data?.user ?? {};
        const mp = data?.managerProfile ?? {};
        setForm({
          fullName: u.fullName ?? '',
          phoneNumber: u.phoneNumber ?? '',
          gender: u.gender ?? '',
          dateOfBirth: u.dateOfBirth ? u.dateOfBirth.split('T')[0] : '',
          about: u.about ?? '',
          address: u.address ?? '',
          province: u.province ?? '',
        });
        setBizForm({
          taxCode: mp.taxCode ?? '',
          bizAddress: mp.address ?? '',
        });
        setExistingLicenseFiles(mp.businessLicenseFiles || []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || 'Không tải được hồ sơ.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ── Helpers ───────────────────────────────────────────────────── */
  const u = profile?.user ?? {
    fullName: authUser?.fullName || authUser?.email || '',
    email: authUser?.email || '',
    phoneNumber: null,
    avatarUrl: null,
    createdAt: null,
  };
  const mp = profile?.managerProfile ?? null;
  const isManager = profile?.roles?.includes('MANAGER') || authUser?.roles?.includes('MANAGER');

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
  };

  const formatGenderVi = (g) => {
    const s = String(g || '').trim().toUpperCase();
    if (!s) return '';
    if (s === 'MALE' || s === 'NAM') return 'Nam';
    if (s === 'FEMALE' || s === 'NỮ' || s === 'NU') return 'Nữ';
    if (s === 'OTHER' || s === 'KHÁC' || s === 'KHAC') return 'Khác';
    return g;
  };

  const getFieldError = (field) => {
    if (!fieldErrors) return null;
    const key = Object.keys(fieldErrors).find((k) => k.toLowerCase() === field.toLowerCase());
    return key ? fieldErrors[key][0] : null;
  };

  const setF = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const setBF = (key, val) => setBizForm((p) => ({ ...p, [key]: val }));

  const clearErr = (field) => setFieldErrors((p) => ({ ...p, [field]: null }));

  const managerBadge = (() => {
    const s = (mp?.status || '').toUpperCase();
    if (s === 'APPROVED') return <span className="badge bg-success">Đã phê duyệt</span>;
    if (s === 'REJECTED') return <span className="badge bg-danger">Bị từ chối</span>;
    if (s === 'PENDING') return <span className="badge bg-warning text-dark">Đang chờ duyệt</span>;
    return isManager ? <span className="badge bg-success">Đã xác thực</span> : <span className="badge bg-secondary">Chưa đăng ký</span>;
  })();

  /* ── Submit (Personal) ─────────────────────────────────────────── */
  const handleSubmitPersonal = async (e) => {
    e?.preventDefault?.();
    const errors = {};
    if (!form.fullName?.trim()) errors.fullName = ['Bạn chưa nhập họ tên kìa!'];
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMsg('Oops... Có vài chỗ chưa ổn, bạn kiểm tra lại bên dưới nhé!');
      return;
    }

    try {
      setErrorMsg('');
      setFieldErrors({});
      setSubmittingPersonal(true);

      /* Update personal info */
      await profileApi.updateMe({
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        about: form.about,
        address: form.address,
        province: form.province,
      });

      /* Upload avatar if selected */
      if (avatarFile) {
        const res = await profileApi.uploadAvatar(avatarFile);
        const url = res?.avatarUrl ?? res?.user?.avatarUrl ?? null;
        if (url) updateUser?.({ avatarUrl: url });
        setAvatarFile(null);
      }

      /* Reload */
      const updated = await profileApi.getMe();
      setProfile(updated);
      setSuccessMsg('Đã lưu thay đổi thông tin cá nhân.');
    } catch (err) {
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
        setErrorMsg('Oops... Hệ thống phát hiện vài phần nhập chưa chuẩn xác.');
      } else {
        setFieldErrors({});
        setErrorMsg(err.response?.data?.message || 'Rất tiếc! Đã xảy ra sự cố khi lưu. Bạn thử lại nha!');
      }
    } finally {
      setSubmittingPersonal(false);
    }
  };

  /* ── Submit (Business/Owner) ───────────────────────────────────── */
  const handleSubmitBiz = async (e) => {
    e?.preventDefault?.();
    try {
      setErrorMsg('');
      setFieldErrors({});
      setSubmittingBiz(true);

      if (bizForm.taxCode || bizForm.bizAddress || cccdFront.length || cccdBack.length || licenseFiles.length || licensesDirty) {
        await managerProfileApi.updateMe({
          taxCode: bizForm.taxCode || null,
          address: bizForm.bizAddress || null,
          cccdFrontFile: cccdFront[0] || null,
          cccdBackFile: cccdBack[0] || null,
          businessLicenseFiles: licenseFiles,
          retainedLicenseIds: existingLicenseFiles
            .map(f => f.id ?? f.Id ?? null)
            .filter(Boolean)
            .join(','),
          licensesDirty: licensesDirty || (licenseFiles && licenseFiles.length > 0)
        });
      } else {
        setErrorMsg('Bạn chưa cập nhật thông tin nào ở phần Chủ sân.');
        return;
      }

      const updated = await profileApi.getMe();
      setProfile(updated);
      setExistingLicenseFiles(updated?.managerProfile?.businessLicenseFiles || []);
      setLicensesDirty(false);
      setSuccessMsg('Đã gửi/cập nhật thông tin Chủ sân. Vui lòng chờ Admin duyệt.');
      setCccdFront([]);
      setCccdBack([]);
      setLicenseFiles([]);
    } catch (err) {
      if (err.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
        setErrorMsg('Oops... Hệ thống phát hiện vài phần nhập chưa chuẩn xác.');
      } else {
        setFieldErrors({});
        setErrorMsg(err.response?.data?.message || 'Rất tiếc! Đã xảy ra sự cố khi gửi/cập nhật. Bạn thử lại nha!');
      }
    } finally {
      setSubmittingBiz(false);
    }
  };

  /* ── Cancel edit ───────────────────────────────────────────────── */
  const handleCancelEdit = () => {
    if (!profile) return;
    const pu = profile.user ?? {};
    const pmp = profile.managerProfile ?? {};
    setForm({
      fullName: pu.fullName ?? '',
      phoneNumber: pu.phoneNumber ?? '',
      gender: pu.gender ?? '',
      dateOfBirth: pu.dateOfBirth ? pu.dateOfBirth.split('T')[0] : '',
      about: pu.about ?? '',
      address: pu.address ?? '',
      province: pu.province ?? '',
    });
    setBizForm({ taxCode: pmp.taxCode ?? '', bizAddress: pmp.address ?? '' });
    setCccdFront([]);
    setCccdBack([]);
    setLicenseFiles([]);
    setExistingLicenseFiles(pmp.businessLicenseFiles || []);
    setLicensesDirty(false);
    setAvatarFile(null);
    setErrorMsg('');
    setFieldErrors({});
    setEditing(false);
  };

  /* ── Loading/Error states ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Đang tải...</span></div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
   VIEW MODE
   ══════════════════════════════════════════════════════════════════ */
  if (!editing) {
    return (
      <>
        {/* Page title bar */}
        <div className="mgr-header">
          <div className="mgr-header__title">
            <h1>Hồ sơ Quản lý</h1>
            <p>Thông tin tài khoản và giấy tờ kinh doanh của Chủ Sân</p>
          </div>
          <div className="mgr-header__actions">
            <button
              type="button"
              className="btn btn-primary fw-bold d-inline-flex align-items-center gap-2 shadow-sm"
              style={{ borderRadius: 12, padding: '10px 22px' }}
              onClick={() => { setSuccessMsg(''); setErrorMsg(''); setEditing(true); }}
            >
              <i className="feather-edit-2" style={{ fontSize: 15 }} />
              Chỉnh sửa hồ sơ
            </button>
          </div>
        </div>

        {error && <div className="alert alert-warning mb-3">{error}</div>}
        {successMsg && (
          <div className="alert alert-success d-flex align-items-center gap-2 mb-4" style={{ borderRadius: 12, border: 'none', background: '#f0fdf4', color: '#166534' }}>
            <i className="feather-check-circle fs-5" /> {successMsg}
          </div>
        )}

        <div className="mgr-content" style={{ maxWidth: 900 }}>
          {/* ── Personal Info Card ─────────────────────────────── */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 16 }}>
            <div className="card-body p-4 p-md-5">
              <SectionHeader icon="feather-user" iconBg="#e8f5ee" iconColor="#097E52" title="Thông tin cá nhân" subtitle="Tên, liên hệ và thông tin cơ bản" />
              <div className="d-flex align-items-center mb-4 pb-4 border-bottom" style={{ gap: 20 }}>
                <img
                  src={u?.avatarUrl || '/assets/img/profiles/avatar-01.jpg'}
                  alt="Avatar"
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f8fafc', flexShrink: 0 }}
                />
                <div>
                  <h4 style={{ margin: '0 0 4px', color: '#0f172a', fontWeight: 700 }}>{u.fullName || '—'}</h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Gia nhập: {formatDate(u.createdAt) || 'Không xác định'}</p>
                </div>
              </div>
              <div className="row g-4">
                <div className="col-sm-6"><InfoRow label="Email" value={u.email} /></div>
                <div className="col-sm-6"><InfoRow label="Số điện thoại" value={u.phoneNumber} /></div>
                <div className="col-sm-6"><InfoRow label="Giới tính" value={formatGenderVi(u.gender)} /></div>
                <div className="col-sm-6"><InfoRow label="Ngày sinh" value={formatDate(u.dateOfBirth)} /></div>
                <div className="col-12"><InfoRow label="Địa chỉ" value={u.address} /></div>
                {u.about && <div className="col-12"><InfoRow label="Giới thiệu" value={u.about} /></div>}
              </div>
            </div>
          </div>

          {/* ── Business Info Card ─────────────────────────────── */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center px-4 px-md-5 py-4" style={{ borderRadius: '16px 16px 0 0' }}>
              <SectionHeader icon="feather-briefcase" iconBg="#eff6ff" iconColor="#2563eb" title="Thông tin Chủ Sân" subtitle="Giấy tờ và hồ sơ kinh doanh" />
              <div className="ms-3">{managerBadge}</div>
            </div>
            <div className="card-body p-4 p-md-5">
              <div className="row g-4 pb-4 mb-4 border-bottom">
                <div className="col-sm-6"><InfoRow label="Mã số thuế" value={mp?.taxCode} /></div>
                <div className="col-sm-6"><InfoRow label="Địa chỉ kinh doanh" value={mp?.address} /></div>
              </div>
              <div className="mb-4 pb-4 border-bottom">
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Căn cước công dân</div>
                {mp?.cccdFrontUrl || mp?.cccdBackUrl ? (
                  <div className="d-flex gap-3 flex-wrap">
                    {mp.cccdFrontUrl && <CccdPreviewImg src={mp.cccdFrontUrl} label="Mặt trước" />}
                    {mp.cccdBackUrl && <CccdPreviewImg src={mp.cccdBackUrl} label="Mặt sau" />}
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8' }}>Chưa cập nhật</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Giấy phép kinh doanh</div>
                {mp?.businessLicenseFiles?.length > 0 ? (
                  <div className="d-flex flex-wrap gap-3">
                    {mp.businessLicenseFiles.map((f, idx) => (
                      (f.mimeType || '').startsWith('image/') ? (
                        <img key={f.id ?? idx} src={f.url} alt={`Giấy phép ${idx + 1}`} style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0' }} />
                      ) : (
                        <a key={f.id ?? idx} href={f.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f1f5f9', borderRadius: 8, textDecoration: 'none', color: '#0f172a', fontSize: 13 }}>
                          <i className="feather-file-text" /> Giấy phép {idx + 1}
                        </a>
                      )
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8' }}>Chưa cập nhật</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
   EDIT MODE
   ══════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
        <button
          type="button"
          onClick={handleCancelEdit}
          className="btn btn-light shadow-sm d-flex align-items-center justify-content-center"
          style={{ width: 44, height: 44, borderRadius: 12 }}
        >
          <i className="feather-arrow-left fs-5" />
        </button>
        <div>
          <h3 className="mb-0 fw-bold text-dark">Chỉnh sửa Hồ sơ</h3>
          <p className="text-secondary mb-0 mt-1" style={{ fontSize: 14 }}>Cập nhật thông tin cá nhân và giấy tờ kinh doanh</p>
        </div>
      </div>

      <form onSubmit={handleSubmitPersonal} noValidate>
        {errorMsg && (
          <div className="alert alert-danger d-flex align-items-center mb-4" style={{ borderRadius: 10, border: 'none', background: '#fef2f2', color: '#991b1b', padding: '14px 20px' }}>
            <i className="feather-alert-circle fs-5 me-2" />
            <span className="fw-medium">{errorMsg}</span>
          </div>
        )}

        <div className="row g-4">
          {/* ═══ LEFT – Personal Info ═══ */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-4">
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-user" iconBg="#e8f5ee" iconColor="#097E52" title="Thông tin cá nhân" subtitle="Họ tên, liên hệ và dữ liệu cơ bản" />
                <div className="d-flex align-items-center gap-3 mb-4 pb-4 border-bottom">
                  <img
                    src={avatarFile ? URL.createObjectURL(avatarFile) : (u?.avatarUrl || '/assets/img/profiles/avatar-01.jpg')}
                    alt="Avatar"
                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f8fafc', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <label className="form-label fw-semibold text-dark mb-2">Ảnh đại diện</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="form-control"
                      onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>JPG/PNG/WebP</div>
                  </div>
                </div>
                <div className="row g-4">
                  <div className="col-12">
                    <label className="form-label fw-semibold text-dark mb-2">Họ và tên <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control form-control-lg bg-light border-0 ${getFieldError('fullName') ? 'is-invalid' : ''}`}
                      placeholder="Nguyễn Văn A"
                      value={form.fullName}
                      onChange={(e) => { setF('fullName', e.target.value); clearErr('fullName'); }}
                    />
                    {getFieldError('fullName') && <div className="invalid-feedback">{getFieldError('fullName')}</div>}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Số điện thoại</label>
                    <input type="tel" className="form-control form-control-lg bg-light border-0" placeholder="0901234567" value={form.phoneNumber} onChange={(e) => setF('phoneNumber', e.target.value)} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Giới tính</label>
                    <select className="form-select form-select-lg bg-light border-0" value={form.gender} onChange={(e) => setF('gender', e.target.value)}>
                      <option value="">Chưa chọn</option>
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Ngày sinh</label>
                    <ShuttleDateField
                      value={form.dateOfBirth ? form.dateOfBirth.substring(0, 10) : ''}
                      onChange={(ymd) => setF('dateOfBirth', ymd)}
                      placeholder="Ngày sinh"
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold text-dark mb-2">Tỉnh / Thành phố</label>
                    <input type="text" className="form-control form-control-lg bg-light border-0" placeholder="TP. Hà Nội" value={form.province} onChange={(e) => setF('province', e.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-dark mb-2">Địa chỉ</label>
                    <input type="text" className="form-control form-control-lg bg-light border-0" placeholder="Số nhà, đường, phường..." value={form.address} onChange={(e) => setF('address', e.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-dark mb-2">Giới thiệu bản thân</label>
                    <textarea className="form-control bg-light border-0" rows={3} placeholder="Một vài dòng về bạn..." value={form.about} onChange={(e) => setF('about', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Personal actions (outside card, like screenshot) */}
            <div className="d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-primary fw-bold px-5 py-3 shadow"
                disabled={submittingPersonal}
                onClick={handleSubmitPersonal}
                style={{ borderRadius: 12, minWidth: 180 }}
              >
                {submittingPersonal ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
              </button>
            </div>
          </div>

          {/* ═══ RIGHT – Business Info ═══ */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-4">
            {/* Business Fields */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-briefcase" iconBg="#eff6ff" iconColor="#2563eb" title="Thông tin Chủ Sân" subtitle="Mã số thuế và địa chỉ kinh doanh" />
                <div className="row g-4">
                  <div className="col-12">
                    <label className="form-label fw-semibold text-dark mb-2">Mã số thuế</label>
                    <input type="text" className={`form-control form-control-lg bg-light border-0 ${getFieldError('taxCode') ? 'is-invalid' : ''}`} placeholder="Ví dụ: 0123456789" value={bizForm.taxCode} onChange={(e) => { setBF('taxCode', e.target.value); clearErr('taxCode'); }} />
                    {getFieldError('taxCode') && <div className="invalid-feedback">{getFieldError('taxCode')}</div>}
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-dark mb-2">Địa chỉ kinh doanh</label>
                    <textarea className="form-control bg-light border-0" rows={3} placeholder="Địa chỉ cơ sở kinh doanh..." value={bizForm.bizAddress} onChange={(e) => setBF('bizAddress', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* CCCD Upload */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-credit-card" iconBg="#fce7f3" iconColor="#db2777" title="Căn cước công dân" subtitle="Tải lên 2 mặt CCCD / CMND" />
                <div className="row g-4">
                  <div className="col-6">
                    <FileUploadZone label="Mặt trước" hint="Nhấn để chọn ảnh" accept="image/*" files={cccdFront} onFiles={setCccdFront} existingUrl={mp?.cccdFrontUrl} />
                  </div>
                  <div className="col-6">
                    <FileUploadZone label="Mặt sau" hint="Nhấn để chọn ảnh" accept="image/*" files={cccdBack} onFiles={setCccdBack} existingUrl={mp?.cccdBackUrl} />
                  </div>
                </div>
              </div>
            </div>

            {/* License Upload */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4 p-md-5">
                <SectionHeader icon="feather-file-text" iconBg="#fef3c7" iconColor="#d97706" title="Giấy phép kinh doanh" subtitle="JPG, PNG hoặc PDF – tối đa 5MB mỗi file (Tối đa 3 file)" />
                
                <div
                  className="position-relative bg-light rounded-4 d-flex flex-column align-items-center justify-content-center border"
                  style={{ minHeight: 130, cursor: 'pointer', borderStyle: 'dashed' }}
                  onClick={() => document.getElementById('bizLicenseUploadInput').click()}
                >
                  <input
                    id="bizLicenseUploadInput"
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files ?? []);
                      setLicenseFiles(prev => {
                        const merged = [...prev, ...newFiles];
                        const currentExistingCount = existingLicenseFiles?.length || 0;
                        if (merged.length + currentExistingCount > 3) {
                          setErrorMsg('Chỉ được tải lên tổng cộng tối đa 3 file giấy phép kinh doanh.');
                          return merged.slice(0, 3 - currentExistingCount);
                        }
                        setErrorMsg('');
                        return merged;
                      });
                      setLicensesDirty(true);
                      e.target.value = '';
                    }}
                  />
                  <div className="text-center text-muted py-3">
                    <i className="feather-upload-cloud" style={{ fontSize: 28, color: '#d97706' }} />
                    <p style={{ margin: '6px 0 0', fontSize: 13 }}>Nhấn để chọn 1 hoặc nhiều file</p>
                  </div>
                </div>

                {((licensePreviews && licensePreviews.length > 0) || (existingLicenseFiles && existingLicenseFiles.length > 0)) && (
                  <div className="row g-3 mt-3">
                    {existingLicenseFiles?.map((f) => {
                      const mime = f.mimeType || f.MimeType || '';
                      const isImg = (mime || '').toString().startsWith('image/');
                      return (
                        <div key={f.id ?? String(f.url)} className="col-4">
                          <div className="position-relative bg-light rounded-3 p-2 border">
                            <button
                              type="button"
                              onClick={() => handleRemoveExistingLicense(f.id)}
                              className="position-absolute btn btn-sm btn-danger rounded-circle p-0 d-flex align-items-center justify-content-center border border-2 border-white shadow-sm"
                              style={{ top: -6, right: -6, width: 22, height: 22, zIndex: 10 }}
                            >
                              <i className="feather-x" style={{ fontSize: 12 }}></i>
                            </button>
                            <div className="w-100 bg-white rounded overflow-hidden d-flex align-items-center justify-content-center shadow-sm" style={{ height: 80 }}>
                              {isImg ? (
                                <img src={f.url} className="w-100 h-100 object-fit-cover" alt="license" />
                              ) : (
                                <i className="feather-file-text text-danger fs-1"></i>
                              )}
                            </div>
                            <div className="mt-2 text-truncate" style={{ fontSize: 11, fontWeight: 600 }}>{f.name || 'Tài liệu cũ'}</div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {licensePreviews?.map((f, idx) => {
                      const mime = f.mimeType || f.MimeType || '';
                      const isImg = (mime || '').toString().startsWith('image/');
                      return (
                        <div key={`new_${idx}`} className="col-4">
                          <div className="position-relative bg-light rounded-3 p-2 border">
                            <button
                              type="button"
                              onClick={() => handleRemoveNewLicense(idx)}
                              className="position-absolute btn btn-sm btn-danger rounded-circle p-0 d-flex align-items-center justify-content-center border border-2 border-white shadow-sm"
                              style={{ top: -6, right: -6, width: 22, height: 22, zIndex: 10 }}
                            >
                              <i className="feather-x" style={{ fontSize: 12 }}></i>
                            </button>
                            <div className="w-100 bg-white rounded overflow-hidden d-flex align-items-center justify-content-center shadow-sm" style={{ height: 80 }}>
                              {isImg ? (
                                <img src={f.url} className="w-100 h-100 object-fit-cover" alt="license" />
                              ) : (
                                <i className="feather-file-text text-danger fs-1"></i>
                              )}
                            </div>
                            <div className="mt-2 text-truncate" style={{ fontSize: 11, fontWeight: 600 }}>{f.name || `Tài liệu mới ${idx+1}`}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3 mt-4 mb-4">
          <div className="d-flex justify-content-end gap-3 ms-auto">
            <button type="button" className="btn btn-light fw-bold px-4 py-3 shadow-sm" style={{ borderRadius: 12 }} onClick={handleCancelEdit}>
              Hủy bỏ
            </button>
            <button
              type="button"
              className="btn btn-primary fw-bold px-5 py-3 shadow"
              disabled={submittingBiz}
              onClick={handleSubmitBiz}
              style={{ borderRadius: 12 }}
            >
              {submittingBiz ? 'ĐANG GỬI...' : 'GỬI/CẬP NHẬT'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
