import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import VenueReviewModal from '../components/courts/VenueReviewModal';
import StarRatingDisplay from '../components/common/StarRatingDisplay';
import RichText from '../components/common/RichText';
import ReportModal from '../components/common/ReportModal';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';

const AMENITIES_LIST = [
  { key: 'parking',       label: 'Bãi đỗ xe',                  icon: 'feather-map-pin' },
  { key: 'water',         label: 'Nước uống',                   icon: 'feather-droplet' },
  { key: 'locker',        label: 'Tủ đồ & phòng thay đồ',      icon: 'feather-briefcase' },
  { key: 'bathroom',      label: 'Phòng tắm & nhà vệ sinh',     icon: 'feather-wind' },
  { key: 'lighting',      label: 'Đèn chiếu sáng',             icon: 'feather-sun' },
  { key: 'security',      label: 'Camera an ninh',              icon: 'feather-camera' },
  { key: 'wifi',          label: 'WiFi',                        icon: 'feather-wifi' },
  { key: 'rental_racket', label: 'Cho thuê vợt',                icon: 'feather-activity' },
  { key: 'buy_shuttle',   label: 'Mua cầu tại sân',            icon: 'feather-shopping-bag' },
  { key: 'canteen',       label: 'Căn tin / Quầy ăn uống',     icon: 'feather-coffee' },
];

const MOCK_GALLERY = [
  '/assets/img/gallery/gallery1/gallery-01.png',
  '/assets/img/gallery/gallery1/gallery-02.png',
  '/assets/img/gallery/gallery1/gallery-03.png',
  '/assets/img/gallery/gallery1/gallery-04.png',
  '/assets/img/gallery/gallery1/gallery-05.png',
  '/assets/img/gallery/gallery1/gallery-01.png',
  '/assets/img/gallery/gallery1/gallery-02.png',
];

