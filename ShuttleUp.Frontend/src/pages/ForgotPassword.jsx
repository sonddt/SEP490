import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/authApi';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Oops... Không thể kết nối đến máy chủ. Bạn thử lại nha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-wrapper authendication-pages">
      <div className="content blur-ellipses">
        <div className="container">
          <div className="row">
            <div className="col-md-6 col-lg-6 mx-auto vph-100 d-flex align-items-center">
              <div className="forgot-password w-100">
                <header className="text-center forgot-head-title">
                  <Link to="/">
                    <img src="/assets/img/logo-black.svg" className="img-fluid" alt="Logo" />
                  </Link>
                </header>
                <div className="shadow-card">
                  <h2>Quên Mật Khẩu</h2>
                  <p>Nhập Email Đã Đăng Ký Của Bạn</p>

                  {success ? (
                    <div className="alert alert-success">
                      Tụi mình đã gửi link đổi mật khẩu đến <strong>{email}</strong> rồi đó.
                      Bạn nhớ kiểm tra hộp thư (cả thư mục Spam) nhé.
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      {error && <div className="alert alert-danger">{error}</div>}
                      <div className="form-group">
                        <div className="group-img">
                          <i className="feather-mail"></i>
                          <input
                            type="email"
                            className="form-control"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-secondary w-100 d-inline-flex justify-content-center align-items-center"
                        disabled={loading}
                      >
                        {loading ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
                        {!loading && <i className="feather-arrow-right-circle ms-2"></i>}
                      </button>
                    </form>
                  )}
                </div>
                <div className="bottom-text text-center">
                  <p>Nhớ mật khẩu? <Link to="/login">Đăng nhập!</Link></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
