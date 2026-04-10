import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-bell text-amber-500"></i>
              Thông báo
            </h2>
            <p className="text-slate-500 text-sm m-0">Cập nhật tin tức mới nhất về đặt sân và hệ thống.</p>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button type="button" className="btn btn-emerald-soft btn-sm font-bold" onClick={markAll}>
                <i className="fa-solid fa-check-double me-2" />
                Đọc tất cả
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mt-6 pt-6 border-t border-slate-50">
          {[
            { key: 'all', label: 'Tất cả', icon: 'fa-list' },
            { key: 'unread', label: `Chưa đọc (${unreadCount})`, icon: 'fa-envelope-open' },
            { key: 'BOOKING', label: 'Đặt sân', icon: 'fa-calendar-alt' },
            { key: 'PAYMENT', label: 'Thanh toán', icon: 'fa-credit-card' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filterTab === t.key
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setFilterTab(t.key)}
            >
              <i className={`fa-solid ${t.icon} text-[12px]`}></i>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
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
                        onClick={() => handleOpen(n)}
                        className={`group relative p-4 transition-all duration-300 hover:bg-slate-50 border-b border-slate-50 last:border-0 cursor-pointer ${
                          !n.isRead ? 'bg-emerald-50/30' : ''
                        }`}
                      >
                        <div className="flex gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                            n.type?.includes('BOOKING') ? 'bg-emerald-100 text-emerald-600' : 
                            n.type?.includes('PAYMENT') ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <i className={`fa-solid ${
                              n.type?.includes('BOOKING') ? 'fa-calendar-check' : 
                              n.type?.includes('PAYMENT') ? 'fa-credit-card' : 'fa-bell'
                            } text-lg`}></i>
                          </div>
                          
                          <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <h6 className={`text-[15px] m-0 truncate pr-8 ${!n.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-600'}`}>
                                {n.title}
                              </h6>
                              <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-full border border-slate-100">
                                {formatTime(n.createdAt)}
                              </span>
                            </div>
                            <p className={`text-[13px] m-0 line-clamp-2 leading-relaxed ${!n.isRead ? 'text-slate-700' : 'text-slate-500'}`}>
                              {n.message}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {!n.isRead && (
                              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200"></div>
                            )}
                            <button
                              type="button"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                              onClick={(e) => handleDelete(e, n.id)}
                              title="Xóa thông báo"
                            >
                              <i className="fa-solid fa-trash-can text-sm"></i>
                            </button>
                          </div>
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
  );
}
