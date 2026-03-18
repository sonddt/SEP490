import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { registerEmail, loginGoogle } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { managerProfileApi } from '../api/managerProfileApi';

export default function Register() {
  const [activeTab, setActiveTab] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  });

  const { login } = useAuth();
  const navigate = useNavigate();

  const isValidGmail = (email) => {
    if (!email) return false;
    return /^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(email.trim());
  };

  // Số điện thoại: 9-11 chữ số (chỉ số)
  const normalizePhone = (phone) => (phone || '').replace(/\s+/g, '');
  const isValidPhone = (phone) => /^\d{9,11}$/.test(normalizePhone(phone));

  const validatePassword = (password) => {
    const p = password || '';

    const lengthOk = p.length >= 8 && p.length <= 32;
    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasNumber = /\d/.test(p);
    // Special chars theo ví dụ trong ảnh: ! @ # $ % ^ & * ( ) _ - + .
    const hasSpecial = /[!@#$%^&*()_+\-\.]/.test(p);

    // Ép độ dài phải nằm trong 8-32, phần còn lại cần thỏa tối thiểu 3/4 điều kiện.
    const otherPassed = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    const passed = (lengthOk ? 1 : 0) + otherPassed;

    return {
      ok: lengthOk && otherPassed >= 3,
      passed,
      details: { lengthOk, hasUpper, hasLower, hasNumber, hasSpecial },
    };
  };

  // tab → roles
  const getRoles = () => (activeTab === 'manager' ? ['MANAGER'] : ['PLAYER']);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // ── Đăng ký bằng email + mật khẩu ────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp!');
      return;
    }

    const email = (formData.email || '').trim();
    const phoneNumber = normalizePhone(formData.phoneNumber);
    const password = formData.password || '';

    if (!isValidGmail(email)) {
      setError('Email phải đúng định dạng Gmail (ví dụ: yourname@gmail.com).');
      return;
    }

    if (!isValidPhone(phoneNumber)) {
      setError('Số điện thoại phải gồm 9-11 chữ số (chỉ nhập số).');
      return;
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) {
      setError('Mật khẩu phải dài 8-32 ký tự và thỏa ít nhất 3/4 điều kiện còn lại: HOA, thường, số, ký tự đặc biệt.');
      return;
    }

    if (!formData.agreedToTerms) {
      setError('Bạn cần đồng ý với Điều khoản sử dụng.');
      return;
    }

    setLoading(true);
    try {
      const data = await registerEmail({
        email,
        phoneNumber,
        password,
        fullName: formData.fullName,
        isManagerRoleRequested: activeTab === 'manager',
      });
      login(data);
      if (activeTab === 'manager') {
        // Manager: chuyển sang trang hoàn thiện hồ sơ quản lý (PENDING)
        navigate('/manager/profile-request');
      } else {
        navigate('/user/dashboard');
      }
    } catch (err) {
      const res = err.response;
      if (!res) {
        setError('Không thể kết nối tới máy chủ. Kiểm tra backend đã chạy chưa.');
      } else if (res.data?.message) {
        setError(res.data.message);
      } else if (res.data?.title) {
        // ASP.NET validation error format
        const firstErrors = Object.values(res.data.errors ?? {}).flat();
        setError(firstErrors[0] ?? res.data.title);
      } else {
        setError(`Lỗi ${res.status}: Đăng ký thất bại.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Đăng ký / Đăng nhập bằng Google ──────────────────────────────────────
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const data = await loginGoogle({
        idToken: credentialResponse.credential,
        roles: getRoles(),
      });
      login(data);
      // Nếu đang ở tab Manager thì coi như user đang yêu cầu đăng ký làm Manager → chuyển sang trang hồ sơ
      if (activeTab === 'manager') {
        // đảm bảo có hồ sơ PENDING (backend sẽ tạo nếu cần)
        try { await managerProfileApi.getMe(); } catch { /* ignore */ }
        navigate('/manager/profile-request');
      } else {
        navigate('/user/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký Google thất bại.');
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
            <div className="col-12 col-sm-12 col-md-12 col-lg-6 no-padding">
              <div className="banner-bg register">
                <div className="row no-margin h-100">
                  <div className="col-sm-10 col-md-10 col-lg-10 mx-auto">
                    <div className="h-100 d-flex justify-content-center align-items-center">
                      <div className="text-bg register text-center">
                        <button type="button" className="btn btn-limegreen text-capitalize">
                          <i className="fa-solid fa-thumbs-up me-3"></i>Đăng Ký Ngay
                        </button>
                        <p>Tạo tài khoản ngay để trải nghiệm phần mềm quản lý sân cầu lông, giúp bạn giải quyết những khó khăn trong các hoạt động thể thao hằng ngày.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side form */}
            <div className="col-12 col-sm-12 col-md-12 col-lg-6 no-padding">
              <div className="dull-pg">
                <div className="row no-margin vph-100 d-flex align-items-center justify-content-center">
                  <div className="col-sm-10 col-md-10 col-lg-10 mx-auto">
                    <header className="text-center">
                      <Link to="/">
                        <img src="/assets/img/logo-black.svg" className="img-fluid" alt="Logo" />
                      </Link>
                    </header>
                    <div className="shadow-card">
                      <h2>Bắt đầu với ShuttleUp</h2>
                      <p>Khởi động hành trình thể thao của bạn cùng ShuttleUp ngay bây giờ.</p>

                      {/* Tabs: role selection */}
                      <ul className="nav nav-tabs" id="myTab" role="tablist">
                        <li className="nav-item" role="presentation">
                          <button
                            className={`nav-link d-flex align-items-center ${activeTab === 'user' ? 'active' : ''}`}
                            onClick={() => setActiveTab('user')}
                            type="button"
                          >
                            <span className="d-flex justify-content-center align-items-center"></span>Tôi là Người chơi
                          </button>
                        </li>
                        <li className="nav-item" role="presentation">
                          <button
                            className={`nav-link d-flex align-items-center ${activeTab === 'manager' ? 'active' : ''}`}
                            onClick={() => setActiveTab('manager')}
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

                      {/* Form */}
                      <div className="tab-content" id="myTabContent">
                        <div className="tab-pane fade show active">
                          <form onSubmit={handleRegister}>
                            <div className="form-group">
                              <div className="group-img">
                                <i className="feather-user"></i>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Họ và tên"
                                  name="fullName"
                                  value={formData.fullName}
                                  onChange={handleInputChange}
                                  required
                                />
                              </div>
                            </div>
                            <div className="form-group">
                              <div className="group-img">
                                <i className="feather-mail"></i>
                                <input
                                  type="email"
                                  className="form-control"
                                  placeholder="Email"
                                  name="email"
                                  value={formData.email}
                                  onChange={handleInputChange}
                                  required
                                  pattern="^[A-Za-z0-9._%+-]+@gmail\.com$"
                                  title="Email phải thuộc định dạng @gmail.com"
                                />
                              </div>
                            </div>
                            <div className="form-group">
                              <div className="group-img">
                                <i className="feather-phone"></i>
                                <input
                                  type="tel"
                                  className="form-control"
                                  placeholder="Số điện thoại"
                                  name="phoneNumber"
                                  value={formData.phoneNumber}
                                  onChange={handleInputChange}
                                  required
                                  pattern="[0-9]{9,11}"
                                  title="Số điện thoại gồm 9-11 chữ số (chỉ nhập số)"
                                />
                              </div>
                            </div>

                            {activeTab === 'manager' && (
                              <div className="alert alert-info mt-2">
                                Sau khi đăng ký, bạn sẽ được chuyển sang trang <b>Hoàn tất Hồ sơ Quản lý</b> để nhập CCCD/Mã số thuế/Giấy phép kinh doanh và chờ Admin duyệt.
                              </div>
                            )}
                            <div className="form-group">
                              <div className="pass-group group-img">
                                <i
                                  className={`toggle-password ${showPassword ? 'feather-eye' : 'feather-eye-off'}`}
                                  onClick={() => setShowPassword(!showPassword)}
                                  style={{ cursor: 'pointer' }}
                                ></i>
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  className="form-control pass-input"
                                  placeholder="Mật khẩu (8-32 ký tự)"
                                  name="password"
                                  value={formData.password}
                                  onChange={handleInputChange}
                                  required
                                  minLength={8}
                                  maxLength={32}
                                />
                              </div>
                            </div>
                            <div className="form-group">
                              <div className="pass-group group-img">
                                <i
                                  className={`toggle-password-confirm ${showConfirmPassword ? 'feather-eye' : 'feather-eye-off'}`}
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  style={{ cursor: 'pointer' }}
                                ></i>
                                <input
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  className="form-control pass-confirm"
                                  placeholder="Xác nhận mật khẩu"
                                  name="confirmPassword"
                                  value={formData.confirmPassword}
                                  onChange={handleInputChange}
                                  required
                                  minLength={8}
                                  maxLength={32}
                                />
                              </div>
                            </div>
                            <div className="form-check d-flex justify-content-start align-items-center policy">
                              <div className="d-inline-block">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id="policy"
                                  name="agreedToTerms"
                                  checked={formData.agreedToTerms}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <label className="form-check-label" htmlFor="policy">
                                Bằng cách tiếp tục, bạn đồng ý rằng bạn đã đọc và chấp nhận{' '}
                                <Link to="/terms">Điều khoản sử dụng</Link>
                              </label>
                            </div>
                            <button
                              className="btn btn-secondary register-btn d-inline-flex justify-content-center align-items-center w-100 btn-block"
                              type="submit"
                              disabled={loading}
                            >
                              {loading ? 'Đang xử lý...' : 'Tạo Tài Khoản'}
                              {!loading && <i className="feather-arrow-right-circle ms-2"></i>}
                            </button>

                            {/* Google Sign-Up */}
                            <div className="form-group mt-3">
                              <div className="login-options text-center mb-2">
                                <span className="text">Hoặc đăng ký bằng</span>
                              </div>
                              <div className="d-flex justify-content-center">
                                <GoogleLogin
                                  onSuccess={handleGoogleSuccess}
                                  onError={() => setError('Đăng ký Google thất bại.')}
                                  text="signup_with"
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
                      <p>Đã có tài khoản? <Link to="/login">Đăng nhập!</Link></p>
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
