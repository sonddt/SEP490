import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [activeTab, setActiveTab] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // TODO: Implement actual login logic with API
    console.log(`Đang đăng nhập dưới quyền ${activeTab} với`, email, password);
    if (activeTab === 'user') {
      navigate('/user/dashboard');
    } else {
      navigate('/coach/dashboard');
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
                            onClick={() => setActiveTab('user')}
                            type="button"
                          >
                            <span className="d-flex justify-content-center align-items-center"></span>Tôi là Người chơi
                          </button>
                        </li>
                        <li className="nav-item" role="presentation">
                          <button
                            className={`nav-link d-flex align-items-center ${activeTab === 'coach' ? 'active' : ''}`}
                            onClick={() => setActiveTab('coach')}
                            type="button"
                          >
                            <span className="d-flex justify-content-center align-items-center"></span>Tôi là Quản lý sân
                          </button>
                        </li>
                      </ul>

                      {/* Form Content */}
                      <div className="tab-content" id="myTabContent">
                        <div className="tab-pane fade show active">
                          <form onSubmit={handleLogin}>
                            <div className="form-group">
                              <div className="group-img">
                                <i className="feather-user"></i>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Email / Tên tài khoản"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  required
                                />
                              </div>
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
                                  className="form-control pass-input"
                                  placeholder="Mật khẩu"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                            <div className="form-group d-sm-flex align-items-center justify-content-between">
                              <div className="form-check form-switch d-flex align-items-center justify-content-start">
                                <input className="form-check-input" type="checkbox" id="user-pass" />
                                <label className="form-check-label" htmlFor="user-pass">Nhớ mật khẩu</label>
                              </div>
                              <span>
                                <Link to="/forgot-password" className="forgot-pass">Quên mật khẩu?</Link>
                              </span>
                            </div>
                            <button className="btn btn-secondary register-btn d-inline-flex justify-content-center align-items-center w-100 btn-block" type="submit">
                              Đăng Nhập<i className="feather-arrow-right-circle ms-2"></i>
                            </button>

                            <div className="form-group">
                              <div className="login-options text-center">
                                <span className="text">Hoặc tiếp tục với</span>
                              </div>
                            </div>
                            <div className="form-group mb-0">
                              <ul className="social-login d-flex justify-content-center align-items-center">
                                <li className="text-center">
                                  <button type="button" className="btn btn-social d-flex align-items-center justify-content-center">
                                    <img src="/assets/img/icons/google.svg" className="img-fluid" alt="Google" />
                                    <span>Google</span>
                                  </button>
                                </li>
                                <li className="text-center">
                                  <button type="button" className="btn btn-social d-flex align-items-center justify-content-center">
                                    <img src="/assets/img/icons/facebook.svg" className="img-fluid" alt="Facebook" />
                                    <span>Facebook</span>
                                  </button>
                                </li>
                              </ul>
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
