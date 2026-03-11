import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';

const featuredManagersBase = [
  { id: 1, img: '/assets/img/profiles/user-01.jpg', tag: 'Nhiệt tình', price: '150k', courts: 4, name: 'Nguyễn Văn A' },
  { id: 2, img: '/assets/img/profiles/user-02.jpg', tag: 'Chuyên nghiệp', price: '120k', courts: 8, name: 'Trần Thị B' },
  { id: 3, img: '/assets/img/profiles/user-03.jpg', tag: 'Đánh giá cao', price: '180k', courts: 2, name: 'Lê Văn C' },
  { id: 4, img: '/assets/img/profiles/user-04.jpg', tag: 'Nhiệt tình', price: '100k', courts: 6, name: 'Phạm Thị D' },
];

const featuredManagers = [...featuredManagersBase, ...featuredManagersBase.map(c => ({ ...c, id: c.id + 10 }))];

export default function FeaturedCoaches() {
  return (
    <section className="section featured-section">
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Quản Lý Sân <span>Tiêu Biểu</span></h2>
          <p className="sub-title">Trải nghiệm dịch vụ tuyệt vời cùng các quản lý sân tận tâm và chuyên nghiệp của chúng tôi.</p>
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
              {featuredManagers.map((manager) => (
                <SwiperSlide key={manager.id}>
                  <div className="featured-venues-item">
                    <div className="listing-item mb-0">
                      <div className="listing-img">
                        <Link to="/coach-detail">
                          <img src={manager.img} alt="Manager" />
                        </Link>
                        <div className="fav-item-venues">
                          <span className="tag tag-blue">{manager.tag}</span>
                          <div className="list-reviews coche-star">
                            <a href="#" onClick={(e) => e.preventDefault()} className="fav-icon">
                              <i className="feather-heart"></i>
                            </a>
                          </div>
                        </div>
                        <div className="hour-list">
                          <h5 className="tag tag-primary">Từ {manager.price} <span>/h</span></h5>
                        </div>
                      </div>
                      <div className="listing-content list-coche-content">
                        <span>Quản lý {manager.courts} sân</span>
                        <h3><Link to="/coach-detail">{manager.name}</Link></h3>
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
            Hiển Thị Tất Cả <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
        </div>
      </div>
    </section>
  );
}
