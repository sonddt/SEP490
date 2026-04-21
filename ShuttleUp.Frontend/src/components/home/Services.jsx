import { Link } from 'react-router-dom';

const services = [
  { img: '/assets/img/services/service-01.jpg', title: 'Thuê Sân' },
  { img: '/assets/img/services/service-02.jpg', title: 'Luyện Tập Nhóm' },
  { img: '/assets/img/services/service-03.jpg', title: 'Tổ Chức Giải Đấu' },
  { img: '/assets/img/services/service-04.jpg', title: 'Đặt Sân Cố Định' },
];

export default function Services() {
  return (
    <section className="section service-section">
      <div className="work-cock-img">
        <img src="/assets/img/icons/work-cock.svg" alt="Service" />
      </div>
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Dịch Vụ <span>Nổi Bật</span></h2>
          <p className="sub-title">Cung cấp các gói dịch vụ toàn diện hỗ trợ phong trào thể thao và thi đấu chuyên nghiệp.</p>
        </div>
        <div className="row">
          {services.map((s, i) => (
            <div key={i} className="col-lg-3 col-md-6 d-flex">
              <div className="service-grid w-100 aos" data-aos="fade-up">
                <div className="service-img">
                  <Link to="#" onClick={(e) => e.preventDefault()}>
                    <img src={s.img} className="img-fluid" alt="Service" />
                  </Link>
                </div>
                <div className="service-content">
                  <h4><Link to="#" onClick={(e) => e.preventDefault()}>{s.title}</Link></h4>
                  <Link to="#" onClick={(e) => e.preventDefault()}>Xem Chi Tiết</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="view-all text-center aos" data-aos="fade-up">
          <Link to="#" onClick={(e) => e.preventDefault()} className="btn btn-secondary d-inline-flex align-items-center">
            Tất Cả Dịch Vụ <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
        </div>
      </div>
    </section>
  );
}
