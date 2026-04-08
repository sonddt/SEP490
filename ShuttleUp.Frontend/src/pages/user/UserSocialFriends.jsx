import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import RelationshipActions from '../../components/user/RelationshipActions';
import socialApi from '../../api/socialApi';
import { notifyWarning } from '../../hooks/useNotification';

const TABS = [
  { key: 'friends', label: 'Bạn bè' },
  { key: 'received', label: 'Đã nhận' },
  { key: 'sent', label: 'Đã gửi' },
];

export default function UserSocialFriends() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'friends';

  const setTab = (key) => {
    setSearchParams(key === 'friends' ? {} : { tab: key });
  };

  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [f, inc, s] = await Promise.all([
        socialApi.getFriends(),
        socialApi.incomingRequests(),
        socialApi.sentRequests(),
      ]);
      setFriends(Array.isArray(f) ? f : []);
      setIncoming(Array.isArray(inc) ? inc : []);
      setSent(Array.isArray(s) ? s : []);
    } catch (e) {
      notifyWarning(e?.response?.data?.message || 'Không tải được danh sách.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onAcceptDecline = () => loadAll();

  const rowAvatar = (url, name) =>
    url ? (
      <img src={url} alt="" className="rounded-circle me-2" style={{ width: 44, height: 44, objectFit: 'cover' }} />
    ) : (
      <div
        className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center me-2"
        style={{ width: 44, height: 44, color: '#64748b' }}
      >
        {(name || '?').charAt(0)}
      </div>
    );

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Bạn bè & lời mời</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Bạn bè</li>
          </ul>
        </div>
      </section>

      <UserDashboardMenu />

      <div className="content court-bg" style={{ paddingTop: 40 }}>
        <div className="container">
          <div className="mb-3">
            <Link to="/user/social/search" className="btn btn-outline-primary btn-sm">
              Tìm thêm bạn
            </Link>
          </div>

          <ul className="nav nav-tabs mb-3">
            {TABS.map((t) => (
              <li className="nav-item" key={t.key}>
                <button
                  type="button"
                  className={`nav-link ${tab === t.key ? 'active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>

          {loading && <p className="text-muted">Đang tải…</p>}

          {!loading && tab === 'friends' && (
            <ul className="list-group list-group-flush shadow-sm rounded">
              {friends.length === 0 && (
                <li className="list-group-item text-muted">Chưa có bạn bè — hãy tìm qua email hoặc tên.</li>
              )}
              {friends.map((x) => {
                const id = x.id ?? x.Id;
                const name = x.fullName ?? x.FullName ?? '';
                const av = x.avatarUrl ?? x.AvatarUrl;
                return (
                  <li key={id} className="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center">
                      {rowAvatar(av, name)}
                      <Link to={`/user/profile/${id}`} style={{ color: '#1e293b', fontWeight: 600 }}>
                        {name}
                      </Link>
                    </div>
                    <RelationshipActions
                      otherUserId={id}
                      onChanged={loadAll}
                      chatPeerFullName={name}
                      chatPeerAvatarUrl={av}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && tab === 'received' && (
            <ul className="list-group list-group-flush shadow-sm rounded">
              {incoming.length === 0 && (
                <li className="list-group-item text-muted">Không có lời mời đang chờ.</li>
              )}
              {incoming.map((x) => {
                const fromId = x.fromUserId ?? x.FromUserId;
                const name = x.fullName ?? x.FullName ?? '';
                const av = x.avatarUrl ?? x.AvatarUrl;
                const reqId = x.id ?? x.Id;
                return (
                  <li key={reqId} className="list-group-item">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                      <div className="d-flex align-items-center">
                        {rowAvatar(av, name)}
                        <Link to={`/user/profile/${fromId}`} style={{ color: '#1e293b', fontWeight: 600 }}>
                          {name}
                        </Link>
                      </div>
                    </div>
                    <RelationshipActions
                      otherUserId={fromId}
                      initialState="PENDING_IN"
                      initialRequestId={reqId}
                      onChanged={onAcceptDecline}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && tab === 'sent' && (
            <ul className="list-group list-group-flush shadow-sm rounded">
              {sent.length === 0 && (
                <li className="list-group-item text-muted">Bạn chưa gửi lời mời nào đang chờ.</li>
              )}
              {sent.map((x) => {
                const toId = x.toUserId ?? x.ToUserId;
                const name = x.fullName ?? x.FullName ?? '';
                const av = x.avatarUrl ?? x.AvatarUrl;
                return (
                  <li key={toId} className="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center">
                      {rowAvatar(av, name)}
                      <Link to={`/user/profile/${toId}`} style={{ color: '#1e293b', fontWeight: 600 }}>
                        {name}
                      </Link>
                    </div>
                    <RelationshipActions otherUserId={toId} onChanged={loadAll} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
