import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/user/profile',                   label: 'Hồ sơ',        end: true },
  { to: '/user/profile/manager-info',      label: 'Thông tin quản lý', end: false },
  { to: '/user/profile/change-password',   label: 'Đổi mật khẩu', end: false },
  { to: '/user/profile/other-settings',    label: 'Cài đặt khác', end: false },
];

export default function UserProfileTabs() {
  return (
    <div className="coach-court-list profile-court-list">
      <ul className="nav">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
