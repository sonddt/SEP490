import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../../api/notificationsApi';
import { refreshNotificationBadge } from '../../utils/appToast';
import { getNotificationTargetPath } from '../../utils/notificationNavigation';

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

const PAGE_SIZE = 20;

export default function UserNotifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [filterTab, setFilterTab] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotifications({ take: PAGE_SIZE });
      setItems(res.items);
      setHasMore(res.hasMore);
      setNextBefore(res.nextBefore);
    } catch {
      setItems([]);
      setHasMore(false);
      setNextBefore(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!nextBefore || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getNotifications({ take: PAGE_SIZE, before: nextBefore });
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
      setNextBefore(res.nextBefore);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  const unreadCount = useMemo(() => items.filter((n) => !n.isRead).length, [items]);

  const filtered = useMemo(() => {
    if (filterTab === 'all') return items;
    if (filterTab === 'unread') return items.filter((n) => !n.isRead);
    return items.filter((n) => (n.type || '').toUpperCase().includes(filterTab.toUpperCase()));
  }, [items, filterTab]);

  const handleOpen = async (n) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        refreshNotificationBadge();
      } catch {
        /* ignore */
      }
    }
    const path = getNotificationTargetPath(n.metadataJson, false);
    if (path) navigate(path);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      refreshNotificationBadge();
    } catch {
      /* ignore */
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshNotificationBadge();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Thông báo</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Thông báo</li>
          </ul>
        </div>
      </section>

      <UserDashboardMenu />

      <div className="content court-bg">
        <div className="container">

          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body py-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex gap-2 flex-wrap">
                  {[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'unread', label: `Chưa đọc (${unreadCount})` },
                    { key: 'BOOKING', label: 'Đặt sân' },
                    { key: 'PAYMENT', label: 'Thanh toán' },
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
                  <button type="button" className="btn btn-sm btn-link text-secondary" onClick={markAll}>
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
                <p className="text-muted mt-3 mb-0">Chưa có thông báo nào</p>
              </div>
            ) : (
              <>
                <div className="list-group list-group-flush">
                  {filtered.map((n) => {
                    const ti = typeIcon[n.type] || typeIcon.SYSTEM;
                    const hasTarget = !!getNotificationTargetPath(n.metadataJson, false);
                    return (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        className="list-group-item border-0"
                        style={{
                          padding: '14px 20px',
                          background: n.isRead ? '#fff' : '#f8fbff',
                          cursor: hasTarget || !n.isRead ? 'pointer' : 'default',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                        onClick={() => handleOpen(n)}
                        onKeyDown={(e) => e.key === 'Enter' && handleOpen(n)}
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
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0, marginTop: 6 }} />
                          )}
                          <button
                            type="button"
                            className="btn btn-link text-muted p-0"
                            style={{ flexShrink: 0, fontSize: 16, lineHeight: 1 }}
                            title="Ẩn thông báo"
                            aria-label="Ẩn thông báo"
                            onClick={(e) => handleDelete(e, n.id)}
                          >
                            <i className="feather-trash-2" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hasMore && (
                  <div className="card-body text-center border-top py-3">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      disabled={loadingMore}
                      onClick={loadMore}
                    >
                      {loadingMore ? 'Đang tải…' : 'Xem thêm'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
