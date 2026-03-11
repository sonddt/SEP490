import { Link } from 'react-router-dom';

export default function JourneySection() {
  return (
    <section className="section journey-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-6 d-flex align-items-center">
            <div className="start-your-journey aos" data-aos="fade-up">
              <h2>Start Your Journey With <span className="active-sport">ShuttleUp</span> Badminton Today.</h2>
              <p>At ShuttleUp, we prioritize your satisfaction and value your feedback as we continuously improve and evolve our learning experiences.</p>
              <p>Our instructors utilize modern methods for effective badminton lessons, offering introductory sessions for beginners and personalized development plans.</p>
              <span className="stay-approach">Stay Ahead With Our Innovative Approach:</span>
              <div className="journey-list">
                <ul>
                  <li><i className="fa-solid fa-circle-check"></i>Skilled Professionals</li>
                  <li><i className="fa-solid fa-circle-check"></i>Modern Techniques</li>
                  <li><i className="fa-solid fa-circle-check"></i>Intro Lesson</li>
                </ul>
                <ul>
                  <li><i className="fa-solid fa-circle-check"></i>Personal Development</li>
                  <li><i className="fa-solid fa-circle-check"></i>Advanced Equipment</li>
                  <li><i className="fa-solid fa-circle-check"></i>Interactive Classes</li>
                </ul>
              </div>
              <div className="convenient-btns">
                <Link to="/register" className="btn btn-primary d-inline-flex align-items-center">
                  <span><i className="feather-user-plus me-2"></i></span>Join With Us
                </Link>
                <Link to="/about" className="btn btn-secondary d-inline-flex align-items-center">
                  <span><i className="feather-align-justify me-2"></i></span>Learn More
                </Link>
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="journey-img aos" data-aos="fade-up">
              <img src="/assets/img/journey-01.png" className="img-fluid" alt="Journey" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
