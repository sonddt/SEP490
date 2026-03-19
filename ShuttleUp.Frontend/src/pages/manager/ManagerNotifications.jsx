import { useState } from 'react';

const INITIAL = [
  { id: 1, avatar: '/assets/img/profiles/avatar-01.jpg', title: 'Nguyễn Văn A', message: 'đã đặt Sân 1 – ShuttleUp Q7', detail: '15/03/2026 08:00 – 10:00', time: '5 phút trước', read: false, type: 'booking' },
  { id: 2, avatar: '/assets/img/profiles/avatar-02.jpg', title: 'Trần Thị B', message: 'đã huỷ đặt sân', detail: 'Sân 2 – ShuttleUp Q7', time: '15 phút trước', read: false, type: 'cancel' },
  { id: 3, avatar: null, title: 'Hệ thống', message: 'Thanh toán đã được xác nhận', detail: '240.000 ₫ từ Lê Văn C', time: '1 giờ trước', read: false, type: 'payment' },
  { id: 4, avatar: '/assets/img/profiles/avatar-03.jpg', title: 'Lê Văn C', message: 'gửi tin nhắn cho bạn', detail: '"Cho hỏi sân còn trống không ạ?"', time: '2 giờ trước', read: true, type: 'message' },
  { id: 5, avatar: null, title: 'Hệ thống', message: 'Cụm sân ShuttleUp Q7 đã được duyệt', detail: '', time: 'Hôm qua', read: true, type: 'system' },
  { id: 6, avatar: '/assets/img/profiles/avatar-04.jpg', title: 'Phạm Thị D', message: 'đã đánh giá cụm sân của bạn', detail: '⭐ 5 sao', time: 'Hôm qua', read: true, type: 'review' },
  { id: 7, avatar: null, title: 'Hệ thống', message: 'Doanh thu tháng 2 đã được tổng hợp', detail: '8.500.000 ₫', time: '2 ngày trước', read: true, type: 'system' },
];

const typeIcon = {
  booking: { icon: 'feather-calendar', color: '#2563eb', bg: '#eff6ff' },
  cancel:  { icon: 'feather-x-circle', color: '#ef4444', bg: '#fef2f2' },
  payment: { icon: 'feather-credit-card', color: '#10b981', bg: '#ecfdf5' },
  message: { icon: 'feather-message-circle', color: '#8b5cf6', bg: '#f5f3ff' },
  system:  { icon: 'feather-info', color: '#64748b', bg: '#f8fafc' },
  review:  { icon: 'feather-star', color: '#f59e0b', bg: '#fffbeb' },
};

export default function ManagerNotifications() {
  const [notifications, setNotifications] = useState(INITIAL);
  const [filterTab, setFilterTab] = useState('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  const filtered = filterTab === 'all'
    ? notifications
    : filterTab === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications.filter((n) => n.type === filterTab);

  return (
    <>
      {/* Toolbar */}
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
                <i className="feather-check-circle me-1" />Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notification list */}
      <div className="card border-0 shadow-sm">
        {filtered.length === 0 ? (
          <div className="card-body text-center py-5">
            <i className="feather-bell-off" style={{ fontSize: 48, color: '#cbd5e1' }} />
            <p className="text-muted mt-3 mb-0">Không có thông báo nào</p>
          </div>
        ) : (
          <div className="list-group list-group-flush">
            {filtered.map((n) => {
              const ti = typeIcon[n.type] || typeIcon.system;
              return (
                <div
                  key={n.id}
                  className="list-group-item border-0"
                  style={{
                    padding: '14px 20px',
                    background: n.read ? '#fff' : '#f8fbff',
                    cursor: n.read ? 'default' : 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <div className="d-flex gap-3 align-items-start">
                    {/* Icon or avatar */}
                    {n.avatar ? (
                      <img src={n.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: ti.bg, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <i className={ti.icon} style={{ fontSize: 17, color: ti.color }} />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <strong style={{ fontSize: 14, color: '#1e293b' }}>{n.title}</strong>
                          <span style={{ fontSize: 13, color: '#64748b' }}> {n.message}</span>
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{n.time}</span>
                      </div>
                      {n.detail && (
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>{n.detail}</p>
                      )}
                    </div>

                    {!n.read && (
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
