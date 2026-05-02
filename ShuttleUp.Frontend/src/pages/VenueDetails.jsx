import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import favoritesApi from '../api/favoritesApi';
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
import LongTermTypeModal from '../components/booking/LongTermTypeModal';

const AMENITIES_LIST = [
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

const MOCK_GALLERY = [
  '/assets/img/gallery/gallery1/gallery-01.png',
  '/assets/img/gallery/gallery1/gallery-02.png',
  '/assets/img/gallery/gallery1/gallery-03.png',
  '/assets/img/gallery/gallery1/gallery-04.png',
  '/assets/img/gallery/gallery1/gallery-05.png',
  '/assets/img/gallery/gallery1/gallery-01.png',
  '/assets/img/gallery/gallery1/gallery-02.png',
];

/* ─── Toast helper (inline, simple) ─── */
function MiniToast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#166534', color: '#fff',
      padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    }}>
      <i className="feather-check-circle" style={{ fontSize: 16 }} />
      <span>{msg}</span>
    </div>
  );
}

/* ─── Contact Owner Modal ─── */
function ContactOwnerModal({ open, onClose, venue, onChat }) {
  if (!open) return null;
  return (
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1050 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-content" style={{ borderRadius: 16, overflow: 'hidden' }}>
          <div className="modal-header border-0 pb-0" style={{ background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)' }}>
            <div className="text-center w-100 py-3">
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <i className="feather-user" style={{ fontSize: 24, color: '#fff' }} />
              </div>
              <h6 className="mb-0 text-white">{venue?.ownerName || 'Chủ sân'}</h6>
              <small className="text-white" style={{ opacity: 0.8 }}>Liên hệ qua điện thoại hoặc tin nhắn</small>
            </div>
            <button type="button" className="btn-close btn-close-white position-absolute" style={{ top: 12, right: 12 }} onClick={onClose} />
          </div>
          <div className="modal-body p-4">
            <div className="d-grid gap-3">
              {/* Call button */}
              <a
                href={`tel:${venue?.phone || ''}`}
                className="btn d-flex align-items-center justify-content-center gap-2"
                style={{
                  background: '#f0fdf4', border: '1.5px solid #86efac', color: '#166534',
                  borderRadius: 12, padding: '14px 16px', fontWeight: 600, fontSize: 15,
                  transition: 'all .2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.borderColor = '#4ade80'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#86efac'; }}
              >
                <i className="feather-phone-call" style={{ fontSize: 18 }} />
                <span>Gọi điện: <strong>{venue?.phone || 'Đang cập nhật'}</strong></span>
              </a>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Policy Summary builder (matches Manager logic) ─── */
function buildPolicySummary(c) {
  if (!c) return null;
  if (!c.allowCancel) return 'Người chơi không được phép tự huỷ đặt sân trên app.';
  const mins = Number(c.cancelBeforeMinutes ?? 0);
  let timeStr;
  if (mins >= 1440) timeStr = `${mins / 1440} ngày`;
  else if (mins >= 60) timeStr = `${mins / 60} giờ`;
  else timeStr = `${mins} phút`;

  const refund = (c.refundType || 'NONE').toUpperCase();
  let refundStr = 'không hoàn tiền số tiền đã cọc';
  if (refund === 'FULL') refundStr = 'hoàn 100% tiền cọc';
  else if (refund === 'PERCENT') refundStr = `hoàn ${c.refundPercent ?? '?'}% tiền cọc`;

  return `Người chơi được huỷ trước ${timeStr}, ${refundStr}.`;
}

export default function VenueDetails() {
  const { venueId, id } = useParams();
  const resolvedId = venueId ?? id;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { openChatWithPeer, openingPeerId } = useChat();
  const isAdmin = user?.roles?.includes('ADMIN');

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
  const [isLongTermModalOpen, setIsLongTermModalOpen] = useState(false);

  // New states
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [checkoutSettings, setCheckoutSettings] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

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
      slotDuration: venue.slotDuration ?? 60,
    };
    sessionStorage.setItem('booking_venue_context', JSON.stringify(payload));
    navigate('/booking', { state: payload });
  };

  const handleLongTermBooking = () => {
    setIsLongTermModalOpen(true);
  };

  // ── Load Venue ──
  useEffect(() => {
    async function loadVenue() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/venues/${resolvedId}`);
        if (!response.ok) throw new Error('Oops... Không tìm thấy thông tin sân này rồi.');
        const data = await response.json();
        setVenue({
          id: data.id,
          name: data.name,
          isVerified: data.isVerified ?? true,
          address: data.address,
          phone: data.phoneNumber ?? data.ownerPhone ?? 'Đang cập nhật',
          email: data.email ?? data.ownerEmail ?? 'Đang cập nhật',
          ownerName: data.ownerName ?? 'Chủ sân',
          ownerUserId: data.ownerUserId ?? null,
          ownerAvatarUrl: data.ownerAvatarUrl ?? null,
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
          slotDuration: data.slotDuration || data.SlotDuration || 60,
        });
      } catch (err) {
        setError(err.message || 'Oops... Có lỗi nảy sinh khi tải thông tin sân.');
      } finally {
        setLoading(false);
      }
    }
    if (resolvedId) loadVenue();
  }, [resolvedId]);

  // ── Load Favorites ──
  useEffect(() => {
    if (!user || !resolvedId) return;
    (async () => {
      try {
        const favs = await favoritesApi.getMyFavorites();
        const ids = new Set((Array.isArray(favs) ? favs : []).map(f => String(f.id ?? f.Id)));
        setIsFavorited(ids.has(String(resolvedId)));
      } catch { /* ignore */ }
    })();
  }, [user, resolvedId]);

  // ── Load Checkout Settings (policies) ──
  useEffect(() => {
    if (!resolvedId) return;
    (async () => {
      try {
        setCheckoutLoading(true);
        const res = await fetch(`/api/venues/${resolvedId}/checkout-settings`);
        if (res.ok) {
          const data = await res.json();
          setCheckoutSettings(data);
        }
      } catch { /* */ }
      finally { setCheckoutLoading(false); }
    })();
  }, [resolvedId]);

  const loadReviews = useCallback(async () => {
    if (!resolvedId) return;
    try {
      setReviewsLoading(true);
      const res = await fetch(`/api/venues/${resolvedId}/reviews`);
      if (res.ok) setReviewsData(await res.json());
      else setReviewsData(null);
    } catch { setReviewsData(null); }
    finally { setReviewsLoading(false); }
  }, [resolvedId]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

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
          prev ? { ...prev, rating: data.rating ?? data.Rating ?? prev.rating, reviewCount: data.reviewCount ?? data.ReviewCount ?? prev.reviewCount } : prev
        );
      } catch { /* */ }
    }
    refreshVenue();
  };

  // ── Share handler ──
  const handleShare = async () => {
    const shareData = { title: venue?.name || 'ShuttleUp', text: `Xem sân ${venue?.name} trên ShuttleUp`, url: window.location.href };
    try {
      if (navigator.share) { await navigator.share(shareData); }
      else { await navigator.clipboard.writeText(window.location.href); setToast('Đã sao chép liên kết sân!'); }
    } catch {
      try { await navigator.clipboard.writeText(window.location.href); setToast('Đã sao chép liên kết sân!'); } catch { /* */ }
    }
  };

  // ── Favorite toggle ──
  const handleToggleFavorite = async () => {
    if (!user) { navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`); return; }
    if (favLoading) return;
    setFavLoading(true);
    try {
      if (isFavorited) { await favoritesApi.removeFavorite(resolvedId); setIsFavorited(false); setToast('Đã bỏ yêu thích'); }
      else { await favoritesApi.addFavorite(resolvedId); setIsFavorited(true); setToast('Đã thêm vào yêu thích ❤️'); }
    } catch { setToast('Có lỗi xảy ra, thử lại sau'); }
    finally { setFavLoading(false); }
  };

  // ── Copy email ──
  const handleCopyEmail = async () => {
    try { await navigator.clipboard.writeText(venue?.email || ''); setToast('Đã sao chép email!'); } catch { /* */ }
  };

  // ── Scroll to reviews ──
  const scrollToReviews = () => {
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Chat with owner ──
  const handleChatOwner = () => {
    if (!user) { navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`); return; }
    if (!venue?.ownerUserId) { setToast('Không tìm thấy thông tin chủ sân'); return; }
    openChatWithPeer({ userId: venue.ownerUserId, fullName: venue.ownerName, avatarUrl: venue.ownerAvatarUrl });
  };

  // ── Policy summary ──
  const policySummary = useMemo(() => {
    if (!checkoutSettings?.cancellation) return null;
    return buildPolicySummary(checkoutSettings.cancellation);
  }, [checkoutSettings]);

  // Early returns
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
            <Link to="/venues" className="btn btn-secondary">Quay lại danh sách sân</Link>
          </div>
        </div>
      </div>
    );
  }

  const avgStars = Number(reviewsData?.averageStars ?? reviewsData?.AverageStars ?? venue.rating ?? 0);
  const reviewCountDisplay = Number(reviewsData?.reviewCount ?? reviewsData?.ReviewCount ?? venue.reviewCount ?? 0);
  const reviewsList = reviewsData?.reviews ?? reviewsData?.Reviews ?? [];

  return (
    <div className="main-wrapper content-below-header venue-coach-details">
      {toast && <MiniToast msg={toast} onClose={() => setToast(null)} />}
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="VENUE" targetId={venue?.id} title="Báo cáo cụm sân" />
      <ContactOwnerModal open={contactModalOpen} onClose={() => setContactModalOpen(false)} venue={venue} onChat={handleChatOwner} />

      {/* Top gallery */}
      <section className="bannergallery-section">
        <Swiper
          modules={[Navigation]}
          navigation={{ prevEl: '.vg-prev', nextEl: '.vg-next' }}
          loop spaceBetween={4} slidesPerView={1}
          breakpoints={{ 576: { slidesPerView: 2, spaceBetween: 4 }, 992: { slidesPerView: 3, spaceBetween: 4 }, 1200: { slidesPerView: 4, spaceBetween: 4 } }}
          className="main-gallery-slider owl-carousel owl-theme"
        >
          {MOCK_GALLERY.map((src, idx) => (
            <SwiperSlide key={`top-gallery-${idx}-${src}`}>
              <div className="gallery-widget-item" onClick={() => openLightbox(idx)} style={{ cursor: 'pointer' }}>
                <img className="img-fluid" alt={`Ảnh sân ${idx + 1}`} src={src} style={{ display: 'block', width: '100%' }} />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
        <div className="owl-nav d-none d-md-block" style={{ position: 'absolute', top: '50%', width: '100%', transform: 'translateY(-50%)', zIndex: 10, pointerEvents: 'none' }}>
          <button className="owl-prev vg-prev" type="button"
            onMouseEnter={() => setPrevHovered(true)} onMouseLeave={() => setPrevHovered(false)}
            style={{ position: 'absolute', pointerEvents: 'auto', left: '30px', backgroundColor: prevHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)', border: 'none', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: prevHovered ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)', transition: 'background-color 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer' }}
          ><i className="feather-chevron-left" style={{ margin: 0, fontSize: '18px', color: '#333' }} /></button>
          <button className="owl-next vg-next" type="button"
            onMouseEnter={() => setNextHovered(true)} onMouseLeave={() => setNextHovered(false)}
            style={{ position: 'absolute', pointerEvents: 'auto', right: '30px', backgroundColor: nextHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)', border: 'none', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: nextHovered ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)', transition: 'background-color 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer' }}
          ><i className="feather-chevron-right" style={{ margin: 0, fontSize: '18px', color: '#333' }} /></button>
        </div>
        <div className="showphotos corner-radius-10" style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 10 }}>
          <button type="button" onClick={() => openLightbox(0)}
            onMouseEnter={() => setMoreHovered(true)} onMouseLeave={() => setMoreHovered(false)}
            style={{ backgroundColor: moreHovered ? '#F59E0B' : '#FBBF24', color: '#192335', padding: '7px 14px', borderRadius: '6px', border: 'none', fontWeight: '600', fontSize: '13px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'background-color 0.2s ease', whiteSpace: 'nowrap', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            <i className="fa-regular fa-images me-2" style={{ color: '#192335', fontSize: '14px' }} /> Xem thêm hình
          </button>
        </div>
      </section>

      <Lightbox
        open={lightboxOpen} close={() => setLightboxOpen(false)} slides={slides} index={lightboxIndex}
        plugins={[Zoom, Thumbnails]}
        zoom={{ maxZoomPixelRatio: 4, zoomInMultiplier: 1.5, doubleTapDelay: 300, doubleClickDelay: 300, scrollToZoom: true }}
        thumbnails={{ position: 'end', width: 120, height: 80, gap: 10, border: 2, borderRadius: 6, padding: 0, showToggle: false }}
        animation={{ fade: 300, swipe: 300 }}
        on={{ backdropClick: () => setLightboxOpen(false) }}
        styles={{ root: { '--yarl__color_backdrop': 'rgba(0, 0, 0, 0.75)' } }}
      />

      {/* Discount banner */}
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

      {/* ════ Venue header ════ */}
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
                {/* Email: display only with copy icon */}
                <li className="d-flex align-items-center gap-1">
                  <i className="feather-mail" />
                  <span style={{ color: '#6B7385' }}>{venue.email}</span>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    title="Sao chép email"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#6B7385', transition: 'color .2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#097E52'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6B7385'}
                  >
                    <i className="feather-copy" style={{ fontSize: 13 }} />
                  </button>
                </li>
              </ul>
            </div>
            <div className="col-lg-6 text-lg-end">
              <ul className="social-options float-lg-end d-sm-flex justify-content-start align-items-center">
                {/* Share */}
                <li>
                  <a href="#" onClick={e => { e.preventDefault(); handleShare(); }}
                    className="d-inline-flex align-items-center gap-1"
                    style={{ color: '#6B7385', textDecoration: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#097E52'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6B7385'}
                  >
                    <i className="feather-share-2" /> Chia sẻ
                  </a>
                </li>
                {/* Favorite */}
                <li>
                  <a href="#" onClick={e => { e.preventDefault(); handleToggleFavorite(); }}
                    className="d-inline-flex align-items-center gap-1"
                    style={{ color: isFavorited ? '#ef4444' : '#6B7385', textDecoration: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'color 0.2s' }}
                    onMouseEnter={e => { if (!isFavorited) e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { if (!isFavorited) e.currentTarget.style.color = '#6B7385'; }}
                  >
                    <i className={isFavorited ? 'fas fa-heart' : 'far fa-heart'} />
                    {isFavorited ? 'Đã yêu thích' : 'Thêm vào yêu thích'}
                  </a>
                </li>
                {/* Review count → scroll */}
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
                      <button type="button" className="btn btn-link p-0" onClick={scrollToReviews} style={{ textDecoration: 'underline', color: '#097E52' }}>
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
          {/* ── Bottom row: Price LEFT, Owner RIGHT ── */}
          <div className="row bottom-row d-flex align-items-center">
            <div className="col-lg-6">
              <div className="d-flex align-items-center">
                <p className="d-inline-block me-2 mb-0" style={{ fontSize: 15, color: '#64748b' }}>Giá từ:</p>
                <h3 className="primary-text mb-0 d-inline-block fw-bold" style={{ fontSize: '1.6rem' }}>
                  {venue.currency}{venue.startingPrice?.toLocaleString('vi-VN')}
                  <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>/ giờ</span>
                </h3>
              </div>
            </div>
            <div className="col-lg-6">
              <ul className="d-sm-flex details float-sm-end mb-0">
                <li className="d-flex align-items-center">
                  <div className="profile-pic">
                    <img className="img-fluid" src={venue.ownerAvatarUrl || '/assets/img/profiles/avatar-01.jpg'} alt="Owner" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  </div>
                  <div className="ms-2">
                    <p className="mb-0" style={{ fontSize: 12, color: '#94a3b8' }}>Chủ sân</p>
                    <h6 className="mb-0" style={{ fontSize: 14 }}>{venue.ownerName}</h6>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ════ Main content ════ */}
      <div className="content">
        <div className="container">
          <div className="row">
            {/* Left column */}
            <div className="col-lg-8">
              <div className="venue-options white-bg mb-4">
                <ul className="clearfix">
                  <li className="active"><a href="#overview">Tổng quan</a></li>
                  <li><a href="#includes">Bao gồm</a></li>
                  <li><a href="#policies">Chính sách</a></li>
                  <li><a href="#amenities">Tiện ích</a></li>
                  <li><a href="#gallery">Hình ảnh</a></li>
                  <li><a href="#reviews">Đánh giá</a></li>
                  <li><a href="#location">Vị trí</a></li>
                </ul>
              </div>

              {/* Overview */}
              <section id="overview" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Tổng quan</h4>
                {venue.description ? (
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>{venue.description}</p>
                ) : (
                  <p>Cơ sở đang trong quá trình cập nhật thông tin. Vui lòng liên hệ trực tiếp để biết thêm chi tiết về tiện nghi và dịch vụ.</p>
                )}
              </section>

              {/* Includes */}
              <section id="includes" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Bao gồm</h4>
                {venue.includes && venue.includes.length > 0 ? (
                  <ul className="clearfix">
                    {venue.includes.map((item, i) => (
                      <li key={i}><i className="feather-check-square" />{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mb-0" style={{ fontSize: 14 }}>Chủ sân chưa cập nhật thông tin mục này.</p>
                )}
              </section>

              {/* ══ NEW: Policies Section ══ */}
              <section id="policies" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Chính sách sân</h4>
                {checkoutLoading ? (
                  <p className="text-muted mb-0">Đang tải chính sách...</p>
                ) : (
                  <>
                    {(!checkoutSettings?.venueRules?.trim() && !checkoutSettings?.cancellation) ? (
                      <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                        Chủ sân hiện chưa cập nhật quy định và chính sách hoàn tiền cho cơ sở này.
                      </p>
                    ) : (
                      <>
                        {/* Venue Rules */}
                        {checkoutSettings?.venueRules?.trim() && (
                          <div className="mb-4">
                            <h5 className="mb-3" style={{ fontSize: 16 }}>Quy định chung tại sân</h5>
                            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: 15 }}>
                              {checkoutSettings.venueRules}
                            </p>
                          </div>
                        )}

                        {/* Cancellation & Refund */}
                        {checkoutSettings?.cancellation && (
                          <div>
                            <h5 className="mb-3" style={{ fontSize: 16 }}>Chính sách huỷ & hoàn tiền</h5>
                            <div>
                              <div className="d-flex align-items-start">
                                <div>
                                  {checkoutSettings.cancellation.allowCancel ? (
                                    <>
                                      <p className="mb-1" style={{ fontSize: 14 }}>
                                        <strong>Cho phép tự huỷ:</strong>{' '}
                                        <span style={{ color: '#059669' }}>Có</span>
                                      </p>
                                      <p className="mb-1" style={{ fontSize: 14 }}>
                                        <strong>Phải huỷ trước ít nhất:</strong>{' '}
                                        {(() => {
                                          const m = Number(checkoutSettings.cancellation.cancelBeforeMinutes ?? 0);
                                          if (m >= 1440) return `${m / 1440} ngày`;
                                          if (m >= 60) return `${m / 60} giờ`;
                                          return `${m} phút`;
                                        })()}
                                      </p>
                                      <p className="mb-0" style={{ fontSize: 14 }}>
                                        <strong>Hoàn tiền:</strong>{' '}
                                        {(() => {
                                          const rt = (checkoutSettings.cancellation.refundType || 'NONE').toUpperCase();
                                          if (rt === 'FULL') return <span style={{ color: '#059669' }}>100%</span>;
                                          if (rt === 'PERCENT') return <span style={{ color: '#d97706' }}>{checkoutSettings.cancellation.refundPercent}%</span>;
                                          return <span style={{ color: '#dc2626' }}>Không hoàn tiền</span>;
                                        })()}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="mb-0" style={{ fontSize: 14, color: '#dc2626' }}>
                                      Không cho phép tự huỷ đặt sân trên app.
                                    </p>
                                  )}
                                </div>
                              </div>
                              {/* Summary badge */}
                              {policySummary && (
                                <div className="mt-3 p-2 rounded d-flex align-items-center gap-2" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: 13 }}>
                                  <i className="feather-bookmark" style={{ color: '#059669', flexShrink: 0 }} />
                                  <span style={{ color: '#065f46', fontWeight: 500 }}>Tóm tắt: {policySummary}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>

              {/* Amenities */}
              <section id="amenities" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Tiện ích</h4>
                {venue.amenities && venue.amenities.length > 0 ? (
                  <ul className="d-md-flex justify-content-start align-items-center flex-wrap" style={{ gap: '8px 24px' }}>
                    {AMENITIES_LIST.filter(a => venue.amenities.includes(a.key)).map(a => (
                      <li key={a.key}><i className={a.icon} aria-hidden="true" />{a.label}</li>
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
                  {MOCK_GALLERY.map((src, idx) => (
                    <div key={`gallery-grid-${idx}-${src}`} className="col-6 col-md-4">
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
                              {cm ? <RichText text={cm} className="mb-2 mt-1" as="div" /> : null}
                              {Array.isArray(imgs) && imgs.length > 0 && (
                                <div className="d-flex flex-wrap gap-2 mb-2">
                                  {imgs.map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noreferrer">
                                      <img src={url} alt="" className="rounded" style={{ width: 72, height: 72, objectFit: 'cover' }} />
                                    </a>
                                  ))}
                                </div>
                              )}
                              {reply && (
                                <div className="p-2 rounded mt-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                  <small className="text-muted d-block mb-1">Phản hồi từ chủ sân</small>
                                  <RichText text={reply} className="mb-0 small" as="div" />
                                  {replyAt && <small className="text-muted">{new Date(replyAt).toLocaleString('vi-VN')}</small>}
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
                    height="445" style={{ border: 0, width: '100%' }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <div className="dull-bg d-flex justify-content-start align-items-center mt-3">
                  <div className="white-bg me-2"><i className="fas fa-location-arrow" /></div>
                  <div>
                    <h6>Địa chỉ sân</h6>
                    <p className="mb-0">{venue.address}</p>
                  </div>
                </div>
              </section>
            </div>

            {/* ════ Right sidebar ════ */}
            <aside className="col-lg-4">
              {/* ── Booking Card (optimized) ── */}
              <div className="white-bg book-court" style={{ borderRadius: 14, padding: '24px 20px' }}>
                <h4 className="border-bottom pb-3 mb-3" style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Đặt sân</h4>
                <p className="mb-3" style={{ fontSize: 14, color: '#64748b' }}>
                  <strong style={{ color: '#1e293b' }}>{venue.name}</strong> hiện đang mở đặt lịch.
                </p>
                <div className="d-flex align-items-baseline gap-1 mb-3 p-3 rounded" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <h3 className="primary-text mb-0 fw-bold" style={{ fontSize: '1.5rem' }}>
                    {venue.currency}{venue.startingPrice?.toLocaleString('vi-VN')}
                  </h3>
                  <span style={{ color: '#64748b', fontSize: 14 }}>/giờ</span>
                </div>
                <div className="d-grid gap-2">
                  {isAdmin ? (
                    <div className="alert alert-warning text-center mb-0 p-2" style={{ fontSize: '13px' }}>
                      <i className="feather-alert-triangle me-1" /> Tài khoản Quản trị không thể thao tác đặt sân.
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={handleBooking}
                        className="btn btn-secondary d-inline-flex justify-content-center align-items-center"
                        style={{ borderRadius: 10, padding: '12px 16px', fontWeight: 600 }}
                      >
                        <i className="feather-calendar" /><span className="ms-2">ĐẶT LỊCH</span>
                      </button>
                      <button type="button" onClick={handleLongTermBooking}
                        className="btn btn-outline-primary d-inline-flex justify-content-center align-items-center"
                        style={{ borderRadius: 10, padding: '12px 16px', fontWeight: 600 }}
                      >
                        <i className="feather-repeat" /><span className="ms-2">ĐẶT LỊCH DÀI HẠN</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ── Owner Info ── */}
              <div className="white-bg cage-owner-info" style={{ borderRadius: 14, padding: '24px 20px', marginTop: 16 }}>
                <h4 className="border-bottom pb-3 mb-3" style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Thông tin chủ sân</h4>
                <div className="d-flex justify-content-start align-items-center">
                  <div className="profile-pic me-2">
                    <img className="img-fluid" alt="Owner" src={venue.ownerAvatarUrl || '/assets/img/profiles/avatar-05.jpg'} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <h5 className="mb-1" style={{ fontSize: 15 }}>{venue.ownerName}</h5>
                    <div className="rating d-flex align-items-center flex-wrap gap-1">
                      <StarRatingDisplay value={avgStars} size={15} />
                      <span className="ms-1">{avgStars.toFixed(1)}</span>
                      <span>({reviewCountDisplay} đánh giá)</span>
                    </div>
                  </div>
                </div>
                <div className="d-grid gap-2 mt-3">
                  {/* Contact owner → opens modal */}
                  <button
                    type="button"
                    onClick={() => setContactModalOpen(true)}
                    className="btn btn-secondary d-inline-flex justify-content-center align-items-center"
                    style={{ borderRadius: 10, padding: '12px 16px', fontWeight: 600 }}
                  >
                    <i className="feather-phone-call" /><span className="ms-2">Liên hệ chủ sân</span>
                  </button>
                  {/* Report */}
                  <button
                    type="button"
                    className="btn btn-outline-secondary d-inline-flex justify-content-center align-items-center"
                    onClick={() => setReportOpen(true)}
                    disabled={!user}
                    title={!user ? 'Vui lòng đăng nhập để báo cáo' : 'Báo cáo cụm sân'}
                    style={{ borderRadius: 10, padding: '12px 16px' }}
                  >
                    <i className="feather-flag" /><span className="ms-2">Báo cáo cụm sân</span>
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
        onClose={() => { setReviewModalOpen(false); setPendingReviewBookingId(null); }}
        onSaved={handleReviewSaved}
      />

      <LongTermTypeModal
        isOpen={isLongTermModalOpen}
        onClose={() => setIsLongTermModalOpen(false)}
        venuePayload={venue ? {
          venueId: venue.id,
          venueName: venue.name,
          venueAddress: venue.address,
          pricePerSlot: venue.startingPrice,
          slotDuration: venue.slotDuration ?? 60,
          weeklyDiscountPercent: venue.weeklyDiscountPercent,
          monthlyDiscountPercent: venue.monthlyDiscountPercent
        } : null}
      />
    </div>
  );
}
