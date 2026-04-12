import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function DropItem({ to, icon, label, onNav }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onNav(to)}
      onKeyDown={(e) => { if (e.key === 'Enter') onNav(to); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 18px', color: '#475569', fontSize: 14,
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <i className={icon} style={{ fontSize: 15, color: '#94a3b8', width: 18, textAlign: 'center' }} />
      {label}
    </div>
  );
}

export default function UserDropdown({
  user, isAdmin, isManager,
  profilePath = '/user/profile',
  showManagerAccess,
  showSwitchToPlayer = false,
  switchToPlayerPath = '/',
  open, onToggle, onClose, onLogout,
  iconColor = '#555',
  avatarSize = 33,
}) {
  const fallbackAvatar = '/assets/img/profiles/avatar-01.jpg';
  const ref = useRef(null);
  const navigate = useNavigate();

  const handleNav = (path) => {
    onClose();
    navigate(path);
  };

  const handleManagerAccess = () => {
    const managerStatus = user?.managerStatus;
    if (managerStatus === 'APPROVED' || isManager) {
      handleNav('/manager/venues');
    } else {
      handleNav('/profile');
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const roleName = isAdmin ? 'Admin' : isManager ? 'Chủ Sân' : 'Người chơi';

  return (
    <li className="nav-item dropdown logged-item" ref={ref} style={{ position: 'relative', marginLeft: 2 }}>
      {/* Trigger */}
      <a
        href="#"
        className="nav-link"
        onClick={(e) => { e.preventDefault(); onToggle(); }}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 6px' }}
      >
        <span className="user-img">
          <img
            className="rounded-circle"
            src={user?.avatarUrl || fallbackAvatar}
            alt={user?.fullName || user?.email || 'User'}
            style={{ width: avatarSize, height: avatarSize, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.55)', borderRadius: '50%' }}
          />
        </span>
        <i
          className="fas fa-chevron-down"
          style={{
            fontSize: 9, color: iconColor,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </a>

      {/* Dropdown */}
      <div
        className={`dropdown-menu dropdown-menu-end${open ? ' show noti-dropdown-animate' : ''}`}
        style={{
          position: 'absolute', right: 0, top: 'calc(100% + 10px)',
          minWidth: 220, padding: 0, border: 'none',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          borderRadius: 10, overflow: 'hidden', zIndex: 1050,
        }}
      >
        {/* Header */}
        <div
          className="user-header"
          style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11, background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}
        >
          <div className="avatar avatar-sm" style={{ flexShrink: 0 }}>
            <img
                src={user?.avatarUrl || fallbackAvatar}
                alt={user?.fullName || user?.email || 'User'}
              className="avatar-img rounded-circle"
              style={{ width: 40, height: 40, objectFit: 'cover', border: '2px solid #e2e8f0', borderRadius: '50%' }}
            />
          </div>
          <div className="user-text" style={{ overflow: 'hidden' }}>
            <h6 style={{ margin: '0 0 1px', fontSize: 14, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.fullName || user?.email}
            </h6>
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
              {roleName}
            </span>
          </div>
        </div>

        {/* Menu items */}
        {!isAdmin ? (
          <div style={{ padding: '6px 0', background: '#fff' }}>
            <DropItem to={profilePath} icon="feather-user" label="Hồ sơ của tôi" onNav={handleNav} />

            {(showSwitchToPlayer || (isManager && showSwitchToPlayer)) && (
              <DropItem to={switchToPlayerPath} icon="feather-refresh-cw" label="Chế độ người chơi" onNav={handleNav} />
            )}

            {(showManagerAccess ?? isManager) && (
              <div
                role="button"
                tabIndex={0}
                onClick={handleManagerAccess}
                onKeyDown={(e) => { if (e.key === 'Enter') handleManagerAccess(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 18px', color: '#475569', fontSize: 14,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <i className="feather-briefcase" style={{ fontSize: 15, color: '#94a3b8', width: 18, textAlign: 'center' }} />
                Quản lý sân
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '6px 0', background: '#fff' }}>
            <DropItem to="/admin/dashboard" icon="feather-shield" label="Trang Quản trị" onNav={handleNav} />
          </div>
        )}

        {/* Logout */}
        <div style={{ borderTop: '1px solid #f1f5f9', background: '#fff' }}>
          <button
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 18px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#ef4444', fontSize: 14, transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fff5f5')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <i className="feather-log-out" style={{ fontSize: 15, width: 18, textAlign: 'center' }} />
            Đăng xuất
          </button>
        </div>
      </div>
    </li>
  );
}
