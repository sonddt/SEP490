import { Link } from 'react-router-dom';

export default function ConvenientSection() {
  return (
    <section className="section convenient-section">
      <div className="cock-img">
        <div className="cock-img-one"><img src="/assets/img/icons/cock-01.svg" alt="Icon" /></div>
        <div className="cock-img-two"><img src="/assets/img/icons/cock-02.svg" alt="Icon" /></div>
        <div className="cock-circle"><img src="/assets/img/bg/cock-shape.png" alt="Icon" /></div>
      </div>
      <div className="container">
        <div className="convenient-content aos" data-aos="fade-up">
          <h2>Thuận Tiện &amp; Linh Hoạt Lịch Trình</h2>
          <p>Tìm kiếm và đặt sân dễ dàng thông qua hệ thống trực tuyến của chúng tôi, giúp bạn chủ động thời gian và địa điểm tập luyện.</p>
        </div>
        <div className="convenient-btns aos" data-aos="fade-up">
          <Link to="/booking" className="btn btn-primary d-inline-flex align-items-center">
            Đặt Sân Ngay <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
          <Link to="/pricing" className="btn btn-secondary d-inline-flex align-items-center">
            Xem Bảng Giá <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
        </div>
      </div>
    </section>
  );
}
