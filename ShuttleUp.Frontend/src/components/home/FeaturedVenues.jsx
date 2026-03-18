import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';

const featuredVenues = [
  {
    id: 1,
    img: '/assets/img/venues/venues-01.jpg',
    tag: 'Nổi bật',
    tagClass: 'tag-blue',
    price: '150k',
    rating: '4.2',
    reviews: '300 Đánh giá',
    name: 'Sarah Sports Academy',
    desc: 'Trải nghiệm sân thi đấu chuẩn quốc gia tại Sarah Sports Academy.',
    location: 'Quận 1, TP HCM',
    available: 'Hôm nay',
    avatar: '/assets/img/profiles/avatar-01.jpg',
    owner: 'Nguyễn Văn A',
  },
  {
    id: 2,
    img: '/assets/img/venues/venues-02.jpg',
    tag: 'Đánh giá cao',
    tagClass: 'tag-blue',
    price: '120k',
    rating: '5.0',
    reviews: '150 Đánh giá',
    name: 'Badminton Center',
    desc: 'Khai mở tiềm năng của bạn tại cụm sân cầu lông quy mô nhất khu vực.',
    location: 'Gò Vấp, TP HCM',
    available: 'Ngày mai',
    avatar: '/assets/img/profiles/avatar-02.jpg',
    owner: 'Trần Thị B',
  },
  {
    id: 3,
    img: '/assets/img/venues/venues-03.jpg',
    tag: '',
    tagClass: '',
    price: '100k',
    rating: '4.7',
    reviews: '120 Đánh giá',
    name: 'Nhà thi đấu Phú Thọ',
    desc: 'Không gian thông thoáng, thích hợp giải đấu quy mô nhỏ và phong trào.',
    location: 'Quận 11, TP HCM',
    available: 'Hôm nay',
    avatar: '/assets/img/profiles/avatar-03.jpg',
    owner: 'Lê Văn C',
  },
  {
    id: 4,
    img: '/assets/img/venues/venues-02.jpg',
    tag: 'Nổi bật',
    tagClass: 'tag-blue',
    price: '180k',
    rating: '4.5',
    reviews: '300 Đánh giá',
    name: 'ABC Sports Academy',
    desc: 'Thỏa mãn đam mê rèn luyện thể thao với trang thiết bị cao cấp tại ABC.',
    location: 'Cầu Giấy, Hà Nội',
    available: 'Cuối tuần này',
    avatar: '/assets/img/profiles/avatar-04.jpg',
    owner: 'Phạm Thị D',
  },
];

const nearCourts = [
  { id: 101, img: '/assets/img/venues/venues-04.jpg', name: 'Smart Shuttlers', address: 'Quận 1, TP HCM', rating: '4.2', reviews: '300 Đánh giá', miles: 'Cách 2.1 km' },
  { id: 102, img: '/assets/img/venues/venues-05.jpg', name: 'Parlers Badminton', address: 'Quận 3, TP HCM', rating: '4.2', reviews: '200 Đánh giá', miles: 'Cách 3.4 km' },
  { id: 103, img: '/assets/img/venues/venues-06.jpg', name: '6 Feathers', address: 'Quận Bình Thạnh, TP HCM', rating: '4.2', reviews: '400 Đánh giá', miles: 'Cách 5.8 km' },
  { id: 104, img: '/assets/img/venues/venues-05.jpg', name: 'Parlers Badminton', address: 'Quận Phú Nhuận, TP HCM', rating: '4.2', reviews: '300 Đánh giá', miles: 'Cách 4.1 km' },
  { id: 105, img: '/assets/img/venues/venues-04.jpg', name: 'Smart Shuttlers', address: 'Quận 10, TP HCM', rating: '4.2', reviews: '300 Đánh giá', miles: 'Cách 3.1 km' },
  { id: 106, img: '/assets/img/venues/venues-06.jpg', name: '6 Feathers', address: 'Quận 5, TP HCM', rating: '4.2', reviews: '400 Đánh giá', miles: 'Cách 6.5 km' },
];

const featuredVenuesLoop = [...featuredVenues, ...featuredVenues.map(v => ({ ...v, id: v.id + 10 }))];

export default function FeaturedVenues() {
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
                loop
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
                {featuredVenuesLoop.map((venue) => (
                  <SwiperSlide key={venue.id}>
                    <div className="featured-venues-item aos" data-aos="fade-up">
                      <div className="listing-item mb-0">
                        <div className="listing-img">
                          <Link to="/venue-details">
                            <img src={venue.img} className="img-fluid" alt="Venue" />
                          </Link>
                          <div className="fav-item-venues">
                            {venue.tag && <span className={`tag ${venue.tagClass}`}>{venue.tag}</span>}
                            <h5 className="tag tag-primary">{venue.price}<span>/h</span></h5>
                          </div>
                        </div>
                        <div className="listing-content">
                          <div className="list-reviews">
                            <div className="d-flex align-items-center">
                              <span className="rating-bg">{venue.rating}</span><span>{venue.reviews}</span>
                            </div>
                            <a href="#" onClick={(e) => e.preventDefault()} className="fav-icon">
                              <i className="feather-heart"></i>
                            </a>
                          </div>
                          <h3 className="listing-title">
                            <Link to="/venue-details">{venue.name}</Link>
                          </h3>
                          <div className="listing-details-group">
                            <p>{venue.desc}</p>
                            <ul>
                              <li><span><i className="feather-map-pin"></i>{venue.location}</span></li>
                              <li><span><i className="feather-calendar"></i>Lịch trống tới: <span className="primary-text">{venue.available}</span></span></li>
                            </ul>
                          </div>
                          <div className="listing-button">
                            <div className="listing-venue-owner">
                              <Link className="navigation" to="/manager-detail">
                                <img src={venue.avatar} alt="Owner" />{venue.owner}
                              </Link>
                            </div>
                            <Link to="/venue-details" className="user-book-now">
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
            <p className="sub-title">Khám phá các sân cầu lông gần bạn cho những buổi tập thuận tiện và dễ dàng tiếp cận.</p>
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
                loop
                spaceBetween={24}
                breakpoints={{
                  576: { slidesPerView: 1 },
                  768: { slidesPerView: 2 },
                  992: { slidesPerView: 3 },
                  1200: { slidesPerView: 4 },
                }}
                className="featured-venues-slider"
              >
                {nearCourts.map((c) => (
                  <SwiperSlide key={c.id}>
                    <div className="featured-venues-item court-near-item">
                      <div className="listing-item mb-0">
                        <div className="listing-img">
                          <Link to="/venue-details">
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
                            <Link to="/venue-details">{c.name}</Link>
                          </h3>
                          <div className="listing-details-group">
                            <ul>
                              <li>
                                <span><i className="feather-map-pin"></i>{c.address}</span>
                              </li>
                            </ul>
                          </div>
                          <div className="list-reviews near-review">
                            <div className="d-flex align-items-center">
                              <span className="rating-bg">{c.rating}</span><span>{c.reviews}</span>
                            </div>
                            <span className="mile-away"><i className="feather-zap"></i>{c.miles}</span>
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
            <Link to="/courts" className="btn btn-secondary d-inline-flex align-items-center">
              <i className="feather-search me-2"></i>Tìm Kiếm Sân
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
