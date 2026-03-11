import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';

const testimonials = [
  { id: 1, name: 'Mai Phương', avatar: '/assets/img/profiles/avatar-01.jpg', title: 'Sự Chăm Sóc Khách Hàng', text: "ShuttleUp thực sự giúp tôi tìm được các anh em đồng quản lý rất thân thiện. Cảm ơn đội ngũ vì sự chuyên nghiệp.", tag: 'Cầu lông' },
  { id: 2, name: 'Minh Khang', avatar: '/assets/img/profiles/avatar-04.jpg', title: 'Chất Lượng Là Số 1', text: "Hệ thống đặt sân chạy rất mượt mà. Số lượng sân tại TP.HCM trên app thực sự uy tín, giúp nhóm tôi không bao giờ thiếu sân tập cuối tuần.", tag: 'Cầu lông' },
  { id: 3, name: 'Hoàng Yến', avatar: '/assets/img/profiles/avatar-03.jpg', title: 'Giao Diện Xuất Sắc', text: "Mình rất thích giao diện tinh tế và cách ứng dụng cung cấp thông tin sân rõ ràng. Việc tạo cộng đồng những người đam mê cũng thú vị.", tag: 'Cầu lông' },
  { id: 4, name: 'Minh Khang', avatar: '/assets/img/profiles/avatar-04.jpg', title: 'Chất Lượng Sân Tốt', text: "Sân rộng rãi và không gian thoáng. Gợi ý thêm các app có tính điểm rank để thi đấu giữa các thành viên vui hơn.", tag: 'Cầu lông' },
];

export default function Testimonials() {
  return (
    <section className="section our-testimonials">
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Nhận Xét <span>Khách Hàng</span></h2>
          <p className="sub-title">Những chia sẻ chân thực từ cộng đồng đam mê cầu lông sử dụng ShuttleUp mỗi ngày.</p>
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
