import { NavLink } from 'react-router-dom';

const menuItems = [
  { to: '/user/dashboard',  icon: 'dashboard-icon.svg', label: 'Trang chủ' },
  { to: '/user/bookings',   icon: 'booking-icon.svg',   label: 'Đặt sân của tôi' },
  { to: '/user/social/search', icon: 'profile-icon.svg', label: 'Tìm bạn' },
  { to: '/user/social/friends', icon: 'request-icon.svg', label: 'Bạn bè' },
  { to: '/user/notifications', icon: 'subscribe.svg',  label: 'Thông báo' },
  { to: '/user/chat',       icon: 'chat-icon.svg',      label: 'Trò chuyện' },
  { to: '/user/favorites', icon: 'court-icon.svg',     label: 'Sân yêu thích' },
  { to: '/user/invoices',   icon: 'invoice-icon.svg',   label: 'Hóa đơn' },
  { to: '/profile/edit',    icon: 'profile-icon.svg',   label: 'Cài đặt hồ sơ' },
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
