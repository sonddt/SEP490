import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_SECTIONS = [
  {
    label: 'Tổng quan',
    items: [
      { to: '/admin/dashboard', icon: 'feather-home', label: 'Tổng quan' },
    ],
  },
  {
    label: 'Quản lý',
    items: [
      { to: '/admin/accounts',         icon: 'feather-users',        label: 'Tài khoản' },
      { to: '/admin/manager-requests',  icon: 'feather-user-check',   label: 'Duyệt Chủ sân' },
      { to: '/admin/featured-posts',   icon: 'feather-star',         label: 'Nổi bật' },
    ],
  },
  {
    label: 'Thống kê',
    items: [
      { to: '/admin/bookings-stats', icon: 'feather-calendar',     label: 'Thống kê Đặt sân' },
      { to: '/admin/revenue-stats',  icon: 'feather-bar-chart-2',  label: 'Thống kê Doanh thu' },
      { to: '/admin/reports',        icon: 'feather-flag',         label: 'Báo cáo & Khiếu nại' },
    ],
  },
];

export default function AdminSidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true, state: { skipReturn: true } });
  };

  const handleSwitchToPlayer = () => {
    onClose?.();
    navigate('/');
  };

  return (
    <>
      <div className={`adm-sidebar-overlay${open ? ' open' : ''}`} onClick={onClose} />

      <aside className={`adm-sidebar${open ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
        {/* Edge collapse handle */}
        <button
          type="button"
          className="adm-sidebar__collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          <i className={collapsed ? 'feather-chevron-right' : 'feather-chevron-left'} />
        </button>

        {/* Logo */}
        <div className="adm-sidebar__logo-wrap">
          <NavLink to="/admin/dashboard" className="adm-sidebar__logo" onClick={onClose}>
            <img src="/assets/img/logo-black.svg" alt="ShuttleUp" />
            {!collapsed && (
              <div>
                <span className="adm-sidebar__logo-text">Quản trị hệ thống</span>
              </div>
            )}
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="adm-sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="adm-sidebar__section">
              {!collapsed && <div className="adm-sidebar__section-label">{section.label}</div>}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/admin/dashboard'}
                  className={({ isActive }) => `adm-sidebar__item${isActive ? ' active' : ''}`}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="adm-sidebar__item-icon">
                    <i className={item.icon} />
                  </span>
                  {!collapsed && item.label}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Extra section */}
          <div className="adm-sidebar__section" style={{ marginTop: 8 }}>
            {!collapsed && <div className="adm-sidebar__section-label">Khác</div>}
            <button
              type="button"
              className="adm-sidebar__item"
              onClick={handleSwitchToPlayer}
              title={collapsed ? 'Về trang chủ' : undefined}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span className="adm-sidebar__item-icon">
                <i className="feather-globe" />
              </span>
              {!collapsed && 'Về trang chủ'}
            </button>
          </div>
        </nav>

        {/* User section */}
        <div className="adm-sidebar__user">
          <img src="/assets/img/profiles/avatar-01.jpg" alt="" />
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="adm-sidebar__user-name">{user?.fullName || user?.email || 'Admin'}</div>
              <div className="adm-sidebar__user-role">Quản trị viên</div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title="Đăng xuất"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.6)', fontSize: 17, padding: 4, flexShrink: 0 }}
          >
            <i className="feather-log-out" />
          </button>
        </div>
      </aside>
    </>
  );
}
