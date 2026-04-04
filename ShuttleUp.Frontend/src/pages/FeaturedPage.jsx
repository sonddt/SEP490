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

export default function FeaturedPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailPost, setDetailPost] = useState(null);

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
              <h2 id="featured-detail-title" className="modal-title fw-bold h5 mb-0" style={{ fontSize: '1.25rem' }}>
                {detailPost.title}
              </h2>
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
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white">Nổi bật</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Nổi bật</li>
          </ul>
        </div>
      </section>

      <div className="content" style={{ fontFamily: FONT_UI }}>
        <div className="container py-5">
          <p className="text-muted mb-4" style={{ maxWidth: 640, fontSize: 15 }}>
            Tin ưu đãi, khuyến mãi và thông báo từ ShuttleUp cùng các cụm sân đối tác.
          </p>

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

          <div className="row g-4">
            {posts.map((p) => {
              const preview = cardPreview(p);
              const showDetailBtn = needsDetailModal(p);
              return (
                <div key={p.id} className="col-md-6 col-lg-4">
                  <article
                    className="white-bg corner-radius-10 overflow-hidden h-100 shadow-sm"
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
                    <div className="p-4">
                      <div className="d-flex flex-wrap gap-2 mb-2">
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
                      {preview && (
                        <p className="text-muted small mb-3" style={{ lineHeight: 1.6 }}>
                          {preview}
                        </p>
                      )}
                      <div className="d-flex flex-wrap gap-2 align-items-center">
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
        </div>
      </div>
      {detailModal}
    </div>
  );
}
