import { useState } from 'react';

const defaultAvatar = '/assets/img/profiles/avatar-01.jpg';

export default function MatchingJoinRequests({ requests = [], onAccept, onReject }) {
  const [rejectId, setRejectId] = useState(null);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(null);

  if (requests.length === 0) {
    return (
      <div className="matching-requests-panel">
        <p className="text-muted text-center py-3">Không có yêu cầu nào đang chờ.</p>
      </div>
    );
  }

  const handleAccept = async (id) => {
    setProcessing(id);
    try { await onAccept(id); } finally { setProcessing(null); }
  };

  const handleReject = async (id) => {
    setProcessing(id);
    try { await onReject(id, reason); } finally { setProcessing(null); setRejectId(null); setReason(''); }
  };

  return (
    <div className="matching-requests-panel">
      {requests.map((r) => (
        <div key={r.id} className="matching-request-row">
          <div className="matching-request-info">
            <img
              src={r.avatarUrl || defaultAvatar}
              alt={r.fullName}
              className="matching-member-avatar"
            />
            <div>
              <span className="matching-member-name">{r.fullName}</span>
              <div className="matching-member-meta">
                {r.skillLevel && <span className="badge-sm">{r.skillLevel}</span>}
                {r.gender && <span className="badge-sm">{r.gender}</span>}
              </div>
              {r.message && <p className="matching-request-msg">"{r.message}"</p>}
            </div>
          </div>
          <div className="matching-request-actions">
            <button
              className="btn btn-sm btn-success"
              onClick={() => handleAccept(r.id)}
              disabled={!!processing}
            >
              {processing === r.id ? '...' : '✓ Chấp nhận'}
            </button>
            {rejectId === r.id ? (
              <div className="matching-reject-form">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Lý do (tùy chọn)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleReject(r.id)}
                  disabled={!!processing}
                >
                  Xác nhận
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setRejectId(null)}>Hủy</button>
              </div>
            ) : (
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => setRejectId(r.id)}
                disabled={!!processing}
              >
                ✗ Từ chối
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
