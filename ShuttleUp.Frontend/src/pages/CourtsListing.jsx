import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { venuesMock } from '../data/venuesMock';
import VenueCard from '../components/courts/VenueCard';

/**
 * Danh sách sân - Grid (listing-grid) và List (listing-list) view.
 * Route: /courts = grid, /courts/list = list.
 */
export default function CourtsListing() {
  const location = useLocation();
  const isListView = location.pathname === '/courts/list';

  const [sortBy, setSortBy] = useState('relevance');
  const [displayCount, setDisplayCount] = useState(9);

  const venues = useMemo(() => {
    const list = [...venuesMock];
    if (sortBy === 'price') {
      list.sort((a, b) => a.price - b.price);
    }
    return list;
  }, [sortBy]);

  const visibleVenues = venues.slice(0, displayCount);
  const hasMore = displayCount < venues.length;

  const breadcrumbTitle = isListView
    ? 'Venue List Without Sidebar'
    : 'Venue Grid Without Sidebar';

  return (
    <div className="main-wrapper">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">{breadcrumbTitle}</h1>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li>{breadcrumbTitle}</li>
          </ul>
        </div>
      </section>

      {/* Page Content */}
      <div className={`content ${isListView ? 'listing-list-page' : ''}`}>
        <div className="container">
          {/* Sort By */}
          <div className="row">
            <div className="col-lg-12">
              <div className="sortby-section">
                <div className="sorting-info">
                  <div className="row d-flex align-items-center">
                    <div className="col-xl-4 col-lg-3 col-sm-12 col-12">
                      <div className="count-search">
                        <p><span>{venues.length}</span> venues are listed</p>
                      </div>
                    </div>
                    <div className="col-xl-8 col-lg-9 col-sm-12 col-12">
                      <div className="sortby-filter-group">
                        <div className="grid-listview">
                          <ul className="nav">
                            <li><span>View as</span></li>
                            <li>
                              <Link
                                to="/courts"
                                className={!isListView ? 'active' : ''}
                                aria-label="Grid view"
                              >
                                <img src="/assets/img/icons/sort-01.svg" alt="Grid" />
                              </Link>
                            </li>
                            <li>
                              <Link
                                to="/courts/list"
                                className={isListView ? 'active' : ''}
                                aria-label="List view"
                              >
                                <img src="/assets/img/icons/sort-02.svg" alt="List" />
                              </Link>
                            </li>
                            <li>
                              <Link to="/courts/map" aria-label="Map view">
                                <img src="/assets/img/icons/sort-03.svg" alt="Map" />
                              </Link>
                            </li>
                          </ul>
                        </div>
                        <div className="sortbyset">
                          <span className="sortbytitle">Sort By</span>
                          <div className="sorting-select">
                            <select
                              className="form-control select"
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value)}
                            >
                              <option value="relevance">Relevance</option>
                              <option value="price">Price</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Listing Content */}
          <div className="row justify-content-center">
            {visibleVenues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                viewMode={isListView ? 'list' : 'grid'}
              />
            ))}
            <div className="col-12 text-center">
              <div className="more-details">
                {hasMore ? (
                  <button
                    type="button"
                    className="btn btn-load"
                    onClick={() => setDisplayCount((c) => Math.min(c + 6, venues.length))}
                  >
                    Load More <img src="/assets/img/icons/u_plus-square.svg" className="ms-2" alt="" />
                  </button>
                ) : (
                  <p className="text-muted mb-0">Đã hiển thị tất cả sân.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
