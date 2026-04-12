import { useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import { useAuth } from '../context/AuthContext';
import UserDropdown from '../components/layout/UserDropdown';

const PAGE_TITLES = {
  '/admin/dashboard':        { title: 'Tổng quan',          crumbs: [] },
  '/admin/accounts':         { title: 'Quản lý Tài khoản',  crumbs: [] },
  '/admin/manager-requests': { title: 'Duyệt Chủ sân',      crumbs: [] },
  '/admin/bookings-stats':   { title: 'Thống kê Đặt sân',   crumbs: [] },
  '/admin/revenue-stats':    { title: 'Thống kê Doanh thu',  crumbs: [] },
  '/admin/reports':          { title: 'Báo cáo & Khiếu nại', crumbs: [] },
};

function getPageMeta(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  return { title: 'Quản trị', crumbs: [] };
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { title, crumbs } = getPageMeta(location.pathname);

  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setOpenDropdown(null);
    navigate('/login');
  };

  return (
    <div className="adm-layout">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="adm-content">
        <header className="adm-topbar">
          <div className="adm-topbar__left">
            <button
              type="button"
              className="adm-sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="feather-menu" />
            </button>
            <div>
              <h1 className="adm-topbar__title">{title}</h1>
              {crumbs.length > 0 && (
                <div className="adm-topbar__breadcrumb">
                  <Link to="/admin/dashboard">Quản trị</Link>
                  {crumbs.map((c, i) => (
                    <span key={i}> / <Link to={c.to}>{c.label}</Link></span>
                  ))}
                  <span> / {title}</span>
                </div>
              )}
            </div>
          </div>

          <div className="adm-topbar__actions">
            <ul className="nav header-navbar-rht logged-in" style={{ alignItems: 'center', gap: 0, margin: 0 }}>
              <UserDropdown
                user={user}
                isAdmin={true}
                isManager={false}
                profilePath="/admin/dashboard"
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

        <main className="adm-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
