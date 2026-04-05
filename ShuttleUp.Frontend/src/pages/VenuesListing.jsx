import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import VenueCard from '../components/courts/VenueCard';
import favoritesApi from '../api/favoritesApi';
import { profileApi } from '../api/profileApi';
import { useAuth } from '../context/AuthContext';
import { useVenueLocationAnchor } from '../hooks/useVenueLocationAnchor';
import { distanceToVenueKm } from '../utils/geoDistance';

const STORAGE_USE_GPS = 'shuttleup_venues_use_gps';

function readUseGpsPreference() {
  try {
    return localStorage.getItem(STORAGE_USE_GPS) === '1';
  } catch {
    return false;
  }
}

function writeUseGpsPreference(on) {
  try {
    localStorage.setItem(STORAGE_USE_GPS, on ? '1' : '0');
  } catch {
    /* */
  }
}

function formatAnchorCoords(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return '—';
  return `${la.toFixed(5)}, ${lo.toFixed(5)}`;
}

/**
 * Danh sách venues - Grid (listing-grid) và List (listing-list) view.
 * Route: /venues = grid, /venues/list = list.
 */
export default function VenuesListing() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const isListView = location.pathname === '/venues/list';

  const [useGps, setUseGps] = useState(() => readUseGpsPreference());
  const [profileParts, setProfileParts] = useState({
    address: '',
    district: '',
    province: '',
  });

  const {
    refLat,
    refLng,
    source,
    status: anchorStatus,
    message: anchorMessage,
    hasAnchor,
    profileQuery,
    refreshGps,
    gpsPlaceName,
    gpsPlaceLoading,
  } = useVenueLocationAnchor(useGps, profileParts);

  const [sortBy, setSortBy] = useState('price_asc');
  const [displayCount, setDisplayCount] = useState(9);
  const [venues, setVenues] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Mỗi lần bật GPS, tự chọn "Gần nhất" một lần (đúng kỳ vọng ưu tiên sân gần). */
  const autoDistanceSortForGpsRef = useRef(false);

  const loadProfileAddress = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setProfileParts({ address: '', district: '', province: '' });
      return;
    }
    try {
      const data = await profileApi.getMe();
      const u = data?.user ?? data?.User;
      if (!u) return;
      setProfileParts({
        address: u.address ?? u.Address ?? '',
        district: u.district ?? u.District ?? '',
        province: u.province ?? u.Province ?? '',
      });
    } catch {
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          setProfileParts({
            address: u.address ?? '',
            district: u.district ?? '',
            province: u.province ?? '',
          });
        }
      } catch {
        /* */
      }
    }
  }, []);

  useEffect(() => {
    loadProfileAddress();
  }, [loadProfileAddress, isAuthenticated]);

  useEffect(() => {
    if (!user) return;
    const a = user.address ?? user.Address;
    const d = user.district ?? user.District;
    const p = user.province ?? user.Province;
    if (a || d || p) {
      setProfileParts((prev) => ({
        address: a || prev.address,
        district: d || prev.district,
        province: p || prev.province,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!hasAnchor && sortBy === 'distance_asc') {
      setSortBy('price_asc');
    }
  }, [hasAnchor, sortBy]);

  useEffect(() => {
    if (!useGps) {
      autoDistanceSortForGpsRef.current = false;
      return;
    }
    if (!hasAnchor || source !== 'gps') return;
    if (autoDistanceSortForGpsRef.current) return;
    setSortBy('distance_asc');
    autoDistanceSortForGpsRef.current = true;
  }, [useGps, hasAnchor, source]);

  useEffect(() => {
    async function loadVenues() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          '/api/venues?sortBy=price&sortDir=asc'
        );

        if (!response.ok) {
          throw new Error(`Failed to load venues (${response.status})`);
        }

        const data = await response.json();
        const mapped = data.map((v) => ({
          id: v.id,
          name: v.name,
          location: v.address,
          lat: v.lat ?? v.Lat ?? null,
          lng: v.lng ?? v.Lng ?? null,
          minPrice: v.minPrice ?? null,
          maxPrice: v.maxPrice ?? null,
          img: '/assets/img/venues/venues-01.jpg',
          rating: '4.5',
          reviews: '',
          desc: '',
          avatar: '/assets/img/profiles/avatar-01.jpg',
          owner: '',
        }));

        setVenues(mapped);

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
  }, []);

  const sortedVenues = useMemo(() => {
    const getPrice = (v) => v.minPrice ?? v.maxPrice ?? 0;

    const withDistance = venues.map((v) => {
      const distanceKm =
        hasAnchor && refLat != null && refLng != null
          ? distanceToVenueKm(refLat, refLng, v.lat, v.lng)
          : null;
      return { ...v, distanceKm };
    });

    const priceCmp = (a, b) => {
      const pa = getPrice(a);
      const pb = getPrice(b);
      const dir = sortBy === 'price_desc' ? -1 : 1;

      if (pa === pb) {
        return String(a.name ?? '').localeCompare(String(b.name ?? ''));
      }
      return (pa - pb) * dir;
    };

    const distCmp = (a, b) => {
      const da = a.distanceKm;
      const db = b.distanceKm;
      const inf = Number.POSITIVE_INFINITY;
      const na = da == null ? inf : da;
      const nb = db == null ? inf : db;
      if (na === nb) {
        return priceCmp(a, b);
      }
      return na - nb;
    };

    const sortInGroup = (list) => {
      const copy = [...list];
      if (sortBy === 'distance_asc' && hasAnchor) {
        copy.sort(distCmp);
      } else {
        copy.sort(priceCmp);
      }
      return copy;
    };

    if (favoriteIds && favoriteIds.size > 0) {
      const favList = withDistance.filter((v) => favoriteIds.has(v.id));
      const otherList = withDistance.filter((v) => !favoriteIds.has(v.id));
      return [...sortInGroup(favList), ...sortInGroup(otherList)];
    }

    return sortInGroup(withDistance);
  }, [venues, sortBy, favoriteIds, hasAnchor, refLat, refLng]);

  const visibleVenues = sortedVenues.slice(0, displayCount);
  const hasMore = displayCount < sortedVenues.length;

  const toggleGps = (next) => {
    setUseGps(next);
    writeUseGpsPreference(next);
  };

  const statusLabel =
    source === 'gps'
      ? 'Đang dùng vị trí GPS'
      : source === 'profile'
        ? 'Theo địa chỉ trong hồ sơ'
        : 'Không lọc theo vị trí địa lý';

  const breadcrumbTitle = isListView
    ? 'Danh sách sân (dạng danh sách)'
    : 'Danh sách sân (dạng lưới)';

  const hasProfileText =
    !!(profileParts.address || profileParts.district || profileParts.province);

  return (
    <div className="main-wrapper content-below-header">
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

      <div className={`content ${isListView ? 'listing-list-page' : ''}`}>
        <div className="container">
          <div className="row mb-3">
            <div className="col-12">
              <div
                className="card border-0 shadow-sm rounded-3 overflow-hidden"
                style={{ borderLeft: '4px solid #0d6efd' }}
              >
                <div className="card-body py-3 px-3 px-md-4 d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3">
                  <div className="d-flex align-items-center gap-3 flex-grow-1">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 text-white fw-bold"
                      style={{
                        width: 48,
                        height: 48,
                        background: useGps ? '#0d6efd' : '#64748b',
                        fontSize: 22,
                      }}
                      aria-hidden
                    >
                      {useGps ? '📍' : '🏠'}
                    </div>
                    <div>
                      <div className="fw-bold text-dark mb-1" style={{ fontSize: '1.05rem' }}>
                        Định vị để ưu tiên sân gần bạn
                      </div>
                      <div className="small text-muted mb-0">
                        {useGps
                          ? 'Bật: trình duyệt sẽ hỏi quyền vị trí. Nếu bạn từ chối, hệ thống dùng địa chỉ trong hồ sơ (nếu có).'
                          : 'Tắt: không dùng GPS; thứ tự theo địa chỉ hồ sơ nếu bạn đã nhập, nếu không thì chỉ sắp theo giá.'}
                      </div>
                    </div>
                  </div>
                  <div className="form-check form-switch ms-lg-3 flex-shrink-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="venues-use-gps"
                      checked={useGps}
                      onChange={(e) => toggleGps(e.target.checked)}
                      style={{ width: '3.25rem', height: '1.65rem', cursor: 'pointer' }}
                    />
                    <label
                      className="form-check-label fw-semibold ms-2"
                      htmlFor="venues-use-gps"
                      style={{ cursor: 'pointer' }}
                    >
                      Dùng vị trí của tôi (GPS)
                    </label>
                  </div>
                </div>
                <div className="px-3 px-md-4 pb-3 pt-0 border-top border-light">
                  <div className="d-flex flex-wrap align-items-center gap-2 small">
                    <span
                      className={`badge ${hasAnchor ? 'text-bg-success' : 'text-bg-secondary'}`}
                    >
                      {anchorStatus === 'loading' ? 'Đang xác định vị trí…' : statusLabel}
                    </span>
                    {useGps && hasAnchor && source === 'gps' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={refreshGps}
                      >
                        Cập nhật vị trí
                      </button>
                    )}
                    {!hasProfileText && !isAuthenticated && (
                      <span className="text-muted">
                        <Link to="/login">Đăng nhập</Link>
                        {' '}để lưu địa chỉ trong hồ sơ (fallback khi tắt GPS).
                      </span>
                    )}
                    {!hasProfileText && isAuthenticated && (
                      <span className="text-muted">
                        Chưa có địa chỉ hồ sơ —{' '}
                        <Link to="/user/profile/edit">Cập nhật hồ sơ</Link>
                      </span>
                    )}
                  </div>
                  {hasAnchor &&
                    anchorStatus === 'ready' &&
                    refLat != null &&
                    refLng != null && (
                      <div className="small mt-2 pt-2 border-top border-light">
                        {source === 'gps' && (
                          <>
                            <div className="mb-1">
                              <span className="text-muted">Tọa độ (WGS84): </span>
                              <code
                                className="user-select-all text-dark"
                                style={{ fontSize: '0.9em' }}
                              >
                                {formatAnchorCoords(refLat, refLng)}
                              </code>
                              <a
                                className="ms-2"
                                href={`https://www.google.com/maps?q=${encodeURIComponent(`${refLat},${refLng}`)}&z=16`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Mở Google Maps
                              </a>
                            </div>
                            {gpsPlaceLoading && (
                              <p className="text-muted mb-0 fst-italic">
                                Đang tra cứu địa danh…
                              </p>
                            )}
                            {!gpsPlaceLoading && gpsPlaceName && (
                              <p className="text-body-secondary mb-0">
                                <span className="text-muted">Gần đúng: </span>
                                {gpsPlaceName}
                              </p>
                            )}
                          </>
                        )}
                        {source === 'profile' && profileQuery && (
                          <p className="text-body-secondary mb-0">
                            <span className="text-muted">Neo theo địa chỉ: </span>
                            {profileQuery}
                          </p>
                        )}
                        {source === 'profile' && (
                          <p className="text-muted mb-0 mt-1">
                            Tọa độ đã geocode:{' '}
                            <code
                              className="user-select-all text-dark"
                              style={{ fontSize: '0.9em' }}
                            >
                              {formatAnchorCoords(refLat, refLng)}
                            </code>
                          </p>
                        )}
                      </div>
                    )}
                  {anchorMessage && (
                    <p className="small text-warning mb-0 mt-2">{anchorMessage}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

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
                                to="/venues"
                                className={!isListView ? 'active' : ''}
                                aria-label="Dạng lưới"
                              >
                                <img src="/assets/img/icons/sort-01.svg" alt="Grid" />
                              </Link>
                            </li>
                            <li>
                              <Link
                                to="/venues/list"
                                className={isListView ? 'active' : ''}
                                aria-label="Dạng danh sách"
                              >
                                <img src="/assets/img/icons/sort-02.svg" alt="List" />
                              </Link>
                            </li>
                            <li>
                              <Link to="/venues/map" aria-label="Bản đồ">
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
                              {hasAnchor && (
                                <option value="distance_asc">Gần nhất</option>
                              )}
                              <option value="price_asc">Giá tăng dần</option>
                              <option value="price_desc">Giá giảm dần</option>
                            </select>
                            {hasAnchor && sortBy !== 'distance_asc' && (
                              <p className="small text-muted mb-0 mt-2">
                                Bạn đang sắp xếp theo giá. Chọn &quot;Gần nhất&quot; để ưu tiên
                                sân gần điểm neo (GPS / hồ sơ).
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

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

          <div className="row justify-content-center">
            {!loading && !error && visibleVenues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                viewMode={isListView ? 'list' : 'grid'}
                isFavorited={favoriteIds.has(venue.id)}
                distanceKm={venue.distanceKm}
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
                    onClick={() =>
                      setDisplayCount((c) => Math.min(c + 6, sortedVenues.length))
                    }
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
