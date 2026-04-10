import { Outlet, Link } from 'react-router-dom';
import UserDashboardMenu from '../components/user/UserDashboardMenu';

export default function UserLayout() {
  return (
    <div className="main-wrapper font-['Be_Vietnam_Pro'] bg-slate-50 min-h-screen content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Trang Cá Nhân</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Tài khoản của tôi</li>
          </ul>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="content pt-6 pb-16">
        <div className="container">
          <div className="row g-4 lg:g-5">
            {/* Sidebar Column */}
            <div className="col-lg-3 col-md-4">
              <UserDashboardMenu />
            </div>

            {/* Outlet Column */}
            <div className="col-lg-9 col-md-8">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
