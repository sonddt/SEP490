import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

/** Số ký tự tối đa cho đoạn xem trước trên thẻ (mô tả ngắn / nội dung). */
const CARD_TEXT_MAX = 130;

/** Nhãn ShuttleUp — xanh lá thương hiệu (đồng bộ Manager / CTA). */
const SHUTTLEUP_BADGE = { background: '#097E52', color: '#fff' };

/**
 * Cụm sân: cùng họ xanh (teal / ngọc / rêu / cyan đậm) để không lệch tông thể thao,
 * vẫn phân biệt được từng venue theo venueId. Tránh tím/cam/hồng gắn với thương hiệu.
 */
const CLUSTER_PALETTE = [
  { background: '#0f766e', color: '#fff' },
  { background: '#047857', color: '#fff' },
  { background: '#0e7490', color: '#fff' },
  { background: '#15803d', color: '#fff' },
  { background: '#115e59', color: '#fff' },
  { background: '#166534', color: '#fff' },
  { background: '#134e4a', color: '#fff' },
];

/** Font chữ dự án — đồng bộ index.css / style.css, ưu tiên tiếng Việt. */
const FONT_UI = '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, sans-serif';

/** Bo góc vừa phải; chữ đủ lớn để đọc (0.875rem ≈ 14px). */
const BADGE_BASE = {
  fontFamily: FONT_UI,
  fontWeight: 600,
  fontSize: '0.875rem',
  letterSpacing: '0.01em',
  borderRadius: 6,
  padding: '0.38rem 0.7rem',
  lineHeight: 1.35,
};

function paletteIndex(seed) {
  if (!seed) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = ((h << 5) - h) + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % CLUSTER_PALETTE.length;
}

function clusterColors(seed) {
  const p = CLUSTER_PALETTE[paletteIndex(seed)];
  return { background: p.background, color: p.color };
}

function venueBadgeStyle(seed) {
  return { ...BADGE_BASE, ...clusterColors(seed) };
}

function roleBadgeStyle(post) {
  if (post.authorRole === 'ADMIN') return { ...BADGE_BASE, ...SHUTTLEUP_BADGE };
  return { ...BADGE_BASE, ...clusterColors(post.venueId || post.id) };
}

