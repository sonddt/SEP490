import { NavLink } from 'react-router-dom';

const menuItems = [
  { to: '/admin/dashboard',         icon: 'dashboard-icon.svg',  label: 'Tổng quan' },
  { to: '/admin/accounts',          icon: 'profile-icon.svg',    label: 'Tài khoản' },
  { to: '/admin/manager-requests',  icon: 'request-icon.svg',    label: 'Duyệt Chủ sân' },
  { to: '/admin/bookings-stats',    icon: 'booking-icon.svg',    label: 'Thống kê Đặt sân' },
  { to: '/admin/revenue-stats',     icon: 'invoice-icon.svg',    label: 'Thống kê Doanh thu' },
];

export default function AdminDashboardMenu() {
  return (
    <div className="dashboard-section coach-dash-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="dashboard-menu coaurt-menu-dash">
              <ul>
                {menuItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/admin/dashboard'}
                      className={({ isActive }) => (isActive ? 'active' : undefined)}
                    >
                      <img src={`/assets/img/icons/${item.icon}`} alt="" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
