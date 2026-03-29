import { Link } from 'react-router-dom';

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

export default function MatchingPostCard({ post }) {
  const totalSlots = (post.requiredPlayers || 0) + 1; // +1 host
  const filled = post.membersCount || 0;
  const slotsLeft = Math.max(totalSlots - filled, 0);
  const progressPct = totalSlots > 0 ? Math.round((filled / totalSlots) * 100) : 0;

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatPrice = (v) => {
    if (v == null) return 'Thỏa thuận';
    return Number(v).toLocaleString('vi-VN') + 'đ';
  };

  return (
    <div className="col-lg-4 col-md-6">
      <div className="matching-post-card">
        {/* ── Image + Badges ── */}
        <div className="matching-card-img">
          <Link to={`/matching/${post.id}`}>
            <img src={defaultImg} className="img-fluid" alt={post.title} />
          </Link>
          <div className="matching-card-badges">
            {post.skillLevel && (
              <span className="badge-skill">{skillLabels[post.skillLevel] || post.skillLevel}</span>
            )}
            <span className="badge-price">{formatPrice(post.pricePerSlot)}/slot</span>
          </div>
          {post.status === 'FULL' && <div className="matching-card-overlay">Đã đủ người</div>}
        </div>

        {/* ── Content ── */}
        <div className="matching-card-body">
          <h4 className="matching-card-title">
            <Link to={`/matching/${post.id}`}>{post.title}</Link>
          </h4>
          <p className="matching-card-venue">
            <i className="feather-map-pin"></i>
            {post.venueName}{post.courtName ? ` — ${post.courtName}` : ''}
          </p>
          {post.venueAddress && (
            <p className="matching-card-address">{post.venueAddress}</p>
          )}

          {/* ── Expense sharing ── */}
          {post.expenseSharing && (
            <p className="matching-card-expense">
              <i className="feather-dollar-sign"></i>
              {expenseLabels[post.expenseSharing] || post.expenseSharing}
            </p>
          )}
        </div>

        {/* ── Slots Progress ── */}
        <div className="matching-card-slots">
          <div className="slots-bar">
            <div className="slots-fill" style={{ width: `${progressPct}%` }}></div>
          </div>
          <div className="slots-text">
            <span>👥 {filled}/{totalSlots} slot</span>
            <span className={slotsLeft <= 1 ? 'text-danger fw-bold' : ''}>{slotsLeft > 0 ? `Còn ${slotsLeft} chỗ` : 'Đã đủ'}</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="matching-card-footer">
          <div className="matching-card-meta">
            <span><i className="feather-calendar"></i> {formatDate(post.playDate)}</span>
            <span><i className="feather-clock"></i> {post.playStartTime} – {post.playEndTime}</span>
          </div>
          <div className="matching-card-host">
            <img
              src={post.host?.avatarUrl || '/assets/img/profiles/avatar-01.jpg'}
              alt={post.host?.fullName}
              className="host-avatar"
            />
            <span>{post.host?.fullName}</span>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="matching-card-cta">
          <Link to={`/matching/${post.id}`} className="btn btn-primary btn-sm w-100">
            Xem chi tiết
          </Link>
        </div>
      </div>
    </div>
  );
}
