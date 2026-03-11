import { NavLink } from 'react-router-dom';

const menuItems = [
  { to: '/user/dashboard',  icon: 'dashboard-icon.svg', label: 'Trang chủ' },
  { to: '/user/bookings',   icon: 'booking-icon.svg',   label: 'Đặt sân của tôi' },
  { to: '/user/chat',       icon: 'chat-icon.svg',      label: 'Trò chuyện' },
  { to: '/user/invoices',   icon: 'invoice-icon.svg',   label: 'Hóa đơn' },
  { to: '/user/wallet',     icon: 'wallet-icon.svg',    label: 'Ví' },
  { to: '/user/profile',    icon: 'profile-icon.svg',   label: 'Cài đặt hồ sơ' },
];

export default function UserDashboardMenu() {
  return (
    <div className="dashboard-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="dashboard-menu">
              <ul>
                {menuItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => (isActive ? 'active' : undefined)}
                    >
                      <img
                        src={`/assets/assets/img/icons/${item.icon}`}
                        alt="Icon"
                      />
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
