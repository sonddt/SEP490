import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import VenueCard from '../components/courts/VenueCard';
import favoritesApi from '../api/favoritesApi';

/**
 * Danh sách sân - Grid (listing-grid) và List (listing-list) view.
 * Route: /courts = grid, /courts/list = list.
 */
export default function CourtsListing() {
  const location = useLocation();
  const isListView = location.pathname === '/courts/list';

  const [sortBy, setSortBy] = useState('price_asc');
  const [displayCount, setDisplayCount] = useState(9);
  const [venues, setVenues] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadVenues() {
      try {
        setLoading(true);
        setError(null);

        const sortDir = sortBy === 'price_desc' ? 'desc' : 'asc';
        const response = await fetch(
          `/api/venues?sortBy=price&sortDir=${encodeURIComponent(sortDir)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to load venues (${response.status})`);
        }

        const data = await response.json();
        // Map backend data về format VenueCard đang dùng tối thiểu:
        const mapped = data.map((v) => ({
          id: v.id,
          name: v.name,
          location: v.address,
          minPrice: v.minPrice ?? null,
          maxPrice: v.maxPrice ?? null,
          img: '/assets/img/venues/venues-01.jpg', // TODO: thay bằng ảnh thật khi có
          rating: '4.5', // TODO: map từ review khi đã có
          reviews: '',
          desc: '',
          avatar: '/assets/img/profiles/avatar-01.jpg',
          owner: '',
        }));

        setVenues(mapped);
        
        // Load favorites (nếu đã đăng nhập). Nếu chưa đăng nhập thì bỏ qua.
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const favs = await favoritesApi.getMyFavorites();
                setFavoriteIds(new Set(favs.map((f) => f.id ?? f.Id)));
          } catch {
            setFavoriteIds(new Set());
          }
        } else {
          setFavoriteIds(new Set());
        }
      } catch (err) {
        setError(err.message || 'Đã xảy ra lỗi khi tải danh sách sân.');
      } finally {
        setLoading(false);
      }
    }

    loadVenues();
  }, [sortBy]);

  const sortedVenues = useMemo(() => {
    const list = [...venues];
    const getPrice = (v) => v.minPrice ?? v.maxPrice ?? 0;

    if (sortBy === 'price_asc') {
      list.sort((a, b) => getPrice(a) - getPrice(b));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => getPrice(b) - getPrice(a));
    }
    return list;
  }, [venues, sortBy]);

  const visibleVenues = sortedVenues.slice(0, displayCount);
  const hasMore = displayCount < sortedVenues.length;

  const breadcrumbTitle = isListView
    ? 'Danh sách sân (dạng danh sách)'
    : 'Danh sách sân (dạng lưới)';

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">{breadcrumbTitle}</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
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
                        <p><span>{sortedVenues.length}</span> sân đang được hiển thị</p>
                      </div>
                    </div>
                    <div className="col-xl-8 col-lg-9 col-sm-12 col-12">
                      <div className="sortby-filter-group">
                        <div className="grid-listview">
                          <ul className="nav">
                            <li><span>Hiển thị dưới dạng</span></li>
                            <li>
                              <Link
                                to="/courts"
                                className={!isListView ? 'active' : ''}
                                aria-label="Dạng lưới"
                              >
                                <img src="/assets/img/icons/sort-01.svg" alt="Grid" />
                              </Link>
                            </li>
                            <li>
                              <Link
                                to="/courts/list"
                                className={isListView ? 'active' : ''}
                                aria-label="Dạng danh sách"
                              >
                                <img src="/assets/img/icons/sort-02.svg" alt="List" />
                              </Link>
                            </li>
                            <li>
                              <Link to="/courts/map" aria-label="Bản đồ">
                                <img src="/assets/img/icons/sort-03.svg" alt="Map" />
                              </Link>
                            </li>
                          </ul>
                        </div>
                        <div className="sortbyset">
                          <span className="sortbytitle">Sắp xếp theo</span>
                          <div className="sorting-select">
                            <select
                              className="form-control select"
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value)}
                            >
                              <option value="price_asc">Giá tăng dần</option>
                              <option value="price_desc">Giá giảm dần</option>
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

          {/* Loading / Error */}
          {loading && (
            <div className="row">
              <div className="col-12 text-center py-5">
                <p>Đang tải danh sách sân...</p>
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="row">
              <div className="col-12">
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              </div>
            </div>
          )}

          {/* Listing Content */}
          <div className="row justify-content-center">
            {!loading && !error && visibleVenues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                viewMode={isListView ? 'list' : 'grid'}
                isFavorited={favoriteIds.has(venue.id)}
                onToggleFavorite={async (venueId, shouldFavorite) => {
                  if (shouldFavorite) {
                    await favoritesApi.addFavorite(venueId);
                    setFavoriteIds((prev) => {
                      const next = new Set(prev);
                      next.add(venueId);
                      return next;
                    });
                  } else {
                    await favoritesApi.removeFavorite(venueId);
                    setFavoriteIds((prev) => {
                      const next = new Set(prev);
                      next.delete(venueId);
                      return next;
                    });
                  }
                }}
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
                    Xem thêm <img src="/assets/img/icons/u_plus-square.svg" className="ms-2" alt="" />
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
