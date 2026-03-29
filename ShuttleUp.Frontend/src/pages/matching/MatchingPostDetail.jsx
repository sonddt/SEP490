import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import matchingApi from '../../api/matchingApi';
import MatchingMembers from '../../components/matching/MatchingMembers';
import MatchingJoinRequests from '../../components/matching/MatchingJoinRequests';
import MatchingComments from '../../components/matching/MatchingComments';

const defaultImg = '/assets/img/venues/venues-01.jpg';
const defaultAvatar = '/assets/img/profiles/avatar-01.jpg';

const skillLabels = {
  beginner: 'Mới chơi', intermediate: 'Trung bình',
  advanced: 'Khá giỏi', expert: 'Chuyên nghiệp',
};
const expenseLabels = {
  split_equal: 'Chia đều', host_pays: 'Bao sân',
  female_free: 'Nữ miễn phí', negotiable: 'Thỏa thuận',
};

export default function MatchingPostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [hostTab, setHostTab] = useState('requests'); // 'requests' | 'members'

  const load = useCallback(async () => {
    try {
      const res = await matchingApi.getPostDetail(postId);
      setPost(res);
    } catch {
      navigate('/matching');
    } finally {
      setLoading(false);
    }
  }, [postId, navigate]);

  useEffect(() => { load(); }, [load]);

  // ── Actions ──
  const handleJoin = async () => {
    setActionLoading(true);
    try {
      await matchingApi.joinPost(postId, { message: joinMessage || undefined });
      setShowJoinForm(false);
      setJoinMessage('');
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelJoin = async () => {
    if (!window.confirm('Bạn muốn hủy yêu cầu tham gia?')) return;
    setActionLoading(true);
    try {
      await matchingApi.cancelJoin(postId);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Bạn chắc chắn muốn đóng bài đăng?')) return;
    setActionLoading(true);
    try {
      await matchingApi.closePost(postId);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await matchingApi.acceptRequest(requestId);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleRejectRequest = async (requestId, reason) => {
    try {
      await matchingApi.rejectRequest(requestId, { reason });
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleKick = async (memberId) => {
    if (!window.confirm('Bạn muốn xóa thành viên này?')) return;
    try {
      await matchingApi.removeMember(memberId);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Bạn muốn rời khỏi nhóm?')) return;
    setActionLoading(true);
    try {
      // Find my member record
      const myMember = post.members?.find(m => m.userId === post.host?.id);
      // Actually, we need to find MY member record — but post doesn't expose me directly
      // Let's find it from members where the current user's ID matches
      // Since we know isMember is true, we need to get our memberId
      // The API returns all members, so we need to figure out who is "me"
      // Let's use the fact that "isMember" is true and find by exclusion
      // Better: just call the leave endpoint which finds by current user
      const meAsMember = post.members?.find(m => !post.isHost || m.userId !== post.host?.id);
      if (meAsMember?.memberId) {
        await matchingApi.removeMember(meAsMember.memberId);
        await load();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatPrice = (v) => {
    if (v == null) return 'Thỏa thuận';
    return Number(v).toLocaleString('vi-VN') + 'đ';
  };

  if (loading) {
    return (
      <div className="content">
        <div className="container text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      </div>
    );
  }

  if (!post) return null;

  const totalSlots = (post.requiredPlayers || 0) + 1;
  const filled = post.membersCount || 0;
  const slotsLeft = Math.max(totalSlots - filled, 0);
  const progressPct = totalSlots > 0 ? Math.round((filled / totalSlots) * 100) : 0;
  const isOpen = post.status === 'OPEN';
  const isFull = post.status === 'FULL';
  const isClosed = post.status === 'CLOSED';

  return (
    <>
      {/* ── Breadcrumb ── */}
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                  <li className="breadcrumb-item"><Link to="/">Trang chủ</Link></li>
                  <li className="breadcrumb-item"><Link to="/matching">Tìm đồng đội</Link></li>
                  <li className="breadcrumb-item active">{post.title}</li>
                </ol>
              </nav>
              <h2 className="breadcrumb-title">{post.title}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="content matching-detail-content">
        <div className="container">
          <div className="row">
            {/* ═══ Left Column ═══ */}
            <div className="col-lg-8">
              {/* ── Hero Image ── */}
              <div className="matching-detail-hero">
                <img src={defaultImg} className="img-fluid rounded" alt={post.title} />
                {isFull && <div className="matching-status-badge badge-full">Đã đủ người</div>}
                {isClosed && <div className="matching-status-badge badge-closed">Đã đóng</div>}
              </div>

              {/* ── Host Info ── */}
              <div className="matching-detail-host">
                <img src={post.host?.avatarUrl || defaultAvatar} alt={post.host?.fullName} className="host-avatar-lg" />
                <div>
                  <h5>{post.host?.fullName}</h5>
                  <div className="host-badges">
                    {post.host?.skillLevel && <span className="badge-sm">{skillLabels[post.host.skillLevel] || post.host.skillLevel}</span>}
                    {post.host?.gender && <span className="badge-sm">{post.host.gender}</span>}
                  </div>
                </div>
              </div>

              {/* ── Detail Info ── */}
              <div className="matching-detail-info">
                <div className="matching-detail-row">
                  <span className="matching-detail-label"><i className="feather-map-pin"></i> Sân</span>
                  <span>{post.venueName}{post.courtName ? ` — ${post.courtName}` : ''}</span>
                </div>
                {post.venueAddress && (
                  <div className="matching-detail-row">
                    <span className="matching-detail-label"><i className="feather-navigation"></i> Địa chỉ</span>
                    <span>{post.venueAddress}</span>
                  </div>
                )}
                <div className="matching-detail-row">
                  <span className="matching-detail-label"><i className="feather-calendar"></i> Ngày chơi</span>
                  <span>{formatDate(post.playDate)}</span>
                </div>
                <div className="matching-detail-row">
                  <span className="matching-detail-label"><i className="feather-clock"></i> Giờ</span>
                  <span>{post.playStartTime} – {post.playEndTime}</span>
                </div>
                <div className="matching-detail-row">
                  <span className="matching-detail-label"><i className="feather-dollar-sign"></i> Giá/slot</span>
                  <span className="fw-bold text-primary">{formatPrice(post.pricePerSlot)}</span>
                </div>
                <div className="matching-detail-row">
                  <span className="matching-detail-label"><i className="feather-users"></i> Số người cần</span>
                  <span>{post.requiredPlayers} người</span>
                </div>
                {post.skillLevel && (
                  <div className="matching-detail-row">
                    <span className="matching-detail-label"><i className="feather-award"></i> Trình độ</span>
                    <span className="badge bg-info">{skillLabels[post.skillLevel] || post.skillLevel}</span>
                  </div>
                )}
                {post.genderPref && (
                  <div className="matching-detail-row">
                    <span className="matching-detail-label"><i className="feather-user"></i> Giới tính</span>
                    <span>{post.genderPref}</span>
                  </div>
                )}
                {post.expenseSharing && (
                  <div className="matching-detail-row">
                    <span className="matching-detail-label"><i className="feather-credit-card"></i> Chia tiền</span>
                    <span className="badge bg-success">{expenseLabels[post.expenseSharing] || post.expenseSharing}</span>
                  </div>
                )}
                {post.notes && (
                  <div className="matching-detail-notes">
                    <h6><i className="feather-file-text"></i> Ghi chú</h6>
                    <p>{post.notes}</p>
                  </div>
                )}
              </div>

              {/* ── Booking Items (ca chơi) ── */}
              {post.bookingItems && post.bookingItems.length > 0 && (
                <div className="matching-detail-items">
                  <h5>📅 Ca chơi chi tiết</h5>
                  {post.bookingItems.map((item, i) => (
                    <div key={i} className="matching-booking-item-preview">
                      <span className="fw-bold">{item.courtName}</span>
                      <span>
                        {item.startTime && new Date(item.startTime).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {item.endTime && new Date(item.endTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>{formatPrice(item.price)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── HOST: Manage Requests/Members ── */}
              {post.isHost && (
                <div className="matching-host-manage">
                  <div className="matching-host-tabs">
                    <button
                      className={`matching-tab ${hostTab === 'requests' ? 'active' : ''}`}
                      onClick={() => setHostTab('requests')}
                    >
                      Yêu cầu ({post.pendingRequests?.length || 0})
                    </button>
                    <button
                      className={`matching-tab ${hostTab === 'members' ? 'active' : ''}`}
                      onClick={() => setHostTab('members')}
                    >
                      Thành viên ({post.membersCount || 0})
                    </button>
                  </div>

                  {hostTab === 'requests' ? (
                    <MatchingJoinRequests
                      requests={post.pendingRequests || []}
                      onAccept={handleAcceptRequest}
                      onReject={handleRejectRequest}
                    />
                  ) : (
                    <MatchingMembers
                      members={post.members || []}
                      isHost={true}
                      onKick={handleKick}
                    />
                  )}
                </div>
              )}

              {/* ── FB-style Comments (only for host + accepted members) ── */}
              {(post.isHost || post.isMember) && (
                <MatchingComments postId={postId} />
              )}
            </div>

            {/* ═══ Right Column ═══ */}
            <div className="col-lg-4">
              {/* ── Action Card ── */}
              <div className="matching-action-card">
                {/* Slots Progress */}
                <div className="matching-slots-big">
                  <div className="matching-slots-circle">
                    <svg viewBox="0 0 36 36" className="matching-circular-chart">
                      <path className="circle-bg" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="circle-fill" strokeDasharray={`${progressPct}, 100`} d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <text x="18" y="20.35" className="circle-text">{filled}/{totalSlots}</text>
                    </svg>
                  </div>
                  <p className="matching-slots-label">
                    {slotsLeft > 0 ? `Còn ${slotsLeft} chỗ trống` : 'Đã đủ người'}
                  </p>
                </div>

                {/* ── Action Buttons ── */}
                <div className="matching-action-buttons">
                  {/* Finder */}
                  {!post.isHost && !post.isMember && !post.isPending && isOpen && (
                    <>
                      {showJoinForm ? (
                        <div className="matching-join-form">
                          <textarea
                            className="form-control mb-2"
                            rows={2}
                            placeholder="Lời nhắn cho chủ bài (tùy chọn)"
                            value={joinMessage}
                            onChange={(e) => setJoinMessage(e.target.value)}
                          />
                          <button className="btn btn-primary w-100 mb-2" onClick={handleJoin} disabled={actionLoading}>
                            {actionLoading ? '...' : '🏸 Gửi yêu cầu'}
                          </button>
                          <button className="btn btn-outline-secondary w-100" onClick={() => setShowJoinForm(false)}>Hủy</button>
                        </div>
                      ) : (
                        <button className="btn btn-primary btn-lg w-100" onClick={() => setShowJoinForm(true)}>
                          <i className="feather-user-plus"></i> Xin tham gia
                        </button>
                      )}
                    </>
                  )}

                  {/* Pending */}
                  {post.isPending && (
                    <>
                      <button className="btn btn-warning btn-lg w-100 mb-2" disabled>
                        <i className="feather-clock"></i> Đang chờ duyệt...
                      </button>
                      <button className="btn btn-outline-danger w-100" onClick={handleCancelJoin} disabled={actionLoading}>
                        Hủy yêu cầu
                      </button>
                    </>
                  )}

                  {/* Member (not host) */}
                  {post.isMember && !post.isHost && (
                    <button className="btn btn-outline-danger w-100" onClick={handleLeave} disabled={actionLoading}>
                      <i className="feather-log-out"></i> Rời nhóm
                    </button>
                  )}

                  {/* Host */}
                  {post.isHost && (
                    <>
                      <Link to={`/matching/edit/${postId}`} className="btn btn-outline-primary w-100 mb-2">
                        <i className="feather-edit"></i> Chỉnh sửa
                      </Link>
                      {isOpen && (
                        <button className="btn btn-outline-danger w-100" onClick={handleClose} disabled={actionLoading}>
                          <i className="feather-x-circle"></i> Đóng bài đăng
                        </button>
                      )}
                    </>
                  )}

                  {/* Closed/Full */}
                  {(isClosed || isFull) && !post.isHost && !post.isMember && (
                    <button className="btn btn-secondary btn-lg w-100" disabled>
                      {isClosed ? 'Bài đăng đã đóng' : 'Đã đủ người'}
                    </button>
                  )}
                </div>
              </div>

              {/* ── Members Card (sidebar for non-host) ── */}
              {!post.isHost && (
                <div className="matching-sidebar-card">
                  <h5>👥 Thành viên ({post.membersCount}/{totalSlots})</h5>
                  <MatchingMembers members={post.members || []} isHost={false} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
