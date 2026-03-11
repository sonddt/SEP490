import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';

const nearCourts = [
  { id: 1, img: '/assets/img/venues/venues-04.jpg', name: 'Smart Shuttlers', address: 'Quận 1, TP HCM', rating: '4.2', reviews: '300 Đánh giá', miles: 'Cách 2.1 km' },
  { id: 2, img: '/assets/img/venues/venues-05.jpg', name: 'Parlers Badminton', address: 'Quận 3, TP HCM', rating: '4.2', reviews: '200 Đánh giá', miles: 'Cách 3.4 km' },
  { id: 3, img: '/assets/img/venues/venues-06.jpg', name: '6 Feathers', address: 'Quận Bình Thạnh, TP HCM', rating: '4.2', reviews: '400 Đánh giá', miles: 'Cách 5.8 km' },
  { id: 4, img: '/assets/img/venues/venues-05.jpg', name: 'Parlers Badminton', address: 'Quận Phú Nhuận, TP HCM', rating: '4.2', reviews: '300 Đánh giá', miles: 'Cách 4.1 km' },
  { id: 5, img: '/assets/img/venues/venues-04.jpg', name: 'Smart Shuttlers', address: 'Quận 10, TP HCM', rating: '4.2', reviews: '300 Đánh giá', miles: 'Cách 3.1 km' },
  { id: 6, img: '/assets/img/venues/venues-06.jpg', name: '6 Feathers', address: 'Quận 5, TP HCM', rating: '4.2', reviews: '400 Đánh giá', miles: 'Cách 6.5 km' },
];

export default function CourtsNearYou() {
  return (
    <section className="section court-near">
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Tìm Sân <span>Gần Bạn</span></h2>
          <p className="sub-title">Khám phá các sân cầu lông gần bạn cho những buổi tập thuận tiện và dễ dàng tiếp cận.</p>
        </div>
        <div className="row">
          <div className="featured-slider-group aos" data-aos="fade-up">
            <Swiper
              modules={[Navigation, Autoplay]}
              navigation
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
          </div>
        </div>
        <div className="view-all text-center aos" data-aos="fade-up">
          <Link to="/courts" className="btn btn-secondary d-inline-flex align-items-center">
            Hiển Thị Tất Cả <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
        </div>
      </div>
    </section>
  );
}
