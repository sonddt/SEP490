import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { registerEmail, loginGoogle } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

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
    idCardNo: '',
    taxCode: '',
    businessLicenseNo: '',
    address: '',
  });

  const { login } = useAuth();
  const navigate = useNavigate();

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
    if (!formData.agreedToTerms) {
      setError('Bạn cần đồng ý với Điều khoản sử dụng.');
      return;
    }

    setLoading(true);
    try {
      const data = await registerEmail({
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password,
        fullName: formData.fullName,
        isManagerRoleRequested: activeTab === 'manager',
        idCardNo: formData.idCardNo,
        taxCode: formData.taxCode,
        businessLicenseNo: formData.businessLicenseNo,
        address: formData.address,
      });
      login(data);
      // Mặc định luôn là PLAYER khi mới đăng ký, Manager cần chờ duyệt. 
      // Do đó, dù đăng ký vai trò gì, hệ thống cũng điều hướng về user dashboard
      navigate('/user/dashboard');
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
      // Redirect dựa theo role nhận được từ BE
      const roles = data.user?.roles ?? [];
      if (roles.includes('MANAGER')) navigate('/manager/dashboard');
      else navigate('/user/dashboard');
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
                                  title="Số điện thoại gồm 9-11 chữ số"
                                />
                              </div>
                            </div>

                            {activeTab === 'manager' && (
                              <>
                                <div className="form-group">
                                  <div className="group-img">
                                    <i className="feather-credit-card"></i>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="CCCD / Chứng minh nhân dân"
                                      name="idCardNo"
                                      value={formData.idCardNo}
                                      onChange={handleInputChange}
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="form-group">
                                  <div className="group-img">
                                    <i className="feather-file-text"></i>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Mã số thuế"
                                      name="taxCode"
                                      value={formData.taxCode}
                                      onChange={handleInputChange}
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="form-group">
                                  <div className="group-img">
                                    <i className="feather-award"></i>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Giấy phép kinh doanh"
                                      name="businessLicenseNo"
                                      value={formData.businessLicenseNo}
                                      onChange={handleInputChange}
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="form-group">
                                  <div className="group-img">
                                    <i className="feather-map-pin"></i>
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Địa chỉ doanh nghiệp / Cá nhân"
                                      name="address"
                                      value={formData.address}
                                      onChange={handleInputChange}
                                      required
                                    />
                                  </div>
                                </div>
                              </>
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
                                  placeholder="Mật khẩu (ít nhất 6 ký tự)"
                                  name="password"
                                  value={formData.password}
                                  onChange={handleInputChange}
                                  required
                                  minLength={6}
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
