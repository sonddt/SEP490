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
  const [success, setSuccess] = useState('');
  const [status, setStatus] = useState(null);
  const [requestType, setRequestType] = useState(null);

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
        setError(e.response?.data?.message || 'Không tải được hồ sơ quản lý.');
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

    const effectiveCccdFront = cccdFrontFile || existingCccdFrontUrl;
    const effectiveCccdBack = cccdBackFile || existingCccdBackUrl;
    const licenseCountEffective =
      (businessLicenseFiles && businessLicenseFiles.length > 0)
        ? businessLicenseFiles.length
        : (existingBusinessLicenseFiles?.length ?? 0);

    if (isRegistration) {
      if (!form.taxCode?.trim()) return setError('Vui lòng nhập mã số thuế.') || false;
      if (!form.address?.trim()) return setError('Vui lòng nhập địa chỉ.') || false;
      if (!effectiveCccdFront) return setError('Vui lòng cung cấp CCCD mặt trước.') || false;
      if (!effectiveCccdBack) return setError('Vui lòng cung cấp CCCD mặt sau.') || false;
      if (licenseCountEffective <= 0) return setError('Vui lòng cung cấp giấy phép kinh doanh (1-3 file).') || false;
      return true;
    }

    // CAP_NHAT: CCCD/giấy phép không bắt buộc
    if (cccdFrontFile && !cccdBackFile) return setError('Thiếu CCCD mặt sau.') || false;
    if (cccdBackFile && !cccdFrontFile) return setError('Thiếu CCCD mặt trước.') || false;

    const hasTaxOrAddress = !!(form.taxCode?.trim() || form.address?.trim());
    const hasAnyNewFile = !!(cccdFrontFile || cccdBackFile || (businessLicenseFiles?.length ?? 0) > 0);
    if (!hasTaxOrAddress && !hasAnyNewFile) {
      setError('Bạn chưa cập nhật thông tin nào.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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

      setSuccess('Đã gửi/cập nhật hồ sơ. Vui lòng chờ Admin duyệt.');
    } catch (e2) {
      setError(e2.response?.data?.message || 'Lưu hồ sơ thất bại, vui lòng thử lại.');
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

                <div className="col-md-6 mb-3">
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

                <div className="col-md-6 mb-3">
                  <label className="form-label">Mã số thuế</label>
                  <input
                    className="form-control"
                    name="taxCode"
                    value={form.taxCode}
                    onChange={handleChange}
                    placeholder="Nhập mã số thuế"
                  />
                </div>

                <div className="col-md-12 mb-3">
                  <label className="form-label">Giấy phép kinh doanh</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/png,image/jpeg,application/pdf"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 3) {
                        setError('Tối đa 3 file giấy phép kinh doanh.');
                        setBusinessLicenseFiles(files.slice(0, 3));
                        return;
                      }
                      setBusinessLicenseFiles(files);
                      setError('');
                    }}
                  />
                  <div className="text-muted mt-2" style={{ fontSize: 13 }}>
                    Vui lòng tải lên ảnh chụp Giấy phép kinh doanh (Rõ nét, không mất góc). Chấp nhận file JPG, PNG hoặc PDF. Tối đa 3 file, mỗi file không quá 5MB.
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
                    className="form-control"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Nhập địa chỉ"
                  />
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

