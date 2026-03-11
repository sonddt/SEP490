import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

const Header = ({ transparent = false }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const headerClass = [
    'header',
    transparent && !scrolled ? 'header-trans' : '',
    scrolled ? 'fixed' : '',
  ].filter(Boolean).join(' ');

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
              <img src="/assets/img/logo.svg" className="img-fluid" alt="ShuttleUp" />
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
              <li>
                <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMobileMenu}>
                  Home
                </NavLink>
              </li>

              <li className="has-submenu">
                <a href="#" onClick={(e) => e.preventDefault()}>
                  Venues <i className="fas fa-chevron-down"></i>
                </a>
                <ul className="submenu">
                  <li><Link to="/courts" onClick={closeMobileMenu}>Court Listing</Link></li>
                  <li><Link to="/courts/map" onClick={closeMobileMenu}>Courts Map</Link></li>
                  <li><Link to="/venue-details" onClick={closeMobileMenu}>Venue Details</Link></li>
                </ul>
              </li>

              <li className="has-submenu">
                <a href="#" onClick={(e) => e.preventDefault()}>
                  Booking <i className="fas fa-chevron-down"></i>
                </a>
                <ul className="submenu">
                  <li><Link to="/booking" onClick={closeMobileMenu}>Book a Court</Link></li>
                  <li><Link to="/user/bookings" onClick={closeMobileMenu}>My Bookings</Link></li>
                </ul>
              </li>

              <li className="has-submenu">
                <a href="#" onClick={(e) => e.preventDefault()}>
                  Dashboard <i className="fas fa-chevron-down"></i>
                </a>
                <ul className="submenu">
                  <li><Link to="/user/dashboard" onClick={closeMobileMenu}>User Dashboard</Link></li>
                  <li><Link to="/coach/dashboard" onClick={closeMobileMenu}>Coach Dashboard</Link></li>
                </ul>
              </li>

              <li>
                <Link to="/about" onClick={closeMobileMenu}>About Us</Link>
              </li>
              <li>
                <Link to="/contact" onClick={closeMobileMenu}>Contact Us</Link>
              </li>
              <li className="login-link">
                <Link to="/register" onClick={closeMobileMenu}>Sign Up</Link>
              </li>
              <li className="login-link">
                <Link to="/login" onClick={closeMobileMenu}>Sign In</Link>
              </li>
            </ul>
          </div>

          {/* ── Right side buttons ───────────────────────────────────────── */}
          <ul className="nav header-navbar-rht">
            <li className="nav-item">
              <div className="nav-link btn btn-white log-register">
                <Link to="/login" onClick={closeMobileMenu}><span><i className="feather-users"></i></span>Login</Link>
                {' / '}
                <Link to="/register" onClick={closeMobileMenu}>Register</Link>
              </div>
            </li>
            <li className="nav-item">
              <Link className="nav-link btn btn-secondary" to="/courts/add" onClick={closeMobileMenu}>
                <span><i className="feather-check-circle"></i></span>List Your Court
              </Link>
            </li>
          </ul>

        </nav>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeMobileMenu}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999,
          }}
        />
      )}
    </header>
  );
};

export default Header;
