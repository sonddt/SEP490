import { Outlet, Link } from 'react-router-dom';
import UserDashboardMenu from '../components/user/UserDashboardMenu';

export default function UserLayout() {
  return (
    <div className="user-profile-shell main-wrapper font-['Be_Vietnam_Pro'] bg-slate-50 min-h-screen content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0" style={{ padding: '40px 0', overflow: 'hidden', position: 'relative' }}>
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white h2 mb-1">Trang Cá Nhân</h1>
          <ul className="mb-0">
            <li><Link to="/">Trang chủ</Link></li>
            <li>Tài khoản của tôi</li>
          </ul>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="content user-profile-content">
        <div className="container-fluid user-profile-container-fluid">
          <div className="row user-profile-row g-4 lg:g-5">
            {/* Sidebar Column */}
            <div className="col-12 col-md-4 col-lg-3 col-xl-2">
              <UserDashboardMenu />
            </div>

            {/* Outlet Column */}
            <div className="col-12 col-md-8 col-lg-9 col-xl-10">
              <div className="user-profile-outlet">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
