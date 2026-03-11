import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';

const nearCourts = [
  { id: 1, img: '/assets/img/venues/venues-04.jpg', name: 'Smart Shuttlers', address: '1 Crowthorne Road, 4th Street, NY', rating: '4.2', reviews: '300 Reviews', miles: '2.1 Miles Away' },
  { id: 2, img: '/assets/img/venues/venues-05.jpg', name: 'Parlers Badminton', address: 'Hope Street, Battersea, SW11 2DA', rating: '4.2', reviews: '200 Reviews', miles: '9.3 Miles Away' },
  { id: 3, img: '/assets/img/venues/venues-06.jpg', name: '6 Feathers', address: 'Lonsdale Road, Barnes, SW13 9QL', rating: '4.2', reviews: '400 Reviews', miles: '10.8 Miles Away' },
  { id: 4, img: '/assets/img/venues/venues-05.jpg', name: 'Parlers Badminton', address: '1 Crowthorne Road, 4th Street, NY', rating: '4.2', reviews: '300 Reviews', miles: '8.1 Miles Away' },
  { id: 5, img: '/assets/img/venues/venues-04.jpg', name: 'Smart Shuttlers', address: '1 Crowthorne Road, 4th Street, NY', rating: '4.2', reviews: '300 Reviews', miles: '2.1 Miles Away' },
  { id: 6, img: '/assets/img/venues/venues-06.jpg', name: '6 Feathers', address: 'Lonsdale Road, Barnes, SW13 9QL', rating: '4.2', reviews: '400 Reviews', miles: '10.8 Miles Away' },
];

export default function CourtsNearYou() {
  return (
    <section className="section court-near">
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Find Courts <span>Near You</span></h2>
          <p className="sub-title">Discover nearby badminton courts for convenient and accessible gameplay.</p>
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
            View All Services <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
        </div>
      </div>
    </section>
  );
}
