import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUnreadNotificationCount } from '../../hooks/useUnreadNotificationCount';

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
      { to: '/manager/refunds',       icon: 'feather-rotate-ccw',   label: 'Hoàn tiền' },
      { to: '/manager/featured-posts', icon: 'feather-star',        label: 'Nổi bật' },
      { to: '/manager/notifications', icon: 'feather-bell',         label: 'Thông báo', badgeKey: 'notifications' },
    ],
  },
  {
    label: 'Tài chính',
    items: [
      { to: '/manager/earnings',          icon: 'feather-bar-chart-2',  label: 'Doanh thu' },
    ],
  },
  {
    label: 'Cài đặt',
    items: [
      { to: '/manager/payment-settings',      icon: 'feather-credit-card',  label: 'Thanh toán' },
    ],
  },
];

export default function ManagerSidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { count: unreadNotifCount } = useUnreadNotificationCount();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true, state: { skipReturn: true } });
  };

  const handleSwitchToPlayer = () => {
    onClose?.();
    navigate('/');
  };

  const handleGoToProfile = () => {
    onClose?.();
    navigate('/manager/profile');
  };

  return (
    <>
      <div className={`mgr-sidebar-overlay${open ? ' open' : ''}`} onClick={onClose} />

      <aside className={`mgr-sidebar${open ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
        {/* Edge collapse handle */}
        <button
          type="button"
          className="mgr-sidebar__collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          <i className={collapsed ? 'feather-chevron-right' : 'feather-chevron-left'} />
        </button>

        {/* Logo */}
        <div className="mgr-sidebar__logo-wrap">
          <NavLink to="/manager/venues" className="mgr-sidebar__logo" onClick={onClose}>
            <img src="/assets/img/logo-black.svg" alt="ShuttleUp" />
            {!collapsed && (
              <div className="mgr-sidebar__logo-text">
                Hệ thống<br />
                <span>quản lý sân</span>
              </div>
            )}
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="mgr-sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mgr-sidebar__section">
              {!collapsed && <div className="mgr-sidebar__section-label">{section.label}</div>}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/manager/venues'}
                  className={({ isActive }) => `mgr-sidebar__item${isActive ? ' active' : ''}`}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="mgr-sidebar__item-icon">
                    <i className={item.icon} />
                  </span>
                  {!collapsed && item.label}
                  {item.badgeKey === 'notifications' && unreadNotifCount > 0 && (
                    <span className="mgr-sidebar__badge">
                      {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Extra section */}
          <div className="mgr-sidebar__section" style={{ marginTop: 8 }}>
            {!collapsed && <div className="mgr-sidebar__section-label">Khác</div>}
            <button
              type="button"
              className="mgr-sidebar__item"
              onClick={handleGoToProfile}
              title={collapsed ? 'Hồ sơ của tôi' : undefined}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span className="mgr-sidebar__item-icon">
                <i className="feather-user" />
              </span>
              {!collapsed && 'Hồ sơ của tôi'}
            </button>
            <button
              type="button"
              className="mgr-sidebar__item"
              onClick={handleSwitchToPlayer}
              title={collapsed ? 'Chế độ Người chơi' : undefined}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span className="mgr-sidebar__item-icon">
                <i className="feather-refresh-cw" />
              </span>
              {!collapsed && 'Chế độ Người chơi'}
            </button>
          </div>
        </nav>

        {/* User section */}
        <div className="mgr-sidebar__user">
          <img src={user?.avatarUrl || '/assets/img/profiles/avatar-01.jpg'} alt="" onError={(e) => { e.target.onerror = null; e.target.src = '/assets/img/profiles/avatar-01.jpg'; }} />
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="mgr-sidebar__user-name">{user?.fullName || user?.email || 'Manager'}</div>
              <div className="mgr-sidebar__user-role">Chủ sân</div>
            </div>
          )}
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

