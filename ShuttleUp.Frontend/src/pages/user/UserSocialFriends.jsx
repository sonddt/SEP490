import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-user-group text-emerald-600"></i>
              Bạn bè & Kết nối
            </h2>
            <p className="text-slate-500 text-sm m-0">Quản lý danh bạn và các lời mời kết nối từ cộng đồng.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/user/social/search" className="btn btn-emerald-soft font-bold rounded-xl px-4 flex items-center gap-2">
              <i className="fa-solid fa-user-plus text-sm"></i>
              Tìm thêm bạn
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === t.key ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'received' && incoming.length > 0 && (
              <span className="ms-2 px-15 py-0.5 bg-rose-500 text-white text-[10px] rounded-full">{incoming.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
           <div className="flex flex-col items-center gap-3">
             <i className="fa-solid fa-circle-notch fa-spin text-emerald-500 text-3xl"></i>
             <p className="text-slate-400 font-medium anim-pulse">Đang tải danh sách...</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tab === 'friends' && (
            <>
              {friends.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-users-slash text-slate-300 text-3xl"></i>
                  </div>
                  <h4 className="text-slate-800 font-bold mb-1">Chưa có bạn bè</h4>
                  <p className="text-slate-400 text-sm max-w-xs">Hãy tìm kiếm bạn bè qua Email hoặc Tên để cùng nhau tập luyện nhé!</p>
                  <Link to="/user/social/search" className="btn btn-emerald font-bold rounded-xl mt-4 px-6 border-0">Tìm ngay</Link>
                </div>
              )}
              {friends.map((x) => {
                const id = x.id ?? x.Id;
                const name = x.fullName ?? x.FullName ?? '';
                const av = x.avatarUrl ?? x.AvatarUrl;
                return (
                  <div key={id} className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-emerald-100 transition-all shadow-sm hover:shadow-md group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="shrink-0 relative">
                        {av ? (
                          <img src={av} alt="" className="w-14 h-14 rounded-2xl object-cover ring-4 ring-slate-50 group-hover:ring-emerald-50 transition-all" />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl ring-4 ring-slate-50 transition-all">
                            {name.charAt(0)}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div className="min-w-0">
                        <Link to={`/user/profile/${id}`} className="block no-underline">
                          <h6 className="text-[15px] font-bold text-slate-800 m-0 group-hover:text-emerald-700 transition-colors truncate">{name}</h6>
                        </Link>
                        <p className="text-[11px] text-slate-400 m-0 uppercase font-bold tracking-wider pt-0.5">Thành viên</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-50 flex items-center justify-center">
                      <RelationshipActions
                        otherUserId={id}
                        onChanged={loadAll}
                        chatPeerFullName={name}
                        chatPeerAvatarUrl={av}
                      />
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {tab === 'received' && (
            <>
              {incoming.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                   <i className="fa-solid fa-envelope-open text-slate-200 text-5xl mb-4"></i>
                   <p className="text-slate-400 font-medium">Không có lời mời nào đang chờ bạn.</p>
                </div>
              )}
              {incoming.map((x) => {
                const fromId = x.fromUserId ?? x.FromUserId;
                const name = x.fullName ?? x.FullName ?? '';
                const av = x.avatarUrl ?? x.AvatarUrl;
                const reqId = x.id ?? x.Id;
                return (
                  <div key={reqId} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col items-center text-center mb-4">
                      {av ? (
                        <img src={av} alt="" className="w-20 h-20 rounded-full object-cover mb-3 ring-4 ring-emerald-50 shadow-sm" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-2xl mb-3 ring-4 ring-slate-50">
                          {name.charAt(0)}
                        </div>
                      )}
                      <h6 className="text-base font-bold text-slate-800 m-0">{name}</h6>
                      <p className="text-xs text-slate-400">Muốn kết nối với bạn</p>
                    </div>
                    <div className="pt-4 border-t border-slate-50">
                      <RelationshipActions
                        otherUserId={fromId}
                        initialState="PENDING_IN"
                        initialRequestId={reqId}
                        onChanged={onAcceptDecline}
                      />
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {tab === 'sent' && (
            <>
              {sent.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                   <i className="fa-solid fa-paper-plane text-slate-200 text-5xl mb-4"></i>
                   <p className="text-slate-400 font-medium">Bạn chưa gửi lời mời nào.</p>
                </div>
              )}
              {sent.map((x) => {
                const toId = x.toUserId ?? x.ToUserId;
                const name = x.fullName ?? x.FullName ?? '';
                const av = x.avatarUrl ?? x.AvatarUrl;
                return (
                  <div key={toId} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {av ? (
                        <img src={av} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold">
                          {name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h6 className="text-sm font-bold text-slate-800 m-0 truncate">{name}</h6>
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100 uppercase">Đang chờ</span>
                      </div>
                    </div>
                    <RelationshipActions otherUserId={toId} onChanged={loadAll} />
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
