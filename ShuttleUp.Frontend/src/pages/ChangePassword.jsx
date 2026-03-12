import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/authApi';

export default function ChangePassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) {
      setError('Link không hợp lệ. Vui lòng yêu cầu lại từ trang Quên Mật Khẩu.');
    } else {
      setToken(t);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, newPassword, confirmPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-wrapper authendication-pages">
      <div className="content blur-ellipses login-password">
        <div className="container">
          <div className="row">
            <div className="col-xl-6 col-lg-6 col-md-7 mx-auto vph-100 d-flex align-items-center">
              <div className="change-password w-100">
                <header className="text-center">
                  <Link to="/">
                    <img src="/assets/img/logo-black.svg" className="img-fluid" alt="Logo" />
                  </Link>
                </header>
                <div className="shadow-card">
                  <h2>Đặt Lại Mật Khẩu</h2>
                  <p>Mật khẩu mới của bạn phải khác với<br />Mật khẩu đã sử dụng trước đó</p>

                  {success ? (
                    <div className="alert alert-success">
                      Đặt lại mật khẩu thành công! Đang chuyển đến trang đăng nhập...
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      {error && <div className="alert alert-danger">{error}</div>}

                      <div className="form-group">
                        <div className="pass-group group-img">
                          <i
                            className={`toggle-password ${showNew ? 'feather-eye' : 'feather-eye-off'}`}
                            onClick={() => setShowNew(!showNew)}
                            style={{ cursor: 'pointer' }}
                          ></i>
                          <input
                            type={showNew ? 'text' : 'password'}
                            className="form-control pass-input"
                            placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            minLength={6}
                            required
                            disabled={!token}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <div className="pass-group group-img">
                          <i
                            className={`toggle-password-confirm ${showConfirm ? 'feather-eye' : 'feather-eye-off'}`}
                            onClick={() => setShowConfirm(!showConfirm)}
                            style={{ cursor: 'pointer' }}
                          ></i>
                          <input
                            type={showConfirm ? 'text' : 'password'}
                            className="form-control pass-confirm"
                            placeholder="Xác nhận mật khẩu"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={!token}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-secondary w-100 d-inline-flex justify-content-center align-items-center"
                        disabled={loading || !token}
                      >
                        {loading ? 'Đang xử lý...' : 'Đặt Lại Mật Khẩu'}
                        {!loading && <i className="feather-arrow-right-circle ms-2"></i>}
                      </button>
                    </form>
                  )}
                </div>
                <div className="bottom-text text-center">
                  <p>
                    <Link to="/forgot-password">Yêu cầu link mới</Link>
                    {' · '}
                    <Link to="/login">Đăng nhập</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
