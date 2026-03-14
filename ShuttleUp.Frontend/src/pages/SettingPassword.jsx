import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { changePassword } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function SettingPassword() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleReset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setSuccess('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
      handleReset();
      // Đăng xuất sau 2s để bắt buộc login lại với mật khẩu mới
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 2000);
    } catch (err) {
      const msg = err.response?.data?.message
        ?? err.response?.data?.title
        ?? 'Đổi mật khẩu thất bại. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content court-bg">
      <div className="container">
        {/* Profile Navigation */}
        <div className="coach-court-list profile-court-list">
          <ul className="nav">
            <li><Link to="/manager/profile">Hồ sơ</Link></li>
            <li><Link to="/manager/availability">Thời gian hoạt động</Link></li>
            <li><Link className="active" to="/manager/setting-password">Đổi Mật Khẩu</Link></li>
            <li><Link to="/manager/other-settings">Cài đặt khác</Link></li>
          </ul>
        </div>

        <div className="row">
          <div className="col-sm-12">
            <div className="profile-detail-group">
              <div className="card">
                <form onSubmit={handleSubmit}>
                  {error && <div className="alert alert-danger mx-3 mt-3">{error}</div>}
                  {success && <div className="alert alert-success mx-3 mt-3">{success}</div>}

                  <div className="row">
                    <div className="col-lg-7 col-md-7">
                      <div className="input-space">
                        <label className="form-label">Mật khẩu cũ</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="Nhập mật khẩu cũ"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-lg-7 col-md-7">
                      <div className="input-space">
                        <label className="form-label">Mật khẩu mới</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          minLength={6}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-lg-7 col-md-7">
                      <div className="input-space mb-0">
                        <label className="form-label">Xác nhận mật khẩu</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="Nhập lại mật khẩu mới"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              <div className="save-changes text-end">
                <button
                  type="button"
                    className="btn btn-secondary reset-profile me-2"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Xóa Lại
                </button>
                <button
                  type="button"
                    className="btn btn-primary save-profile"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
