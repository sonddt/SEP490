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

  const [form, setForm] = useState({
    idCardNo: '',
    taxCode: '',
    businessLicenseNo: '',
    address: '',
  });

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
        setForm({
          idCardNo: data.idCardNo ?? data.IdCardNo ?? '',
          taxCode: data.taxCode ?? data.TaxCode ?? '',
          businessLicenseNo: data.businessLicenseNo ?? data.BusinessLicenseNo ?? '',
          address: data.address ?? data.Address ?? '',
        });
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await managerProfileApi.updateMe({
        idCardNo: form.idCardNo?.trim() || null,
        taxCode: form.taxCode?.trim() || null,
        businessLicenseNo: form.businessLicenseNo?.trim() || null,
        address: form.address?.trim() || null,
      });
      setStatus(res.status ?? 'PENDING');
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
                  <label className="form-label">CCCD/CMND</label>
                  <input
                    className="form-control"
                    name="idCardNo"
                    value={form.idCardNo}
                    onChange={handleChange}
                    placeholder="Nhập CCCD/CMND"
                  />
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
                <div className="col-md-6 mb-3">
                  <label className="form-label">Giấy phép kinh doanh</label>
                  <input
                    className="form-control"
                    name="businessLicenseNo"
                    value={form.businessLicenseNo}
                    onChange={handleChange}
                    placeholder="Nhập số giấy phép kinh doanh"
                  />
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
                    setForm({ idCardNo: '', taxCode: '', businessLicenseNo: '', address: '' });
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

