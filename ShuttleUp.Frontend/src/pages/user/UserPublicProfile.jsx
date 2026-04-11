import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import RelationshipActions from '../../components/user/RelationshipActions';
import { profileApi } from '../../api/profileApi';
import { buildProfileShareUrl } from '../../utils/profileQr';

export default function UserPublicProfile() {
  const { userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError('');
      const data = await profileApi.getPublic(userId);
      setPayload(data);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Không mở được hồ sơ này.';
      setError(msg);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const u = payload?.user;
  const shareUrl = u?.id ? buildProfileShareUrl(u.id) : '';

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Hồ sơ thành viên</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/user/social/search">Tìm bạn</Link></li>
            <li>Hồ sơ</li>
          </ul>
        </div>
      </section>

      <div className="content court-bg" style={{ paddingTop: 40 }}>
        <div className="container" style={{ maxWidth: 720 }}>
          {loading && <p className="text-muted">Đang tải…</p>}
          {!loading && error && (
            <div className="alert alert-warning" role="status">
              {error}
            </div>
          )}
          {!loading && !error && u && (
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex flex-column flex-md-row gap-4 align-items-start">
                  <div className="text-center">
                    {u.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="rounded-circle"
                        style={{ width: 120, height: 120, objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center"
                        style={{ width: 120, height: 120, fontSize: 48, color: '#64748b' }}
                      >
                        {(u.fullName || '?').charAt(0)}
                      </div>
                    )}
                    {shareUrl && (
                      <div className="mt-3 d-none d-md-block">
                        <div className="small text-muted mb-1">Mã QR hồ sơ</div>
                        <QRCodeSVG value={shareUrl} size={128} level="M" includeMargin />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow-1">
                    <h2 className="h4 mb-2" style={{ color: '#1e293b' }}>
                      {u.fullName}
                    </h2>
                    <ul className="list-unstyled text-muted small mb-3">
                      {u.skillLevel && (
                        <li>
                          <strong className="text-dark">Trình độ:</strong> {u.skillLevel}
                        </li>
                      )}
                      {u.playPurpose && (
                        <li>
                          <strong className="text-dark">Mục tiêu:</strong> {u.playPurpose}
                        </li>
                      )}
                      {u.playFrequency && (
                        <li>
                          <strong className="text-dark">Tần suất:</strong> {u.playFrequency}
                        </li>
                      )}
                    </ul>
                    <RelationshipActions
                      otherUserId={u.id}
                      initialState={payload.relationshipState}
                      initialRequestId={payload.pendingRequestId}
                      onChanged={load}
                      chatPeerFullName={u.fullName}
                      chatPeerAvatarUrl={u.avatarUrl}
                    />
                    {shareUrl && (
                      <div className="mt-4 d-md-none">
                        <div className="small text-muted mb-1">Mã QR hồ sơ</div>
                        <QRCodeSVG value={shareUrl} size={160} level="M" includeMargin />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
