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
                <h4>World Class Badminton Coaching &amp; Premium Courts</h4>
                <h1>Choose Your <span>Coaches</span> And Start Your Training</h1>
                <p className="sub-info">
                  Unleash Your Athletic Potential with Expert Coaching, State-of-the-Art Facilities, and Personalized Training Programs.
                </p>
                <div className="search-box">
                  <form onSubmit={(e) => e.preventDefault()}>
                    <div className="search-input line">
                      <div className="form-group mb-0">
                        <label>Search for</label>
                        <select className="select form-control">
                          <option>Courts</option>
                          <option>Coaches</option>
                        </select>
                      </div>
                    </div>
                    <div className="search-input">
                      <div className="form-group mb-0">
                        <label>Where</label>
                        <select className="form-control select">
                          <option value="">Choose Location</option>
                          <option>Hồ Chí Minh</option>
                          <option>Hà Nội</option>
                          <option>Đà Nẵng</option>
                          <option>Cần Thơ</option>
                        </select>
                      </div>
                    </div>
                    <div className="search-btn">
                      <Link to="/courts" className="btn">
                        <i className="feather-search"></i><span className="search-text">Search</span>
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
