import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import ManagerSidebar from '../components/manager/ManagerSidebar';

const PAGE_TITLES = {
  '/manager/venues':            'Cụm sân của tôi',
  '/manager/venues/add':        'Thêm cụm sân mới',
  '/manager/bookings':          'Quản lý đặt sân',
  '/manager/notifications':     'Thông báo',
  '/manager/earnings':          'Doanh thu',
  '/manager/payment-settings':  'Cài đặt thanh toán',
};

function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.includes('/courts/add')) return 'Thêm sân mới';
  if (pathname.includes('/courts') && pathname.includes('/edit')) return 'Chỉnh sửa sân';
  if (pathname.includes('/courts')) return 'Danh sách sân';
  if (pathname.includes('/edit')) return 'Chỉnh sửa cụm sân';
  if (pathname.includes('/availability')) return 'Giờ hoạt động';
  return 'Quản lý sân';
}

export default function ManagerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="mgr-layout">
      <ManagerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="mgr-content">
        {/* Top bar */}
        <header className="mgr-topbar">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="mgr-sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="feather-menu" />
            </button>
            <h1 className="mgr-topbar__title">{pageTitle}</h1>
          </div>
          <div className="mgr-topbar__actions">
            <button
              type="button"
              className="mgr-topbar__icon-btn"
              title="Thông báo"
              onClick={() => navigate('/manager/notifications')}
            >
              <i className="feather-bell" />
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 7, height: 7, borderRadius: '50%',
                background: '#ef4444', border: '2px solid #fff',
              }} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="mgr-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
