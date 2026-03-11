import { Link } from 'react-router-dom';

const services = [
  { img: '/assets/img/services/service-01.jpg', title: 'Court Rent' },
  { img: '/assets/img/services/service-02.jpg', title: 'Group Lesson' },
  { img: '/assets/img/services/service-03.jpg', title: 'Training Program' },
  { img: '/assets/img/services/service-04.jpg', title: 'Private Lessons' },
];

export default function Services() {
  return (
    <section className="section service-section">
      <div className="work-cock-img">
        <img src="/assets/img/icons/work-cock.svg" alt="Service" />
      </div>
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Explore Our <span>Services</span></h2>
          <p className="sub-title">Fostering excellence and empowering sports growth through tailored services.</p>
        </div>
        <div className="row">
          {services.map((s, i) => (
            <div key={i} className="col-lg-3 col-md-6 d-flex">
              <div className="service-grid w-100 aos" data-aos="fade-up">
                <div className="service-img">
                  <Link to="/services">
                    <img src={s.img} className="img-fluid" alt="Service" />
                  </Link>
                </div>
                <div className="service-content">
                  <h4><Link to="/services">{s.title}</Link></h4>
                  <Link to="/services">Learn More</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="view-all text-center aos" data-aos="fade-up">
          <Link to="/services" className="btn btn-secondary d-inline-flex align-items-center">
            View All Services <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
          </Link>
        </div>
      </div>
    </section>
  );
}
