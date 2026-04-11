import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';
import { distanceToVenueKm } from '../../utils/geoDistance';
import { useVenueLocationAnchor } from '../../hooks/useVenueLocationAnchor';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profileApi';

const formatVndShort = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}tr`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return `${n}`;
};

export default function FeaturedVenues() {
  const { isAuthenticated, user } = useAuth();
  
  // States for API data
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  // States for Location Anchor
  const [useGps, setUseGps] = useState(false);
  const [profileParts, setProfileParts] = useState({
    address: '',
    district: '',
    province: '',
  });

  const {
    refLat,
    refLng,
    hasAnchor,
  } = useVenueLocationAnchor(useGps, profileParts);

  // Build profile address parts from current user
  useEffect(() => {
    async function loadProfileAddress() {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const data = await profileApi.getMe();
        const u = data?.user ?? data?.User;
        if (!u) return;
        setProfileParts({
          address: u.address ?? u.Address ?? '',
          district: u.district ?? u.District ?? '',
          province: u.province ?? u.Province ?? '',
        });
        // Auto enable GPS check using profile if they have one but don't want strict GPS
        setUseGps(true); 
      } catch {
        // Suppress errors
      }
    }
    if (isAuthenticated) {
      loadProfileAddress();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    async function loadVenues() {
      try {
        const response = await fetch('/api/venues');
        if (!response.ok) throw new Error('Failed to load venues');
        const data = await response.json();
        const mapped = data.map((v) => ({
          id: v.id ?? v.Id,
          name: v.name ?? v.Name,
          location: v.address ?? v.Address,
          lat: v.lat ?? v.Lat,
          lng: v.lng ?? v.Lng,
          minPrice: v.minPrice ?? null,
          maxPrice: v.maxPrice ?? null,
          img: '/assets/img/venues/venues-01.jpg',
          rating: Number(v.rating ?? v.Rating ?? 0) || 0,
          reviewCount: Number(v.reviewCount ?? v.ReviewCount ?? 0) || 0,
          ownerId: v.ownerUserId ?? v.OwnerUserId ?? null,
          owner: String(v.ownerName ?? v.OwnerName ?? '').trim() || 'Chủ Sân',
          avatar: v.ownerAvatarUrl ?? v.OwnerAvatarUrl ?? '/assets/img/profiles/avatar-01.jpg',
        }));
        setVenues(mapped);
      } catch (err) {
        console.error("Error loading venues:", err);
      } finally {
        setLoading(false);
      }
    }
    loadVenues();
  }, []);

  // Filter 1: Featured Venues (Highest Rated)
  const featuredVenues = useMemo(() => {
    if (!venues.length) return [];
    const copy = [...venues].sort((a, b) => {
      // Sort primarily by Rating, then ReviewCount
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviewCount - a.reviewCount;
    });
    // Return top 8
    return copy.slice(0, 8);
  }, [venues]);

  // Support swiper infinite loop by appending a copy if we don't have many items
  const featuredVenuesLoop = useMemo(() => {
    if (!featuredVenues.length) return [];
    if (featuredVenues.length >= 4) return featuredVenues;
    return [...featuredVenues, ...featuredVenues.map(v => ({ ...v, id: v.id + 'loop' }))];
  }, [featuredVenues]);

  // Filter 2: Near Venues
  const nearVenues = useMemo(() => {
    if (!venues.length) return [];
    const withDistance = venues.map((v) => {
      const distanceKm =
        hasAnchor && refLat != null && refLng != null
          ? distanceToVenueKm(refLat, refLng, v.lat, v.lng)
          : null;
      return { ...v, distanceKm };
    });

    const copy = [...withDistance].sort((a, b) => {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da === db) return b.rating - a.rating;
      return da - db;
    });

    // Return top 8 nearest (or newest/highest rated if no GPS coordinates)
    return copy.slice(0, 8);
  }, [venues, hasAnchor, refLat, refLng]);

  return (
    <>
      {/* Sân Nổi Bật */}
      <section className="section featured-venues">
        <div className="container">
          <div className="section-heading aos" data-aos="fade-up">
            <h2>Sân Cầu Lông <span>Nổi Bật</span></h2>
            <p className="sub-title">Khám phá các cụm sân chất lượng cao được cộng đồng lựa chọn nhiều nhất.</p>
          </div>
          <div className="row">
            <div className="featured-slider-group">
              <Swiper
                modules={[Navigation, Autoplay]}
                navigation={{
                  prevEl: '.fv-prev',
                  nextEl: '.fv-next',
                }}
                autoplay={{ delay: 3500, disableOnInteraction: false }}
                loop={featuredVenuesLoop.length >= 4}
                loopAdditionalSlides={4}
                spaceBetween={24}
                slidesPerView={1}
                breakpoints={{
                  500: { slidesPerView: 1 },
                  768: { slidesPerView: 2 },
                  1000: { slidesPerView: 3 },
                }}
                className="featured-venues-slider"
              >
                {!loading && featuredVenuesLoop.map((venue) => (
                  <SwiperSlide key={venue.id}>
                    <div className="featured-venues-item aos" data-aos="fade-up">
                      <div className="listing-item mb-0">
                        <div className="listing-img">
                          <Link to={`/venue/${(String(venue.id)).replace('loop', '')}`}>
                            <img src={venue.img} className="img-fluid" alt="Venue" />
                          </Link>
                          <div className="fav-item-venues">
                            <span className="tag tag-blue">Đánh giá cao</span>
                            <h5 className="tag tag-primary">
                              {venue.minPrice ? `${formatVndShort(venue.minPrice)}` : 'Liên hệ'}
                              {venue.minPrice && <span>/h</span>}
                            </h5>
                          </div>
                        </div>
                        <div className="listing-content">
                          <div className="list-reviews">
                            <div className="d-flex align-items-center">
                              <span className="rating-bg">{venue.rating.toFixed(1)}</span>
                              <span>{venue.reviewCount} Đánh giá</span>
                            </div>
                            <a href="#" onClick={(e) => e.preventDefault()} className="fav-icon">
                              <i className="feather-heart"></i>
                            </a>
                          </div>
                          <h3 className="listing-title">
                            <Link to={`/venue/${(String(venue.id)).replace('loop', '')}`}>{venue.name}</Link>
                          </h3>
                          <div className="listing-details-group">
                            <p className="text-truncate">{venue.location}</p>
                            <ul>
                              <li><span><i className="feather-map-pin"></i>{venue.location.split(', ').pop()}</span></li>
                              <li><span><i className="feather-calendar"></i>Lịch trống: <span className="primary-text">Sẵn sàng</span></span></li>
                            </ul>
                          </div>
                          <div className="listing-button">
                            <div className="listing-venue-owner">
                              <Link className="navigation" to="#">
                                <img src={venue.avatar} alt="Owner" />{venue.owner}
                              </Link>
                            </div>
                            <Link to={`/venue/${(String(venue.id)).replace('loop', '')}`} className="user-book-now">
                              <span><i className="feather-calendar me-2"></i></span>Đặt Sân
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
              <div className="owl-nav">
                <button className="owl-prev fv-prev" type="button">
                  <i className="feather-chevron-left"></i>
                </button>
                <button className="owl-next fv-next" type="button">
                  <i className="feather-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sân Gần Bạn */}
      <section className="section court-near">
        <div className="container">
          <div className="section-heading aos" data-aos="fade-up">
            <h2>Sân Cầu Lông <span>Gần Bạn</span></h2>
            <p className="sub-title">
              {hasAnchor 
                ? 'Khám phá các sân cầu lông theo thứ tự khoảng cách đo đạc được.' 
                : 'Khám phá các sân cầu lông với trải nghiệm thuận tiện và dễ dàng tiếp cận.'}
            </p>
          </div>
          <div className="row">
            <div className="featured-slider-group aos" data-aos="fade-up">
              <Swiper
                modules={[Navigation, Autoplay]}
                navigation={{
                  prevEl: '.cny-prev',
                  nextEl: '.cny-next',
                }}
                autoplay={{ delay: 3500, disableOnInteraction: false }}
                loop={nearVenues.length >= 4}
                spaceBetween={24}
                breakpoints={{
                  576: { slidesPerView: 1 },
                  768: { slidesPerView: 2 },
                  992: { slidesPerView: 3 },
                  1200: { slidesPerView: 4 },
                }}
                className="featured-venues-slider"
              >
                {!loading && nearVenues.map((c) => (
                  <SwiperSlide key={c.id}>
                    <div className="featured-venues-item court-near-item">
                      <div className="listing-item mb-0">
                        <div className="listing-img">
                          <Link to={`/venue/${c.id}`}>
                            <img src={c.img} alt="Venue" />
                          </Link>
                          <div className="fav-item-venues">
                            <div className="list-reviews coche-star">
                              <a href="#" onClick={(e) => e.preventDefault()} className="fav-icon">
                                <i className="feather-heart"></i>
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="listing-content">
                          <h3 className="listing-title">
                            <Link to={`/venue/${c.id}`}>{c.name}</Link>
                          </h3>
                          <div className="listing-details-group">
                            <ul>
                              <li className="text-truncate">
                                <span><i className="feather-map-pin"></i>{c.location}</span>
                              </li>
                            </ul>
                          </div>
                          <div className="list-reviews near-review">
                            <div className="d-flex align-items-center">
                              <span className="rating-bg">{c.rating.toFixed(1)}</span>
                              <span>{c.reviewCount} Đánh giá</span>
                            </div>
                            {c.distanceKm != null ? (
                              <span className="mile-away"><i className="feather-zap"></i>Cách {(c.distanceKm).toFixed(1)} km</span>
                            ) : (
                              <span className="mile-away"><i className="feather-zap"></i>Nhanh chóng</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
              <div className="owl-nav">
                <button className="owl-prev cny-prev" type="button">
                  <i className="feather-chevron-left"></i>
                </button>
                <button className="owl-next cny-next" type="button">
                  <i className="feather-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
          <div className="view-all text-center aos" data-aos="fade-up">
            <Link to="/venues" className="btn btn-secondary d-inline-flex align-items-center">
              <i className="feather-search me-2"></i>Tìm Kiếm Sân
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
