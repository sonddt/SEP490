import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Header = ({ transparent = false }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null); // 'search' | 'booking' | 'dashboard' | null
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Scroll listener: add 'header-fixed' class when scrolled past 100px ──
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Close mobile menu on route change / outside click ───────────────────
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('menu-opened');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('menu-opened');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('menu-opened');
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setOpenSubmenu(null);
  };

  const toggleSubmenu = (name) => {
    // Only toggle submenu on mobile / tablet viewports
    if (window.innerWidth < 992) {
      setOpenSubmenu((prev) => (prev === name ? null : name));
    }
  };

  const handleLogout = () => {
    logout();
    closeMobileMenu();
    navigate('/login');
  };

  // Dashboard path based on role
  const isAdmin   = user?.roles?.includes('ADMIN');
  const isManager = user?.roles?.includes('MANAGER');
  const dashboardPath = isAdmin
    ? '/admin/dashboard'
    : isManager
      ? '/manager/dashboard'
      : '/user/dashboard';

  // Profile path based on role
  const profilePath = isAdmin
    ? '/admin/dashboard'
    : isManager
      ? '/manager/setting-password'
      : '/user/my-profile';

  // Helper to check if path is active
  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const headerClass = [
    'header',
    transparent && !scrolled ? 'header-trans' : '',
    scrolled ? 'fixed' : '',
  ].filter(Boolean).join(' ');

  const isWhiteBg = !transparent || scrolled;
  const logoSrc = isWhiteBg ? "/assets/img/logo-black.svg" : "/assets/img/logo.svg";

  return (
    <header className={headerClass}>
      <div className="container-fluid">
        <nav className="navbar navbar-expand-lg header-nav">

          {/* ── Mobile button + Logo ─────────────────────────────────────── */}
          <div className="navbar-header">
            <button
              id="mobile_btn"
              className="mobile-btn"
              onClick={() => setMobileMenuOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <span className="bar-icon">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
            <Link to="/" className="navbar-brand logo" onClick={closeMobileMenu}>
              <img src={logoSrc} className="img-fluid" alt="ShuttleUp" />
            </Link>
          </div>

          {/* ── Main nav menu ────────────────────────────────────────────── */}
          <div className={`main-menu-wrapper${mobileMenuOpen ? ' menu-open' : ''}`}>
            <div className="menu-header">
              <Link to="/" className="menu-logo" onClick={closeMobileMenu}>
                <img src="/assets/img/logo-black.svg" className="img-fluid" alt="ShuttleUp" />
              </Link>
              <button
                id="menu_close"
                className="menu-close"
                onClick={closeMobileMenu}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <ul className="main-nav">
              <li className={isActive('/') ? 'active' : ''}>
                <Link to="/" onClick={closeMobileMenu}>
                  Trang chủ
                </Link>
              </li>

              <li className={`has-submenu ${isActive('/courts') || isActive('/venue-details') ? 'active' : ''} ${openSubmenu === 'search' ? 'active' : ''}`}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleSubmenu('search');
                  }}
                >
                  Tìm Sân <i className="fas fa-chevron-down"></i>
                </a>
                <ul className={`submenu ${openSubmenu === 'search' ? 'd-block' : ''}`}>
                  <li className={isActive('/courts') && !isActive('/courts/map') ? 'active' : ''}><Link to="/courts" onClick={closeMobileMenu}>Danh sách Sân</Link></li>
                  <li className={isActive('/courts/map') ? 'active' : ''}><Link to="/courts/map" onClick={closeMobileMenu}>Bản đồ Sân</Link></li>
                  <li className={isActive('/venue-details') ? 'active' : ''}><Link to="/venue-details" onClick={closeMobileMenu}>Chi tiết Sân</Link></li>
                </ul>
              </li>

              <li className={`has-submenu ${isActive('/booking') || isActive('/user/bookings') ? 'active' : ''} ${openSubmenu === 'booking' ? 'active' : ''}`}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleSubmenu('booking');
                  }}
                >
                  Đặt Sân <i className="fas fa-chevron-down"></i>
                </a>
                <ul className={`submenu ${openSubmenu === 'booking' ? 'd-block' : ''}`}>
                  <li className={isActive('/booking') ? 'active' : ''}><Link to="/booking" onClick={closeMobileMenu}>Đặt một Sân</Link></li>
                  <li className={isActive('/user/bookings') ? 'active' : ''}><Link to="/user/bookings" onClick={closeMobileMenu}>Lịch sử Đặt Sân</Link></li>
                </ul>
              </li>


              <li className={isActive('/about') ? 'active' : ''}>
                <Link to="/about" onClick={closeMobileMenu}>Về Chúng tôi</Link>
              </li>
              <li className={isActive('/contact') ? 'active' : ''}>
                <Link to="/contact" onClick={closeMobileMenu}>Liên hệ</Link>
              </li>
              {isAuthenticated && (
                <li className={isActive('/chat') ? 'active' : ''}>
                  <Link to="/chat" onClick={closeMobileMenu}>💬 Chat</Link>
                </li>
              )}
              <li className="login-link">
                <Link to="/register" onClick={closeMobileMenu}>Đăng ký</Link>
              </li>
              <li className="login-link">
                <Link to="/login" onClick={closeMobileMenu}>Đăng nhập</Link>
              </li>
            </ul>
          </div>

          {/* ── Right side buttons ───────────────────────────────────────── */}
          <ul className="nav header-navbar-rht">
            {isAuthenticated ? (
              <>
                {isManager && !isAdmin && (
                  <li className="nav-item d-none d-sm-block">
                    <Link
                      className={`nav-link btn ${isWhiteBg ? 'btn-primary' : 'btn-limegreen'} me-2 text-white`}
                      to={location.pathname.startsWith('/manager') ? '/user/dashboard' : '/manager/dashboard'}
                      onClick={closeMobileMenu}
                      style={{ padding: '8px 20px', borderRadius: '25px', fontWeight: '600', transition: 'all 0.3s' }}
                    >
                      <i className={location.pathname.startsWith('/manager') ? 'feather-user me-2' : 'feather-briefcase me-2'}></i>
                      {location.pathname.startsWith('/manager') ? 'Chế độ Người chơi' : 'Dashboard Chủ sân'}
                    </Link>
                  </li>
                )}
                <li className="nav-item">
                  <Link
                    className="nav-link btn btn-white log-register"
                    to={profilePath}
                    onClick={closeMobileMenu}
                  >
                    <span><i className="feather-user"></i></span>
                    {user?.fullName || user?.email}
                    {isAdmin && (
                      <span className="badge bg-danger ms-1" style={{ fontSize: '0.68rem', verticalAlign: 'middle' }}>ADMIN</span>
                    )}
                  </Link>
                </li>
                <li className="nav-item">
                  <button
                    className="nav-link btn btn-secondary"
                    onClick={handleLogout}
                    style={{ border: 'none', cursor: 'pointer' }}
                  >
                    <span><i className="feather-log-out"></i></span>Đăng xuất
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link
                    className="nav-link btn header-login-btn"
                    to="/register"
                    onClick={closeMobileMenu}
                  >
                    <span><i className="feather-user-plus"></i></span>Đăng ký
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link btn btn-secondary" to="/login" onClick={closeMobileMenu}>
                    <span><i className="feather-log-in"></i></span>Đăng nhập
                  </Link>
                </li>
              </>
            )}
          </ul>

        </nav>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeMobileMenu}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          }}
        />
      )}
    </header>
  );
};

export default Header;