function truncateText(text, max) {
  const t = (text || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

/** Nội dung xem trước: ưu tiên excerpt, không đủ thì ghép body. */
function cardPreview(post) {
  const ex = (post.excerpt || '').trim();
  const body = (post.body || '').trim();
  if (ex) return truncateText(ex, CARD_TEXT_MAX);
  if (body) return truncateText(body, CARD_TEXT_MAX);
  return '';
}

/** Cần modal khi có body hoặc mô tả bị cắt ngắn trên thẻ. */
function needsDetailModal(post) {
  const ex = (post.excerpt || '').trim();
  const body = (post.body || '').trim();
  if (body) return true;
  if (ex.length > CARD_TEXT_MAX) return true;
  return false;
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export default function FeaturedPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailPost, setDetailPost] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL', 'ADMIN', 'MANAGER'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/featured-posts');
        if (!res.ok) {
          if (!cancelled) setError('unavailable');
          return;
        }
        const data = await res.json();
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError('unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filter, sort, and paginate
  const filteredPosts = posts
    .filter((p) => {
      const matchRole = roleFilter === 'ALL' || p.authorRole === roleFilter;
      const term = searchTerm.toLowerCase();
      const matchSearch = term === '' ||
        (p.title || '').toLowerCase().includes(term) ||
        (p.excerpt || '').toLowerCase().includes(term) ||
        (p.venueName || '').toLowerCase().includes(term);
      return matchRole && matchSearch;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const displayedPosts = filteredPosts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);

  useEffect(() => {
    if (!detailPost) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setDetailPost(null);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [detailPost]);

  const detailModal = detailPost && typeof document !== 'undefined' && createPortal(
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="featured-detail-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setDetailPost(null);
      }}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable" style={{ margin: '1.75rem auto' }}>
        <div
          className="modal-content corner-radius-10 overflow-hidden"
          style={{ border: '1px solid #e2e8f0', fontFamily: FONT_UI }}
        >
          {detailPost.coverImageUrl && (
            <img
              src={detailPost.coverImageUrl}
              alt=""
              className="w-100"
              style={{ maxHeight: 280, objectFit: 'cover' }}
            />
          )}
          <div className="modal-header border-bottom-0 flex-wrap gap-2 align-items-start">
            <div className="flex-grow-1">
              <div className="d-flex flex-wrap gap-2 mb-2">
                <span className="badge border-0" style={roleBadgeStyle(detailPost)}>
                  {detailPost.authorRole === 'ADMIN' ? 'ShuttleUp' : 'Cụm sân'}
                </span>
                {detailPost.venueName && (
                  <span
                    className="badge border-0"
                    style={venueBadgeStyle(detailPost.venueId || detailPost.id)}
                  >
                    {detailPost.venueName}
                  </span>
                )}
              </div>
              <h2 id="featured-detail-title" className="modal-title fw-bold h5 mb-1" style={{ fontSize: '1.25rem' }}>
                {detailPost.title}
              </h2>
              {detailPost.createdAt && (
                <div className="text-muted small">
                  <i className="feather-clock me-1"></i>
                  Đăng ngày: {formatDate(detailPost.createdAt)}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={() => setDetailPost(null)}
              aria-label="Đóng"
            />
          </div>
          <div className="modal-body pt-0">
            {detailPost.excerpt && (
              <p className="text-muted mb-3" style={{ lineHeight: 1.65 }}>
                {detailPost.excerpt}
              </p>
            )}
            {detailPost.body && (
              <p className="mb-0" style={{ fontSize: 15, whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
                {detailPost.body}
              </p>
            )}
            {!detailPost.excerpt && !detailPost.body && (
              <p className="text-muted small mb-0">Bài đăng chưa có mô tả chi tiết.</p>
            )}
          </div>
          <div className="modal-footer border-top-0 flex-wrap gap-2">
            <button type="button" className="btn btn-light" onClick={() => setDetailPost(null)}>
              Đóng
            </button>
            {detailPost.linkUrl && (
              <a
                href={detailPost.linkUrl}
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở liên kết
              </a>
            )}
            {detailPost.venueId && (
              <Link
                to={`/venue-details/${detailPost.venueId}`}
                className="btn btn-outline-secondary"
                onClick={() => setDetailPost(null)}
              >
                Xem sân
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <div className="main-wrapper content-below-header">
      <section className="breadcrumb breadcrumb-list mb-0" style={{ padding: '40px 0', overflow: 'hidden', position: 'relative' }}>
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white h2 mb-1">Nổi bật</h1>
          <ul className="mb-0">
            <li><Link to="/">Trang chủ</Link></li>
            <li>Nổi bật</li>
          </ul>
        </div>
      </section>

      <div className="content" style={{ fontFamily: FONT_UI, padding: '0px 0' }}>
        <div className="container pt-4 pb-5">
          <div className="p-3 p-md-4 mb-4 rounded-4 shadow-sm text-white position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #047857 0%, #0d9488 100%)' }}>
            <i className="feather-bell position-absolute text-white" style={{ fontSize: 90, right: '-5px', bottom: '-15px', opacity: 0.15, transform: 'rotate(-15deg)' }} />
            <div className="position-relative" style={{ zIndex: 1 }}>
              <h3 className="text-white fw-bold mb-2 h4">🎁 Ưu đãi & Tin tức</h3>
              <p className="mb-0 opacity-75" style={{ maxWidth: 640, fontSize: '0.95rem', lineHeight: 1.5 }}>
                Theo dõi các chương trình khuyến mãi, sự kiện, cập nhật thẻ giảm giá (coupon) và bản tin từ ShuttleUp cùng các cụm sân đối tác trên toàn quốc.
              </p>
            </div>
          </div>

          {loading && (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          )}

          {!loading && (error || posts.length === 0) && (
            <div className="white-bg corner-radius-10 p-5 text-center text-muted">
              <i className="feather-info me-2" />
              {error ? 'Nội dung đang được cập nhật. Vui lòng quay lại sau.' : 'Hiện chưa có bài đăng nào. Hãy quay lại sau nhé!'}
            </div>
          )}

          {!loading && !error && posts.length > 0 && (
            <>
              {/* Toolbar */}
              <div className="row g-3 mb-4">
                <div className="col-md-6 col-lg-4">
                  <div className="input-group">
                    <span className="input-group-text bg-white border-end-0 text-muted">
                      <i className="feather-search"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="Tìm kiếm bài viết, mã giảm giá..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6 col-lg-3">
                  <select
                    className="form-select"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="ALL">Tất cả thông báo</option>
                    <option value="ADMIN">Từ hệ thống ShuttleUp</option>
                    <option value="MANAGER">Khuyến mãi từ Cụm sân</option>
                  </select>
                </div>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="white-bg corner-radius-10 p-5 text-center text-muted">
                  <i className="feather-search fs-3 mb-2 d-block text-secondary" />
                  Không tìm thấy bài viết nào phù hợp với điều kiện lọc.
                </div>
              ) : (
                <>
                  <div className="row g-4 mb-4">
                    {displayedPosts.map((p) => {
                      const preview = cardPreview(p);
                      const showDetailBtn = needsDetailModal(p);
                      return (
                        <div key={p.id} className="col-md-6 col-lg-4">
                          <article
                            className="white-bg corner-radius-10 overflow-hidden h-100 shadow-sm d-flex flex-column"
                            style={{ border: '1px solid #eef2f6' }}
                          >
                            {p.coverImageUrl ? (
                              <div
                                className="position-relative"
                                style={{ cursor: showDetailBtn ? 'pointer' : 'default' }}
                                onClick={() => showDetailBtn && setDetailPost(p)}
                                onKeyDown={(e) => {
                                  if (showDetailBtn && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    setDetailPost(p);
                                  }
                                }}
                                role={showDetailBtn ? 'button' : undefined}
                                tabIndex={showDetailBtn ? 0 : undefined}
                                aria-label={showDetailBtn ? 'Xem chi tiết bài đăng' : undefined}
                              >
                                <img src={p.coverImageUrl} alt="" className="w-100" style={{ height: 180, objectFit: 'cover' }} />
                              </div>
                            ) : (
                              <div className="bg-light d-flex align-items-center justify-content-center" style={{ height: 140 }}>
                                <i className="fa-regular fa-image text-muted" style={{ fontSize: 36 }} />
                              </div>
                            )}
                            <div className="p-4 d-flex flex-column flex-grow-1">
                              <div className="d-flex flex-wrap gap-2 mb-2 align-items-center">
                                <span className="badge border-0" style={roleBadgeStyle(p)}>
                                  {p.authorRole === 'ADMIN' ? 'ShuttleUp' : 'Cụm sân'}
                                </span>
                                {p.venueName && (
                                  <span
                                    className="badge border-0"
                                    style={venueBadgeStyle(p.venueId || p.id)}
                                  >
                                    {p.venueName}
                                  </span>
                                )}
                              </div>
                              <h4 className="mb-2" style={{ fontSize: 18, fontWeight: 700 }}>{p.title}</h4>
                              {p.createdAt && (
                                <p className="text-muted small mb-2">
                                  <i className="feather-clock me-1"></i>
                                  {formatDate(p.createdAt)}
                                </p>
                              )}
                              {preview && (
                                <p className="text-muted small mb-3 flex-grow-1" style={{ lineHeight: 1.6 }}>
                                  {preview}
                                </p>
                              )}
                              <div className="d-flex flex-wrap gap-2 align-items-center mt-auto pt-3 border-top border-light">
                                {showDetailBtn && (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{ background: '#097E52', borderColor: '#097E52' }}
                                    onClick={() => setDetailPost(p)}
                                  >
                                    Xem thêm
                                  </button>
                                )}
                                {!showDetailBtn && p.linkUrl && (
                                  <a
                                    href={p.linkUrl}
                                    className="btn btn-primary btn-sm"
                                    style={{ background: '#097E52', borderColor: '#097E52' }}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Mở liên kết
                                  </a>
                                )}
                                {p.venueId && (
                                  <Link to={`/venue-details/${p.venueId}`} className="btn btn-outline-secondary btn-sm">
                                    Xem sân
                                  </Link>
                                )}
                              </div>
                            </div>
                          </article>
                        </div>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="d-flex justify-content-center">
                      <nav>
                        <ul className="pagination">
                          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setCurrentPage(c => Math.max(1, c - 1))}>
                              Trước
                            </button>
                          </li>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                              <button className="page-link" onClick={() => setCurrentPage(page)}>
                                {page}
                              </button>
                            </li>
                          ))}
                          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}>
                              Sau
                            </button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {detailModal}
    </div>
  );
}
