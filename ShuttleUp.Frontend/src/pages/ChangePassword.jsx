import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function ChangePassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Password changed successfully');
    navigate('/login');
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
                  <h2>Thay Đổi Mật Khẩu</h2>
                  <p>Mật khẩu mới của bạn phải khác với<br />Mật khẩu đã sử dụng trước đó</p>
                  <form onSubmit={handleSubmit}>
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
                          placeholder="Mật khẩu mới" 
                          required 
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
                          required 
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-secondary w-100 d-inline-flex justify-content-center align-items-center">
                      Đổi Mật Khẩu<i className="feather-arrow-right-circle ms-2"></i>
                    </button>
                  </form>
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
  );
}
