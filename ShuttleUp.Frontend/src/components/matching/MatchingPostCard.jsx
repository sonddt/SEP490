import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import matchingApi from '../../api/matchingApi';
import MatchingScheduleModal from './MatchingScheduleModal';
import { buildScheduleSummary } from '../../utils/matchingScheduleSummary';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

function sameUserId(a, b) {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

const defaultImg = '/assets/img/venues/venues-01.jpg';

const skillLabels = {
  beginner: 'Mới chơi',
  intermediate: 'Trung bình',
  advanced: 'Khá giỏi',
  expert: 'Chuyên nghiệp',
};

const expenseLabels = {
  split_equal: 'Chia đều',
  host_pays: 'Bao sân',
  female_free: 'Nữ miễn phí',
  negotiable: 'Thỏa thuận',
};

/** Nhãn trạng thái góc ảnh: FULL trắng, OPEN xanh lá, CLOSED/Inactive đỏ. */
function getMatchingPostStatusBadge(status) {
  const u = status == null ? '' : String(status).trim().toUpperCase();
  if (u === 'FULL') {
    return {
      label: 'Đã đầy',
      style: {
        backgroundColor: '#ffffff',
        color: '#1e293b',
        border: '1px solid rgba(226, 232, 240, 0.95)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
      },
    };
  }
  if (u === 'OPEN') {
    return {
      label: 'Đang mở',
      style: {
        backgroundColor: '#097E52',
        color: '#ffffff',
      },
    };
  }
  if (u === 'INACTIVE' || u === 'CLOSED') {
    return {
      label: 'Đã đóng',
      style: {
        backgroundColor: '#dc2626',
        color: '#ffffff',
      },
    };
  }
  return {
    label: 'Đã đóng',
    style: {
      backgroundColor: '#dc2626',
      color: '#ffffff',
    },
  };
}

const scheduleLinkBtnStyle = {
  display: 'inline',
  padding: 0,
  border: 'none',
  background: 'none',
  fontWeight: '700',
  color: '#097E52',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  textAlign: 'inherit',
};

export default function MatchingPostCard({ post, viewMode = 'grid', onJoined }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [joinBusy, setJoinBusy] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleModalLoading, setScheduleModalLoading] = useState(false);
  const [scheduleModalData, setScheduleModalData] = useState(null);
  const [scheduleModalError, setScheduleModalError] = useState(null);

 

  const totalSlots = (post.requiredPlayers || 0) + 1; // +1 host
  const filled = post.membersCount || 0;
  const slotsLeft = Math.max(totalSlots - filled, 0);
  const progressPct = totalSlots > 0 ? Math.round((filled / totalSlots) * 100) : 0;

  const formatPrice = (v) => {
    if (v == null) return 'Thỏa thuận';
    return Number(v).toLocaleString('vi-VN') + 'đ';
  };

  const isPostOwner = post.isHost === true || sameUserId(user?.id, post.host?.id);
  const canQuickJoin = post.canRequestJoin === true && post.status !== 'Inactive';
  const statusBadge = getMatchingPostStatusBadge(post.status);

  const closeScheduleModal = useCallback(() => {
    setScheduleModalOpen(false);
    setScheduleModalLoading(false);
    setScheduleModalData(null);
    setScheduleModalError(null);
  }, []);

  const openScheduleModal = useCallback(async () => {
    setScheduleModalOpen(true);
    setScheduleModalLoading(true);
    setScheduleModalError(null);
    setScheduleModalData(null);
    try {
      const detail = await matchingApi.getPostDetail(post.id);
      setScheduleModalData(buildScheduleSummary(detail));
    } catch {
      setScheduleModalError('Không tải được lịch. Bạn thử lại sau.');
    } finally {
      setScheduleModalLoading(false);
    }
  }, [post.id]);

  const submitJoinRequest = async () => {
    if (!canQuickJoin || joinBusy) return;
    setJoinBusy(true);
    try {
      await matchingApi.joinPost(post.id, { message: joinMessage || undefined });
      toast.success('Đã gửi yêu cầu tham gia! Chờ chủ bài duyệt nhé.');
      setShowJoinModal(false);
      setJoinMessage('');
      onJoined?.();
    } catch (err) {
      const msg = err.response?.data?.message || 'Chưa gửi được yêu cầu — bạn thử lại sau nhé.';
      toast.error(msg);
    } finally {
      setJoinBusy(false);
    }
  };

  const handleJoinClick = () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setShowJoinModal(true);
  };

  if (viewMode === 'list') {
    return (
      <>
      <div className="col-12 mb-4">
        <div className="matching-list-card" style={{ display: 'flex', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden', transition: 'all 0.3s' }}>
          {/* Image Side */}
          <div className="matching-list-card-img" style={{ width: '280px', position: 'relative', flexShrink: 0 }}>
            <Link to={user ? `/matching/${post.id}` : '/login'} state={user ? undefined : { from: `/matching/${post.id}` }} style={{ display: 'block', height: '100%' }}>
              <img src={defaultImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={post.title} />
            </Link>
            <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px', zIndex: 1 }}>
              {post.skillLevel && (
                <span style={{ backgroundColor: '#097E52', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>
                  {skillLabels[post.skillLevel] || post.skillLevel}
                </span>
              )}
            </div>
            <span
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 5,
                padding: '5px 11px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.02em',
                pointerEvents: 'none',
                ...statusBadge.style,
              }}
            >
              {statusBadge.label}
            </span>
            {post.status === 'Inactive' && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '15px', zIndex: 2, textAlign: 'center', padding: '8px' }}>
                Đã kết thúc
              </div>
            )}
            {post.status === 'FULL' && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '16px', zIndex: 2 }}>
                Đã đủ người
              </div>
            )}
            <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '16px 12px 12px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', zIndex: 1 }}>
              <span style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>{formatPrice(post.pricePerSlot)}<span style={{ fontSize: '12px', opacity: 0.8 }}>/slot</span></span>
            </div>
          </div>

          {/* Content Side */}
          <div className="matching-list-card-body" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                <Link to={user ? `/matching/${post.id}` : '/login'} state={user ? undefined : { from: `/matching/${post.id}` }} style={{ color: 'inherit', textDecoration: 'none' }}>{post.title}</Link>
              </h4>
              <div style={{ display: 'flex', gap: '16px', color: '#64748b', fontSize: '14px', fontWeight: '600', flexWrap: 'wrap' }}>
                <span><i className="feather-map-pin me-1" style={{ color: '#097E52' }}></i> {post.venueName}{post.courtName ? ` — ${post.courtName}` : ''}</span>
                {post.expenseSharing && (
                  <span><i className="feather-pie-chart me-1" style={{ color: '#097E52' }}></i> {expenseLabels[post.expenseSharing] || post.expenseSharing}</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <img src={post.host?.avatarUrl || '/assets/img/profiles/avatar-01.jpg'} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', flexShrink: 0 }} />
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chủ bài</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={post.host?.fullName || ''}>{post.host?.fullName || '—'}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={openScheduleModal}
                style={{ ...scheduleLinkBtnStyle, fontSize: '14px', textAlign: 'right', flexShrink: 0 }}
              >
                Bấm vào xem lịch
              </button>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>👥 {filled}/{totalSlots} người</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: slotsLeft <= 1 ? '#ef4444' : '#097E52' }}>{slotsLeft > 0 ? `Còn ${slotsLeft} chỗ` : 'Đã đủ'}</span>
                </div>
                <div style={{ width: '140px', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', backgroundColor: slotsLeft <= 1 ? '#ef4444' : '#097E52', borderRadius: '3px' }}></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                {isPostOwner ? (
                  <Link to={user ? `/matching/${post.id}` : '/login'} state={user ? undefined : { from: `/matching/${post.id}` }} className="btn btn-primary" style={{ borderRadius: '10px', fontWeight: '700', padding: '8px 24px' }}>
                    Xem chi tiết
                  </Link>
                ) : (
                  <>
                    <Link to={user ? `/matching/${post.id}` : '/login'} state={user ? undefined : { from: `/matching/${post.id}` }} className="btn btn-outline-primary" style={{ borderRadius: '10px', fontWeight: '700', padding: '8px 20px' }}>
                      Chi tiết
                    </Link>
                    {canQuickJoin ? (
                      <button onClick={handleJoinClick} disabled={joinBusy} className="btn btn-primary" style={{ borderRadius: '10px', fontWeight: '700', padding: '8px 20px', display: 'flex', alignItems: 'center' }}>
                         {joinBusy ? '...' : <><i className="feather-user-plus me-2"></i> Xin tham gia</>}
                      </button>
                    ) : (
                      <button disabled className="btn btn-secondary" style={{ borderRadius: '10px', fontWeight: '700', padding: '8px 20px', opacity: 0.6 }}>
                         <i className="feather-user-plus me-2"></i> Xin tham gia
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <MatchingScheduleModal
        open={scheduleModalOpen}
        onClose={closeScheduleModal}
        range={scheduleModalData?.range}
        courtsText={scheduleModalData?.courtsText}
        loading={scheduleModalLoading}
        errorMessage={scheduleModalError}
      />
      </>
    );
  }

  // Grid Mode (Default)
  return (
    <>
    <div className="col-lg-4 col-md-6 mb-4">
      <div className="matching-post-card h-100 d-flex flex-column" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', overflow: 'hidden', backgroundColor: '#fff', transition: 'transform 0.2s' }}>
        {/* ── Image + Badges ── */}
        <div className="matching-card-img" style={{ position: 'relative', height: '180px' }}>
          <Link to={user ? `/matching/${post.id}` : '/login'} state={user ? undefined : { from: `/matching/${post.id}` }} style={{ display: 'block', height: '100%' }}>
            <img src={defaultImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={post.title} />
          </Link>
          <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px', zIndex: 1 }}>
            {post.skillLevel && (
               <span style={{ backgroundColor: '#097E52', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                 {skillLabels[post.skillLevel] || post.skillLevel}
               </span>
            )}
          </div>
          <span
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 5,
              padding: '5px 11px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.02em',
              pointerEvents: 'none',
              ...statusBadge.style,
            }}
          >
            {statusBadge.label}
          </span>
          {post.status === 'Inactive' && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '15px', zIndex: 3, textAlign: 'center', padding: '8px' }}>
              Đã kết thúc
            </div>
          )}
          {post.status === 'FULL' && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '16px', zIndex: 2 }}>
              Đã đủ người
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '16px 12px 12px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', zIndex: 1 }}>
              <span style={{ color: '#fff', fontWeight: '800', fontSize: '16px' }}>{formatPrice(post.pricePerSlot)}<span style={{ fontSize: '12px', opacity: 0.8 }}>/slot</span></span>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="matching-card-body" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', marginBottom: '12px', lineHeight: '1.4', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            <Link to={user ? `/matching/${post.id}` : '/login'} state={user ? undefined : { from: `/matching/${post.id}` }} style={{ color: 'inherit', textDecoration: 'none' }}>{post.title}</Link>
          </h4>
          
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
            <i className="feather-map-pin me-2" style={{ color: '#097E52' }}></i>
            {post.venueName}{post.courtName ? ` — ${post.courtName}` : ''}
          </div>
          
          {post.expenseSharing && (
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '16px' }}>
              <i className="feather-pie-chart me-2" style={{ color: '#097E52' }}></i>
              {expenseLabels[post.expenseSharing] || post.expenseSharing}
            </div>
          )}

          {/* ── Slots Progress ── */}
          <div style={{ marginTop: 'auto', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>👥 {filled}/{totalSlots} người</span>
              <span style={{ fontSize: '12px', fontWeight: '800', color: slotsLeft <= 1 ? '#ef4444' : '#097E52' }}>{slotsLeft > 0 ? `Còn ${slotsLeft} chỗ` : 'Đã đủ'}</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', backgroundColor: slotsLeft <= 1 ? '#ef4444' : '#097E52', borderRadius: '3px' }}></div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <img src={post.host?.avatarUrl || '/assets/img/profiles/avatar-01.jpg'} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', flexShrink: 0 }} />
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.35px', marginBottom: '2px' }}>Chủ bài</div>
                <div
                  style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(160px, 42vw)' }}
                  title={post.host?.fullName || ''}
                >
                  {post.host?.fullName || '—'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={openScheduleModal}
              style={{ ...scheduleLinkBtnStyle, fontSize: '12px', textAlign: 'right', flexShrink: 0 }}
            >
              Bấm vào xem lịch
            </button>
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ padding: '0 20px 20px' }}>
          {isPostOwner ? (
            <Link to={user ? `/matching/${post.id}` : '/login'} state={user ? undefined : { from: `/matching/${post.id}` }} className="btn btn-primary w-100" style={{ borderRadius: '10px', fontWeight: '800', padding: '10px' }}>
              Xem chi tiết
            </Link>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link to={user ? `/matching/${post.id}` : '/login'} state={user ? undefined : { from: `/matching/${post.id}` }} className="btn btn-outline-primary flex-fill" style={{ borderRadius: '10px', fontWeight: '800', padding: '10px' }}>
                Chi tiết
              </Link>
              {canQuickJoin ? (
                <button onClick={handleJoinClick} disabled={joinBusy} className="btn btn-primary flex-fill" style={{ borderRadius: '10px', fontWeight: '800', padding: '10px' }}>
                   {joinBusy ? '...' : 'Xin tham gia'}
                </button>
              ) : (
                <button disabled className="btn btn-secondary flex-fill" style={{ borderRadius: '10px', fontWeight: '800', padding: '10px', opacity: 0.6 }}>
                   Tham gia
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    <MatchingScheduleModal
      open={scheduleModalOpen}
      onClose={closeScheduleModal}
      range={scheduleModalData?.range}
      courtsText={scheduleModalData?.courtsText}
      loading={scheduleModalLoading}
      errorMessage={scheduleModalError}
    />

    {/* Modern Join Modal */}
    {showJoinModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)' }}>
        <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>Tham gia nhóm</h3>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', fontWeight: '500' }}>{post.title}</p>
          
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px', display: 'block' }}>Lời nhắn (tuỳ chọn)</label>
          <textarea
            className="form-control"
            rows={3}
            placeholder="Xin chào, có thể duyệt mình vào nhóm được không?"
            value={joinMessage}
            onChange={(e) => setJoinMessage(e.target.value)}
            style={{ borderRadius: '12px', fontSize: '14px', padding: '12px', marginBottom: '24px' }}
          />
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-outline-secondary flex-fill" onClick={() => setShowJoinModal(false)} disabled={joinBusy} style={{ borderRadius: '12px', fontWeight: '700', padding: '10px' }}>Hủy bỏ</button>
            <button className="btn btn-primary flex-fill" onClick={submitJoinRequest} disabled={joinBusy} style={{ borderRadius: '12px', fontWeight: '700', padding: '10px' }}>
              {joinBusy ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
