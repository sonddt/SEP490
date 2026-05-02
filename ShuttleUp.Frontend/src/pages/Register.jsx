import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { registerEmail, loginGoogle, checkEmail, checkPhone } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { managerProfileApi } from '../api/managerProfileApi';
import { profileApi } from '../api/profileApi';
import { notifySuccess } from '../hooks/useNotification';
import { TOAST } from '../constants/toastMessages';

export default function Register() {
  const [activeTab, setActiveTab] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  });

  const { login, updateUser } = useAuth();
  const navigate = useNavigate();

  const goAfterRegisterPlayer = (isPersonalized) => {
    if (isPersonalized === false) {
      navigate('/personalization');
      return;
    }
    navigate('/venues');
  };

  const isValidEmail = (email) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const normalizePhone = (phone) => (phone || '').replace(/\s+/g, '');
  const isValidPhone = (phone) => /^(0|84)(3|5|7|8|9)[0-9]{8}$/.test(normalizePhone(phone));

  const validatePassword = (password) => {
    const p = password || '';

    const lengthOk = p.length >= 8 && p.length <= 32;
    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasNumber = /\d/.test(p);
    const hasSpecial = /[^a-zA-Z0-9]/.test(p);

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

  const handleEmailBlur = async () => {
    const email = (formData.email || '').trim();
    if (!email || !isValidEmail(email)) return;
    setIsCheckingEmail(true);
    try {
      const { data } = await checkEmail(email);
      if (data.exists) {
        setFieldErrors((prev) => ({ ...prev, email: 'Email này đã được sử dụng.' }));
      } else if (fieldErrors.email === 'Email này đã được sử dụng.') {
        setFieldErrors((prev) => ({ ...prev, email: '' }));
      }
    } catch { } // Ignore
    finally {
      setIsCheckingEmail(false);
    }
  };

  const handlePhoneBlur = async () => {
    const phone = normalizePhone(formData.phoneNumber);
    if (!phone || !isValidPhone(phone)) return;
    setIsCheckingPhone(true);
    try {
      const { data } = await checkPhone(phone);
      if (data.exists) {
        setFieldErrors((prev) => ({ ...prev, phoneNumber: 'Số điện thoại này đã được sử dụng.' }));
      } else if (fieldErrors.phoneNumber === 'Số điện thoại này đã được sử dụng.') {
        setFieldErrors((prev) => ({ ...prev, phoneNumber: '' }));
      }
    } catch { } // Ignore
    finally {
      setIsCheckingPhone(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (isCheckingEmail || isCheckingPhone) return;
    setError('');

    const newErrors = {};
    const name = (formData.fullName || '').trim();
    if (!name) {
      newErrors.fullName = 'Bạn chưa nhập họ và tên kìa.';
    } else if (!/^[a-zA-ZÀ-ỹ\u0110\u0111\s]{2,50}$/.test(name)) {
      newErrors.fullName = 'Họ tên không hợp lệ (không dính số hay ký tự đặc biệt) và dài 2-50 ký tự.';
    }

    const email = (formData.email || '').trim();
    if (!email) {
      newErrors.email = 'Bạn chưa nhập email.';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Email không đúng định dạng chuẩn (ví dụ: yourname@domain.com).';
    } else if (fieldErrors.email === 'Email này đã được sử dụng.') {
      newErrors.email = fieldErrors.email;
    }

    const phoneNumber = normalizePhone(formData.phoneNumber);
    if (!phoneNumber) {
      newErrors.phoneNumber = 'Đừng quên nhập số điện thoại nha.';
    } else if (!isValidPhone(phoneNumber)) {
      newErrors.phoneNumber = 'Số điện thoại không đúng định dạng Việt Nam (bắt đầu bằng 0/84, 10 số).';
    } else if (fieldErrors.phoneNumber === 'Số điện thoại này đã được sử dụng.') {
      newErrors.phoneNumber = fieldErrors.phoneNumber;
    }

    const password = formData.password || '';
    if (!password) {
      newErrors.password = 'Bạn chưa nhập mật khẩu.';
    } else {
      const pwCheck = validatePassword(password);
      if (!pwCheck.ok) {
        newErrors.password = 'Mật khẩu cần từ 8 đến 32 ký tự và thoả mãn 3/4 điều kiện: chữ HOA, thường, số, ký tự đặc biệt.';
      }
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Oops... Mật khẩu xác nhận chưa khớp nhau rồi!';
    }

    if (!formData.agreedToTerms) {
      newErrors.agreedToTerms = 'Bạn quên tick chọn đồng ý với Điều khoản sử dụng rồi kìa!';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      const data = await registerEmail({
        email,
        phoneNumber,
        password,
        fullName: name,
        isManagerRoleRequested: activeTab === 'manager',
      });
      login(data);
      notifySuccess(TOAST.GUEST.REGISTER_SUCCESS);
      try {
        const me = await profileApi.getMe();
        const profileUser = me?.user ?? {};
        updateUser?.({
          avatarUrl: profileUser.avatarUrl ?? null,
          isPersonalized: profileUser.isPersonalized ?? null,
          province: profileUser.province ?? null,
          district: profileUser.district ?? null,
          skillLevel: profileUser.skillLevel ?? null,
          playPurpose: profileUser.playPurpose ?? null,
          playFrequency: profileUser.playFrequency ?? null,
        });
        if (activeTab !== 'manager') {
          goAfterRegisterPlayer(profileUser.isPersonalized ?? null);
          return;
        }
      } catch { }
      if (activeTab === 'manager') {
        navigate('/manager/profile-request');
      } else {
        goAfterRegisterPlayer(data?.user?.isPersonalized ?? null);
      }
    } catch (err) {
      const res = err.response;
      if (!res) {
        setError('Oops... Không thể kết nối tới máy chủ. Bạn thử lại sau nhé!');
      } else if (res.data?.message) {
        setError(res.data.message);
      } else if (res.data?.title) {
        const firstErrors = Object.values(res.data.errors ?? {}).flat();
        setError(firstErrors[0] ?? res.data.title);
      } else {
        setError(`Rất tiếc! Đăng ký thất bại (Mã: ${res.status}).`);
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
      try {
        const me = await profileApi.getMe();
        const profileUser = me?.user ?? {};
        updateUser?.({
          avatarUrl: profileUser.avatarUrl ?? null,
          isPersonalized: profileUser.isPersonalized ?? null,
          province: profileUser.province ?? null,
          district: profileUser.district ?? null,
          skillLevel: profileUser.skillLevel ?? null,
          playPurpose: profileUser.playPurpose ?? null,
          playFrequency: profileUser.playFrequency ?? null,
        });
        if (activeTab !== 'manager') {
          goAfterRegisterPlayer(profileUser.isPersonalized ?? null);
          return;
        }
      } catch { }
      // Nếu đang ở tab Manager thì coi như user đang yêu cầu đăng ký làm Manager → chuyển sang trang hồ sơ
      if (activeTab === 'manager') {
        // đảm bảo có hồ sơ PENDING (backend sẽ tạo nếu cần)
        try { await managerProfileApi.getMe(); } catch { /* ignore */ }
        navigate('/manager/profile-request');
      } else {
        goAfterRegisterPlayer(data?.user?.isPersonalized ?? null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Oops... Đăng ký bằng Google có chút trục trặc.');
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
                      <div className="mb-3">
                        <Link to="/" className="back-link d-inline-flex align-items-center text-muted" style={{ fontSize: '14px', fontWeight: 500 }}>
                          <i className="feather-arrow-left me-1"></i> Quay lại trang chủ
                        </Link>
                      </div>
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
                          <form onSubmit={handleRegister} noValidate>
                            <div className="form-group">
                              <div className="group-img">
                                <i className="feather-user"></i>
                                <input
                                  type="text"
                                  className={`form-control ${fieldErrors.fullName ? 'is-invalid' : ''}`}
                                  placeholder="Họ và tên"
                                  name="fullName"
                                  value={formData.fullName}
                                  onChange={handleInputChange}
                                />
                              </div>
                              {fieldErrors.fullName && <div className="invalid-feedback d-block mt-1">{fieldErrors.fullName}</div>}
                            </div>
                            <div className="form-group">
                              <div className="group-img">
                                <i className="feather-mail"></i>
                                <input
                                  type="email"
                                  className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                                  placeholder="Email"
                                  name="email"
                                  value={formData.email}
                                  onChange={handleInputChange}
                                  onBlur={handleEmailBlur}
                                />
                              </div>
                              {fieldErrors.email && <div className="invalid-feedback d-block mt-1">{fieldErrors.email}</div>}
                            </div>
                            <div className="form-group">
                              <div className="group-img">
                                <i className="feather-phone"></i>
                                <input
                                  type="tel"
                                  className={`form-control ${fieldErrors.phoneNumber ? 'is-invalid' : ''}`}
                                  placeholder="Số điện thoại"
                                  name="phoneNumber"
                                  value={formData.phoneNumber}
                                  onChange={handleInputChange}
                                  onBlur={handlePhoneBlur}
                                />
                              </div>
                              {fieldErrors.phoneNumber && <div className="invalid-feedback d-block mt-1">{fieldErrors.phoneNumber}</div>}
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
                                  className={`form-control pass-input ${fieldErrors.password ? 'is-invalid' : ''}`}
                                  placeholder="Mật khẩu (8-32 ký tự)"
                                  name="password"
                                  value={formData.password}
                                  onChange={handleInputChange}
                                />
                              </div>
                              {fieldErrors.password && <div className="invalid-feedback d-block mt-1">{fieldErrors.password}</div>}
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
                                  className={`form-control pass-confirm ${fieldErrors.confirmPassword ? 'is-invalid' : ''}`}
                                  placeholder="Xác nhận mật khẩu"
                                  name="confirmPassword"
                                  value={formData.confirmPassword}
                                  onChange={handleInputChange}
                                />
                              </div>
                              {fieldErrors.confirmPassword && <div className="invalid-feedback d-block mt-1">{fieldErrors.confirmPassword}</div>}
                            </div>
                            <div className="form-check d-flex justify-content-start align-items-start flex-column policy">
                              <div className="d-flex align-items-center">
                                <input
                                  className={`form-check-input ${fieldErrors.agreedToTerms ? 'is-invalid' : ''} me-2`}
                                  type="checkbox"
                                  id="policy"
                                  name="agreedToTerms"
                                  checked={formData.agreedToTerms}
                                  onChange={handleInputChange}
                                />
                                <label className="form-check-label mb-0" htmlFor="policy">
                                  Bằng cách tiếp tục, bạn đồng ý rằng bạn đã đọc và chấp nhận{' '}
                                  <Link to="/terms">Điều khoản sử dụng</Link>
                                </label>
                              </div>
                              {fieldErrors.agreedToTerms && <div className="invalid-feedback d-block mt-1">{fieldErrors.agreedToTerms}</div>}
                            </div>
                            <button
                              className="btn btn-secondary register-btn d-inline-flex justify-content-center align-items-center w-100 btn-block"
                              type="submit"
                              disabled={loading || isCheckingEmail || isCheckingPhone}
                            >
                              {loading && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
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
                                  onError={() => setError('Oops... Đăng ký bằng Google có chút trục trặc.')}
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
