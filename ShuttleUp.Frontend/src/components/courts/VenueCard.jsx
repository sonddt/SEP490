import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Thẻ hiển thị thông tin một sân (grid hoặc list),
 * chuyển thể từ listing-grid.html / listing-list.html.
 */
export default function VenueCard({ venue, viewMode = 'grid' }) {
  const [faved, setFaved] = useState(false);

  const isList = viewMode === 'list';

  return (
    <div className={isList ? 'col-lg-12 col-md-12' : 'col-lg-4 col-md-6'}>
      <div className={isList ? 'featured-venues-item venue-list-item' : 'wrapper'}>
        <div className="listing-item listing-item-grid">
          <div className="listing-img">
            <Link to="/venue-details">
              <img src={venue.img} className="img-fluid" alt={venue.name} />
            </Link>
            <div className="fav-item-venues">
              {venue.tag && (
                <span className={`tag ${venue.tagClass}`}>{venue.tag}</span>
              )}
              <h5 className="tag tag-primary">
                {venue.price}<span>/giờ</span>
              </h5>
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
                onClick={() => setFaved(!faved)}
                aria-label="Thêm vào yêu thích"
              >
                <i className="feather-heart"></i>
              </button>
            </div>
            <h3 className="listing-title">
              <Link to="/venue-details">{venue.name}</Link>
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
              <Link to="/venue-details" className="user-book-now">
                <span><i className="feather-calendar me-2"></i></span>
                Đặt sân
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
