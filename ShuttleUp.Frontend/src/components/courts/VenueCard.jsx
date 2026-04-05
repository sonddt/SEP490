import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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

  return (
    <div className={isList ? 'col-lg-12 col-md-12' : 'col-lg-4 col-md-6'}>
      <div className={isList ? 'featured-venues-item venue-list-item' : 'wrapper'}>
        <div className="listing-item listing-item-grid">
          <div className="listing-img">
            <Link to={`/venue-details/${venue.id}`}>
              <img src={venue.img} className="img-fluid" alt={venue.name} />
            </Link>
            <div className="fav-item-venues venue-card-fav-badges">
              <div
                className="venue-card-fav-badges__left d-flex flex-column gap-1"
                style={{ transform: 'translateX(-12px)', marginRight: 'auto' }}
              >
                {venue.tag && (
                  <span className={`tag ${venue.tagClass}`}>{venue.tag}</span>
                )}
                <h5
                  className="tag tag-primary"
                  style={{ marginLeft: 0, marginBottom: 0 }}
                >
                  {priceLabel}
                  <span>/giờ</span>
                </h5>
              </div>
              {distanceDisplay != null && (
                <h5
                  className="tag venue-card-distance-badge"
                  style={{
                    marginLeft: 'auto',
                    marginBottom: 0,
                    alignSelf: 'flex-start',
                    background: '#475569',
                    fontSize: '0.85rem',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  ~{distanceDisplay} km
                </h5>
              )}
            </div>
          </div>
          <div className="listing-content">
            <div className="list-reviews">
              <div className="d-flex align-items-center">
                <span className="rating-bg">{venue.rating}</span>
                <span>{venue.reviews}</span>
              </div>
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
                    // Nếu API lỗi (vd chưa login), revert.
                    setFaved(!next);
                  }
                }}
                aria-label="Thêm vào yêu thích"
              >
                <i className="feather-heart"></i>
              </button>
            </div>
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
            <div className="listing-button">
              <div className="listing-venue-owner">
                <Link to="/manager-detail" className="navigation">
                  <img src={venue.avatar} alt={venue.owner} />
                  {venue.owner}
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
