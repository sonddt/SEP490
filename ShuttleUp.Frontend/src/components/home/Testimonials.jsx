import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';

const testimonials = [
  { id: 1, name: 'Ariyan Rusov', avatar: '/assets/img/profiles/avatar-01.jpg', title: 'Personalized Attention', text: "DreamSports' coaching services enhanced my badminton skills. Personalized attention from knowledgeable coaches propelled my game to new heights.", tag: 'Badminton' },
  { id: 2, name: 'Darren Valdez', avatar: '/assets/img/profiles/avatar-04.jpg', title: 'Quality Matters !', text: "DreamSports' advanced badminton equipment has greatly improved my performance on the court. Their quality range of rackets and shoes made a significant impact.", tag: 'Badminton' },
  { id: 3, name: 'Elinor Dunn', avatar: '/assets/img/profiles/avatar-03.jpg', title: 'Excellent Professionalism !', text: "DreamSports' unmatched professionalism and service excellence left a positive experience. Highly recommended for court rentals and equipment purchases.", tag: 'Badminton' },
  { id: 4, name: 'Darren Valdez', avatar: '/assets/img/profiles/avatar-04.jpg', title: 'Quality Matters !', text: "DreamSports' advanced badminton equipment has greatly improved my performance on the court. Their quality range of rackets and shoes made a significant impact.", tag: 'Badminton' },
];

export default function Testimonials() {
  return (
    <section className="section our-testimonials">
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Our <span>Testimonials</span></h2>
          <p className="sub-title">Glowing testimonials from passionate badminton enthusiasts worldwide, showcasing our exceptional services.</p>
        </div>
        <div className="row">
          <div className="featured-slider-group aos" data-aos="fade-up">
            <Swiper
              modules={[Navigation, Autoplay]}
              navigation
              autoplay={{ delay: 4000, disableOnInteraction: false }}
              loop
              spaceBetween={24}
              breakpoints={{
                576: { slidesPerView: 1 },
                992: { slidesPerView: 2 },
                1200: { slidesPerView: 3 },
              }}
              className="featured-venues-slider"
            >
              {testimonials.map((t) => (
                <SwiperSlide key={t.id}>
                  <div className="testimonial-group">
                    <div className="testimonial-review">
                      <div className="rating-point">
                        <i className="fas fa-star filled"></i>
                        <i className="fas fa-star filled"></i>
                        <i className="fas fa-star filled"></i>
                        <i className="fas fa-star filled"></i>
                        <i className="fas fa-star filled"></i>
                        <span> 5.0</span>
                      </div>
                      <h5>{t.title}</h5>
                      <p>{t.text}</p>
                    </div>
                    <div className="listing-venue-owner">
                      <a className="navigation" href="#" onClick={(e) => e.preventDefault()}>
                        <img src={t.avatar} alt="User" />
                      </a>
                      <div className="testimonial-content">
                        <h5><a href="#" onClick={(e) => e.preventDefault()}>{t.name}</a></h5>
                        <a href="#" onClick={(e) => e.preventDefault()} className="btn btn-primary">
                          {t.tag}
                        </a>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </div>
    </section>
  );
}
