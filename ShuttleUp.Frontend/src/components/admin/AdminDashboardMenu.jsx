import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const menuItems = [
  { to: '/admin/dashboard',         icon: 'dashboard-icon.svg',  label: 'Tổng quan' },
  { to: '/admin/accounts',          icon: 'profile-icon.svg',    label: 'Tài khoản' },
  { to: '/admin/manager-requests',  icon: 'request-icon.svg',    label: 'Duyệt Chủ sân' },
  { to: '/admin/bookings-stats',    icon: 'booking-icon.svg',    label: 'Thống kê Đặt sân' },
  { to: '/admin/revenue-stats',     icon: 'invoice-icon.svg',    label: 'Thống kê Doanh thu' },
];

export default function AdminDashboardMenu() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
    navigate('/login', { replace: true, state: { skipReturn: true } });
  };

  return (
    <div className="dashboard-section coach-dash-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="dashboard-menu coaurt-menu-dash d-flex align-items-center justify-content-between flex-wrap gap-3">
              <ul className="mb-0">
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
              
              <button 
                onClick={handleLogout}
                className="btn btn-danger d-flex align-items-center gap-2 px-4 py-2"
                style={{ borderRadius: '8px', fontWeight: 500 }}
              >
                <i className="feather-log-out" style={{ fontSize: '18px' }}></i>
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
