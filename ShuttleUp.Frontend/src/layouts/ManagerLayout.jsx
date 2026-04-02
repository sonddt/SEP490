import { useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import ManagerSidebar from '../components/manager/ManagerSidebar';
import { useAuth } from '../context/AuthContext';
import UserDropdown from '../components/layout/UserDropdown';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';

const PAGE_TITLES = {
  '/manager/dashboard': { title: 'Tổng quan', crumbs: [] },
  '/manager/venues': { title: 'Cụm sân của tôi', crumbs: [] },
  '/manager/venues/add': { title: 'Thêm cụm sân mới', crumbs: [{ label: 'Cụm sân', to: '/manager/venues' }] },
  '/manager/bookings': { title: 'Quản lý đặt sân', crumbs: [] },
  '/manager/notifications': { title: 'Thông báo', crumbs: [] },
  '/manager/earnings': { title: 'Doanh thu', crumbs: [] },
  '/manager/payment-settings': { title: 'Cài đặt thanh toán', crumbs: [] },
};

function getPageMeta(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.includes('/courts/add'))
    return { title: 'Thêm sân mới', crumbs: [{ label: 'Cụm sân', to: '/manager/venues' }, { label: 'Sân con', to: pathname.replace(/\/courts\/add$/, '/courts') }] };
  if (/\/courts\/\d+\/edit/.test(pathname))
    return { title: 'Chỉnh sửa sân', crumbs: [{ label: 'Cụm sân', to: '/manager/venues' }, { label: 'Sân con', to: pathname.replace(/\/courts\/\d+\/edit$/, '/courts') }] };
  if (pathname.includes('/courts'))
    return { title: 'Quản lý Sân con', crumbs: [{ label: 'Cụm sân', to: '/manager/venues' }] };
  if (pathname.includes('/edit'))
    return { title: 'Chỉnh sửa cụm sân', crumbs: [{ label: 'Cụm sân', to: '/manager/venues' }] };
  if (pathname.includes('/availability'))
    return { title: 'Giờ hoạt động', crumbs: [{ label: 'Cụm sân', to: '/manager/venues' }] };
  return { title: 'Quản lý sân', crumbs: [] };
}

export default function ManagerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'user' | null
  const location = useLocation();
  const navigate = useNavigate();
  const { title, crumbs } = getPageMeta(location.pathname);
  const { count: unreadNotifCount } = useUnreadNotificationCount();

  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setOpenDropdown(null);
    navigate('/login');
  };

  return (
    <div className="mgr-layout">
      <ManagerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="mgr-content">
        <header className="mgr-topbar">
          <div className="mgr-topbar__left">
            <button
              type="button"
              className="mgr-sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="feather-menu" />
            </button>
            <div>
              <h1 className="mgr-topbar__title">{title}</h1>
              {crumbs.length > 0 && (
                <div className="mgr-topbar__breadcrumb">
                  <Link to="/manager/venues">Quản lý</Link>
                  {crumbs.map((c, i) => (
                    <span key={i}> / <Link to={c.to}>{c.label}</Link></span>
                  ))}
                  <span> / {title}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mgr-topbar__actions">
            <button
              type="button"
              className="mgr-topbar__icon-btn"
              title="Thông báo"
              onClick={() => navigate('/manager/notifications')}
              style={{ position: 'relative' }}
            >
              <i className="feather-bell" />
              {unreadNotifCount > 0 && (
                <span style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#ef4444', border: '2px solid #fff',
                }} />
              )}
            </button>

            <ul className="nav header-navbar-rht logged-in" style={{ alignItems: 'center', gap: 0, margin: 0 }}>
              <UserDropdown
                user={user}
                isAdmin={false}
                isManager={true}
                profilePath="/manager/profile"
                showManagerAccess={false}
                showSwitchToPlayer={true}
                switchToPlayerPath="/"
                open={openDropdown === 'user'}
                onToggle={() => setOpenDropdown((p) => (p === 'user' ? null : 'user'))}
                onClose={() => setOpenDropdown(null)}
                onLogout={handleLogout}
                iconColor="#1e293b"
                avatarSize={34}
              />
            </ul>
          </div>
        </header>

        <main className="mgr-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
