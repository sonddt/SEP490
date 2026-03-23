import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import UserProfileTabs from '../../components/user/UserProfileTabs';
import { managerProfileApi } from '../../api/managerProfileApi';
import { useAuth } from '../../context/AuthContext';

export default function UserManagerInfo() {
  const { user } = useAuth();
  const isManager = user?.roles?.includes('MANAGER');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [requestType, setRequestType] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [form, setForm] = useState({
    taxCode: '',
    address: '',
  });

  const [cccdFrontFile, setCccdFrontFile] = useState(null);
  const [cccdBackFile, setCccdBackFile] = useState(null);
  const [businessLicenseFiles, setBusinessLicenseFiles] = useState([]);

  // Docs hiện tại (đến từ BE: snapshot APPROVED hoặc request PENDING gần nhất)
  const [existingCccdFrontUrl, setExistingCccdFrontUrl] = useState(null);
  const [existingCccdBackUrl, setExistingCccdBackUrl] = useState(null);
  const [existingBusinessLicenseFiles, setExistingBusinessLicenseFiles] = useState([]);

  // Preview docs vừa chọn (objectURL từ File user mới upload)
  const [cccdFrontObjectUrl, setCccdFrontObjectUrl] = useState(null);
  const [cccdBackObjectUrl, setCccdBackObjectUrl] = useState(null);
  const [businessLicenseObjectPreviews, setBusinessLicenseObjectPreviews] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const data = await managerProfileApi.getMe();
        if (!mounted) return;
        setStatus(data.status ?? data.Status ?? null);
        setRequestType(data.requestType ?? data.RequestType ?? null);
        setForm({
          taxCode: data.taxCode ?? data.TaxCode ?? '',
          address: data.address ?? data.Address ?? '',
        });
        setExistingCccdFrontUrl(data.cccdFrontUrl ?? null);
        setExistingCccdBackUrl(data.cccdBackUrl ?? null);
        setExistingBusinessLicenseFiles(data.businessLicenseFiles ?? []);
      } catch {
        // user có thể chưa đăng ký manager → giữ trạng thái null
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!cccdFrontFile) {
      setCccdFrontObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(cccdFrontFile);
    setCccdFrontObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cccdFrontFile]);

  useEffect(() => {
    if (!cccdBackFile) {
      setCccdBackObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(cccdBackFile);
    setCccdBackObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cccdBackFile]);

  useEffect(() => {
    if (!businessLicenseFiles || businessLicenseFiles.length === 0) {
      setBusinessLicenseObjectPreviews([]);
      return;
    }
    const previews = businessLicenseFiles.map((f) => ({
      url: URL.createObjectURL(f),
      name: f.name,
      mimeType: f.type,
      id: null,
    }));
    setBusinessLicenseObjectPreviews(previews);
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [businessLicenseFiles]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const requireFullName = () => {
    const fullName = (user?.fullName || '').trim();
    if (!fullName) {
      setErr('Vui lòng cập nhật Họ và tên ở tab Hồ sơ trước khi gửi đơn cho Admin duyệt.');
      return false;
    }
    return true;
  };

  const validateManagerFields = () => {
    const req = (requestType || '').toString().toUpperCase();
    const isRegistration = !req || req === 'DANG_KY';

    const effectiveCccdFront = cccdFrontFile || existingCccdFrontUrl;
    const effectiveCccdBack = cccdBackFile || existingCccdBackUrl;
    const licenseCountEffective =
      (businessLicenseFiles && businessLicenseFiles.length > 0)
        ? businessLicenseFiles.length
        : (existingBusinessLicenseFiles?.length ?? 0);

    const missing = [];
    if (isRegistration) {
      if (!form.taxCode?.trim()) missing.push('Mã số thuế');
      if (!form.address?.trim()) missing.push('Địa chỉ');
      if (!effectiveCccdFront) missing.push('Ảnh CCCD mặt trước');
      if (!effectiveCccdBack) missing.push('Ảnh CCCD mặt sau');
      if (licenseCountEffective <= 0) missing.push('Giấy phép kinh doanh (1-3 file)');
    } else {
      // CAP_NHAT: cho phép không bắt buộc CCCD/giấy phép
      const hasTaxOrAddress = !!(form.taxCode?.trim() || form.address?.trim());
      const hasAnyNewFile = !!(cccdFrontFile || cccdBackFile || (businessLicenseFiles?.length ?? 0) > 0);
      if (!hasTaxOrAddress && !hasAnyNewFile)
        missing.push('Thông tin cập nhật (Mã số thuế/Địa chỉ hoặc upload giấy tờ)');

      // Nếu user chọn 1 mặt CCCD thì cần chọn đủ 2 mặt
      if (cccdFrontFile && !cccdBackFile) missing.push('Thiếu CCCD mặt sau');
      if (cccdBackFile && !cccdFrontFile) missing.push('Thiếu CCCD mặt trước');
    }

    if (missing.length > 0) {
      setErr(`Vui lòng nhập đầy đủ: ${missing.join(', ')}.`);
      return false;
    }
    return true;
  };

  const canSubmit = useMemo(() => {
    if (saving || loading) return false;
    if (!(user?.fullName || '').trim()) return false;
    const req = (requestType || '').toString().toUpperCase();
    const isRegistration = !req || req === 'DANG_KY';

    const effectiveCccdFront = cccdFrontFile || existingCccdFrontUrl;
    const effectiveCccdBack = cccdBackFile || existingCccdBackUrl;
    const licenseCountEffective =
      (businessLicenseFiles && businessLicenseFiles.length > 0)
        ? businessLicenseFiles.length
        : (existingBusinessLicenseFiles?.length ?? 0);

    if (isRegistration) {
      return !!(
        form.taxCode?.trim() &&
        form.address?.trim() &&
        effectiveCccdFront &&
        effectiveCccdBack &&
        licenseCountEffective > 0
      );
    }

    // CAP_NHAT: chỉ cần có thông tin cập nhật + không chọn thiếu CCCD 2 mặt
    if (cccdFrontFile && !cccdBackFile) return false;
    if (cccdBackFile && !cccdFrontFile) return false;

    return !!(
      form.taxCode?.trim() ||
      form.address?.trim() ||
      cccdFrontFile ||
      cccdBackFile ||
      (businessLicenseFiles?.length ?? 0) > 0
    );
  }, [
    saving,
    loading,
    user?.fullName,
    form,
    requestType,
    cccdFrontFile,
    cccdBackFile,
    businessLicenseFiles,
    existingCccdFrontUrl,
    existingCccdBackUrl,
    existingBusinessLicenseFiles
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    if (!requireFullName()) return;
    if (!validateManagerFields()) return;

    setSaving(true);
    try {
      const res = await managerProfileApi.updateMe({
        taxCode: form.taxCode?.trim() || null,
        address: form.address?.trim() || null,
        cccdFrontFile,
        cccdBackFile,
        businessLicenseFiles
      });
      // Refresh để hiển thị docs vừa upload (kể cả khi PENDING chưa duyệt)
      const data = await managerProfileApi.getMe();
      setStatus(data.status ?? data.Status ?? null);
      setRequestType(data.requestType ?? data.RequestType ?? null);
      setForm({
        taxCode: data.taxCode ?? data.TaxCode ?? '',
        address: data.address ?? data.Address ?? '',
      });
      setExistingCccdFrontUrl(data.cccdFrontUrl ?? null);
      setExistingCccdBackUrl(data.cccdBackUrl ?? null);
      setExistingBusinessLicenseFiles(data.businessLicenseFiles ?? []);

      setMsg('Đã gửi/cập nhật thông tin Quản lý. Vui lòng chờ Admin duyệt.');
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Gửi đơn thất bại, vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const badge = (() => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') return <span className="badge bg-success">APPROVED</span>;
    if (s === 'REJECTED') return <span className="badge bg-danger">REJECTED</span>;
    if (s === 'PENDING') return <span className="badge bg-warning text-dark">PENDING</span>;
    return isManager
      ? <span className="badge bg-success">ĐÃ ĐĂNG KÝ</span>
      : <span className="badge bg-secondary">CHƯA ĐĂNG KÝ</span>;
  })();

  return (
    <div className="main-wrapper">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Hồ sơ người dùng</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Hồ sơ người dùng</li>
          </ul>
        </div>
      </section>

      <UserDashboardMenu />

      <div className="content court-bg" style={{ paddingTop: '90px' }}>
        <div className="container">
          <UserProfileTabs />

          <div className="row">
            <div className="col-sm-12">
              <div className="profile-detail-group">
                <div className="card">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div>
                        <h4 className="mb-0">Thông tin quản lý</h4>
                        <div className="text-muted" style={{ fontSize: 14 }}>Trạng thái: {badge}</div>
                      </div>
                    </div>

                    {err && <div className="alert alert-danger py-2">{err}</div>}
                    {msg && <div className="alert alert-success py-2">{msg}</div>}

                    {loading ? (
                      <div className="text-muted">Đang tải...</div>
                    ) : (
                      <form onSubmit={handleSubmit}>
                        <div className="row">
                          <div className="col-lg-4 col-md-6">
                            <div className="input-space">
                              <label className="form-label">CCCD mặt trước</label>
                              <input
                                type="file"
                                className="form-control"
                                accept="image/png,image/jpeg"
                                onChange={(e) => setCccdFrontFile(e.target.files?.[0] ?? null)}
                              />
                              {(cccdFrontObjectUrl || existingCccdFrontUrl) && (
                                <div className="mt-2">
                                  <img
                                    src={cccdFrontObjectUrl || existingCccdFrontUrl}
                                    alt="CCCD mặt trước"
                                    style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 6 }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <div className="input-space">
                              <label className="form-label">CCCD mặt sau</label>
                              <input
                                type="file"
                                className="form-control"
                                accept="image/png,image/jpeg"
                                onChange={(e) => setCccdBackFile(e.target.files?.[0] ?? null)}
                              />
                              {(cccdBackObjectUrl || existingCccdBackUrl) && (
                                <div className="mt-2">
                                  <img
                                    src={cccdBackObjectUrl || existingCccdBackUrl}
                                    alt="CCCD mặt sau"
                                    style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 6 }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <div className="input-space">
                              <label className="form-label">Mã số thuế</label>
                              <input
                                type="text"
                                className="form-control"
                                name="taxCode"
                                value={form.taxCode}
                                onChange={handleChange}
                                placeholder="Nhập mã số thuế"
                              />
                            </div>
                          </div>

                          <div className="col-lg-12 col-md-12">
                            <div className="input-space">
                              <label className="form-label">Giấy phép kinh doanh</label>
                              <input
                                type="file"
                                className="form-control"
                                accept="image/png,image/jpeg,application/pdf"
                                multiple
                                onChange={(e) => {
                                  const files = Array.from(e.target.files ?? []);
                                  if (files.length > 3) {
                                    setErr('Tối đa 3 file giấy phép kinh doanh.');
                                    setBusinessLicenseFiles(files.slice(0, 3));
                                    return;
                                  }
                                  setBusinessLicenseFiles(files);
                                  setErr('');
                                }}
                              />

                              {((businessLicenseObjectPreviews && businessLicenseObjectPreviews.length > 0) ||
                                (existingBusinessLicenseFiles && existingBusinessLicenseFiles.length > 0)) && (
                                <div className="mt-3">
                                  <div className="text-muted" style={{ fontSize: 13, marginBottom: 6 }}>
                                    Xem trước giấy phép:
                                  </div>
                                  <div className="d-flex flex-wrap gap-2">
                                    {(businessLicenseObjectPreviews?.length > 0
                                      ? businessLicenseObjectPreviews
                                      : existingBusinessLicenseFiles
                                    ).map((f, idx) => {
                                      const mime = f.mimeType || f.MimeType || '';
                                      const isImg = (mime || '').toString().startsWith('image/');
                                      return (
                                        <div key={f.id ?? `${f.name ?? 'file'}_${idx}`} style={{ width: 160 }}>
                                          {isImg ? (
                                            <img
                                              src={f.url}
                                              alt={f.name ?? 'Giấy phép'}
                                              style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 6 }}
                                            />
                                          ) : (
                                            <a href={f.url} target="_blank" rel="noreferrer">
                                              Xem PDF
                                            </a>
                                          )}
                                          <div className="text-muted" style={{ fontSize: 12, wordBreak: 'break-word' }}>
                                            {f.name ? f.name : 'Tài liệu'}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="text-muted mt-2" style={{ fontSize: 13 }}>
                                Vui lòng tải lên ảnh chụp Giấy phép kinh doanh (Rõ nét, không mất góc). Chấp nhận file JPG, PNG hoặc PDF. Tối đa 3 file, mỗi file không quá 5MB.
                                {(requestType || '').toString().toUpperCase() === 'CAP_NHAT' ? (
                                  <div className="mt-1">Cập nhật có thể không cần gửi lại giấy phép.</div>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="col-lg-12 col-md-12">
                            <div className="input-space">
                              <label className="form-label">Địa chỉ DOANH NGHIỆP / CÁ NHÂN</label>
                              <input
                                type="text"
                                className="form-control"
                                name="address"
                                value={form.address}
                                onChange={handleChange}
                                placeholder="Nhập địa chỉ"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="text-end">
                          <button className="btn btn-success" type="submit" disabled={!canSubmit}>
                            {saving ? 'Đang gửi...' : 'Gửi/Cập nhật'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

