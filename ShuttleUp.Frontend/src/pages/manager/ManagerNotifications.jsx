import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/notificationsApi';
import { refreshNotificationBadge } from '../../utils/appToast';

const typeIcon = {
  BOOKING: { icon: 'feather-calendar', color: '#2563eb', bg: '#eff6ff' },
  BOOKING_NEW: { icon: 'feather-calendar', color: '#2563eb', bg: '#eff6ff' },
  PAYMENT_PROOF: { icon: 'feather-credit-card', color: '#10b981', bg: '#ecfdf5' },
  SYSTEM: { icon: 'feather-info', color: '#64748b', bg: '#f8fafc' },
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN');
}

export default function ManagerNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getNotifications({ take: 100 });
      setNotifications(Array.isArray(rows) ? rows : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const filtered = useMemo(() => {
    if (filterTab === 'all') return notifications;
    if (filterTab === 'unread') return notifications.filter((n) => !n.isRead);
    if (filterTab === 'booking') {
      return notifications.filter((n) => {
        const t = (n.type || '').toUpperCase();
        return t.includes('BOOKING');
      });
    }
    if (filterTab === 'payment') {
      return notifications.filter((n) => (n.type || '').toUpperCase().includes('PAYMENT'));
    }
    if (filterTab === 'system') {
      return notifications.filter((n) => (n.type || '').toUpperCase() === 'SYSTEM');
    }
    return notifications.filter((n) => (n.type || '').toUpperCase() === filterTab.toUpperCase());
  }, [notifications, filterTab]);

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshNotificationBadge();
    } catch {
      /* ignore */
    }
  };

  const markRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      refreshNotificationBadge();
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'unread', label: `Chưa đọc (${unreadCount})` },
                { key: 'booking', label: 'Đặt sân' },
                { key: 'payment', label: 'Thanh toán' },
                { key: 'system', label: 'Hệ thống' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`btn btn-sm ${filterTab === t.key ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => setFilterTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button type="button" className="btn btn-sm btn-link text-secondary" onClick={markAllRead}>
                <i className="feather-check-circle me-1" />
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        {loading ? (
          <div className="card-body text-center py-5 text-muted">Đang tải…</div>
        ) : filtered.length === 0 ? (
          <div className="card-body text-center py-5">
            <i className="feather-bell-off" style={{ fontSize: 48, color: '#cbd5e1' }} />
            <p className="text-muted mt-3 mb-0">Không có thông báo nào</p>
          </div>
        ) : (
          <div className="list-group list-group-flush">
            {filtered.map((n) => {
              const ti = typeIcon[n.type] || typeIcon.SYSTEM;
              return (
                <div
                  key={n.id}
                  className="list-group-item border-0"
                  style={{
                    padding: '14px 20px',
                    background: n.isRead ? '#fff' : '#f8fbff',
                    cursor: n.isRead ? 'default' : 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => !n.isRead && markRead(n.id)}
                  onKeyDown={(e) => e.key === 'Enter' && !n.isRead && markRead(n.id)}
                >
                  <div className="d-flex gap-3 align-items-start">
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: ti.bg, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                    >
                      <i className={ti.icon} style={{ fontSize: 17, color: ti.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <strong style={{ fontSize: 14, color: '#1e293b' }}>{n.title}</strong>
                          {n.body && (
                            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{n.body}</p>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {formatTime(n.createdAt)}
                        </span>
                      </div>
                    </div>
                    {!n.isRead && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
