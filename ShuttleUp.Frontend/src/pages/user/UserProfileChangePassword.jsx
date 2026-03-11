import { useState } from 'react';
import { Link } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import UserProfileTabs from '../../components/user/UserProfileTabs';

export default function UserProfileChangePassword() {
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };

  const handleReset = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setError('');
    setSuccess('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    // TODO: call API to change password
    console.log('Changing password...');
    setSuccess('Đổi mật khẩu thành công!');
    handleReset();
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
      <div className="content court-bg">
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
                              className="form-control pass-input"
                              name="currentPassword"
                              placeholder="Mật khẩu hiện tại"
                              value={form.currentPassword}
                              onChange={handleChange}
                              required
                            />
                          </div>
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
                              className="form-control pass-input"
                              name="newPassword"
                              placeholder="Mật khẩu mới"
                              value={form.newPassword}
                              onChange={handleChange}
                              required
                            />
                          </div>
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
                              className="form-control pass-confirm"
                              name="confirmPassword"
                              placeholder="Xác nhận mật khẩu mới"
                              value={form.confirmPassword}
                              onChange={handleChange}
                              required
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  </form>
                </div>

                <div className="save-changes text-end">
                  <button
                    type="button"
                    className="btn btn-primary reset-profile"
                    onClick={handleReset}
                  >
                    Đặt lại
                  </button>
                  <button
                    type="submit"
                    className="btn btn-secondary save-profile"
                    onClick={handleSubmit}
                  >
                    Lưu thay đổi
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
