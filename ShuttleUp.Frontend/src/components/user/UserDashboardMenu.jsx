import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

export default function UserDashboardMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    toast.success('Đã đăng xuất thành công!');
    navigate('/');
  };

  const navItemClass = (isActive) =>
    `user-sidebar-nav-item flex items-center font-semibold leading-snug duration-200 ${isActive ? 'is-active' : ''
    }`;

  const iconClass = () =>
    'shrink-0 text-center transition-colors duration-200';

  return (
    <div className="user-sidebar-card bg-white shadow-sm border border-slate-100">
      {/* Avatar Section */}
      <div className="user-sidebar-profile text-center bg-slate-50/50 border border-slate-100 relative overflow-hidden">
        <div className="user-sidebar-avatar rounded-full border-[2px] border-white shadow-sm bg-white mx-auto overflow-hidden relative group">
          <div className="absolute inset-0 bg-emerald-500/10 rounded-full scale-110 blur-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <img
            src={user?.avatarUrl || '/assets/assets/img/profiles/avatar-01.jpg'}
            alt={user?.fullName || 'User'}
            className="w-full h-full object-cover relative z-10"
            onError={(e) => {
              e.target.src = '/assets/assets/img/profiles/avatar-01.jpg';
            }}
          />
        </div>
        <h3 className="user-sidebar-name font-extrabold text-slate-800 m-0 leading-tight px-0.5">{user?.fullName || 'Người Chơi'}</h3>
        <p className="user-sidebar-email text-slate-500 font-medium m-0 mt-1 truncate px-0.5" title={user?.email || ''}>{user?.email || '—'}</p>
      </div>

      {/* Navigation Sections */}
      <div className="flex flex-col user-sidebar-nav-stack">

        {/* OVERVIEW */}
        <div>
          <h6 className="user-sidebar-section-title font-bold text-slate-400 uppercase tracking-[0.08em]">Tổng quan</h6>
          <ul className="user-sidebar-link-list flex flex-col m-0 p-0 list-none">
            <li>
              <NavLink to="/user/profile" end className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-${isActive ? 'solid' : 'regular'} fa-user ${iconClass()}`}></i>
                    <span>Hồ sơ của tôi</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/bookings" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-${isActive ? 'solid' : 'regular'} fa-calendar-check ${iconClass()}`}></i>
                    <span>Đặt sân của tôi</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/favorites" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-${isActive ? 'solid' : 'regular'} fa-heart ${iconClass()}`}></i>
                    <span>Sân yêu thích</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/notifications" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-${isActive ? 'solid' : 'regular'} fa-bell ${iconClass()}`}></i>
                    <span>Thông báo</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/chat" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-${isActive ? 'solid' : 'regular'} fa-comments ${iconClass()}`}></i>
                    <span>Trò chuyện</span>
                  </>
                )}
              </NavLink>
            </li>
          </ul>
        </div>

        {/* SOCIAL */}
        <div>
          <h6 className="user-sidebar-section-title font-bold text-slate-400 uppercase tracking-[0.08em]">Cộng đồng</h6>
          <ul className="user-sidebar-link-list flex flex-col m-0 p-0 list-none">
            <li>
              <NavLink to="/user/social/search" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-solid fa-magnifying-glass ${iconClass()}`}></i>
                    <span>Tìm bạn chơi</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/social/friends" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-solid fa-user-group ${iconClass()}`}></i>
                    <span>Bạn bè</span>
                  </>
                )}
              </NavLink>
            </li>
          </ul>
        </div>

        {/* SETTINGS */}
        <div>
          <h6 className="user-sidebar-section-title font-bold text-slate-400 uppercase tracking-[0.08em]">Cài đặt</h6>
          <ul className="user-sidebar-link-list flex flex-col m-0 p-0 list-none">
            <li>
              <NavLink to="/user/profile/edit" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-solid fa-gear ${iconClass()}`}></i>
                    <span>Thiết lập chung</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/profile/manager-info" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-solid fa-file-signature ${iconClass()}`}></i>
                    <span>Trở thành quản lý sân</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/profile/change-password" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-fw fa-solid fa-shield-halved ${iconClass()}`}></i>
                    <span>Bảo mật mật khẩu</span>
                  </>
                )}
              </NavLink>
            </li>
          </ul>
        </div>

      </div>

      {/* Logout Button */}
      <div className="mb-1 px-0.5">
        <button
          type="button"
          className="user-sidebar-logout w-full flex items-center font-semibold"
          onClick={handleLogout}
        >
          <i className="fa-fw fa-solid fa-right-from-bracket shrink-0 text-center"></i>
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
