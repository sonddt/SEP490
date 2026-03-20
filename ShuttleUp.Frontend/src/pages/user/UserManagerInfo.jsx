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
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [form, setForm] = useState({
    idCardNo: '',
    taxCode: '',
    businessLicenseNo: '',
    address: '',
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr('');
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
      } catch {
        // user có thể chưa đăng ký manager → giữ trạng thái null
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

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
    const missing = [];
    if (!form.idCardNo?.trim()) missing.push('CCCD/CMND');
    if (!form.taxCode?.trim()) missing.push('Mã số thuế');
    if (!form.businessLicenseNo?.trim()) missing.push('Giấy phép kinh doanh');
    if (!form.address?.trim()) missing.push('Địa chỉ');
    if (missing.length > 0) {
      setErr(`Vui lòng nhập đầy đủ: ${missing.join(', ')}.`);
      return false;
    }
    return true;
  };

  const canSubmit = useMemo(() => {
    if (saving || loading) return false;
    if (!(user?.fullName || '').trim()) return false;
    return !!(
      form.idCardNo?.trim() &&
      form.taxCode?.trim() &&
      form.businessLicenseNo?.trim() &&
      form.address?.trim()
    );
  }, [saving, loading, user?.fullName, form]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    if (!requireFullName()) return;
    if (!validateManagerFields()) return;

    setSaving(true);
    try {
      const res = await managerProfileApi.updateMe({
        idCardNo: form.idCardNo?.trim() || null,
        taxCode: form.taxCode?.trim() || null,
        businessLicenseNo: form.businessLicenseNo?.trim() || null,
        address: form.address?.trim() || null,
      });
      setStatus(res.status ?? 'PENDING');
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
                              <label className="form-label">CCCD/CMND</label>
                              <input
                                type="text"
                                className="form-control"
                                name="idCardNo"
                                value={form.idCardNo}
                                onChange={handleChange}
                                placeholder="Nhập CCCD/CMND"
                              />
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
                          <div className="col-lg-4 col-md-6">
                            <div className="input-space">
                              <label className="form-label">Giấy phép kinh doanh</label>
                              <input
                                type="text"
                                className="form-control"
                                name="businessLicenseNo"
                                value={form.businessLicenseNo}
                                onChange={handleChange}
                                placeholder="Nhập số giấy phép kinh doanh"
                              />
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

