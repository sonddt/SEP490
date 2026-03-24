import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { managerProfileApi } from '../../api/managerProfileApi';
import { useAuth } from '../../context/AuthContext';

export default function ManagerProfileRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [status, setStatus] = useState(null);
  const [requestType, setRequestType] = useState(null);

  const getFieldError = (field) => fieldErrors[field] || '';

  const [form, setForm] = useState({
    taxCode: '',
    address: '',
  });

  const [cccdFrontFile, setCccdFrontFile] = useState(null);
  const [cccdBackFile, setCccdBackFile] = useState(null);
  const [businessLicenseFiles, setBusinessLicenseFiles] = useState([]);

  const [existingCccdFrontUrl, setExistingCccdFrontUrl] = useState(null);
  const [existingCccdBackUrl, setExistingCccdBackUrl] = useState(null);
  const [existingBusinessLicenseFiles, setExistingBusinessLicenseFiles] = useState([]);

  const [cccdFrontObjectUrl, setCccdFrontObjectUrl] = useState(null);
  const [cccdBackObjectUrl, setCccdBackObjectUrl] = useState(null);
  const [businessLicenseObjectPreviews, setBusinessLicenseObjectPreviews] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError('');
      setSuccess('');
      setLoading(true);
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
      } catch (e) {
        if (!mounted) return;
        setError(e.response?.data?.message || 'Oops... Không tải được hồ sơ của bạn!');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
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

  const validateManagerFields = () => {
    const req = (requestType || '').toString().toUpperCase();
    const isRegistration = !req || req === 'DANG_KY';
    const errors = {};
    let isValid = true;

    const effectiveCccdFront = cccdFrontFile || existingCccdFrontUrl;
    const effectiveCccdBack = cccdBackFile || existingCccdBackUrl;
    const licenseCountEffective =
      (businessLicenseFiles && businessLicenseFiles.length > 0)
        ? businessLicenseFiles.length
        : (existingBusinessLicenseFiles?.length ?? 0);

    if (isRegistration) {
      if (!form.taxCode?.trim()) { errors.taxCode = 'Bạn quên nhập phần mã số thuế rồi!'; isValid = false; }
      if (!form.address?.trim()) { errors.address = 'Vui lòng cung cấp địa chỉ nhé.'; isValid = false; }
      if (!effectiveCccdFront) { errors.cccdFront = 'Vui lòng tải lên ảnh CCCD mặt trước.'; isValid = false; }
      if (!effectiveCccdBack) { errors.cccdBack = 'Vui lòng tải lên ảnh CCCD mặt sau.'; isValid = false; }
      if (licenseCountEffective <= 0) { errors.businessLicense = 'Vui lòng tải lên 1 đến 3 ảnh giấy phép kinh doanh.'; isValid = false; }
    } else {
      // CAP_NHAT: CCCD/giấy phép không bắt buộc
      if (cccdFrontFile && !cccdBackFile) { errors.cccdBack = 'Thiếu ảnh CCCD mặt sau.'; isValid = false; }
      if (cccdBackFile && !cccdFrontFile) { errors.cccdFront = 'Thiếu ảnh CCCD mặt trước.'; isValid = false; }

      const hasTaxOrAddress = !!(form.taxCode?.trim() || form.address?.trim());
      const hasAnyNewFile = !!(cccdFrontFile || cccdBackFile || (businessLicenseFiles?.length ?? 0) > 0);
      if (!hasTaxOrAddress && !hasAnyNewFile) {
        setError('Hmm... Hình như bạn chưa thay đổi thông tin nào cả.');
        isValid = false;
      }
    }
    
    setFieldErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSuccess('');
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
      setStatus(data.status ?? data.Status ?? res.status ?? 'PENDING');
      setRequestType(data.requestType ?? data.RequestType ?? null);
      setForm({
        taxCode: data.taxCode ?? data.TaxCode ?? '',
        address: data.address ?? data.Address ?? '',
      });
      setExistingCccdFrontUrl(data.cccdFrontUrl ?? null);
      setExistingCccdBackUrl(data.cccdBackUrl ?? null);
      setExistingBusinessLicenseFiles(data.businessLicenseFiles ?? []);

      setSuccess('Bạn đã gửi hồ sơ thành công! Chờ Admin xíu để kiểm tra nhé.');
    } catch (e2) {
      setError(e2.response?.data?.message || 'Rất tiếc... Lưu hồ sơ thất bại, bạn thử lại sau nhé!');
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (() => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') return <span className="badge bg-success">APPROVED</span>;
    if (s === 'REJECTED') return <span className="badge bg-danger">REJECTED</span>;
    if (s === 'PENDING') return <span className="badge bg-warning text-dark">PENDING</span>;
    return <span className="badge bg-secondary">N/A</span>;
  })();

  return (
    <div className="container" style={{ paddingTop: 110, paddingBottom: 40, maxWidth: 920 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-1">Hồ sơ Quản lý sân</h3>
          <div className="text-muted" style={{ fontSize: 14 }}>
            Trạng thái: {statusBadge}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate('/user/dashboard')}
        >
          Về dashboard
        </button>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="mb-3">
            <div className="text-muted" style={{ fontSize: 14 }}>
              Tài khoản: <b>{user?.email}</b>
            </div>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {success && <div className="alert alert-success py-2">{success}</div>}

          {loading ? (
            <div className="text-muted">Đang tải...</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">CCCD mặt trước</label>
                  <input
                    type="file"
                    className={`form-control ${getFieldError('cccdFront') ? 'is-invalid' : ''}`}
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      setCccdFrontFile(e.target.files?.[0] ?? null);
                      setFieldErrors(prev => ({ ...prev, cccdFront: '' }));
                    }}
                  />
                  {getFieldError('cccdFront') && <div className="invalid-feedback">{getFieldError('cccdFront')}</div>}
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

                <div className="col-md-6 mb-3">
                  <label className="form-label">CCCD mặt sau</label>
                  <input
                    type="file"
                    className={`form-control ${getFieldError('cccdBack') ? 'is-invalid' : ''}`}
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      setCccdBackFile(e.target.files?.[0] ?? null);
                      setFieldErrors(prev => ({ ...prev, cccdBack: '' }));
                    }}
                  />
                  {getFieldError('cccdBack') && <div className="invalid-feedback">{getFieldError('cccdBack')}</div>}
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

                <div className="col-md-6 mb-3">
                  <label className="form-label">Mã số thuế</label>
                  <input
                    className={`form-control ${getFieldError('taxCode') ? 'is-invalid' : ''}`}
                    name="taxCode"
                    value={form.taxCode}
                    onChange={(e) => {
                      handleChange(e);
                      setFieldErrors(prev => ({ ...prev, taxCode: '' }));
                    }}
                    placeholder="Nhập mã số thuế"
                  />
                  {getFieldError('taxCode') && <div className="invalid-feedback">{getFieldError('taxCode')}</div>}
                </div>

                <div className="col-md-12 mb-3">
                  <label className="form-label">Giấy phép kinh doanh</label>
                  <input
                    type="file"
                    className={`form-control ${getFieldError('businessLicense') ? 'is-invalid' : ''}`}
                    accept="image/png,image/jpeg,application/pdf"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      setFieldErrors(prev => ({ ...prev, businessLicense: '' }));
                      if (files.length > 3) {
                        setFieldErrors(prev => ({ ...prev, businessLicense: 'Oops! Tối đa 3 file giấy phép kinh doanh thôi bạn nhé.' }));
                        setBusinessLicenseFiles(files.slice(0, 3));
                        return;
                      }
                      setBusinessLicenseFiles(files);
                    }}
                  />
                  {getFieldError('businessLicense') && <div className="invalid-feedback">{getFieldError('businessLicense')}</div>}
                  <div className="text-muted mt-2" style={{ fontSize: 13 }}>
                    Vui lòng tải lên ảnh chụp Giấy phép kinh doanh (Rõ nét, không mất góc). Chấp nhận file JPG, PNG hoặc PDF. Chỉ tối đa 3 file, mỗi file không quá 5MB.
                  </div>

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

                  {(requestType || '').toString().toUpperCase() === 'CAP_NHAT' ? (
                    <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                      Cập nhật có thể không cần gửi lại CCCD/giấy phép.
                    </div>
                  ) : null}
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Địa chỉ</label>
                  <input
                    className={`form-control ${getFieldError('address') ? 'is-invalid' : ''}`}
                    name="address"
                    value={form.address}
                    onChange={(e) => {
                      handleChange(e);
                      setFieldErrors(prev => ({ ...prev, address: '' }));
                    }}
                    placeholder="Nhập địa chỉ"
                  />
                  {getFieldError('address') && <div className="invalid-feedback">{getFieldError('address')}</div>}
                </div>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-success" type="submit" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Gửi hồ sơ'}
                </button>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => {
                    setForm({ taxCode: '', address: '' });
                    setCccdFrontFile(null);
                    setCccdBackFile(null);
                    setBusinessLicenseFiles([]);
                    setSuccess('');
                    setError('');
                  }}
                  disabled={saving}
                >
                  Đặt lại
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

