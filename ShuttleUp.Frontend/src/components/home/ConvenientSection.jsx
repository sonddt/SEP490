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
          <h2>Convenient &amp; Flexible Scheduling</h2>
          <p>Find and book courts conveniently with our online system that matches your schedule and location.</p>
        </div>
        <div className="convenient-btns aos" data-aos="fade-up">
          <Link to="/booking" className="btn btn-primary d-inline-flex align-items-center">
            Book a Court <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
          <Link to="/pricing" className="btn btn-secondary d-inline-flex align-items-center">
            View Pricing Plan <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
        </div>
      </div>
    </section>
  );
}
