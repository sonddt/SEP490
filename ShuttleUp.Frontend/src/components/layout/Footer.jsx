import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="footer">
      {/* Footer Top */}
      <div className="footer-top">
        <div className="container">
          <div className="row">
            <div className="col-lg-3 col-md-6">
              <div className="footer-widget footer-about">
                <div className="footer-logo">
                  <img src="/assets/img/logo-white.svg" alt="Logo" />
                </div>
                <div className="footer-about-content">
                  <p>Chúng tôi tận tâm mang đến trải nghiệm cầu lông tốt nhất, từ việc đặt sân đến tìm kiếm quản lý sân nâng cao kỹ năng.</p>
                </div>
                <div className="social-icon">
                  <ul>
                    <li><a href="#" onClick={(e) => e.preventDefault()} target="_blank" rel="noreferrer"><i className="fab fa-facebook-f"></i></a></li>
                    <li><a href="#" onClick={(e) => e.preventDefault()} target="_blank" rel="noreferrer"><i className="fab fa-twitter"></i></a></li>
                    <li><a href="#" onClick={(e) => e.preventDefault()} target="_blank" rel="noreferrer"><i className="fab fa-instagram"></i></a></li>
                    <li><a href="#" onClick={(e) => e.preventDefault()} target="_blank" rel="noreferrer"><i className="fab fa-linkedin-in"></i></a></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-lg-2 col-md-6">
              <div className="footer-widget footer-menu">
                <h2 className="footer-title">Khám phá</h2>
                <ul>
                  <li><Link to="/about"><i className="fa-solid fa-angle-right"></i> Về chúng tôi</Link></li>
                  <li><Link to="/venues"><i className="fa-solid fa-angle-right"></i> Danh sách sân</Link></li>
                  <li><Link to="/managers"><i className="fa-solid fa-angle-right"></i> Quản lý sân</Link></li>
                  <li><Link to="/events"><i className="fa-solid fa-angle-right"></i> Sự kiện</Link></li>
                  <li><Link to="/contact"><i className="fa-solid fa-angle-right"></i> Liên hệ</Link></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="footer-widget footer-menu">
                <h2 className="footer-title">Dành cho bạn</h2>
                <ul>
                  <li><Link to="/login"><i className="fa-solid fa-angle-right"></i> Đăng nhập</Link></li>
                  <li><Link to="/register"><i className="fa-solid fa-angle-right"></i> Đăng ký</Link></li>
                  <li><Link to="/user/bookings"><i className="fa-solid fa-angle-right"></i> Lịch sử đặt sân</Link></li>
                  <li><Link to="/user/dashboard"><i className="fa-solid fa-angle-right"></i> Bảng điều khiển</Link></li>
                  <li><Link to="/faq"><i className="fa-solid fa-angle-right"></i> Câu hỏi thường gặp</Link></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="footer-widget footer-contact">
                <h2 className="footer-title">Liên hệ nhanh</h2>
                <div className="footer-contact-info">
                  <div className="footer-address">
                    <p><i className="feather-map-pin"></i> <span>Thành phố Hồ Chí Minh, Việt Nam</span></p>
                  </div>
                  <p><i className="feather-phone"></i> +84 123 456 789</p>
                  <p className="mb-0"><i className="feather-mail"></i> cskh@shuttleup.vn</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Footer Bottom */}
      <div className="footer-bottom">
        <div className="container">
          <div className="copyright">
            <div className="row align-items-center">
              <div className="col-md-6">
                <div className="copyright-text">
                  <p className="mb-0">&copy; {new Date().getFullYear()} ShuttleUp - Bản quyền đã được bảo hộ.</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="copyright-menu">
                  <ul className="policy-menu">
                    <li><Link to="/terms">Điều khoản sử dụng</Link></li>
                    <li><Link to="/privacy-policy">Bảo mật thông tin</Link></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
