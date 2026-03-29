const defaultAvatar = '/assets/img/profiles/avatar-01.jpg';

export default function MatchingMembers({ members = [], isHost = false, onKick }) {
  if (members.length === 0) {
    return (
      <div className="matching-members-panel">
        <p className="text-muted text-center py-3">Chưa có thành viên nào.</p>
      </div>
    );
  }

  return (
    <div className="matching-members-panel">
      {members.map((m) => (
        <div key={m.memberId || m.userId} className="matching-member-row">
          <div className="matching-member-info">
            <img
              src={m.avatarUrl || defaultAvatar}
              alt={m.fullName}
              className="matching-member-avatar"
            />
            <div>
              <span className="matching-member-name">{m.fullName}</span>
              <div className="matching-member-meta">
                {m.skillLevel && <span className="badge-sm">{m.skillLevel}</span>}
                {m.gender && <span className="badge-sm">{m.gender}</span>}
              </div>
            </div>
          </div>
          {isHost && m.memberId && (
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => onKick && onKick(m.memberId)}
              title="Xóa khỏi nhóm"
            >
              <i className="feather-x"></i>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
