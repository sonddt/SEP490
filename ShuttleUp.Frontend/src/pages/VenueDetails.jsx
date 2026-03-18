import { Link, useNavigate, useParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';

// Temporary mock data for Iteration 1.
// Later, this can be replaced by data from venue API using the venue ID in the route.
const MOCK_VENUE = {
  name: 'Badminton Academy',
  isVerified: true,
  address: '70 Bright St New York, USA',
  phone: '+3 80992 31212',
  email: 'info@badmintonacademy.com',
  venueType: 'Sân trong nhà',
  ownerName: 'Hendry Williams',
  startingPrice: 150,
  currency: '$',
  rating: 5.0,
  reviewCount: 15,
};

const MOCK_GALLERY = [
  '/assets/img/gallery/gallery1/gallery-01.png',
  '/assets/img/gallery/gallery1/gallery-02.png',
  '/assets/img/gallery/gallery1/gallery-03.png',
  '/assets/img/gallery/gallery1/gallery-04.png',
  '/assets/img/gallery/gallery1/gallery-05.png',
  '/assets/img/gallery/gallery1/gallery-01.png',
  '/assets/img/gallery/gallery1/gallery-02.png',
];

const MOCK_SIMILAR_VENUES = [
  {
    id: 1,
    img: '/assets/img/venues/venues-01.jpg',
    tag: 'Nổi bật',
    tagClass: 'tag-blue',
    price: 450,
    name: 'Sarah Sports Academy',
    desc: 'Trải nghiệm hành trình thể thao đỉnh cao tại Sarah Sports Academy.',
    location: 'Port Alsworth, AK',
    available: '15 May 2023',
    rating: '4.2',
    reviews: '300 đánh giá',
    owner: 'Mart Sublin',
    ownerAvatar: '/assets/img/profiles/avatar-01.jpg',
  },
  {
    id: 2,
    img: '/assets/img/venues/venues-02.jpg',
    tag: 'Đánh giá cao',
    tagClass: 'tag-blue',
    price: 200,
    name: 'Badminton Academy',
    desc: 'Khai mở tiềm năng cầu lông của bạn tại Badminton Academy.',
    location: 'Sacramento, CA',
    available: '15 May 2023',
    rating: '5.0',
    reviews: '150 đánh giá',
    owner: 'Rebecca',
    ownerAvatar: '/assets/img/profiles/avatar-02.jpg',
  },
  {
    id: 3,
    img: '/assets/img/venues/venues-03.jpg',
    price: 350,
    name: 'Manchester Academy',
    desc: 'Manchester Academy: nơi ước mơ gặp gỡ sự xuất sắc trong huấn luyện thể thao.',
    location: 'Guysville, OH',
    available: '16 May 2023',
    rating: '4.7',
    reviews: '120 đánh giá',
    owner: 'Andrew',
    ownerAvatar: '/assets/img/profiles/avatar-03.jpg',
  },
  {
    id: 4,
    img: '/assets/img/venues/venues-02.jpg',
    tag: 'Nổi bật',
    tagClass: 'tag-blue',
    price: 450,
    name: 'ABC Sports Academy',
    desc: 'Hệ thống sân chất lượng, phù hợp cả tập luyện và thi đấu phong trào.',
    location: 'Little Rock, AR',
    available: '17 May 2023',
    rating: '4.5',
    reviews: '300 đánh giá',
    owner: 'Mart Sublin',
    ownerAvatar: '/assets/img/profiles/avatar-04.jpg',
  },
];

export default function VenueDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const venue = { ...MOCK_VENUE, id: id ?? '1' };

  const handleBooking = () => {
    navigate('/booking', {
      state: {
        venueId:      venue.id,
        venueName:    venue.name,
        venueAddress: venue.address,
        pricePerSlot: venue.startingPrice,
        currency:     venue.currency,
      },
    });
  };

  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);
  const [moreHovered, setMoreHovered] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Build unique slides for lightbox (MOCK_GALLERY may have duplicates)
  const slides = MOCK_GALLERY.map((src) => ({ src }));

  const openLightbox = (idx) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  return (
    <div className="main-wrapper content-below-header venue-coach-details">
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
                    {venue.rating.toFixed(1)}
                  </span>
                  <div className="review">
                    <div className="rating">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <i key={i} className="fas fa-star filled" />
                      ))}
                    </div>
                    <p className="mb-0">
                      <button type="button" className="btn btn-link p-0">
                        {venue.reviewCount} đánh giá
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
                <p>
                  Badminton Academy là cụm sân cầu lông chất lượng cao, phù hợp cho cả người chơi phong trào và các đội
                  tuyển. Sân được bảo trì thường xuyên, hệ thống đèn LED và thảm tiêu chuẩn thi đấu.
                </p>
                <p>
                  Bạn có thể đặt sân theo giờ hoặc theo gói dài hạn, phù hợp với nhu cầu luyện tập linh hoạt của từng
                  nhóm. Đội ngũ quản lý hỗ trợ nhanh chóng trong suốt quá trình đặt sân.
                </p>
              </section>

              {/* Includes */}
              <section id="includes" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Bao gồm</h4>
                <ul className="clearfix">
                  <li>
                    <i className="feather-check-square" />
                    Vợt cầu lông (số lượng giới hạn)
                  </li>
                  <li>
                    <i className="feather-check-square" />
                    Trụ, lưới và thảm tiêu chuẩn
                  </li>
                  <li>
                    <i className="feather-check-square" />
                    Hỗ trợ chuẩn bị sân trước giờ chơi
                  </li>
                  <li>
                    <i className="feather-check-square" />
                    Nước uống cơ bản
                  </li>
                </ul>
              </section>

              {/* Rules */}
              <section id="rules" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Quy định</h4>
                <ul>
                  <li>
                    <p>
                      <i className="feather-alert-octagon" />
                      Khuyến khích mang giày đế mềm / non-marking để bảo vệ mặt sân.
                    </p>
                  </li>
                  <li>
                    <p>
                      <i className="feather-alert-octagon" />
                      Không mang thức ăn, đồ uống có gas hoặc chai thủy tinh vào trong khu vực sân.
                    </p>
                  </li>
                  <li>
                    <p>
                      <i className="feather-alert-octagon" />
                      Đến trước giờ chơi ít nhất 10 phút để làm thủ tục nhận sân.
                    </p>
                  </li>
                </ul>
              </section>

              {/* Amenities */}
              <section id="amenities" className="white-bg mb-4 corner-radius-10 p-4">
                <h4 className="mb-3">Tiện ích</h4>
                <ul className="d-md-flex justify-content-between align-items-center flex-wrap">
                  <li>
                    <i className="fa fa-check-circle" aria-hidden="true" />
                    Bãi đỗ xe
                  </li>
                  <li>
                    <i className="fa fa-check-circle" aria-hidden="true" />
                    Nước uống
                  </li>
                  <li>
                    <i className="fa fa-check-circle" aria-hidden="true" />
                    Tủ đồ & phòng thay đồ
                  </li>
                  <li>
                    <i className="fa fa-check-circle" aria-hidden="true" />
                    Phòng tắm & nhà vệ sinh
                  </li>
                </ul>
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

              {/* Reviews – static content for now */}
              <section id="reviews" className="white-bg mb-4 corner-radius-10 p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="mb-0">Đánh giá</h4>
                  <button type="button" className="btn btn-gradient add-review">
                    Viết đánh giá
                  </button>
                </div>
                <div className="row review-wrapper">
                  <div className="col-lg-3">
                    <div className="ratings-info corner-radius-10 text-center">
                      <h3>4.8</h3>
                      <span>trên 5.0</span>
                      <div className="rating">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <i key={i} className="fas fa-star filled" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-9">
                    <p>97% người chơi sẵn sàng quay lại đặt sân tại đây.</p>
                  </div>
                </div>
              </section>

              {/* Location */}
              <section id="location" className="white-bg corner-radius-10 p-4">
                <h4 className="mb-3">Vị trí</h4>
                <div className="google-maps">
                  <iframe
                    title="Venue location"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2967.8862835683544!2d-73.98256668525309!3d41.93829486962529!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89dd0ee3286615b7%3A0x42bfa96cc2ce4381!2s132%20Kingston%20St%2C%20Kingston%2C%20NY%2012401%2C%20USA!5e0!3m2!1sen!2sin!4v1670922579281!5m2!1sen!2sin"
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
                <div className="d-grid btn-block mt-3">
                  <button
                    type="button"
                    onClick={handleBooking}
                    className="btn btn-secondary d-inline-flex justify-content-center align-items-center"
                  >
                    <i className="feather-calendar" />
                    <span className="ms-2">ĐẶT LỊCH</span>
                  </button>
                </div>
              </div>

              <div className="white-bg">
                <h4 className="border-bottom">Yêu cầu tư vấn lịch</h4>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    // To be wired to backend later
                  }}
                >
                  <div className="mb-10">
                    <label className="form-label">Họ tên</label>
                    <input type="text" className="form-control" placeholder="Nhập họ tên" />
                  </div>
                  <div className="mb-10">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" placeholder="Nhập email" />
                  </div>
                  <div className="mb-10">
                    <label className="form-label">Số điện thoại</label>
                    <input type="text" className="form-control" placeholder="Nhập số điện thoại" />
                  </div>
                  <div className="mb-10">
                    <label className="form-label">Ngày mong muốn</label>
                    <div className="form-icon">
                      <input type="date" className="form-control" />
                      <span className="cus-icon">
                        <i className="feather-calendar" />
                      </span>
                    </div>
                  </div>
                  <div className="mb-10">
                    <label className="form-label">Ghi chú</label>
                    <textarea className="form-control" rows={3} placeholder="Mô tả khung giờ, số người chơi..." />
                  </div>
                  <div className="form-check d-flex justify-content-start align-items-center policy">
                    <input className="form-check-input me-2" type="checkbox" id="policy" defaultChecked />
                    <label className="form-check-label" htmlFor="policy">
                      Bằng cách gửi yêu cầu, bạn đồng ý với Chính sách bảo mật & Điều khoản sử dụng.
                    </label>
                  </div>
                  <div className="d-grid btn-block mt-3">
                    <button
                      type="submit"
                      className="btn btn-secondary d-inline-flex justify-content-center align-items-center"
                    >
                      Gửi yêu cầu
                      <i className="feather-arrow-right-circle ms-1" />
                    </button>
                  </div>
                </form>
              </div>

              <div className="white-bg cage-owner-info">
                <h4 className="border-bottom">Thông tin chủ sân</h4>
                <div className="d-flex justify-content-start align-items-center">
                  <div className="profile-pic me-2">
                    <img className="img-fluid" alt="Owner" src="/assets/img/profiles/avatar-05.jpg" />
                  </div>
                  <div>
                    <h5>{venue.ownerName}</h5>
                    <div className="rating">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <i key={i} className="fas fa-star filled" />
                      ))}
                      <span className="ms-1">5.0</span>
                      <span>(20 Reviews)</span>
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
                </div>
              </div>

              <div className="white-bg listing-owner">
                <h4 className="border-bottom">Các sân khác của chủ sân</h4>
                <ul>
                  {MOCK_SIMILAR_VENUES.slice(0, 2).map((v) => (
                    <li key={v.id} className="d-flex justify-content-start align-items-center">
                      <div>
                        <Link to={`/courts/${v.id}`}>
                          <img className="img-fluid" alt={v.name} src={v.img} />
                        </Link>
                      </div>
                        <div className="owner-info ms-2">
                        <h5>
                          <Link to={`/courts/${v.id}`}>{v.name}</Link>
                        </h5>
                        <p>
                          <i className="feather-map-pin" />
                          <span>{v.location}</span>
                        </p>
                        <p className="mb-0">
                          <i className="feather-calendar" />
                          <span>Next Availablity : </span>
                          <span className="primary-text">{v.available}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="white-bg">
                <h4 className="border-bottom">Chia sẻ sân</h4>
                <ul className="social-medias d-flex">
                  <li className="facebook">
                    <button type="button">
                      <i className="fa-brands fa-facebook-f" />
                    </button>
                  </li>
                  <li className="instagram">
                    <button type="button">
                      <i className="fa-brands fa-instagram" />
                    </button>
                  </li>
                  <li className="behance">
                    <button type="button">
                      <i className="fa-brands fa-behance" />
                    </button>
                  </li>
                  <li className="twitter">
                    <button type="button">
                      <i className="fa-brands fa-twitter" />
                    </button>
                  </li>
                  <li className="pinterest">
                    <button type="button">
                      <i className="fa-brands fa-pinterest" />
                    </button>
                  </li>
                  <li className="linkedin">
                    <button type="button">
                      <i className="fa-brands fa-linkedin" />
                    </button>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>

        {/* Similar venues */}
        <section className="section innerpagebg">
          <div className="container">
            <div className="featured-slider-group">
              <h3 className="mb-40">Các sân tương tự</h3>
              <div className="row g-4">
                {MOCK_SIMILAR_VENUES.map((v) => (
                  <div key={v.id} className="col-md-6 col-lg-3">
                    <div className="featured-venues-item">
                      <div className="listing-item mb-0">
                        <div className="listing-img">
                          <Link to={`/courts/${v.id}`}>
                            <img src={v.img} alt={v.name} className="img-fluid" />
                          </Link>
                          <div className="fav-item-venues">
                            {v.tag && <span className={`tag ${v.tagClass}`}>{v.tag}</span>}
                            <h5 className="tag tag-primary">
                              ${v.price}
                              <span>/hr</span>
                            </h5>
                          </div>
                        </div>
                        <div className="listing-content">
                          <div className="list-reviews">
                            <div className="d-flex align-items-center">
                              <span className="rating-bg">{v.rating}</span>
                              <span>{v.reviews}</span>
                            </div>
                            <button type="button" className="fav-icon">
                              <i className="feather-heart" />
                            </button>
                          </div>
                          <h3 className="listing-title">
                            <Link to={`/courts/${v.id}`}>{v.name}</Link>
                          </h3>
                          <div className="listing-details-group">
                            <p>{v.desc}</p>
                            <ul>
                              <li>
                                <span>
                                  <i className="feather-map-pin" />
                                  {v.location}
                                </span>
                              </li>
                              <li>
                                <span>
                                  <i className="feather-calendar" />
                                  Next Availablity : <span className="primary-text">{v.available}</span>
                                </span>
                              </li>
                            </ul>
                          </div>
                          <div className="listing-button">
                            <div className="listing-venue-owner">
                              <span className="navigation">
                                <img src={v.ownerAvatar} alt={v.owner} />
                                {v.owner}
                              </span>
                            </div>
                            <Link to={`/courts/${v.id}`} className="user-book-now">
                              <span>
                                <i className="feather-calendar me-2" />
                              </span>
                              Xem chi tiết
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

