import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { loginEmail, loginGoogle } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { managerProfileApi } from '../api/managerProfileApi';
import { profileApi } from '../api/profileApi';

export default function Login() {
  const saved = JSON.parse(localStorage.getItem('shuttleup_remember') || 'null');
  const [activeTab, setActiveTab] = useState('user');
  const activeTabRef = useRef('user');
  const [showPassword, setShowPassword] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState(saved?.emailOrPhone || '');
  const [password, setPassword] = useState(saved?.password || '');
  const [rememberMe, setRememberMe] = useState(!!saved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const { login, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnUrl = location.state?.from || null;

  useEffect(() => {
    const hint = location.state?.authHint;
    if (hint) setError(hint);
  }, [location.state?.authHint]);

  const syncAvatarFromProfile = async () => {
    try {
      const me = await profileApi.getMe();
      const nextAvatarUrl = me?.user?.avatarUrl ?? null;
      updateUser?.({ avatarUrl: nextAvatarUrl });
    } catch {
      // Không ảnh hưởng luồng login; chỉ bỏ qua đồng bộ avatar.
    }
  };

  // ── Đường dẫn sau khi login xong (ưu tiên returnUrl từ ProtectedRoute) ─────
  const redirectAfterLogin = (roles) => {
    const tab = activeTabRef.current;

    // Tránh bị kéo về sai dashboard bởi returnUrl cũ
    // (đặc biệt khi user từng truy cập /manager/* hoặc /user/* trước khi login)
    const safeReturnUrl = (() => {
      if (!returnUrl) return null;
      if (returnUrl.startsWith('/manager') || returnUrl.startsWith('/user')) return null;
      return returnUrl;
    })();

    if (safeReturnUrl) return navigate(safeReturnUrl);
    if (roles?.includes('ADMIN')) return navigate('/admin/dashboard');
    if (roles?.includes('MANAGER') && tab === 'manager') return navigate('/manager/venues');
    return navigate('/courts');
  };

  const resolveManagerLoginGate = async (roles) => {
    const tab = activeTabRef.current;
    // Tab Manager nhưng user chưa có role MANAGER:
    if (tab !== 'manager') return { allow: true };
    if (roles?.includes('ADMIN')) return { allow: true }; // Admin vẫn cho vào
    if (roles?.includes('MANAGER')) return { allow: true };

    try {
      const prof = await managerProfileApi.getMe();
      const status = (prof.status ?? prof.Status ?? '').toUpperCase();
      if (status === 'PENDING') {
        return { allow: true, redirect: '/manager/profile-request', message: 'Hồ sơ quản lý của bạn đang chờ Admin duyệt nha!' };
      }
      if (status === 'REJECTED') {
        return { allow: true, redirect: '/manager/profile-request', message: 'Rất tiếc, hồ sơ quản lý của bạn đã bị từ chối. Bạn xem và cập nhật lại nhé!' };
      }
      return { allow: false, message: 'Oops... Tài khoản của bạn chưa đăng ký làm quản lý rồi.' };
    } catch {
      return { allow: false, message: 'Oops... Tài khoản của bạn chưa đăng ký làm quản lý rồi.' };
    }
  };

  // ── Đăng nhập bằng email + mật khẩu ──────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // đảm bảo không bị dính session cũ khi test chuyển tab
      logout();
      setFieldErrors({});

      const newErrors = {};
      if (!emailOrPhone.trim()) newErrors.emailOrPhone = 'Bạn chưa nhập Email hoặc SĐT kìa.';
      if (!password) newErrors.password = 'Đừng quên nhập mật khẩu nhé!';
      
      if (Object.keys(newErrors).length > 0) {
        setFieldErrors(newErrors);
        setLoading(false);
        return;
      }

      const isPhone = /^[0-9]{9,11}$/.test(emailOrPhone.trim());
      const payload = isPhone
        ? { phoneNumber: emailOrPhone.trim(), password }
        : { email: emailOrPhone.trim(), password };
      const data = await loginEmail(payload);

      if (rememberMe) {
        localStorage.setItem('shuttleup_remember', JSON.stringify({ emailOrPhone: emailOrPhone.trim(), password }));
      } else {
        localStorage.removeItem('shuttleup_remember');
      }

      const roles = data.user?.roles ?? [];
      const gate = await resolveManagerLoginGate(roles);
      if (!gate.allow) {
        logout();
        setError(gate.message);
        return;
      }
      login(data);
      await syncAvatarFromProfile();
      if (gate.message) setError(gate.message);
      if (gate.redirect) return navigate(gate.redirect);
      redirectAfterLogin(roles);
    } catch (err) {
      setError(err.response?.data?.message || 'Oops... Thông tin đăng nhập chưa chính xác rồi bạn nhé.');
    } finally {
      setLoading(false);
    }
  };

  // ── Đăng nhập bằng Google ─────────────────────────────────────────────────
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      // đảm bảo không bị dính session cũ khi test chuyển tab
      logout();
      // credentialResponse.credential là id_token từ Google
      const tab = activeTabRef.current;
      const roleByTab = tab === 'manager' ? ['MANAGER'] : ['PLAYER'];
      const data = await loginGoogle({
        idToken: credentialResponse.credential,
        roles: roleByTab,
      });
      const roles = data.user?.roles ?? [];
      const gate = await resolveManagerLoginGate(roles);
      if (!gate.allow) {
        logout();
        setError(gate.message);
        return;
      }
      login(data);
      await syncAvatarFromProfile();
      if (gate.message) setError(gate.message);
      if (gate.redirect) return navigate(gate.redirect);
      redirectAfterLogin(roles);
    } catch (err) {
      setError(err.response?.data?.message || 'Oops... Đăng nhập bằng Google có chút trục trặc.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-wrapper authendication-pages">
      <div className="content">
        <div className="container wrapper no-padding">
          <div className="row no-margin vph-100">
            {/* Left side banner */}
            <div className="col-12 col-sm-12 col-lg-6 no-padding">
              <div className="banner-bg login">
                <div className="row no-margin h-100">
                  <div className="col-sm-10 col-md-10 col-lg-10 mx-auto">
                    <div className="h-100 d-flex justify-content-center align-items-center">
                      <div className="text-bg register text-center">
                        <button type="button" className="btn btn-limegreen text-capitalize">
                          <i className="fa-solid fa-thumbs-up me-3"></i>Đăng nhập cho Người chơi & Quản lý sân
                        </button>
                        <p>Đăng nhập ngay để sử dụng giải pháp phần mềm quản lý sân cầu lông tiên tiến của chúng tôi, giúp bạn dễ dàng đặt lịch và tham gia các hoạt động thể thao.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side form */}
            <div className="col-12 col-sm-12 col-lg-6 no-padding">
              <div className="dull-pg">
                <div className="row no-margin vph-100 d-flex align-items-center justify-content-center">
                  <div className="col-sm-10 col-md-10 col-lg-10 mx-auto">
                    <header className="text-center">
                      <Link to="/">
                        <img src="/assets/img/logo-black.svg" className="img-fluid" alt="Logo" />
                      </Link>
                    </header>
                    <div className="shadow-card">
                      <h2>Chào mừng trở lại</h2>
                      <p>Vui lòng đăng nhập vào tài khoản của bạn</p>

                      {/* Tabs */}
                      <ul className="nav nav-tabs" id="myTab" role="tablist">
                        <li className="nav-item" role="presentation">
                          <button
                            className={`nav-link d-flex align-items-center ${activeTab === 'user' ? 'active' : ''}`}
                            onClick={() => {
                              activeTabRef.current = 'user';
                              setActiveTab('user');
                            }}
                            type="button"
                          >
                            <span className="d-flex justify-content-center align-items-center"></span>Tôi là Người chơi
                          </button>
                        </li>
                        <li className="nav-item" role="presentation">
                          <button
                            className={`nav-link d-flex align-items-center ${activeTab === 'manager' ? 'active' : ''}`}
                            onClick={() => {
                              activeTabRef.current = 'manager';
                              setActiveTab('manager');
                            }}
                            type="button"
                          >
                            <span className="d-flex justify-content-center align-items-center"></span>Tôi là Quản lý sân
                          </button>
                        </li>
                      </ul>

                      {/* Error message */}
                      {error && (
                        <div className="alert alert-danger mt-3 mb-0 py-2" role="alert">
                          {error}
                        </div>
                      )}

                      <div className="tab-content" id="myTabContent">
                        <div className="tab-pane fade show active">
                          <form onSubmit={handleLogin} noValidate>
                            <div className="form-group">
                              <div className="group-img">
                                <i className="feather-user"></i>
                                <input
                                  type="text"
                                  className={`form-control ${fieldErrors.emailOrPhone ? 'is-invalid' : ''}`}
                                  placeholder="Email hoặc Số điện thoại"
                                  value={emailOrPhone}
                                  onChange={(e) => {
                                      setEmailOrPhone(e.target.value);
                                      if (fieldErrors.emailOrPhone) setFieldErrors(prev => ({ ...prev, emailOrPhone: '' }));
                                  }}
                                />
                              </div>
                              {fieldErrors.emailOrPhone && (
                                <div className="invalid-feedback d-block mt-1">
                                  {fieldErrors.emailOrPhone}
                                </div>
                              )}
                            </div>
                            <div className="form-group">
                              <div className="pass-group group-img">
                                <i
                                  className={`toggle-password ${showPassword ? 'feather-eye' : 'feather-eye-off'}`}
                                  onClick={() => setShowPassword(!showPassword)}
                                  style={{ cursor: 'pointer' }}
                                ></i>
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  className={`form-control pass-input ${fieldErrors.password ? 'is-invalid' : ''}`}
                                  placeholder="Mật khẩu"
                                  value={password}
                                  onChange={(e) => {
                                      setPassword(e.target.value);
                                      if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                                  }}
                                />
                              </div>
                              {fieldErrors.password && (
                                <div className="invalid-feedback d-block mt-1">
                                  {fieldErrors.password}
                                </div>
                              )}
                            </div>
                            <div className="form-group d-sm-flex align-items-center justify-content-between">
                              <div className="form-check form-switch d-flex align-items-center justify-content-start">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id="user-pass"
                                  checked={rememberMe}
                                  onChange={(e) => {
                                    setRememberMe(e.target.checked);
                                    if (!e.target.checked) localStorage.removeItem('shuttleup_remember');
                                  }}
                                />
                                <label className="form-check-label" htmlFor="user-pass">Nhớ mật khẩu</label>
                              </div>
                              <span>
                                <Link to="/forgot-password" className="forgot-pass">Quên mật khẩu?</Link>
                              </span>
                            </div>
                            <button
                              className="btn btn-secondary register-btn d-inline-flex justify-content-center align-items-center w-100 btn-block"
                              type="submit"
                              disabled={loading}
                            >
                              {loading ? 'Đang xử lý...' : 'Đăng Nhập'}
                              {!loading && <i className="feather-arrow-right-circle ms-2"></i>}
                            </button>

                            {/* Google Sign-In */}
                            <div className="form-group mt-3">
                              <div className="login-options text-center mb-2">
                                <span className="text">Hoặc tiếp tục với</span>
                              </div>
                              <div className="d-flex justify-content-center">
                                <GoogleLogin
                                  onSuccess={handleGoogleSuccess}
                                  onError={() => setError('Oops... Đăng nhập bằng Google có chút trục trặc.')}
                                  text="signin_with"
                                  locale="vi"
                                  shape="rectangular"
                                  width="300"
                                />
                              </div>
                            </div>
                          </form>
                        </div>
                      </div>
                    </div>

                    <div className="bottom-text text-center">
                      <p>Chưa có tài khoản? <Link to="/register">Đăng ký ngay!</Link></p>
                    </div>
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
