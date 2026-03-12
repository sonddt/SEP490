import { NavLink } from 'react-router-dom';

const menuItems = [
  { to: '/manager/dashboard', icon: 'dashboard-icon.svg', label: 'Tổng quan' },
  { to: '/manager/courts',    icon: 'court-icon.svg',     label: 'Sân của tôi' },
  { to: '/manager/courts/add',icon: 'court-icon.svg',     label: 'Thêm sân mới' },
  { to: '/manager/requests',  icon: 'request-icon.svg',   label: 'Yêu cầu', badge: null },
  { to: '/manager/bookings',  icon: 'booking-icon.svg',   label: 'Đặt sân' },
  { to: '/manager/chat',      icon: 'chat-icon.svg',      label: 'Trò chuyện' },
  { to: '/manager/earnings',  icon: 'invoice-icon.svg',   label: 'Doanh thu' },
  { to: '/manager/wallet',    icon: 'wallet-icon.svg',    label: 'Ví' },
  { to: '/manager/profile',   icon: 'profile-icon.svg',   label: 'Hồ sơ' },
];

export default function ManagerDashboardMenu() {
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
                      end={item.to === '/manager/courts'}
                      className={({ isActive }) => (isActive ? 'active' : undefined)}
                    >
                      <img src={`/assets/img/icons/${item.icon}`} alt="" />
                      <span>{item.label}</span>
                      {item.badge && <span className="court-notify">{item.badge}</span>}
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
