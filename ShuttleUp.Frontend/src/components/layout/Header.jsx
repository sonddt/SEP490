import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import UserDropdown from './UserDropdown';

const Header = ({ transparent = false }) => {
  const [scrolled, setScrolled]         = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu]   = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null); // 'notif' | 'user' | null

  const { user, isAuthenticated, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  // ── Scroll ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // ── Mobile menu body-class ────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    document.body.classList.toggle('menu-opened', mobileMenuOpen);
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('menu-opened');
    };
  }, [mobileMenuOpen]);

  // ── Close dropdowns on route change ──────────────────────────────────────
  useEffect(() => {
    setOpenDropdown(null);
    setMobileMenuOpen(false);
    setOpenSubmenu(null);
  }, [location.pathname]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const closeMobileMenu = () => { setMobileMenuOpen(false); setOpenSubmenu(null); };

  const toggleSubmenu = (name) => {
    if (window.innerWidth < 992) setOpenSubmenu((p) => (p === name ? null : name));
  };

  const toggleDropdown = (name) => setOpenDropdown((p) => (p === name ? null : name));

  const handleLogout = () => {
    logout();
    setOpenDropdown(null);
    closeMobileMenu();
    navigate('/login');
  };

  // ── Role flags ────────────────────────────────────────────────────────────
  const isAdmin   = user?.roles?.includes('ADMIN');
  const isManager = user?.roles?.includes('MANAGER');

  // Profile path — fixed bug: manager -> /manager/profile, player -> /user/my-profile
  const profilePath = isAdmin
    ? '/admin/dashboard'
    : isManager
      ? '/manager/profile'
      : '/user/my-profile';

  const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const isWhiteBg = !transparent || scrolled;
  const logoSrc   = isWhiteBg ? '/assets/img/logo-black.svg' : '/assets/img/logo.svg';

  // Icon colour: white on transparent header OR when scrolled (fixed header stays green)
  const iconColor = (!isWhiteBg || scrolled) ? '#fff' : '#555';

  const headerClass = ['header', transparent && !scrolled ? 'header-trans' : '', scrolled ? 'fixed' : '']
    .filter(Boolean).join(' ');

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
                <span /><span /><span />
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <ul className="main-nav">
              <li className={isActive('/') ? 'active' : ''}>
                <Link to="/" onClick={closeMobileMenu}>Trang chủ</Link>
              </li>

              <li className={`has-submenu ${isActive('/courts') || isActive('/venue-details') ? 'active' : ''} ${openSubmenu === 'search' ? 'active' : ''}`}>
                <a href="#" onClick={(e) => { e.preventDefault(); toggleSubmenu('search'); }}>
                  Tìm Sân <i className="fas fa-chevron-down" />
                </a>
                <ul className={`submenu ${openSubmenu === 'search' ? 'd-block' : ''}`}>
                  <li className={isActive('/courts') && !isActive('/courts/map') ? 'active' : ''}>
                    <Link to="/courts" onClick={closeMobileMenu}>Danh sách Sân</Link>
                  </li>
                  <li className={isActive('/courts/map') ? 'active' : ''}>
                    <Link to="/courts/map" onClick={closeMobileMenu}>Bản đồ Sân</Link>
                  </li>
                </ul>
              </li>

              <li className={isActive('/about') ? 'active' : ''}>
                <Link to="/about" onClick={closeMobileMenu}>Nổi bật</Link>
              </li>

              {isAuthenticated && (
                <li className={isActive('/chat') ? 'active' : ''}>
                  <Link to="/chat" onClick={closeMobileMenu}>💬 Chat</Link>
                </li>
              )}

              <li className="login-link"><Link to="/register" onClick={closeMobileMenu}>Đăng ký</Link></li>
              <li className="login-link"><Link to="/login"    onClick={closeMobileMenu}>Đăng nhập</Link></li>
            </ul>
          </div>

          {/* ── Right side ───────────────────────────────────────────────── */}
          {/* iconColor: white on transparent homepage header, dark on white header */}
          <ul className="nav header-navbar-rht logged-in" style={{ alignItems: 'center', gap: 0 }}>
            {isAuthenticated ? (
              <>
                {/* 3. Search */}
                <li className="nav-item">
                  <a
                    className="nav-link"
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    style={{ padding: '8px 10px', display: 'flex', alignItems: 'center' }}
                  >
                    <i className="feather-search" style={{ fontSize: 22, color: iconColor }} />
                  </a>
                </li>

                {/* 2. Notification */}
                <NotificationDropdown
                  open={openDropdown === 'notif'}
                  onToggle={() => toggleDropdown('notif')}
                  onClose={() => setOpenDropdown(null)}
                  iconColor={iconColor}
                  iconSize={22}
                />

                {/* 1. User avatar */}
                <UserDropdown
                  user={user}
                  isAdmin={isAdmin}
                  isManager={isManager}
                  profilePath={profilePath}
                  open={openDropdown === 'user'}
                  onToggle={() => toggleDropdown('user')}
                  onClose={() => setOpenDropdown(null)}
                  onLogout={handleLogout}
                  iconColor={iconColor}
                  avatarSize={38}
                />
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link btn header-login-btn" to="/register" onClick={closeMobileMenu}>
                    <span><i className="feather-user-plus" /></span>Đăng ký
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link btn btn-secondary" to="/login" onClick={closeMobileMenu}>
                    <span><i className="feather-log-in" /></span>Đăng nhập
                  </Link>
                </li>
              </>
            )}
          </ul>

        </nav>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeMobileMenu}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
        />
      )}
    </header>
  );
};

export default Header;
