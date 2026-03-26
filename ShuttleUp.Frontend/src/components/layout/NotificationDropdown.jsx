import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, markNotificationRead } from '../../api/notificationsApi';
import { useUnreadNotificationCount } from '../../hooks/useUnreadNotificationCount';
import { refreshNotificationBadge } from '../../utils/appToast';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export default function NotificationDropdown({ open, onToggle, onClose, iconColor = '#555', iconSize = 19 }) {
  const ref = useRef(null);
  const { user, isAuthenticated } = useAuth();
  const { count: unreadCount, refresh: refreshCount } = useUnreadNotificationCount();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const isManager = user?.roles?.includes('MANAGER');
  const allLink = isManager ? '/manager/notifications' : '/user/notifications';

  const loadList = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const rows = await getNotifications({ take: 8 });
      setItems(Array.isArray(rows) ? rows : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    loadList();
  }, [open, isAuthenticated, loadList]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const handleClickItem = async (n) => {
    if (!n?.id || n.isRead) return;
    try {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      refreshCount();
      refreshNotificationBadge();
    } catch {
      /* ignore */
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <li className="nav-item dropdown noti-nav" ref={ref} style={{ position: 'relative' }}>

      <a
        href="#"
        className="nav-link position-relative"
        onClick={(e) => { e.preventDefault(); onToggle(); }}
        style={{ padding: '8px 10px', display: 'flex', alignItems: 'center' }}
      >
        <i className="feather-bell" style={{ fontSize: iconSize, color: iconColor }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 6,
            minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
            background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </a>

      <div
        className={`dropdown-menu notifications dropdown-menu-end${open ? ' show noti-dropdown-animate' : ''}`}
        style={{
          position: 'absolute', right: 0, top: 'calc(100% + 10px)',
          minWidth: 315, padding: 0, border: 'none',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          borderRadius: 10, overflow: 'hidden', zIndex: 1050,
        }}
      >
        <div className="topnav-dropdown-header" style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          <span className="notification-title" style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Thông báo</span>
          {unreadCount > 0 && (
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, background: '#f0fdf4', padding: '2px 9px', borderRadius: 20 }}>
              {unreadCount} mới
            </span>
          )}
        </div>

        <div className="noti-content">
          <ul style={{ maxHeight: 295, overflowY: 'auto', margin: 0, padding: '4px 0', listStyle: 'none', background: '#fff' }}>
            {loading && (
              <li className="px-3 py-3 text-muted small">Đang tải…</li>
            )}
            {!loading && items.length === 0 && (
              <li className="px-3 py-4 text-center text-muted small">Chưa có thông báo</li>
            )}
            {!loading && items.map((n) => (
              <li key={n.id} className="notification-message">
                <button
                  type="button"
                  onClick={() => handleClickItem(n)}
                  style={{
                    display: 'flex', gap: 11, padding: '9px 16px', width: '100%', textAlign: 'left',
                    border: 'none', background: n.isRead ? 'transparent' : '#f8fbff', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, flexShrink: 0, borderRadius: '50%',
                    background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  >
                    <i className="feather-bell" style={{ color: '#097E52', fontSize: 16 }} />
                  </div>
                  <div className="media-body" style={{ flex: 1, minWidth: 0 }}>
                    <h6 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#1e293b', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                      <span className="notification-time" style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, whiteSpace: 'nowrap' }}>
                        {formatTime(n.createdAt)}
                      </span>
                    </h6>
                    {n.body && (
                      <p className="noti-details" style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                        {n.body}
                      </p>
                    )}
                  </div>
                  {!n.isRead && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0, marginTop: 5 }} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ padding: '9px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center', background: '#fff' }}>
          <Link to={allLink} onClick={onClose} style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            Xem tất cả thông báo
          </Link>
        </div>
      </div>
    </li>
  );
}
