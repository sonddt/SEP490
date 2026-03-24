import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import UserProfileTabs from '../../components/user/UserProfileTabs';
import { changePassword } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';

export default function UserProfileChangePassword() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [show, setShow] = useState({
    current: false,
    newPw: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleReset = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setError('');
    setSuccess('');
    setFieldErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const newErrors = {};

    if (!form.currentPassword) {
      newErrors.currentPassword = 'Bạn chưa nhập mật khẩu hiện tại.';
    }
    if (!form.newPassword) {
      newErrors.newPassword = 'Bạn chưa nhập mật khẩu mới.';
    } else if (form.newPassword.length < 6) {
      newErrors.newPassword = 'Mật khẩu mới cần từ 6 ký tự trở lên bạn nhé.';
    }
    
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Bạn chưa xác nhận mật khẩu.';
    } else if (form.newPassword !== form.confirmPassword) {
      newErrors.confirmPassword = 'Oops... Mật khẩu xác nhận chưa khớp nhau rồi!';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      await changePassword(form);
      setSuccess('Tuyệt vời! Đổi mật khẩu thành công rồi nha. Bạn đăng nhập lại nhé!');
      handleReset();
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.message
        ?? err.response?.data?.title
        ?? 'Oops... Có sự cố khi đổi mật khẩu, bạn thử lại nha.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-wrapper">

      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Hồ sơ người dùng</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Đổi mật khẩu</li>
          </ul>
        </div>
      </section>

      {/* Dashboard Menu */}
      <UserDashboardMenu />

      {/* Page Content */}
      <div className="content court-bg" style={{ paddingTop: '90px' }}>
        <div className="container">

          {/* Profile Tabs */}
          <UserProfileTabs />

          <div className="row">
            <div className="col-sm-12">
              <div className="profile-detail-group">
                <div className="card">
                  <form onSubmit={handleSubmit}>
                    <div className="row">

                      {/* Alert */}
                      {error && (
                        <div className="col-12">
                          <div className="alert alert-danger">{error}</div>
                        </div>
                      )}
                      {success && (
                        <div className="col-12">
                          <div className="alert alert-success">{success}</div>
                        </div>
                      )}

                      {/* Current Password */}
                      <div className="col-lg-12">
                        <div className="appoint-head">
                          <h4>Mật khẩu hiện tại</h4>
                        </div>
                        <div className="input-space other-setting-form">
                          <label className="form-label">Nhập mật khẩu hiện tại</label>
                          <div className="pass-group group-img">
                            <i
                              className={`toggle-password ${show.current ? 'feather-eye' : 'feather-eye-off'}`}
                              onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
                              style={{ cursor: 'pointer' }}
                            />
                            <input
                              type={show.current ? 'text' : 'password'}
                              className={`form-control pass-input ${fieldErrors.currentPassword ? 'is-invalid' : ''}`}
                              name="currentPassword"
                              placeholder="Mật khẩu hiện tại"
                              value={form.currentPassword}
                              onChange={handleChange}
                            />
                          </div>
                          {fieldErrors.currentPassword && <div className="invalid-feedback d-block mt-1">{fieldErrors.currentPassword}</div>}
                        </div>
                      </div>

                      {/* New Password */}
                      <div className="col-lg-12">
                        <div className="appoint-head">
                          <h4>Mật khẩu mới</h4>
                        </div>
                        <div className="input-space other-setting-form">
                          <label className="form-label">Nhập mật khẩu mới (tối thiểu 8 ký tự)</label>
                          <div className="pass-group group-img">
                            <i
                              className={`toggle-password ${show.newPw ? 'feather-eye' : 'feather-eye-off'}`}
                              onClick={() => setShow((s) => ({ ...s, newPw: !s.newPw }))}
                              style={{ cursor: 'pointer' }}
                            />
                            <input
                              type={show.newPw ? 'text' : 'password'}
                              className={`form-control pass-input ${fieldErrors.newPassword ? 'is-invalid' : ''}`}
                              name="newPassword"
                              placeholder="Mật khẩu mới"
                              value={form.newPassword}
                              onChange={handleChange}
                            />
                          </div>
                          {fieldErrors.newPassword && <div className="invalid-feedback d-block mt-1">{fieldErrors.newPassword}</div>}
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div className="col-lg-12">
                        <div className="appoint-head">
                          <h4>Xác nhận mật khẩu mới</h4>
                        </div>
                        <div className="input-space other-setting-form">
                          <label className="form-label">Nhập lại mật khẩu mới</label>
                          <div className="pass-group group-img">
                            <i
                              className={`toggle-password-confirm ${show.confirm ? 'feather-eye' : 'feather-eye-off'}`}
                              onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                              style={{ cursor: 'pointer' }}
                            />
                            <input
                              type={show.confirm ? 'text' : 'password'}
                              className={`form-control pass-confirm ${fieldErrors.confirmPassword ? 'is-invalid' : ''}`}
                              name="confirmPassword"
                              placeholder="Xác nhận mật khẩu mới"
                              value={form.confirmPassword}
                              onChange={handleChange}
                            />
                          </div>
                          {fieldErrors.confirmPassword && <div className="invalid-feedback d-block mt-1">{fieldErrors.confirmPassword}</div>}
                        </div>
                      </div>

                    </div>
                  </form>
                </div>

                <div className="save-changes text-end">
                  <button
                    type="button"
                    className="btn btn-secondary reset-profile"
                    onClick={handleReset}
                    disabled={loading}
                  >
                    Đặt lại
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary save-profile"
                    onClick={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
