import { useState } from 'react';
import { Link } from 'react-router-dom';
import socialApi from '../../api/socialApi';

const defaultAvatar = '/assets/img/profiles/avatar-01.jpg';

function sameUserId(a, b) {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export default function MatchingMembers({
  members = [],
  isHost = false,
  onKick,
  hostUserId,
  currentUserId,
}) {
  const [friendBusy, setFriendBusy] = useState({});
  const [friendSent, setFriendSent] = useState({});

  const sendFriend = async (userId) => {
    if (!userId) return;
    setFriendBusy((b) => ({ ...b, [userId]: true }));
    try {
      await socialApi.sendFriendRequest(userId);
      setFriendSent((s) => ({ ...s, [userId]: true }));
    } catch (e) {
      const msg = e.response?.data?.message || 'Chưa gửi được lời mời — thử lại sau.';
      alert(msg);
    } finally {
      setFriendBusy((b) => ({ ...b, [userId]: false }));
    }
  };

  if (members.length === 0) {
    return (
      <div className="matching-members-panel">
        <p className="text-muted text-center py-3">Chưa có thành viên nào.</p>
      </div>
    );
  }

  return (
    <div className="matching-members-panel">
      {members.map((m) => {
        const uid = m.userId;
        const isSelf = sameUserId(uid, currentUserId);
        const canKick =
          isHost &&
          onKick &&
          m.memberId &&
          hostUserId != null &&
          uid != null &&
          !sameUserId(uid, hostUserId);
        const showFriendBtn = uid && !isSelf;

        return (
          <div key={m.memberId || m.userId} className="matching-member-row">
            <div className="matching-member-info">
              {uid ? (
                <Link
                  to={`/user/profile/${uid}`}
                  className="matching-member-avatar-link"
                  title="Xem trang cá nhân"
                >
                  <img
                    src={m.avatarUrl || defaultAvatar}
                    alt={m.fullName}
                    className="matching-member-avatar"
                  />
                </Link>
              ) : (
                <img
                  src={m.avatarUrl || defaultAvatar}
                  alt={m.fullName}
                  className="matching-member-avatar"
                />
              )}
              <div>
                {uid ? (
                  <Link
                    to={`/user/profile/${uid}`}
                    className="matching-member-name text-decoration-none text-dark"
                  >
                    {m.fullName}
                  </Link>
                ) : (
                  <span className="matching-member-name">{m.fullName}</span>
                )}
                <div className="matching-member-meta">
                  {m.skillLevel && <span className="badge-sm">{m.skillLevel}</span>}
                  {m.gender && <span className="badge-sm">{m.gender}</span>}
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              {showFriendBtn && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  disabled={friendBusy[uid] || friendSent[uid]}
                  onClick={() => sendFriend(uid)}
                  title="Gửi lời mời kết bạn"
                >
                  {friendSent[uid] ? 'Đã gửi' : friendBusy[uid] ? '...' : 'Kết bạn'}
                </button>
              )}
              {canKick && (
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onKick(m.memberId)}
                  title="Xóa khỏi nhóm"
                >
                  <i className="feather-x"></i>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
