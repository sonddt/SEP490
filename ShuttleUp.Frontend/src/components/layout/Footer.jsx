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
                  <p>We are dedicated to providing the best badminton experience, from booking courts to coaching sessions.</p>
                </div>
                <div className="social-icon">
                  <ul>
                    <li><a href="#" onClick={(e) => e.preventDefault()} target="_blank"><i className="fab fa-facebook-f"></i></a></li>
                    <li><a href="#" onClick={(e) => e.preventDefault()} target="_blank"><i className="fab fa-twitter"></i></a></li>
                    <li><a href="#" onClick={(e) => e.preventDefault()} target="_blank"><i className="fab fa-instagram"></i></a></li>
                    <li><a href="#" onClick={(e) => e.preventDefault()} target="_blank"><i className="fab fa-linkedin-in"></i></a></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-lg-2 col-md-6">
              <div className="footer-widget footer-menu">
                <h2 className="footer-title">Quick Links</h2>
                <ul>
                  <li><Link to="/about"><i className="fa-solid fa-angle-right"></i> About Us</Link></li>
                  <li><Link to="/courts"><i className="fa-solid fa-angle-right"></i> Courts</Link></li>
                  <li><Link to="/coaches"><i className="fa-solid fa-angle-right"></i> Coaches</Link></li>
                  <li><Link to="/events"><i className="fa-solid fa-angle-right"></i> Events</Link></li>
                  <li><Link to="/contact"><i className="fa-solid fa-angle-right"></i> Contact</Link></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="footer-widget footer-menu">
                <h2 className="footer-title">For Users</h2>
                <ul>
                  <li><Link to="/login"><i className="fa-solid fa-angle-right"></i> Login</Link></li>
                  <li><Link to="/register"><i className="fa-solid fa-angle-right"></i> Register</Link></li>
                  <li><Link to="/user/bookings"><i className="fa-solid fa-angle-right"></i> My Bookings</Link></li>
                  <li><Link to="/user/dashboard"><i className="fa-solid fa-angle-right"></i> User Dashboard</Link></li>
                  <li><Link to="/faq"><i className="fa-solid fa-angle-right"></i> FAQ</Link></li>
                </ul>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="footer-widget footer-contact">
                <h2 className="footer-title">Contact Us</h2>
                <div className="footer-contact-info">
                  <div className="footer-address">
                    <p><i className="feather-map-pin"></i> <span>Thành phố Hồ Chí Minh, Việt Nam</span></p>
                  </div>
                  <p><i className="feather-phone"></i> +84 (0) 1234 5678</p>
                  <p className="mb-0"><i className="feather-mail"></i> shuttleup@example.com</p>
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
                  <p className="mb-0">&copy; {new Date().getFullYear()} ShuttleUp - All rights reserved.</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="copyright-menu">
                  <ul className="policy-menu">
                    <li><Link to="/terms">Terms & Conditions</Link></li>
                    <li><Link to="/privacy-policy">Privacy Policy</Link></li>
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
