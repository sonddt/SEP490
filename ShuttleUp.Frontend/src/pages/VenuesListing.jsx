import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import VenueCard from '../components/courts/VenueCard';
import favoritesApi from '../api/favoritesApi';
import { profileApi } from '../api/profileApi';
import { useAuth } from '../context/AuthContext';
import { useVenueLocationAnchor } from '../hooks/useVenueLocationAnchor';
import { distanceToVenueKm } from '../utils/geoDistance';

const STORAGE_USE_GPS = 'shuttleup_venues_use_gps';

const AMENITIES_CATALOG = [
  { key: 'parking', label: 'Bãi đỗ xe', icon: 'feather-map-pin' },
  { key: 'water', label: 'Nước uống', icon: 'feather-droplet' },
  { key: 'locker', label: 'Tủ đồ & phòng thay đồ', icon: 'feather-briefcase' },
  { key: 'bathroom', label: 'Phòng tắm & nhà vệ sinh', icon: 'feather-wind' },
  { key: 'lighting', label: 'Đèn chiếu sáng', icon: 'feather-sun' },
  { key: 'security', label: 'Camera an ninh', icon: 'feather-camera' },
  { key: 'wifi', label: 'WiFi', icon: 'feather-wifi' },
  { key: 'rental_racket', label: 'Cho thuê vợt', icon: 'feather-activity' },
  { key: 'buy_shuttle', label: 'Mua cầu tại sân', icon: 'feather-shopping-bag' },
  { key: 'canteen', label: 'Căn tin / Quầy ăn uống', icon: 'feather-coffee' },
];

