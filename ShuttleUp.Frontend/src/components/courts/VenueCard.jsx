import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StarRatingDisplay from '../common/StarRatingDisplay';

/**
 * Thẻ hiển thị thông tin một sân (grid hoặc list),
 * chuyển thể từ listing-grid.html / listing-list.html.
 */
export default function VenueCard({
  venue,
  viewMode = 'grid',
  isFavorited = false,
  onToggleFavorite,
  /** Khoảng cách km (từ điểm neo GPS/hồ sơ), hiển thị khi có */
  distanceKm = null,
}) {
  // Sync tim với trạng thái thật từ props.
  const [faved, setFaved] = useState(!!isFavorited);

  const isList = viewMode === 'list';

  useEffect(() => {
    setFaved(!!isFavorited);
  }, [isFavorited]);

  const formatPriceK = (value) => {
    if (value == null) return null;
    const num = Number(value) || 0;
    if (num >= 1000) {
      return `${Math.round(num / 1000)}k`;
    }
    return `${num}`;
  };

  const minLabel = formatPriceK(venue.minPrice);
  const maxLabel = formatPriceK(venue.maxPrice);

  let priceLabel = 'Liên hệ';
  if (minLabel && maxLabel) {
    priceLabel = minLabel === maxLabel ? `${minLabel}` : `${minLabel} - ${maxLabel}`;
  } else if (minLabel) {
    priceLabel = minLabel;
  } else if (maxLabel) {
    priceLabel = maxLabel;
  }

  const distanceDisplay =
    distanceKm != null && Number.isFinite(distanceKm)
      ? Math.abs(distanceKm) < 10
        ? Math.abs(distanceKm).toFixed(1)
        : String(Math.round(Math.abs(distanceKm)))
      : null;

  const ratingNum = Number(venue.rating);
  const ratingLabel = (() => {
    const r = ratingNum;
    if (!Number.isFinite(r) || r <= 0) return '—';
    return r.toFixed(1);
  })();

  const reviewCount = Number(venue.reviewCount ?? 0) || 0;
  const reviewsLabel =
    typeof venue.reviews === 'string' && venue.reviews.trim()
      ? venue.reviews
      : reviewCount > 0
        ? `${reviewCount} Đánh giá`
        : 'Chưa có đánh giá';

  return (
    <div className={isList ? 'col-lg-12 col-md-12' : 'col-lg-4 col-md-6'}>
      <div className={isList ? 'featured-venues-item venue-list-item' : 'wrapper'}>
        <div className="listing-item listing-item-grid">
          <div className="listing-img">
            <Link to={`/venue-details/${venue.id}`}>
              <img
                src={venue.img}
                className="img-fluid"
                alt={venue.name}
                style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
                onError={(e) => { e.target.onerror = null; e.target.src = '/assets/img/venues/venues-01.jpg'; }}
              />
            </Link>
            <div className="fav-item-venues venue-card-fav-badges">
              <div
                className="venue-card-fav-badges__left d-flex flex-column gap-1"
                style={{ transform: 'translateX(-12px)', marginRight: 'auto' }}
              >
                {venue.tag && (
                  <span className={`tag ${venue.tagClass}`}>{venue.tag}</span>
                )}
                <h5 className="tag tag-primary" style={{ marginLeft: 0, marginBottom: 0 }}>
                  {priceLabel}
                  <span>/giờ</span>
                </h5>
              </div>

              {/* Heart on top-right like template (near-you) */}
              <div className="list-reviews coche-star" style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  className={`fav-icon ${faved ? 'selected' : ''}`}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const next = !faved;
                    setFaved(next); // optimistic UI
                    try {
                      if (onToggleFavorite) {
                        await onToggleFavorite(venue.id, next);
                      }
                    } catch {
                      setFaved(!next);
                    }
                  }}
                  aria-label="Thêm vào yêu thích"
                >
                  <i className="feather-heart"></i>
                </button>
              </div>
            </div>
          </div>
          <div className="listing-content">
            <h3 className="listing-title">
              <Link to={`/venue-details/${venue.id}`}>{venue.name}</Link>
            </h3>
            <div className="listing-details-group">
              <p>{venue.desc}</p>
              <ul className={isList ? 'listing-details-info' : ''}>
                <li>
                  <span>
                    <i className="feather-map-pin"></i>
                    {venue.location}
                  </span>
                </li>
                <li>
                  <span>
                    <i className="feather-calendar"></i>
                    Lịch trống tới: <span className="primary-text">{venue.nextAvailability}</span>
                  </span>
                </li>
              </ul>
            </div>

            {/* Match card row in screenshot: rating + reviews + distance badge */}
            <div className="list-reviews near-review">
              <div className="d-flex align-items-center flex-wrap gap-1">
                <span className="rating-bg">{ratingLabel}</span>
                {Number.isFinite(ratingNum) && ratingNum > 0 && (
                  <StarRatingDisplay value={ratingNum} size={13} className="ms-1" />
                )}
                <span>{reviewsLabel}</span>
              </div>
              {distanceDisplay != null && (
                <span className="mile-away">
                  <i className="feather-zap"></i>
                  Cách {distanceDisplay} km
                </span>
              )}
            </div>

            <div className="listing-button">
              <div className="listing-venue-owner">
                <Link
                  to={venue.ownerId ? `/user/profile/${venue.ownerId}` : '#'}
                  className="navigation"
                  onClick={(e) => {
                    if (!venue.ownerId) e.preventDefault();
                  }}
                >
                  <img
                    src={venue.avatar}
                    alt={venue.owner || 'Chủ sân'}
                    onError={(e) => { e.target.onerror = null; e.target.src = '/assets/img/profiles/avatar-01.jpg'; }}
                  />
                  {(venue.owner || '').trim() || 'Chủ sân'}
                </Link>
              </div>
              <Link to={`/venue-details/${venue.id}`} className="user-book-now">
                <span><i className="feather-calendar me-2"></i></span>
                Xem &amp; Đặt sân
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
