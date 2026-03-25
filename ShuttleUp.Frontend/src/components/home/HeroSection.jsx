import { Link } from 'react-router-dom';

export default function HeroSection() {
  return (
    <section className="hero-section">
      <div className="banner-cock-one">
        <img src="/assets/img/icons/banner-cock1.svg" alt="Banner" />
      </div>
      <div className="banner-shapes">
        <div className="banner-dot-one"><span></span></div>
        <div className="banner-cock-two">
          <img src="/assets/img/icons/banner-cock2.svg" alt="Banner" />
          <span></span>
        </div>
        <div className="banner-dot-two"><span></span></div>
      </div>
      <div className="container">
        <div className="home-banner">
          <div className="row align-items-center w-100">
            <div className="col-lg-7 col-md-10 mx-auto">
              <div className="section-search aos" data-aos="fade-up">
                <h4>Hệ Thống Sân Cầu Lông Cao Cấp &amp; Quản Lý Chuyên Nghiệp</h4>
                <h1>Chọn <span>Sân Chơi</span> Và Bắt Đầu Đam Mê Của Bạn</h1>
                <p className="sub-info">
                  Khám phá tiềm năng thể thao của bạn với các sân tập hiện đại, quy trình đặt lịch nhanh chóng và dễ dàng.
                </p>
                <div className="search-box">
                  <form onSubmit={(e) => e.preventDefault()}>
                    <div className="search-input line">
                      <div className="form-group mb-0">
                        <label>Tìm kiếm</label>
                        <select className="select form-control">
                          <option>Sân cầu lông</option>
                          <option>Quản lý sân</option>
                        </select>
                      </div>
                    </div>
                    <div className="search-input">
                      <div className="form-group mb-0">
                        <label>Khu vực</label>
                        <select className="form-control select">
                          <option value="">Chọn địa điểm</option>
                          <option>Hồ Chí Minh</option>
                          <option>Hà Nội</option>
                          <option>Đà Nẵng</option>
                          <option>Cần Thơ</option>
                        </select>
                      </div>
                    </div>
                    <div className="search-btn">
                      <Link to="/venues" className="btn">
                        <i className="feather-search"></i><span className="search-text">Tìm kiếm</span>
                      </Link>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="banner-imgs text-center aos" data-aos="fade-up">
                <img className="img-fluid" src="/assets/img/bg/banner-right.png" alt="Banner" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
