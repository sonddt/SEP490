import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_SECTIONS = [
  {
    label: 'Tổng quan',
    items: [
      { to: '/manager/dashboard',     icon: 'feather-home',        label: 'Tổng quan' },
    ],
  },
  {
    label: 'Quản lý',
    items: [
      { to: '/manager/venues',        icon: 'feather-map-pin',      label: 'Cụm sân' },
      { to: '/manager/bookings',      icon: 'feather-calendar',     label: 'Đặt sân' },
      { to: '/manager/notifications', icon: 'feather-bell',         label: 'Thông báo', badge: 3 },
    ],
  },
  {
    label: 'Tài chính',
    items: [
      { to: '/manager/earnings',          icon: 'feather-bar-chart-2',  label: 'Doanh thu' },
    ],
  },
];

export default function ManagerSidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchToPlayer = () => {
    onClose?.();
    navigate('/');
  };

  const handleGoToProfile = () => {
    onClose?.();
    navigate('/profile');
  };

  return (
    <>
      <div className={`mgr-sidebar-overlay${open ? ' open' : ''}`} onClick={onClose} />

      <aside className={`mgr-sidebar${open ? ' open' : ''}`}>
        {/* Logo */}
        <NavLink to="/manager/venues" className="mgr-sidebar__logo" onClick={onClose}>
          <img src="/assets/img/logo-black.svg" alt="ShuttleUp" />
          <div>
            <span className="mgr-sidebar__logo-text">Hệ thống quản lý sân</span>
          </div>
        </NavLink>

        {/* Navigation */}
        <nav className="mgr-sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mgr-sidebar__section">
              <div className="mgr-sidebar__section-label">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/manager/venues'}
                  className={({ isActive }) => `mgr-sidebar__item${isActive ? ' active' : ''}`}
                  onClick={onClose}
                >
                  <i className={item.icon} />
                  {item.label}
                  {item.badge > 0 && <span className="mgr-sidebar__badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Extra section */}
          <div className="mgr-sidebar__section" style={{ marginTop: 8 }}>
            <div className="mgr-sidebar__section-label">Khác</div>
            <button
              type="button"
              className="mgr-sidebar__item"
              onClick={handleGoToProfile}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <i className="feather-user" />
              Hồ sơ của tôi
            </button>
            <button
              type="button"
              className="mgr-sidebar__item"
              onClick={handleSwitchToPlayer}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <i className="feather-refresh-cw" />
              Chế độ Người chơi
            </button>
          </div>
        </nav>

        {/* User section */}
        <div className="mgr-sidebar__user">
          <img src="/assets/img/profiles/avatar-01.jpg" alt="" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="mgr-sidebar__user-name">{user?.fullName || user?.email || 'Manager'}</div>
            <div className="mgr-sidebar__user-role">Chủ sân</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Đăng xuất"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 17, padding: 4, flexShrink: 0 }}
          >
            <i className="feather-log-out" />
          </button>
        </div>
      </aside>
    </>
  );
}
