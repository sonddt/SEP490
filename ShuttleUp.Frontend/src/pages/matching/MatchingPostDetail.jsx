import { useState, useEffect, useCallback, useMemo } from 'react';
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

  const commentMentionMembers = useMemo(() => {
    const list = [...(post?.members || [])];
    const hid = post?.host?.id;
    if (hid && !list.some((m) => m.userId === hid)) {
      list.unshift({
        userId: hid,
        fullName: post.host.fullName,
        avatarUrl: post.host.avatarUrl,
      });
    }
    return list;
  }, [post]);

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

  const handleReopen = async () => {
    if (!window.confirm('Mở lại bài đăng để người chơi có thể xin tham gia?')) return;
    setActionLoading(true);
    try {
      await matchingApi.reopenPost(postId);
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
      <div className="content py-5" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <div className="container">

          {/* Minimal Breadcrumb */}
          <nav aria-label="breadcrumb" style={{ marginBottom: '24px' }}>
            <ol className="breadcrumb mb-0" style={{ backgroundColor: 'transparent', padding: 0 }}>
              <li className="breadcrumb-item"><Link to="/" style={{ color: '#64748b', textDecoration: 'none', fontWeight: '600' }}>Trang chủ</Link></li>
              <li className="breadcrumb-item"><Link to="/matching" style={{ color: '#64748b', textDecoration: 'none', fontWeight: '600' }}>Tìm kèo 🏸</Link></li>
              <li className="breadcrumb-item active" style={{ color: '#097E52', fontWeight: '800' }}>{post.title}</li>
            </ol>
          </nav>
          
          {/* Header Action Section - Minimal Hero */}
          <div style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px 40px', marginBottom: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
             <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <img src={post.host?.avatarUrl || defaultAvatar} alt={post.host?.fullName} style={{ width: '80px', height: '80px', borderRadius: '16px', objectFit: 'cover', border: '3px solid #e8f5ee', boxShadow: '0 2px 10px rgba(9,126,82,0.1)' }} />
                <div>
                  <h3 style={{ fontSize: '26px', fontWeight: '800', color: '#1e293b', marginBottom: '8px', letterSpacing: '-0.5px' }}>{post.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#097E52' }}><i className="feather-user me-1"></i> {post.host?.fullName}</span>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chủ bài đăng</span>
                    {post.host?.skillLevel && (
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '8px' }}>{skillLabels[post.host.skillLevel] || post.host.skillLevel}</span>
                    )}
                  </div>
                </div>
             </div>
             
             <div style={{ textAlign: 'right' }}>
                {isFull && <span style={{ display: 'inline-block', backgroundColor: '#fef2f2', color: '#ef4444', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '15px' }}><i className="feather-check-circle me-2"></i>Đã đủ người</span>}
                {isClosed && <span style={{ display: 'inline-block', backgroundColor: '#f1f5f9', color: '#64748b', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '15px' }}><i className="feather-x-circle me-2"></i>Đã đóng</span>}
                {isOpen && !isFull && !isClosed && <span style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#e8f5ee', color: '#097E52', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', fontSize: '15px', border: '1px solid #bbf7d0' }}><i className="feather-radio me-2" style={{ animation: 'blink 2s infinite' }}></i> Đang tuyển người</span>}
             </div>
          </div>

          <div className="row">
            {/* ═══ Left Column ═══ */}
            <div className="col-lg-8">
              
              <div style={{ backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', overflow: 'hidden', marginBottom: '32px' }}>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#e8f5ee', color: '#097E52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="feather-info" style={{ fontSize: '18px' }}></i>
                    </div>
                    <h5 style={{ margin: 0, fontWeight: '800', color: '#1e293b' }}>Thông tin chi tiết</h5>
                </div>
                {/* Information matrix */}
                <div style={{ padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="feather-map-pin" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Địa điểm</div>
                            <div style={{ fontSize: '16px', color: '#1e293b', fontWeight: '800', marginBottom: '2px' }}>{post.venueName}</div>
                            {post.venueAddress && <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.4', fontWeight: '500' }}>{post.venueAddress}</div>}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#ffedd5', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="feather-calendar" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Lịch chơi</div>
                            <div style={{ fontSize: '16px', color: '#1e293b', fontWeight: '800', marginBottom: '2px' }}>{formatDate(post.playDate)}</div>
                            <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '700' }}>{post.playStartTime} – {post.playEndTime}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#f3e8ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="feather-award" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Yêu cầu trình độ</div>
                            <div style={{ fontSize: '16px', color: '#1e293b', fontWeight: '800', marginBottom: '2px' }}>{post.skillLevel ? (skillLabels[post.skillLevel] || post.skillLevel) : 'Mọi trình độ'}</div>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}><i className="feather-users me-1"></i> {post.genderPref || 'Nam & Nữ đều được'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="feather-credit-card" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Chi phí dự kiến</div>
                            <div style={{ fontSize: '18px', color: '#097E52', fontWeight: '800', marginBottom: '2px', letterSpacing: '-0.5px' }}>{formatPrice(post.pricePerSlot)} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '600' }}>/ ng</span></div>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}><i className="feather-pie-chart me-1"></i> {expenseLabels[post.expenseSharing] || post.expenseSharing}</div>
                        </div>
                    </div>
                </div>

                {post.notes && (
                  <div style={{ borderTop: '1px dashed #e2e8f0', padding: '24px 32px' }}>
                     <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}><i className="feather-feather me-2"></i>Ghi chú từ chủ nhóm</div>
                     <div style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '16px 20px', borderRadius: '12px', fontSize: '14.5px', fontWeight: '500', lineHeight: '1.6' }}>
                        {post.notes}
                     </div>
                  </div>
                )}
                
                {post.bookingItems && post.bookingItems.length > 0 && (
                  <div style={{ borderTop: '1px dashed #e2e8f0', padding: '24px 32px' }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}><i className="feather-layers me-2"></i>Danh sách ca chơi ghép</div>
                      {post.bookingItems.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '12px', marginBottom: '8px', border: '1px solid #f1f5f9' }}>
                          <div>
                            <span style={{ fontWeight: '700', color: '#1e293b', marginRight: '12px' }}>{item.courtName}</span>
                            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                              {item.startTime && new Date(item.startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {' - '} 
                              {item.endTime && new Date(item.endTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span style={{ fontWeight: '800', color: '#097E52' }}>{formatPrice(item.price)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Comments moved up right below details */}
              {(post.isHost || post.isMember) && (
                <div style={{ paddingBottom: '32px' }}>
                   <MatchingComments postId={postId} isHost={post.isHost} postMembers={commentMentionMembers} />
                </div>
              )}

            </div>

            {/* ═══ Right Column ═══ */}
            <div className="col-lg-4">
              
              {/* Slots Action Card */}
              <div style={{ backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', padding: '32px', marginBottom: '24px', textAlign: 'center' }}>
                <div style={{ marginBottom: '24px', position: 'relative', width: '120px', height: '120px', margin: '0 auto 24px' }}>
                   <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                     <path style={{ stroke: '#f1f5f9', strokeWidth: '3', fill: 'none' }} d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" />
                     <path style={{ stroke: '#097E52', strokeWidth: '3', strokeDasharray: `${progressPct}, 100`, fill: 'none', strokeLinecap: 'round' }} d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" />
                     <text x="18" y="22" style={{ fill: '#1e293b', fontSize: '10px', fontWeight: '800', textAnchor: 'middle' }}>{filled}/{totalSlots}</text>
                   </svg>
                </div>
                {slotsLeft > 0 ? (
                  <h5 style={{ fontWeight: '800', color: '#097E52', marginBottom: '24px' }}>Còn {slotsLeft} chỗ trống</h5>
                ) : (
                  <h5 style={{ fontWeight: '800', color: '#ef4444', marginBottom: '24px' }}>Đã đủ đội hình</h5>
                )}

                {/* Finder Buttons */}
                {!post.isHost && !post.isMember && !post.isPending && isOpen && (
                    <>
                      {showJoinForm ? (
                        <div style={{ textAlign: 'left' }}>
                          <label style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>Lời nhắn (tuỳ chọn)</label>
                          <textarea
                            className="form-control mb-3"
                            rows={3}
                            placeholder="Xin chào, mình đánh loại khá, có thể join nhóm hôm nay không?"
                            value={joinMessage}
                            onChange={(e) => setJoinMessage(e.target.value)}
                            style={{ borderRadius: '12px', fontSize: '14px', padding: '12px' }}
                          />
                          <button className="btn btn-primary w-100 mb-2" onClick={handleJoin} disabled={actionLoading} style={{ padding: '12px', borderRadius: '12px', fontWeight: '700' }}>
                            {actionLoading ? 'Đang gửi...' : 'Gửi yêu cầu xin tham gia'}
                          </button>
                          <button className="btn w-100" onClick={() => setShowJoinForm(false)} style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '12px', borderRadius: '12px', fontWeight: '600' }}>Hủy bỏ</button>
                        </div>
                      ) : (
                        <button className="btn btn-primary w-100" onClick={() => setShowJoinForm(true)} style={{ padding: '14px', borderRadius: '14px', fontSize: '16px', fontWeight: '700', boxShadow: '0 4px 12px rgba(9,126,82,0.2)' }}>
                          <i className="feather-user-plus me-2"></i> Xin tham gia nhóm
                        </button>
                      )}
                    </>
                  )}

                  {post.isPending && (
                    <>
                      <div style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '12px', fontWeight: '700', marginBottom: '12px' }}>
                        <i className="feather-clock me-2"></i> Yêu cầu đang được chờ Host duyệt...
                      </div>
                      <button className="btn w-100" onClick={handleCancelJoin} disabled={actionLoading} style={{ border: '1px solid #e2e8f0', color: '#ef4444', padding: '12px', borderRadius: '12px', fontWeight: '600' }}>
                        Hủy yêu cầu tham gia
                      </button>
                    </>
                  )}

                  {post.isMember && !post.isHost && (
                    <button className="btn w-100" onClick={handleLeave} disabled={actionLoading} style={{ backgroundColor: '#fef2f2', color: '#ef4444', padding: '14px', borderRadius: '14px', fontWeight: '700' }}>
                      <i className="feather-log-out me-2"></i> Rời khỏi nhóm chơi
                    </button>
                  )}

                  {post.isHost && (
                    <>
                      {isOpen && (
                        <Link to={`/matching/edit/${postId}`} className="btn w-100 mb-3" style={{ border: '2px solid #e8f5ee', color: '#097E52', padding: '12px', borderRadius: '12px', fontWeight: '700' }}>
                          <i className="feather-edit me-2"></i> Chỉnh sửa bài đăng
                        </Link>
                      )}
                      {isOpen && (
                        <button type="button" className="btn w-100" onClick={handleClose} disabled={actionLoading} style={{ backgroundColor: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '12px', fontWeight: '700' }}>
                          <i className="feather-x-circle me-2"></i> Đóng tuyển người chơi
                        </button>
                      )}
                      {isClosed && (
                        <button type="button" className="btn btn-primary w-100" onClick={handleReopen} disabled={actionLoading} style={{ padding: '12px', borderRadius: '12px', fontWeight: '700' }}>
                          <i className="feather-refresh-cw me-2"></i> Mở lại bài để tuyển thêm
                        </button>
                      )}
                    </>
                  )}

                  {(isClosed || isFull) && !post.isHost && !post.isMember && (
                    <button className="btn w-100" disabled style={{ backgroundColor: '#f1f5f9', color: '#94a3b8', padding: '14px', borderRadius: '14px', fontWeight: '700' }}>
                      {isClosed ? 'Bài đăng đã đóng' : 'Đã đủ đội hình'}
                    </button>
                  )}
              </div>

              {/* Host management card */}
              {post.isHost && (
                <div style={{ backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', padding: '24px 0', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 24px 16px', gap: '8px' }}>
                    <button
                      onClick={() => setHostTab('requests')}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', border: 'none', transition: 'all 0.2s', backgroundColor: hostTab === 'requests' ? '#f1f5f9' : 'transparent', color: hostTab === 'requests' ? '#097E52' : '#64748b' }}
                    >
                      Duyệt tham gia {post.pendingRequests?.length > 0 && <span style={{ backgroundColor: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', marginLeft: '4px' }}>{post.pendingRequests.length}</span>}
                    </button>
                    <button
                      onClick={() => setHostTab('members')}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', border: 'none', transition: 'all 0.2s', backgroundColor: hostTab === 'members' ? '#f1f5f9' : 'transparent', color: hostTab === 'members' ? '#097E52' : '#64748b' }}
                    >
                      Thành viên ({post.membersCount || 0})
                    </button>
                  </div>

                  <div style={{ padding: '16px 24px 0' }}>
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
                </div>
              )}

              {/* Members List specifically for non-host */}
              {!post.isHost && (
                <div style={{ backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', padding: '24px' }}>
                  <h5 style={{ fontWeight: '800', color: '#1e293b', marginBottom: '20px' }}><i className="feather-users me-2"></i>Đội hình hiện tại ({post.membersCount}/{totalSlots})</h5>
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
