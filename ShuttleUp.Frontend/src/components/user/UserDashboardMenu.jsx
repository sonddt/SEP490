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
    `flex items-center gap-3 px-4 py-2.5 rounded-[12px] font-semibold text-[14.5px] transition-all duration-300 ${
      isActive
        ? 'text-white bg-emerald-600 shadow-[0_4px_12px_rgba(5,150,105,0.3)]'
        : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-50'
    }`;

  const iconClass = (isActive) =>
    `w-6 text-center text-lg transition-transform duration-300 ${
      isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-emerald-500 group-hover:scale-110'
    }`;

  return (
    <div className="bg-white rounded-[24px] shadow-sm sticky top-[100px] border border-slate-100 p-4">
      {/* Avatar Section */}
      <div className="p-4 text-center mb-6 bg-slate-50/50 rounded-2xl border border-slate-100 relative overflow-hidden">
        <div className="w-16 h-16 rounded-full border-[3px] border-white shadow-sm bg-white mx-auto mb-3 overflow-hidden relative group">
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
        <h3 className="text-[15px] font-extrabold text-slate-800 m-0 leading-tight">{user?.fullName || 'Người Chơi'}</h3>
        <p className="text-[12px] text-slate-500 font-medium m-0 mt-1 truncate">{user?.email || '—'}</p>
      </div>

      {/* Navigation Sections */}
      <div className="space-y-6">
        
        {/* OVERVIEW */}
        <div>
          <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-2 px-4">Tổng quan</h6>
          <ul className="space-y-1 m-0 p-0 list-none">
            <li>
              <NavLink to="/user/profile" end className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-${isActive ? 'solid' : 'regular'} fa-user ${iconClass(isActive)}`}></i>
                    <span>Hồ sơ của tôi</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/bookings" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-${isActive ? 'solid' : 'regular'} fa-calendar-check ${iconClass(isActive)}`}></i>
                    <span>Đặt sân của tôi</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/favorites" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-${isActive ? 'solid' : 'regular'} fa-heart ${iconClass(isActive)}`}></i>
                    <span>Sân yêu thích</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/notifications" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-${isActive ? 'solid' : 'regular'} fa-bell ${iconClass(isActive)}`}></i>
                    <span>Thông báo</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/chat" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-${isActive ? 'solid' : 'regular'} fa-comments ${iconClass(isActive)}`}></i>
                    <span>Trò chuyện</span>
                  </>
                )}
              </NavLink>
            </li>
          </ul>
        </div>

        {/* SOCIAL */}
        <div>
          <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-2 px-4">Cộng đồng</h6>
          <ul className="space-y-1 m-0 p-0 list-none">
            <li>
              <NavLink to="/user/social/search" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-solid fa-magnifying-glass ${iconClass(isActive)}`}></i>
                    <span>Tìm bạn chơi</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/social/friends" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-${isActive ? 'solid' : 'regular'} fa-handshake ${iconClass(isActive)}`}></i>
                    <span>Bạn bè</span>
                  </>
                )}
              </NavLink>
            </li>
          </ul>
        </div>

        {/* SETTINGS */}
        <div>
          <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-2 px-4">Cài đặt</h6>
          <ul className="space-y-1 m-0 p-0 list-none">
            <li>
              <NavLink to="/user/profile/edit" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-solid fa-gear ${iconClass(isActive)}`}></i>
                    <span>Thiết lập chung</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/profile/manager-info" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-solid fa-file-signature ${iconClass(isActive)}`}></i>
                    <span>Trở thành quản lý sân</span>
                  </>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/user/profile/change-password" className={({ isActive }) => navItemClass(isActive) + ' group'}>
                {({ isActive }) => (
                  <>
                    <i className={`fa-solid fa-shield-halved ${iconClass(isActive)}`}></i>
                    <span>Bảo mật mật khẩu</span>
                  </>
                )}
              </NavLink>
            </li>
          </ul>
        </div>

      </div>

      {/* Logout Button */}
      <div className="mt-8 mb-2 px-1">
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-[14.5px] text-rose-500 hover:bg-rose-50 hover:text-rose-600 hover:shadow-[0_4px_12px_rgba(244,63,94,0.1)] transition-all duration-300"
          onClick={handleLogout}
        >
          <i className="fa-solid fa-right-from-bracket w-6 text-center text-lg"></i>
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
