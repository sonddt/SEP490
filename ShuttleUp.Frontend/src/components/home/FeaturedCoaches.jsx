import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';

const featuredCoachesBase = [
  { id: 1, img: '/assets/img/profiles/user-01.jpg', tag: 'Rookie', price: '$250', lessons: 4, name: 'Kevin Anderson' },
  { id: 2, img: '/assets/img/profiles/user-02.jpg', tag: 'Intermediate', price: '$150', lessons: 3, name: 'Harry Richardson' },
  { id: 3, img: '/assets/img/profiles/user-03.jpg', tag: 'Professional', price: '$350', lessons: 2, name: 'Evon Raddick' },
  { id: 4, img: '/assets/img/profiles/user-04.jpg', tag: 'Rookie', price: '$250', lessons: 4, name: 'Angela Roudrigez' },
];

const featuredCoaches = [...featuredCoachesBase, ...featuredCoachesBase.map(c => ({ ...c, id: c.id + 10 }))];

export default function FeaturedCoaches() {
  return (
    <section className="section featured-section">
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Featured <span>Coaches</span></h2>
          <p className="sub-title">Uplift your badminton game with our featured coaches, personalized instruction, and expertise.</p>
        </div>
        <div className="row">
          <div className="featured-slider-group aos" data-aos="fade-up">
            <Swiper
              modules={[Navigation, Autoplay]}
              navigation
              autoplay={{ delay: 4000, disableOnInteraction: false }}
              loop
              loopAdditionalSlides={4}
              spaceBetween={24}
              breakpoints={{
                576: { slidesPerView: 1 },
                768: { slidesPerView: 2 },
                992: { slidesPerView: 3 },
                1200: { slidesPerView: 4 },
              }}
              className="featured-coache-slider"
            >
              {featuredCoaches.map((coach) => (
                <SwiperSlide key={coach.id}>
                  <div className="featured-venues-item">
                    <div className="listing-item mb-0">
                      <div className="listing-img">
                        <Link to="/coach-detail">
                          <img src={coach.img} alt="Coach" />
                        </Link>
                        <div className="fav-item-venues">
                          <span className="tag tag-blue">{coach.tag}</span>
                          <div className="list-reviews coche-star">
                            <a href="#" onClick={(e) => e.preventDefault()} className="fav-icon">
                              <i className="feather-heart"></i>
                            </a>
                          </div>
                        </div>
                        <div className="hour-list">
                          <h5 className="tag tag-primary">From {coach.price} <span>/hr</span></h5>
                        </div>
                      </div>
                      <div className="listing-content list-coche-content">
                        <span>{coach.lessons} Lessons</span>
                        <h3><Link to="/coach-detail">{coach.name}</Link></h3>
                        <Link to="/coach-details"><i className="feather-arrow-right"></i></Link>
                        <Link to="/coach-details" className="icon-hover"><i className="feather-calendar"></i></Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
        <div className="view-all text-center aos" data-aos="fade-up">
          <Link to="/coaches" className="btn btn-secondary d-inline-flex align-items-center">
            View All Coaches <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
        </div>
      </div>
    </section>
  );
}
