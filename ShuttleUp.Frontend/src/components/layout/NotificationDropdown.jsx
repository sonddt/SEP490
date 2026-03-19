import { useEffect, useRef } from 'react';

const MOCK_NOTIFICATIONS = [
  { id: 1, avatar: '/assets/img/profiles/avatar-01.jpg', name: 'Nguyễn Văn A', message: 'đã đặt sân của bạn',     detail: 'Sân 1 – ShuttleUp Q7', time: '18:30',          read: false },
  { id: 2, avatar: '/assets/img/profiles/avatar-02.jpg', name: 'Trần Thị B',   message: 'đã huỷ đặt sân',        detail: 'Sân 2 – ShuttleUp Q7', time: '12 phút trước',  read: false },
  { id: 3, avatar: '/assets/img/profiles/avatar-03.jpg', name: 'Lê Văn C',     message: 'thanh toán thành công', detail: '160.000 ₫',             time: '6 phút trước',   read: true  },
  { id: 4, avatar: '/assets/img/profiles/avatar-04.jpg', name: 'Phạm Thị D',   message: 'gửi tin nhắn cho bạn',  detail: '',                      time: '8:30 SA',        read: true  },
];

export default function NotificationDropdown({ open, onToggle, onClose, iconColor = '#555' }) {
  const ref = useRef(null);
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <li className="nav-item dropdown noti-nav" ref={ref} style={{ position: 'relative' }}>

      {/* ── Bell trigger ──────────────────────────────────────────────────── */}
      <a
        href="#"
        className="nav-link position-relative"
        onClick={(e) => { e.preventDefault(); onToggle(); }}
        style={{ padding: '8px 10px', display: 'flex', alignItems: 'center' }}
      >
        <i className="feather-bell" style={{ fontSize: 19, color: iconColor }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 8,
            width: 8, height: 8, borderRadius: '50%',
            background: '#22c55e',
            /* border colour matches both dark & light header */
            border: '2px solid transparent',
            boxShadow: '0 0 0 1.5px #fff',
          }} />
        )}
      </a>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      <div
        className={`dropdown-menu notifications dropdown-menu-end${open ? ' show noti-dropdown-animate' : ''}`}
        style={{
          position: 'absolute', right: 0, top: 'calc(100% + 10px)',
          minWidth: 315, padding: 0, border: 'none',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          borderRadius: 10, overflow: 'hidden', zIndex: 1050,
        }}
      >
        {/* Header */}
        <div className="topnav-dropdown-header" style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          <span className="notification-title" style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Thông báo</span>
          {unreadCount > 0 && (
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, background: '#f0fdf4', padding: '2px 9px', borderRadius: 20 }}>
              {unreadCount} mới
            </span>
          )}
        </div>

        {/* List */}
        <div className="noti-content">
          <ul style={{ maxHeight: 295, overflowY: 'auto', margin: 0, padding: '4px 0', listStyle: 'none', background: '#fff' }}>
            {MOCK_NOTIFICATIONS.map((n) => (
              <li key={n.id} className="notification-message">
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  style={{ display: 'flex', gap: 11, padding: '9px 16px', textDecoration: 'none', background: n.read ? 'transparent' : '#f8fbff', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : '#f8fbff')}
                >
                  <span className="avatar" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', display: 'inline-block' }}>
                    <img className="avatar-img" src={n.avatar} alt={n.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </span>
                  <div className="media-body" style={{ flex: 1, minWidth: 0 }}>
                    <h6 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#1e293b', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                      <span className="notification-time" style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, whiteSpace: 'nowrap' }}>{n.time}</span>
                    </h6>
                    <p className="noti-details" style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                      {n.message}
                      {n.detail && <span className="noti-title" style={{ fontWeight: 500, color: '#334155' }}> {n.detail}</span>}
                    </p>
                  </div>
                  {!n.read && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0, marginTop: 5 }} />
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div style={{ padding: '9px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center', background: '#fff' }}>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            Xem tất cả thông báo
          </a>
        </div>
      </div>
    </li>
  );
}