export default function VenueDetails() {
  // Support both route patterns:
  //   /venue-details/:venueId  (used by VenueCard links)
  //   /venues/:id              (legacy / alternative route)
  const { venueId, id } = useParams();
  const resolvedId = venueId ?? id;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // ALL hooks MUST be declared before any conditional return (React Rules of Hooks)
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);
  const [moreHovered, setMoreHovered] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [reviewsData, setReviewsData] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [pendingReviewBookingId, setPendingReviewBookingId] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Build slides for lightbox
  const slides = MOCK_GALLERY.map((src) => ({ src }));

  const openLightbox = (idx) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const handleBooking = () => {
    const payload = {
        venueId: venue.id,
        venueName: venue.name,
        venueAddress: venue.address,
        pricePerSlot: venue.startingPrice,
        currency: venue.currency,
    };
    sessionStorage.setItem('booking_venue_context', JSON.stringify(payload));
    navigate('/booking', { state: payload });
  };

  const handleLongTermBooking = () => {
    const payload = {
        venueId: venue.id,
        venueName: venue.name,
        venueAddress: venue.address,
        weeklyDiscountPercent: venue.weeklyDiscountPercent,
        monthlyDiscountPercent: venue.monthlyDiscountPercent
    };
    sessionStorage.setItem('booking_venue_context', JSON.stringify(payload));
    navigate('/booking/long-term', { state: payload });
  };

  useEffect(() => {
    async function loadVenue() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/venues/${resolvedId}`);
        if (!response.ok) {
          throw new Error('Oops... Không tìm thấy thông tin sân này rồi.');
        }
        const data = await response.json();

        // Map dữ liệu backend sang model dùng trong UI
        setVenue({
          id: data.id,
          name: data.name,
          isVerified: data.isVerified ?? true,
          address: data.address,
          phone: data.phoneNumber ?? 'Đang cập nhật',
          email: data.email ?? 'Đang cập nhật',
          venueType: data.venueType ?? 'Sân cầu lông',
          ownerName: data.ownerName ?? 'Chủ sân',
          startingPrice: data.minPrice ?? 0,
          currency: '₫',
          rating: data.rating ?? 5.0,
          reviewCount: data.reviewCount ?? 0,
          lat: data.lat,
          lng: data.lng,
          weeklyDiscountPercent: data.weeklyDiscountPercent || data.WeeklyDiscountPercent || 0,
          monthlyDiscountPercent: data.monthlyDiscountPercent || data.MonthlyDiscountPercent || 0,
          description: data.description || data.Description || null,
          includes: Array.isArray(data.includes) ? data.includes : (Array.isArray(data.Includes) ? data.Includes : null),
          rules: Array.isArray(data.rules) ? data.rules : (Array.isArray(data.Rules) ? data.Rules : null),
          amenities: Array.isArray(data.amenities) ? data.amenities : (Array.isArray(data.Amenities) ? data.Amenities : null),
        });
      } catch (err) {
        setError(err.message || 'Oops... Có lỗi nảy sinh khi tải thông tin sân.');
      } finally {
        setLoading(false);
      }
    }

    if (resolvedId) {
      loadVenue();
    }
  }, [resolvedId]);

  const loadReviews = useCallback(async () => {
    if (!resolvedId) return;
    try {
      setReviewsLoading(true);
      const res = await fetch(`/api/venues/${resolvedId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviewsData(data);
      } else {
        setReviewsData(null);
      }
    } catch {
      setReviewsData(null);
    } finally {
      setReviewsLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    const ob = searchParams.get('openReview');
    const bid = searchParams.get('bookingId');
    if (!ob || (ob !== '1' && ob !== 'true')) return;
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname + (location.search || ''))}`);
      return;
    }
    if (bid) setPendingReviewBookingId(bid);
    setReviewModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('openReview');
    next.delete('bookingId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, user, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (!reviewModalOpen || !pendingReviewBookingId) return;
    const t = window.setTimeout(() => {
      document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [reviewModalOpen, pendingReviewBookingId]);

  const handleOpenReviewModal = () => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname + (location.search || ''))}`);
      return;
    }
    setPendingReviewBookingId(null);
    setReviewModalOpen(true);
  };

  const handleReviewSaved = () => {
    loadReviews();
    async function refreshVenue() {
      try {
        const response = await fetch(`/api/venues/${resolvedId}`);
        if (!response.ok) return;
        const data = await response.json();
        setVenue((prev) =>
          prev
            ? {
                ...prev,
                rating: data.rating ?? data.Rating ?? prev.rating,
                reviewCount: data.reviewCount ?? data.ReviewCount ?? prev.reviewCount,
              }
            : prev
        );
      } catch {
        /* ignore */
      }
    }
    refreshVenue();
  };

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="main-wrapper content-below-header">
        <div className="content">
          <div className="container py-5 text-center">
            <p>Đang tải thông tin sân...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="main-wrapper content-below-header">
        <div className="content">
          <div className="container py-5 text-center">
            <p className="text-danger mb-3">{error || 'Không tìm thấy sân.'}</p>
            <Link to="/venues" className="btn btn-secondary">
              Quay lại danh sách sân
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const avgStars = Number(
    reviewsData?.averageStars ?? reviewsData?.AverageStars ?? venue.rating ?? 0
  );
  const reviewCountDisplay = Number(
    reviewsData?.reviewCount ?? reviewsData?.ReviewCount ?? venue.reviewCount ?? 0
  );
  const reviewsList = reviewsData?.reviews ?? reviewsData?.Reviews ?? [];

  return (
    <div className="main-wrapper content-below-header venue-coach-details">
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="VENUE"
        targetId={venue?.id}
        title="Báo cáo cụm sân"
      />
      {/* Top gallery – Swiper slider để giống template */}
      <section className="bannergallery-section">
        <Swiper
          modules={[Navigation]}
          navigation={{
            prevEl: '.vg-prev',
            nextEl: '.vg-next',
          }}
          loop
          spaceBetween={4}
          slidesPerView={1}
          breakpoints={{
            576: { slidesPerView: 2, spaceBetween: 4 },
            992: { slidesPerView: 3, spaceBetween: 4 },
            1200: { slidesPerView: 4, spaceBetween: 4 },
          }}
          className="main-gallery-slider owl-carousel owl-theme"
        >
          {MOCK_GALLERY.map((src, idx) => (
            <SwiperSlide key={`${src}-${idx}`}>
              <div
                className="gallery-widget-item"
                onClick={() => openLightbox(idx)}
                style={{ cursor: 'pointer' }}
              >
                <img
                  className="img-fluid"
                  alt={`Ảnh sân ${idx + 1}`}
                  src={src}
                  style={{ display: 'block', width: '100%' }}
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
        <div className="owl-nav d-none d-md-block" style={{ position: 'absolute', top: '50%', width: '100%', transform: 'translateY(-50%)', zIndex: 10, pointerEvents: 'none' }}>
          <button
            className="owl-prev vg-prev"
            type="button"
            onMouseEnter={() => setPrevHovered(true)}
            onMouseLeave={() => setPrevHovered(false)}
            style={{ position: 'absolute', pointerEvents: 'auto', left: '30px', backgroundColor: prevHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)', border: 'none', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: prevHovered ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)', transition: 'background-color 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer' }}
          >
            <i className="feather-chevron-left" style={{ margin: 0, fontSize: '18px', color: '#333' }} />
          </button>
          <button
            className="owl-next vg-next"
            type="button"
            onMouseEnter={() => setNextHovered(true)}
            onMouseLeave={() => setNextHovered(false)}
            style={{ position: 'absolute', pointerEvents: 'auto', right: '30px', backgroundColor: nextHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)', border: 'none', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: nextHovered ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)', transition: 'background-color 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer' }}
          >
            <i className="feather-chevron-right" style={{ margin: 0, fontSize: '18px', color: '#333' }} />
          </button>
        </div>
        <div className="showphotos corner-radius-10" style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 10 }}>
          <button
            type="button"
            onClick={() => openLightbox(0)}
            onMouseEnter={() => setMoreHovered(true)}
            onMouseLeave={() => setMoreHovered(false)}
            style={{ backgroundColor: moreHovered ? '#F59E0B' : '#FBBF24', color: '#192335', padding: '7px 14px', borderRadius: '6px', border: 'none', fontWeight: '600', fontSize: '13px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'background-color 0.2s ease', whiteSpace: 'nowrap', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          >
            <i className="fa-regular fa-images me-2" style={{ color: '#192335', fontSize: '14px' }} /> Xem thêm hình
          </button>
        </div>
      </section>

      {/* Lightbox with Zoom + Thumbnails on the right */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={slides}
        index={lightboxIndex}
        plugins={[Zoom, Thumbnails]}
        zoom={{
          maxZoomPixelRatio: 4,
          zoomInMultiplier: 1.5,
          doubleTapDelay: 300,
          doubleClickDelay: 300,
          scrollToZoom: true,
        }}
        thumbnails={{ position: 'end', width: 120, height: 80, gap: 10, border: 2, borderRadius: 6, padding: 0, showToggle: false }}
        animation={{ fade: 300, swipe: 300 }}
        on={{ backdropClick: () => setLightboxOpen(false) }}
        styles={{ root: { '--yarl__color_backdrop': 'rgba(0, 0, 0, 0.75)' } }}
      />

      {(venue.weeklyDiscountPercent > 0 || venue.monthlyDiscountPercent > 0) && (
        <div className="container mt-4 mb-2">
          <div className="alert d-flex align-items-center mb-0" style={{ backgroundColor: '#fff7ed', borderLeft: '4px solid #ea580c', color: '#9a3412', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <i className="feather-gift me-3 fs-3" style={{ color: '#ea580c' }}></i>
            <div>
              <strong className="d-block mb-1 fs-5">Mừng Giờ Vàng - Ưu Đãi Đặt Lịch Dài Hạn!</strong>
              <span>
                Cơ sở đang áp dụng chiết khấu 
                {venue.weeklyDiscountPercent > 0 && <strong className="mx-1">{venue.weeklyDiscountPercent}%</strong>} 
                {venue.weeklyDiscountPercent > 0 && venue.monthlyDiscountPercent > 0 && 'và'} 
                {venue.monthlyDiscountPercent > 0 && <strong className="mx-1">{venue.monthlyDiscountPercent}%</strong>} 
                khi Quý khách đăng ký khung giờ thuê cố định theo <strong>Tuần</strong> hoặc <strong>Tháng</strong>. 
                Hãy đặt lịch ngay để được hưởng giá ưu đãi tự động trong hệ thống!
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Venue header info */}
      <section className="venue-info white-bg d-block">
        <div className="container">
          <div className="row">
            <div className="col-lg-6">
              <h1 className="d-flex align-items-center justify-content-start">
                {venue.name}
                {venue.isVerified && (
                  <span className="d-flex justify-content-center align-items-center ms-2">
                    <i className="fas fa-check-double" />
                  </span>
                )}
              </h1>
              <ul className="d-sm-flex justify-content-start align-items-center flex-wrap">
                <li>
                  <i className="feather-map-pin" />
                  {venue.address}
                </li>
                <li>
                  <i className="feather-phone-call" />
                  {venue.phone}
                </li>
                <li>
                  <i className="feather-mail" />
                  <a href={`mailto:${venue.email}`}>{venue.email}</a>
                </li>
              </ul>
            </div>
            <div className="col-lg-6 text-lg-end">
              <ul className="social-options float-lg-end d-sm-flex justify-content-start align-items-center">
                <li>
                  <a
                    href="#"
                    onClick={e => e.preventDefault()}
                    className="d-inline-flex align-items-center gap-1"
                    style={{ color: '#6B7385', textDecoration: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#097E52'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6B7385'}
                  >
                    <i className="feather-share-2" />
                    Chia sẻ
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    onClick={e => e.preventDefault()}
                    className="d-inline-flex align-items-center gap-1"
                    style={{ color: '#6B7385', textDecoration: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#097E52'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6B7385'}
                  >
                    <i className="feather-star" />
                    Thêm vào yêu thích
                  </a>
                </li>
                <li className="venue-review-info d-flex justify-content-start align-items-center">
                  <span className="d-flex justify-content-center align-items-center">
                    {avgStars.toFixed(1)}
                  </span>
                  <div className="review">
                    <div className="rating">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <i key={i} className="fas fa-star filled" />
                      ))}
                    </div>
                    <p className="mb-0">
                      <button type="button" className="btn btn-link p-0">
                        {reviewCountDisplay} đánh giá
                      </button>
                    </p>
                  </div>
                  <i className="fa-regular fa-comments" />
                </li>
              </ul>
            </div>
          </div>
          <hr />
          <div className="row bottom-row d-flex align-items-center">
            <div className="col-lg-6">
              <ul className="d-sm-flex details">
                <li>
                  <div className="profile-pic">
                    <span className="venue-type">
                      <img className="img-fluid" src="/assets/img/icons/venue-type.svg" alt="Venue type" />
                    </span>
                  </div>
                  <div className="ms-2">
                    <p>Loại sân</p>
                    <h6 className="mb-0">{venue.venueType}</h6>
                  </div>
                </li>
                <li>
                  <div className="profile-pic">
                    <img className="img-fluid" src="/assets/img/profiles/avatar-01.jpg" alt="Owner" />
                  </div>
                  <div className="ms-2">
                    <p>Chủ sân</p>
                    <h6 className="mb-0">{venue.ownerName}</h6>
                  </div>
                </li>
              </ul>
            </div>
            <div className="col-lg-6">
              <div className="d-flex float-sm-end align-items-center">
                <p className="d-inline-block me-2 mb-0">Giá từ:</p>
                <h3 className="primary-text mb-0 d-inline-block">
                  {venue.currency}
                  {venue.startingPrice}
                  <span>/ giờ</span>
                </h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="content">
        <div className="container">
          <div className="row">
            {/* Left column: accordions */}
            <div className="col-lg-8">
              <div className="venue-options white-bg mb-4">
                <ul className="clearfix">
                  <li className="active">
                    <a href="#overview">Tổng quan</a>
                  </li>
                  <li>
                    <a href="#includes">Bao gồm</a>
                  </li>
                  <li>
                    <a href="#rules">Quy định</a>
                  </li>
                  <li>
                    <a href="#amenities">Tiện ích</a>
                  </li>
                  <li>
                    <a href="#gallery">Hình ảnh</a>
                  </li>
                  <li>
                    <a href="#reviews">Đánh giá</a>
                  </li>
                  <li>
                    <a href="#location">Vị trí</a>
                  </li>
                </ul>
              </div>

              {/* Overview */}
              <section id="overview" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Tổng quan</h4>
                {venue.description ? (
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>{venue.description}</p>
                ) : (
                  <>
                    <p>
                      Cơ sở đang trong quá trình cập nhật thông tin. Vui lòng liên hệ trực tiếp để biết thêm chi tiết
                      về tiện nghi và dịch vụ.
                    </p>
                  </>
                )}
              </section>

              {/* Includes */}
              <section id="includes" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Bao gồm</h4>
                {venue.includes && venue.includes.length > 0 ? (
                  <ul className="clearfix">
                    {venue.includes.map((item, i) => (
                      <li key={i}>
                        <i className="feather-check-square" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mb-0" style={{ fontSize: 14 }}>Chủ sân chưa cập nhật thông tin mục này.</p>
                )}
              </section>

              {/* Rules */}
              <section id="rules" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Quy định</h4>
                {venue.rules && venue.rules.length > 0 ? (
                  <ul>
                    {venue.rules.map((rule, i) => (
                      <li key={i}>
                        <p>
                          <i className="feather-alert-octagon" />
                          {rule}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mb-0" style={{ fontSize: 14 }}>Chủ sân chưa cập nhật quy định.</p>
                )}
              </section>

              {/* Amenities */}
              <section id="amenities" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Tiện ích</h4>
                {venue.amenities && venue.amenities.length > 0 ? (
                  <ul className="d-md-flex justify-content-start align-items-center flex-wrap" style={{ gap: '8px 24px' }}>
                    {AMENITIES_LIST.filter(a => venue.amenities.includes(a.key)).map(a => (
                      <li key={a.key}>
                        <i className={a.icon} aria-hidden="true" />
                        {a.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mb-0" style={{ fontSize: 14 }}>Chủ sân chưa cập nhật tiện ích.</p>
                )}
              </section>

              {/* Gallery */}
              <section id="gallery" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Hình ảnh</h4>
                <div className="row g-2">
                  {MOCK_GALLERY.map((src) => (
                    <div key={src} className="col-6 col-md-4">
                      <img className="img-fluid corner-radius-10" alt="Gallery" src={src} />
                    </div>
                  ))}
                </div>
              </section>

              {/* Reviews */}
              <section id="reviews" className="white-bg mb-4 corner-radius-10 p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="mb-0">Đánh giá</h4>
                  <button type="button" className="btn btn-gradient add-review" onClick={handleOpenReviewModal}>
                    Viết đánh giá
                  </button>
                </div>
                <div className="row review-wrapper">
                  <div className="col-lg-3">
                    <div className="ratings-info corner-radius-10 text-center">
                      <h3>{avgStars.toFixed(1)}</h3>
                      <span>trên 5.0</span>
                      <div className="rating d-flex align-items-center justify-content-center gap-1 flex-wrap">
                        <StarRatingDisplay value={avgStars} size={16} />
                      </div>
                      <p className="small text-muted mb-0 mt-2">{reviewCountDisplay} lượt đánh giá</p>
                    </div>
                  </div>
                  <div className="col-lg-9">
                    {reviewsLoading ? (
                      <p className="text-muted mb-0">Đang tải đánh giá…</p>
                    ) : reviewsList.length === 0 ? (
                      <p className="text-muted mb-0">Chưa có đánh giá nào. Hãy là người đầu tiên đặt sân và chia sẻ trải nghiệm.</p>
                    ) : (
                      <ul className="list-unstyled mb-0">
                        {reviewsList.map((r) => {
                          const rid = r.id ?? r.Id;
                          const name = r.userFullName ?? r.UserFullName ?? 'Người chơi';
                          const st = Number(r.stars ?? r.Stars ?? 0);
                          const cm = r.comment ?? r.Comment ?? '';
                          const imgs = r.imageUrls ?? r.ImageUrls ?? [];
                          const reply = r.ownerReply ?? r.OwnerReply;
                          const replyAt = r.ownerReplyAt ?? r.OwnerReplyAt;
                          return (
                            <li key={rid} className="mb-4 pb-3 border-bottom">
                              <div className="d-flex justify-content-between align-items-start gap-2">
                                <strong style={{ fontFamily: '"Be Vietnam Pro", sans-serif' }}>{name}</strong>
                                <span className="d-inline-flex align-items-center gap-1 small text-warning">
                                  <StarRatingDisplay value={st} size={14} /> {st.toFixed(1)}
                                </span>
                              </div>
                              {cm ? (
                                <RichText
                                  text={cm}
                                  className="mb-2 mt-1"
                                  as="div"
                                />
                              ) : null}
                              {Array.isArray(imgs) && imgs.length > 0 && (
                                <div className="d-flex flex-wrap gap-2 mb-2">
                                  {imgs.map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noreferrer">
                                      <img
                                        src={url}
                                        alt=""
                                        className="rounded"
                                        style={{ width: 72, height: 72, objectFit: 'cover' }}
                                      />
                                    </a>
                                  ))}
                                </div>
                              )}
                              {reply && (
                                <div className="p-2 rounded mt-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                  <small className="text-muted d-block mb-1">Phản hồi từ chủ sân</small>
                                  <RichText text={reply} className="mb-0 small" as="div" />
                                  {replyAt && (
                                    <small className="text-muted">{new Date(replyAt).toLocaleString('vi-VN')}</small>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              {/* Location */}
              <section id="location" className="white-bg corner-radius-10 p-4">
                <h4 className="mb-3">Vị trí</h4>
                <div className="google-maps">
                  <iframe
                    title="Venue location"
                    src={
                      venue.lat && venue.lng
                        ? `https://maps.google.com/maps?q=${venue.lat},${venue.lng}&z=16&output=embed`
                        : `https://maps.google.com/maps?q=${encodeURIComponent(venue.address)}&z=15&output=embed`
                    }
                    height="445"
                    style={{ border: 0, width: '100%' }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <div className="dull-bg d-flex justify-content-start align-items-center mt-3">
                  <div className="white-bg me-2">
                    <i className="fas fa-location-arrow" />
                  </div>
                  <div>
                    <h6>Địa chỉ sân</h6>
                    <p className="mb-0">{venue.address}</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Right column: booking sidebar (static for Iter 1) */}
            <aside className="col-lg-4">
              <div className="white-bg d-flex justify-content-start align-items-center availability">
                <span className="icon-bg me-3">
                  <img className="img-fluid" alt="Calendar" src="/assets/img/icons/head-calendar.svg" />
                </span>
                <div>
                  <h4>Khả dụng</h4>
                  <p className="mb-0">Kiểm tra lịch trống phù hợp với bạn</p>
                </div>
              </div>

              <div className="white-bg book-court">
                <h4 className="border-bottom">Đặt sân</h4>
                <p className="mb-2">
                  <strong>{venue.name}</strong> hiện đang mở đặt lịch.
                </p>
                <ul className="d-sm-flex align-items-center justify-content-evenly">
                  <li>
                    <h3 className="d-inline-block primary-text">
                      {venue.currency}
                      {venue.startingPrice}
                    </h3>
                    <span>/giờ</span>
                    <p>tối đa 1 khách</p>
                  </li>
                  <li>
                    <span>
                      <i className="feather-plus" />
                    </span>
                  </li>
                  <li>
                    <h4 className="d-inline-block primary-text">$5</h4>
                    <span>/giờ</span>
                    <p>
                      mỗi khách thêm <br />
                      tối đa 4 khách
                    </p>
                  </li>
                </ul>
                <div className="d-grid btn-block mt-3 gap-2">
                  <button
                    type="button"
                    onClick={handleBooking}
                    className="btn btn-secondary d-inline-flex justify-content-center align-items-center"
                  >
                    <i className="feather-calendar" />
                    <span className="ms-2">ĐẶT LỊCH</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLongTermBooking}
                    className="btn btn-outline-primary d-inline-flex justify-content-center align-items-center"
                  >
                    <i className="feather-repeat" />
                    <span className="ms-2">ĐẶT LỊCH DÀI HẠN</span>
                  </button>
                </div>
              </div>

              <div className="white-bg cage-owner-info">
                <h4 className="border-bottom">Thông tin chủ sân</h4>
                <div className="d-flex justify-content-start align-items-center">
                  <div className="profile-pic me-2">
                    <img className="img-fluid" alt="Owner" src="/assets/img/profiles/avatar-05.jpg" />
                  </div>
                  <div>
                    <h5>{venue.ownerName}</h5>
                    <div className="rating d-flex align-items-center flex-wrap gap-1">
                      <StarRatingDisplay value={avgStars} size={15} />
                      <span className="ms-1">{avgStars.toFixed(1)}</span>
                      <span>({reviewCountDisplay} đánh giá)</span>
                    </div>
                  </div>
                </div>
                <div className="d-grid btn-block text-center mt-3">
                  <Link
                    to="/contact"
                    className="btn btn-secondary d-inline-flex justify-content-center align-items-center"
                  >
                    <i className="feather-phone-call" />
                    <span className="ms-2">Liên hệ chủ sân</span>
                  </Link>
                  <button
                    type="button"
                    className="btn btn-outline-secondary d-inline-flex justify-content-center align-items-center mt-2"
                    onClick={() => setReportOpen(true)}
                    disabled={!user}
                    title={!user ? 'Vui lòng đăng nhập để báo cáo' : 'Báo cáo cụm sân'}
                  >
                    <i className="feather-flag" />
                    <span className="ms-2">Báo cáo cụm sân</span>
                  </button>
                </div>
              </div>

            </aside>
          </div>
        </div>
      </div>

      <VenueReviewModal
        venueId={resolvedId}
        open={reviewModalOpen}
        initialBookingId={pendingReviewBookingId}
        onClose={() => {
          setReviewModalOpen(false);
          setPendingReviewBookingId(null);
        }}
        onSaved={handleReviewSaved}
      />
    </div>
  );
}

