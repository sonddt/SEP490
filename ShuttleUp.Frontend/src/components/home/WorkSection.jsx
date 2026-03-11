import { Link } from 'react-router-dom';

export default function WorkSection() {
  const steps = [
    { icon: '/assets/img/icons/work-icon1.svg', title: 'Join Us', link: '/register', desc: 'Quick and Easy Registration: Get started on our platform with a simple account creation process.', btn: 'Register Now' },
    { icon: '/assets/img/icons/work-icon2.svg', title: 'Select Venues', link: '/courts', desc: 'Book badminton venues for expert guidance and premium facilities.', btn: 'Go To Courts' },
    { icon: '/assets/img/icons/work-icon3.svg', title: 'Booking Process', link: '/booking', desc: 'Easily book, pay, and enjoy a seamless experience on our user-friendly platform.', btn: 'Book Now' },
  ];

  return (
    <section className="section work-section">
      <div className="work-cock-img">
        <img src="/assets/img/icons/work-cock.svg" alt="Icon" />
      </div>
      <div className="work-img">
        <div className="work-img-right">
          <img src="/assets/img/bg/work-bg.png" alt="Icon" />
        </div>
      </div>
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>How It <span>Works</span></h2>
          <p className="sub-title">Simplifying the booking process for coaches, venues, and athletes.</p>
        </div>
        <div className="row justify-content-center">
          {steps.map((item, i) => (
            <div key={i} className="col-lg-4 col-md-6 d-flex">
              <div className="work-grid w-100 aos" data-aos="fade-up">
                <div className="work-icon">
                  <div className="work-icon-inner">
                    <img src={item.icon} alt="Icon" />
                  </div>
                </div>
                <div className="work-content">
                  <h5><Link to={item.link}>{item.title}</Link></h5>
                  <p>{item.desc}</p>
                  <Link className="btn" to={item.link}>{item.btn} <i className="feather-arrow-right"></i></Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
