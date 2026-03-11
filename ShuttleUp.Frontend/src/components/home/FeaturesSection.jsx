const features = [
  { icon: '/assets/img/icons/coache-icon-01.svg', title: 'Group Coaching', desc: 'Accelerate your skills with tailored group coaching sessions for badminton players.' },
  { icon: '/assets/img/icons/coache-icon-02.svg', title: 'Private Coaching', desc: 'Find private badminton coaches and academies for a personalized approach to skill enhancement.' },
  { icon: '/assets/img/icons/coache-icon-03.svg', title: 'Equipment Store', desc: 'Your one-stop shop for high-quality badminton equipment, enhancing your on-court performance.' },
  { icon: '/assets/img/icons/coache-icon-04.svg', title: 'Innovative Lessons', desc: 'Enhance your badminton skills with innovative lessons, combining modern techniques and training methods.' },
  { icon: '/assets/img/icons/coache-icon-05.svg', title: 'Badminton Community', desc: 'Upraise your game with engaging lessons and a supportive community.' },
  { icon: '/assets/img/icons/coache-icon-06.svg', title: 'Court Rental', desc: 'Enjoy uninterrupted badminton sessions with our premium court rental services.' },
];

export default function FeaturesSection() {
  return (
    <section className="section group-coaching">
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Our <span>Features</span></h2>
          <p className="sub-title">Discover your potential with our comprehensive training, expert trainers, and advanced facilities.</p>
        </div>
        <div className="row justify-content-center">
          {features.map((f, i) => (
            <div key={i} className="col-lg-4 col-md-6 d-flex">
              <div className="work-grid coaching-grid w-100 aos" data-aos="fade-up">
                <div className="work-icon">
                  <div className="work-icon-inner">
                    <img src={f.icon} alt="Icon" />
                  </div>
                </div>
                <div className="work-content">
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <a href="#" onClick={(e) => e.preventDefault()}>Learn More</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