function normalizeText(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

function parseNumOrEmpty(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const n = Number(s);
  return Number.isFinite(n) ? n : '';
}

function parseAmenitiesParam(v) {
  const raw = String(v || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function serializeAmenitiesParam(list) {
  const arr = Array.isArray(list) ? list.filter(Boolean) : [];
  return arr.length ? arr.join(',') : '';
}

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
  const [searchParams, setSearchParams] = useSearchParams();
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

  const [sortBy, setSortBy] = useState('hybrid');
  const [displayCount, setDisplayCount] = useState(9);
  const [venues, setVenues] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters (persist in URL)
  const [keyword, setKeyword] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [ratingMin, setRatingMin] = useState(0);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [radiusKm, setRadiusKm] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const advancedActive =
    (priceMin !== '' && Number(priceMin) > 0) ||
    priceMax !== '' ||
    ratingMin > 0 ||
    selectedAmenities.length > 0 ||
    radiusKm !== '';

  useEffect(() => {
    if (advancedActive) setShowAdvanced(true);
  }, [advancedActive]);

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
    setSortBy((prev) => (prev === 'hybrid' ? 'hybrid' : prev));
    autoDistanceSortForGpsRef.current = true;
  }, [useGps, hasAnchor, source]);

  // Load filter state from URL (on first mount + back/forward)
  const loadedFromUrlRef = useRef(false);
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const minP = parseNumOrEmpty(searchParams.get('minPrice'));
    const maxP = parseNumOrEmpty(searchParams.get('maxPrice'));
    const minR = Number(searchParams.get('minRating') || '0') || 0;
    const am = parseAmenitiesParam(searchParams.get('amenities'));
    const rad = parseNumOrEmpty(searchParams.get('radiusKm'));
    const s = searchParams.get('sort') || '';

    setKeyword(q);
    setPriceMin(minP);
    setPriceMax(maxP);
    setRatingMin(Math.max(0, Math.min(5, minR)));
    setSelectedAmenities(am);
    setRadiusKm(rad);
    if (s) setSortBy(s);

    loadedFromUrlRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Persist filter state to URL (real-time)
  useEffect(() => {
    if (!loadedFromUrlRef.current) return;
    const next = new URLSearchParams(searchParams);
    const setOrDel = (k, v) => {
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) next.delete(k);
      else next.set(k, String(v));
    };

    setOrDel('q', keyword.trim());
    setOrDel('minPrice', priceMin === '' ? '' : priceMin);
    setOrDel('maxPrice', priceMax === '' ? '' : priceMax);
    setOrDel('minRating', ratingMin ? ratingMin : '');
    setOrDel('amenities', serializeAmenitiesParam(selectedAmenities));
    setOrDel('radiusKm', radiusKm === '' ? '' : radiusKm);
    setOrDel('sort', sortBy === 'hybrid' ? '' : sortBy);

    setSearchParams(next, { replace: true });
    setDisplayCount(9);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, priceMin, priceMax, ratingMin, selectedAmenities, radiusKm, sortBy]);

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
          id: v.id ?? v.Id,
          name: v.name ?? v.Name,
          location: v.address ?? v.Address,
          lat: v.lat ?? v.Lat ?? null,
          lng: v.lng ?? v.Lng ?? null,
          minPrice: v.minPrice ?? null,
          maxPrice: v.maxPrice ?? null,
          img: '/assets/img/venues/venues-01.jpg',
          rating: Number(v.rating ?? v.Rating ?? 0) || 0,
          reviewCount: Number(v.reviewCount ?? v.ReviewCount ?? 0) || 0,
          amenities: v.amenities ?? v.Amenities ?? [],
          createdAt: v.createdAt ?? v.CreatedAt ?? null,
          reviews: '',
          desc: '',
          ownerId: v.ownerUserId ?? v.OwnerUserId ?? null,
          owner: String(v.ownerName ?? v.OwnerName ?? '').trim(),
          avatar:
            v.ownerAvatarUrl ??
            v.OwnerAvatarUrl ??
            '/assets/img/profiles/avatar-01.jpg',
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
    const kw = normalizeText(keyword);
    const minP = priceMin === '' ? null : Number(priceMin);
    const maxP = priceMax === '' ? null : Number(priceMax);
    const rad = radiusKm === '' ? null : Number(radiusKm);
    const needAmenities = selectedAmenities || [];

    const getPrice = (v) => {
      const p = v.minPrice ?? v.maxPrice;
      const n = Number(p);
      return Number.isFinite(n) ? n : null;
    };

    const withDistance = venues.map((v) => {
      const distanceKm =
        hasAnchor && refLat != null && refLng != null
          ? distanceToVenueKm(refLat, refLng, v.lat, v.lng)
          : null;
      return { ...v, distanceKm };
    });

    // ── Filtering layers (ưu tiên lọc bỏ trước khi sort) ───────────────────
    let filtered = withDistance;

    if (kw) {
      filtered = filtered.filter((v) => {
        const n = normalizeText(v.name);
        const a = normalizeText(v.location);
        return n.includes(kw) || a.includes(kw);
      });
    }

    if (minP != null || maxP != null) {
      filtered = filtered.filter((v) => {
        const p = getPrice(v);
        if (p == null) return false;
        if (minP != null && p < minP) return false;
        if (maxP != null && p > maxP) return false;
        return true;
      });
    }

    if (ratingMin) {
      filtered = filtered.filter((v) => Number(v.rating || 0) >= ratingMin);
    }

    if (needAmenities.length) {
      filtered = filtered.filter((v) => {
        const a = Array.isArray(v.amenities) ? v.amenities : [];
        return needAmenities.every((k) => a.includes(k));
      });
    }

    if (hasAnchor && rad != null && Number.isFinite(rad) && rad > 0) {
      filtered = filtered.filter((v) => v.distanceKm != null && v.distanceKm <= rad);
    }

    // ── Sorting (hybrid) ───────────────────────────────────────────────────
    const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''));

    const priceCmp = (a, b, dir) => {
      const pa = getPrice(a);
      const pb = getPrice(b);
      const na = pa == null ? Number.POSITIVE_INFINITY : pa;
      const nb = pb == null ? Number.POSITIVE_INFINITY : pb;
      if (na === nb) return byName(a, b);
      return (na - nb) * dir;
    };

    const ratingCmp = (a, b) => {
      const ra = Number(a.rating || 0);
      const rb = Number(b.rating || 0);
      if (rb === ra) return priceCmp(a, b, 1);
      return rb - ra;
    };

    const newestCmp = (a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (tb === ta) return ratingCmp(a, b);
      return tb - ta;
    };

    const distanceHybridCmp = (a, b) => {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      const nearEq = Math.abs(da - db) < 0.4; // ~400m coi như tương đương
      if (da === db || nearEq) {
        // tie-break: rating cao hơn, rồi giá rẻ hơn
        const r = ratingCmp(a, b);
        if (r !== 0) return r;
        return priceCmp(a, b, 1);
      }
      return da - db;
    };

    const sortMode = (() => {
      if (sortBy && sortBy !== 'hybrid') return sortBy;
      if (hasAnchor) return 'distance';
      return 'rating_desc';
    })();

    const sortInGroup = (list) => {
      const copy = [...list];
      if (sortMode === 'price_asc') copy.sort((a, b) => priceCmp(a, b, 1));
      else if (sortMode === 'price_desc') copy.sort((a, b) => priceCmp(a, b, -1));
      else if (sortMode === 'newest_desc') copy.sort(newestCmp);
      else if (sortMode === 'rating_desc') copy.sort(ratingCmp);
      else if (sortMode === 'distance' && hasAnchor) copy.sort(distanceHybridCmp);
      else if (sortMode === 'distance' && !hasAnchor) copy.sort(ratingCmp);
      else copy.sort(hasAnchor ? distanceHybridCmp : ratingCmp);
      return copy;
    };

    if (favoriteIds && favoriteIds.size > 0) {
      const favList = filtered.filter((v) => favoriteIds.has(v.id));
      const otherList = filtered.filter((v) => !favoriteIds.has(v.id));
      return [...sortInGroup(favList), ...sortInGroup(otherList)];
    }

    return sortInGroup(filtered);
  }, [
    venues,
    favoriteIds,
    hasAnchor,
    refLat,
    refLng,
    keyword,
    priceMin,
    priceMax,
    ratingMin,
    selectedAmenities,
    radiusKm,
    sortBy,
  ]);

  const visibleVenues = sortedVenues.slice(0, displayCount);
  const hasMore = displayCount < sortedVenues.length;

  // Price slider bounds (từ dữ liệu venues)
  const priceBounds = useMemo(() => {
    const nums = venues
      .map((v) => [v.minPrice, v.maxPrice])
      .flat()
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return { min: 0, max: 500000 };
    const min = Math.max(0, Math.floor(Math.min(...nums) / 10000) * 10000);
    const max = Math.ceil(Math.max(...nums) / 10000) * 10000;
    return { min, max: Math.max(min + 10000, max) };
  }, [venues]);

  const clampPrice = useCallback(
    (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return '';
      return Math.max(priceBounds.min, Math.min(priceBounds.max, n));
    },
    [priceBounds.min, priceBounds.max]
  );

  const formatVndShort = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}tr`;
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return `${n}`;
  };

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
                              <option value="hybrid">
                                {hasAnchor ? 'Tối ưu (Gần nhất + Giá/Đánh giá)' : 'Tối ưu (Đánh giá cao)'}
                              </option>
                              {hasAnchor && <option value="distance">Gần nhất</option>}
                              <option value="price_asc">Giá tăng dần</option>
                              <option value="price_desc">Giá giảm dần</option>
                              <option value="rating_desc">Đánh giá cao nhất</option>
                              <option value="newest_desc">Sân mới nhất</option>
                            </select>
                            {hasAnchor && (sortBy === 'price_asc' || sortBy === 'price_desc') && (
                              <p className="small text-muted mb-0 mt-2">
                                Bạn đang sắp xếp theo giá — hệ thống vẫn hiển thị khoảng cách để bạn tham khảo.
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

          {/* Filters */}
          <div className="row mb-3">
            <div className="col-12">
              <div className="card border-0 shadow-sm rounded-3">
                <div className="card-body p-3 p-md-4">
                  <div className="row g-3 align-items-end">
                    <div className="col-lg-6">
                      <label className="form-label fw-semibold">Tìm theo tên / địa chỉ</label>
                      <div className="input-group">
                        <span className="input-group-text bg-white">
                          <i className="feather-search" />
                        </span>
                        <input
                          className="form-control"
                          value={keyword}
                          placeholder="VD: Long Biên, Ninh Kiều, Hải Châu..."
                          onChange={(e) => setKeyword(e.target.value)}
                        />
                        {keyword.trim() && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setKeyword('')}
                            title="Xóa"
                          >
                            <i className="feather-x" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="col-lg-3 col-6">
                      <label className="form-label fw-semibold">Sao tối thiểu</label>
                      <select
                        className="form-control"
                        value={ratingMin}
                        onChange={(e) => setRatingMin(Number(e.target.value) || 0)}
                      >
                        <option value={0}>Tất cả</option>
                        <option value={3}>Từ 3.0+</option>
                        <option value={3.5}>Từ 3.5+</option>
                        <option value={4}>Từ 4.0+</option>
                        <option value={4.5}>Từ 4.5+</option>
                      </select>
                    </div>

                    <div className="col-lg-3 col-6 d-flex justify-content-lg-end">
                      <button
                        type="button"
                        className={`btn ${showAdvanced ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setShowAdvanced((v) => !v)}
                        style={{ borderRadius: 12, width: '100%' }}
                      >
                        <i className={`feather-${showAdvanced ? 'chevron-up' : 'sliders'}`} style={{ marginRight: 8 }} />
                        Bộ lọc nâng cao
                        {advancedActive && !showAdvanced && (
                          <span className="badge text-bg-primary ms-2">Đang bật</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {showAdvanced && (
                    <div className="mt-3 pt-3 border-top">
                      <div className="row g-3">
                        {/* Price slider */}
                        <div className="col-lg-6">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="form-label fw-semibold mb-0">Khoảng giá</label>
                            <span className="small text-muted">
                              {priceMin === '' && priceMax === ''
                                ? `Tất cả (${formatVndShort(priceBounds.min)}–${formatVndShort(priceBounds.max)})`
                                : `${priceMin === '' ? formatVndShort(priceBounds.min) : formatVndShort(priceMin)} – ${
                                    priceMax === '' ? formatVndShort(priceBounds.max) : formatVndShort(priceMax)
                                  }`}
                            </span>
                          </div>
                          <div className="px-1">
                            <input
                              type="range"
                              min={priceBounds.min}
                              max={priceBounds.max}
                              step={10000}
                              value={priceMin === '' ? priceBounds.min : priceMin}
                              onChange={(e) => {
                                const v = clampPrice(e.target.value);
                                setPriceMin(v);
                                if (priceMax !== '' && Number(v) > Number(priceMax)) setPriceMax(v);
                              }}
                              className="form-range"
                            />
                            <input
                              type="range"
                              min={priceBounds.min}
                              max={priceBounds.max}
                              step={10000}
                              value={priceMax === '' ? priceBounds.max : priceMax}
                              onChange={(e) => {
                                const v = clampPrice(e.target.value);
                                setPriceMax(v);
                                if (priceMin !== '' && Number(v) < Number(priceMin)) setPriceMin(v);
                              }}
                              className="form-range mt-1"
                            />
                          </div>
                          <div className="d-flex gap-2 mt-2">
                            <input
                              type="number"
                              min="0"
                              className="form-control"
                              value={priceMin}
                              placeholder="Giá từ"
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') return setPriceMin('');
                                const v = clampPrice(raw);
                                setPriceMin(v);
                              }}
                            />
                            <input
                              type="number"
                              min="0"
                              className="form-control"
                              value={priceMax}
                              placeholder="Giá đến"
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') return setPriceMax('');
                                const v = clampPrice(raw);
                                setPriceMax(v);
                              }}
                            />
                            {(priceMin !== '' || priceMax !== '') && (
                              <button
                                type="button"
                                className="btn btn-light"
                                onClick={() => {
                                  setPriceMin('');
                                  setPriceMax('');
                                }}
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          <p className="small text-muted mb-0 mt-2">
                            Mẹo: kéo thanh để lọc nhanh theo ngân sách.
                          </p>
                        </div>

                        {/* Radius */}
                        <div className="col-lg-3 col-6">
                          <label className="form-label fw-semibold">Bán kính (km)</label>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            disabled={!hasAnchor}
                            value={radiusKm}
                            placeholder={hasAnchor ? 'VD: 10' : 'Bật định vị để dùng'}
                            onChange={(e) =>
                              setRadiusKm(e.target.value === '' ? '' : Number(e.target.value))
                            }
                          />
                          {!hasAnchor && (
                            <p className="small text-muted mb-0 mt-2">
                              Bật định vị để lọc theo bán kính.
                            </p>
                          )}
                        </div>

                        {/* Amenities chips */}
                        <div className="col-lg-3 col-6">
                          <label className="form-label fw-semibold">Tiện ích</label>
                          <div className="d-flex flex-wrap gap-2">
                            {AMENITIES_CATALOG.map((a) => {
                              const active = selectedAmenities.includes(a.key);
                              return (
                                <button
                                  key={a.key}
                                  type="button"
                                  onClick={() => {
                                    setSelectedAmenities((prev) => {
                                      const set = new Set(prev);
                                      if (set.has(a.key)) set.delete(a.key);
                                      else set.add(a.key);
                                      return Array.from(set);
                                    });
                                  }}
                                  className="btn btn-sm"
                                  style={{
                                    borderRadius: 999,
                                    border: active ? '1px solid #097E52' : '1px solid #e2e8f0',
                                    background: active ? '#e8f5ee' : '#fff',
                                    color: active ? '#065f3f' : '#475569',
                                    fontWeight: 700,
                                  }}
                                >
                                  <i className={a.icon} style={{ marginRight: 6 }} />
                                  {a.label}
                                  {active && <i className="feather-check ms-1" />}
                                </button>
                              );
                            })}
                            {selectedAmenities.length > 0 && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-decoration-none"
                                onClick={() => setSelectedAmenities([])}
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quick clear */}
                        {(advancedActive || keyword.trim()) && (
                          <div className="col-12">
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => {
                                setKeyword('');
                                setPriceMin('');
                                setPriceMax('');
                                setRatingMin(0);
                                setSelectedAmenities([]);
                                setRadiusKm('');
                                setSortBy('hybrid');
                              }}
                            >
                              Xóa toàn bộ bộ lọc
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
            {!loading && !error && visibleVenues.length === 0 && (
              <div className="col-12">
                <div className="alert alert-info">
                  Không có sân nào phù hợp với bộ lọc hiện tại.{' '}
                  {hasAnchor && radiusKm ? (
                    <span>Gợi ý: thử <strong>mở rộng bán kính</strong> hoặc xóa bớt tiện ích.</span>
                  ) : (
                    <span>Gợi ý: thử <strong>xóa bớt bộ lọc</strong> hoặc giảm mức sao tối thiểu.</span>
                  )}
                </div>
              </div>
            )}
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
