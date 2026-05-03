import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import VenueCard from '../components/courts/VenueCard';
import favoritesApi from '../api/favoritesApi';
import { profileApi } from '../api/profileApi';
import { useAuth } from '../context/AuthContext';
import { useVenueLocationAnchor } from '../hooks/useVenueLocationAnchor';
import { distanceToVenueKm } from '../utils/geoDistance';
import { normalizeSearchText } from '../utils/searchNormalize';

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
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 9;
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
    setPage(1);
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
          img: v.thumbnailUrl ?? v.ThumbnailUrl ?? '/assets/img/venues/venues-01.jpg',
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
    const kw = normalizeSearchText(keyword);
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
        const n = normalizeSearchText(v.name);
        const a = normalizeSearchText(v.location);
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

  const totalPages = Math.ceil(sortedVenues.length / ITEMS_PER_PAGE);
  const visibleVenues = sortedVenues.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const getPaginationGroups = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }
    return pages;
  };

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
      <section className="breadcrumb breadcrumb-list mb-0" style={{ padding: '40px 0', overflow: 'hidden', position: 'relative' }}>
        <span className="primary-right-round" />
        <div className="container">
          <h1 className="text-white h2 mb-1">Danh sách Sân</h1>
          <ul className="mb-0">
            <li><Link to="/">Trang chủ</Link></li>
            <li>Danh sách Sân</li>
          </ul>
        </div>
      </section>

      <div className={`content ${isListView ? 'listing-list-page' : ''}`}>
        <div className="container">
          {/* ═══ Filter & Location Toolbar ═══ */}
          <div className="row mb-4">
            <div className="col-12">
              <div style={{ backgroundColor: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', padding: 24 }}>
                {/* ── Row 1: Search + Quick filters ── */}
                <div className="row g-3 align-items-end">
                  {/* Search */}
                  <div className="col-lg-5 col-md-6">
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, letterSpacing: '0.5px', display: 'block' }}>
                      <i className="feather-search me-1" />Tìm sân
                    </label>
                    <div className="input-group">
                      <input
                        className="form-control"
                        value={keyword}
                        placeholder="Tên sân, quận, thành phố..."
                        onChange={(e) => setKeyword(e.target.value)}
                        style={{ borderRadius: '12px 0 0 12px', padding: '12px 16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: 600, color: '#1e293b' }}
                      />
                      {keyword.trim() && (
                        <button type="button" className="btn" onClick={() => setKeyword('')} style={{ border: '1px solid #e2e8f0', borderLeft: 0, borderRadius: '0 12px 12px 0', backgroundColor: '#f8fafc', color: '#94a3b8' }}>
                          <i className="feather-x" />
                        </button>
                      )}
                      {!keyword.trim() && (
                        <span style={{ border: '1px solid #e2e8f0', borderLeft: 0, borderRadius: '0 12px 12px 0', backgroundColor: '#f8fafc', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
                          <i className="feather-search" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="col-lg-2 col-md-3 col-6">
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, letterSpacing: '0.5px', display: 'block' }}>
                      <i className="feather-star me-1" />Đánh giá
                    </label>
                    <select
                      className="form-select"
                      value={ratingMin}
                      onChange={(e) => setRatingMin(Number(e.target.value) || 0)}
                      style={{ borderRadius: 12, padding: '12px 16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: 700, color: '#1e293b' }}
                    >
                      <option value={0}>Tất cả sao</option>
                      <option value={3}>3.0+ ⭐</option>
                      <option value={3.5}>3.5+ ⭐</option>
                      <option value={4}>4.0+ ⭐</option>
                      <option value={4.5}>4.5+ ⭐</option>
                    </select>
                  </div>

                  {/* GPS Toggle */}
                  <div className="col-lg-2 col-md-3 col-6">
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, letterSpacing: '0.5px', display: 'block' }}>
                      <i className="feather-map-pin me-1" />Vị trí
                    </label>
                    <div
                      onClick={() => toggleGps(!useGps)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, padding: '10px 16px', cursor: 'pointer', transition: 'all 0.2s',
                        border: useGps ? '1.5px solid #097E52' : '1px solid #e2e8f0',
                        backgroundColor: useGps ? '#e8f5ee' : '#f8fafc',
                      }}
                    >
                      <div className="form-check form-switch mb-0" style={{ minHeight: 'auto', paddingLeft: 0 }}>
                        <input
                          className="form-check-input ms-0"
                          type="checkbox"
                          role="switch"
                          id="venues-use-gps"
                          checked={useGps}
                          onChange={(e) => { e.stopPropagation(); toggleGps(e.target.checked); }}
                          style={{ width: '2.5rem', height: '1.3rem', cursor: 'pointer', marginTop: 0 }}
                        />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: useGps ? '#065f3f' : '#64748b', whiteSpace: 'nowrap' }}>
                        {useGps ? '📍 Bật' : '🏠 Tắt'}
                      </span>
                    </div>
                  </div>

                  {/* Radius */}
                  <div className="col-lg-3 col-md-4 col-12">
                    <div className="d-flex gap-2 align-items-end">
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, letterSpacing: '0.5px', display: 'block' }}>
                          <i className="feather-target me-1" />Bán kính
                        </label>
                        <div className="input-group">
                          <input
                            type="number" min="1" max="50"
                            className="form-control"
                            disabled={!hasAnchor}
                            value={radiusKm}
                            placeholder={hasAnchor ? '10' : '—'}
                            onChange={(e) => setRadiusKm(e.target.value === '' ? '' : Number(e.target.value))}
                            style={{ borderRadius: '12px 0 0 12px', padding: '12px 16px', border: '1px solid #e2e8f0', backgroundColor: hasAnchor ? '#f8fafc' : '#f1f5f9', fontWeight: 700, color: '#1e293b' }}
                          />
                          <span style={{ display: 'flex', alignItems: 'center', padding: '0 14px', border: '1px solid #e2e8f0', borderLeft: 0, borderRadius: '0 12px 12px 0', backgroundColor: '#f8fafc', fontWeight: 600, color: '#94a3b8', fontSize: 13 }}>km</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((v) => !v)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                          padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, transition: 'all 0.2s', cursor: 'pointer',
                          border: showAdvanced ? '1.5px solid #097E52' : advancedActive ? '1.5px solid #097E52' : '1px solid #e2e8f0',
                          backgroundColor: showAdvanced ? '#097E52' : advancedActive ? '#e8f5ee' : '#f8fafc',
                          color: showAdvanced ? '#fff' : advancedActive ? '#097E52' : '#64748b',
                          boxShadow: showAdvanced ? '0 4px 12px rgba(9,126,82,0.2)' : 'none',
                        }}
                      >
                        <i className={`feather-${showAdvanced ? 'chevron-up' : 'sliders'}`} />
                        Lọc nâng cao
                        {advancedActive && !showAdvanced && (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#097E52', display: 'inline-block' }} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Location status ── */}
                <div className="d-flex flex-wrap align-items-center gap-2 mt-3 pt-3 border-top" style={{ borderColor: '#f1f5f9 !important', fontSize: 13 }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    backgroundColor: hasAnchor ? '#e8f5ee' : '#f1f5f9',
                    color: hasAnchor ? '#065f3f' : '#64748b',
                  }}>
                    {anchorStatus === 'loading' ? '⏳ Đang xác định…' : hasAnchor ? '✅ ' + statusLabel : statusLabel}
                  </span>
                  {useGps && hasAnchor && source === 'gps' && (
                    <button type="button" onClick={refreshGps} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #bbf7d0', backgroundColor: '#e8f5ee', color: '#097E52', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      <i className="feather-refresh-cw me-1" style={{ fontSize: 11 }} />Cập nhật
                    </button>
                  )}
                  {hasAnchor && source === 'gps' && !gpsPlaceLoading && gpsPlaceName && (
                    <span style={{ color: '#64748b', fontWeight: 600 }}>📍 {gpsPlaceName}</span>
                  )}
                  {hasAnchor && source === 'gps' && gpsPlaceLoading && (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Đang tra cứu địa danh…</span>
                  )}
                  {hasAnchor && source === 'profile' && profileQuery && (
                    <span style={{ color: '#64748b', fontWeight: 600 }}>🏠 {profileQuery}</span>
                  )}
                  {!hasProfileText && !isAuthenticated && (
                    <span style={{ color: '#94a3b8' }}><Link to="/login" style={{ color: '#097E52', fontWeight: 700 }}>Đăng nhập</Link> để lưu địa chỉ fallback.</span>
                  )}
                  {!hasProfileText && isAuthenticated && (
                    <span style={{ color: '#94a3b8' }}>Chưa có địa chỉ — <Link to="/user/profile/edit" style={{ color: '#097E52', fontWeight: 700 }}>Cập nhật hồ sơ</Link></span>
                  )}
                  {anchorMessage && <span style={{ color: '#f59e0b', fontWeight: 600 }}>{anchorMessage}</span>}
                </div>

                {/* ── Expanded Advanced Filters ── */}
                {showAdvanced && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
                    <div className="row g-3">
                      {/* Price range */}
                      <div className="col-md-5">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '0.5px' }}>
                            <i className="feather-dollar-sign me-1" />Khoảng giá
                          </label>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                            {priceMin === '' && priceMax === ''
                              ? `${formatVndShort(priceBounds.min)} – ${formatVndShort(priceBounds.max)}`
                              : `${priceMin === '' ? formatVndShort(priceBounds.min) : formatVndShort(priceMin)} – ${priceMax === '' ? formatVndShort(priceBounds.max) : formatVndShort(priceMax)}`}
                          </span>
                        </div>
                        <div className="px-1">
                          <input type="range" min={priceBounds.min} max={priceBounds.max} step={10000} value={priceMin === '' ? priceBounds.min : priceMin}
                            onChange={(e) => { const v = clampPrice(e.target.value); setPriceMin(v); if (priceMax !== '' && Number(v) > Number(priceMax)) setPriceMax(v); }}
                            className="form-range" style={{ accentColor: '#097E52' }}
                          />
                          <input type="range" min={priceBounds.min} max={priceBounds.max} step={10000} value={priceMax === '' ? priceBounds.max : priceMax}
                            onChange={(e) => { const v = clampPrice(e.target.value); setPriceMax(v); if (priceMin !== '' && Number(v) < Number(priceMin)) setPriceMin(v); }}
                            className="form-range" style={{ accentColor: '#097E52' }}
                          />
                        </div>
                        <div className="d-flex gap-2 mt-2">
                          <input type="number" min="0" className="form-control" value={priceMin} placeholder="Giá từ"
                            style={{ borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: 600 }}
                            onChange={(e) => { if (e.target.value === '') return setPriceMin(''); setPriceMin(clampPrice(e.target.value)); }}
                          />
                          <input type="number" min="0" className="form-control" value={priceMax} placeholder="Giá đến"
                            style={{ borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: 600 }}
                            onChange={(e) => { if (e.target.value === '') return setPriceMax(''); setPriceMax(clampPrice(e.target.value)); }}
                          />
                          {(priceMin !== '' || priceMax !== '') && (
                            <button type="button" onClick={() => { setPriceMin(''); setPriceMax(''); }}
                              style={{ borderRadius: 10, border: '1px solid #fee2e2', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 700, padding: '0 14px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                              <i className="feather-x" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Amenities */}
                      <div className="col-md-7">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '0.5px' }}>
                            <i className="feather-check-circle me-1" />Tiện ích
                          </label>
                          {selectedAmenities.length > 0 && (
                            <button type="button" onClick={() => setSelectedAmenities([])}
                              style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, padding: '2px 10px', cursor: 'pointer' }}>
                              Xóa ({selectedAmenities.length})
                            </button>
                          )}
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {AMENITIES_CATALOG.map((a) => {
                            const active = selectedAmenities.includes(a.key);
                            return (
                              <button
                                key={a.key} type="button"
                                onClick={() => { setSelectedAmenities((prev) => { const set = new Set(prev); if (set.has(a.key)) set.delete(a.key); else set.add(a.key); return Array.from(set); }); }}
                                style={{
                                  borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                                  border: active ? '1.5px solid #097E52' : '1px solid #e2e8f0',
                                  backgroundColor: active ? '#e8f5ee' : '#fff',
                                  color: active ? '#065f3f' : '#475569',
                                }}
                              >
                                <i className={a.icon} style={{ marginRight: 6, fontSize: 13 }} />
                                {a.label}
                                {active && <i className="feather-check ms-1" style={{ fontSize: 12 }} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Clear all */}
                      {(advancedActive || keyword.trim()) && (
                        <div className="col-12 pt-2">
                          <button type="button"
                            onClick={() => { setKeyword(''); setPriceMin(''); setPriceMax(''); setRatingMin(0); setSelectedAmenities([]); setRadiusKm(''); setSortBy('hybrid'); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid #fee2e2', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                            <i className="feather-trash-2" style={{ fontSize: 13 }} /> Xóa toàn bộ bộ lọc
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ Sort & View Toggle Bar ═══ */}
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
                              <Link to="/venues" className={!isListView ? 'active' : ''} aria-label="Dạng lưới">
                                <img src="/assets/img/icons/sort-01.svg" alt="Grid" />
                              </Link>
                            </li>
                            <li>
                              <Link to="/venues/list" className={isListView ? 'active' : ''} aria-label="Dạng danh sách">
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
                            <select className="form-control select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                              <option value="hybrid">{hasAnchor ? 'Tối ưu (Gần + Giá/Sao)' : 'Tối ưu (Đánh giá cao)'}</option>
                              {hasAnchor && <option value="distance">Gần nhất</option>}
                              <option value="price_asc">Giá tăng dần</option>
                              <option value="price_desc">Giá giảm dần</option>
                              <option value="rating_desc">Đánh giá cao nhất</option>
                              <option value="newest_desc">Sân mới nhất</option>
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
            <div className="col-12">
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                  <nav>
                    <ul className="pagination" style={{ gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                        <button className="page-link" style={{ borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '700', color: '#1e293b' }} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>‹</button>
                      </li>
                      {getPaginationGroups().map((p, idx) => (
                        <li key={idx} className={`page-item ${p === '...' ? 'disabled' : ''}`}>
                          <button className="page-link" style={{ borderRadius: '12px', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: p === page ? '#0d6efd' : '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '700', color: p === page ? '#fff' : p === '...' ? '#94a3b8' : '#1e293b', padding: '0 12px' }} onClick={() => { if (p !== '...') { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}>{p}</button>
                        </li>
                      ))}
                      <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                        <button className="page-link" style={{ borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '700', color: '#1e293b' }} onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>›</button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
