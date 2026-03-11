import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

// ─── Static data ──────────────────────────────────────────────────────────────

const featuredVenues = [
  {
    id: 1,
    img: '/assets/img/venues/venues-01.jpg',
    tag: 'Featured',
    tagClass: 'tag-blue',
    price: '$450',
    rating: '4.2',
    reviews: '300 Reviews',
    name: 'Sarah Sports Academy',
    desc: 'Elevate your athletic journey at Sarah Sports Academy, where excellence meets opportunity.',
    location: 'Port Alsworth, AK',
    available: '15 May 2023',
    avatar: '/assets/img/profiles/avatar-01.jpg',
    owner: 'Mart Sublin',
  },
  {
    id: 2,
    img: '/assets/img/venues/venues-02.jpg',
    tag: 'Top Rated',
    tagClass: 'tag-blue',
    price: '$200',
    rating: '5.0',
    reviews: '150 Reviews',
    name: 'Badminton Academy',
    desc: 'Unleash your badminton potential at our premier Badminton Academy, where champions are made.',
    location: 'Sacramento, CA',
    available: '15 May 2023',
    avatar: '/assets/img/profiles/avatar-02.jpg',
    owner: 'Rebecca',
  },
  {
    id: 3,
    img: '/assets/img/venues/venues-03.jpg',
    tag: '',
    tagClass: '',
    price: '$350',
    rating: '4.7',
    reviews: '120 Reviews',
    name: 'Manchester Academy',
    desc: 'Manchester Academy: Where dreams meet excellence in sports education and training.',
    location: 'Guysville, OH',
    available: '16 May 2023',
    avatar: '/assets/img/profiles/avatar-03.jpg',
    owner: 'Andrew',
  },
  {
    id: 4,
    img: '/assets/img/venues/venues-02.jpg',
    tag: 'Featured',
    tagClass: 'tag-blue',
    price: '$450',
    rating: '4.5',
    reviews: '300 Reviews',
    name: 'ABC Sports Academy',
    desc: 'Unleash your badminton potential at our premier ABC Sports Academy, where champions are made.',
    location: 'Little Rock, AR',
    available: '17 May 2023',
    avatar: '/assets/img/profiles/avatar-04.jpg',
    owner: 'Mart Sublin',
  },
];

const featuredCoachesBase = [
  { id: 1, img: '/assets/img/profiles/user-01.jpg', tag: 'Rookie', price: '$250', lessons: 4, name: 'Kevin Anderson' },
  { id: 2, img: '/assets/img/profiles/user-02.jpg', tag: 'Intermediate', price: '$150', lessons: 3, name: 'Harry Richardson' },
  { id: 3, img: '/assets/img/profiles/user-03.jpg', tag: 'Professional', price: '$350', lessons: 2, name: 'Evon Raddick' },
  { id: 4, img: '/assets/img/profiles/user-04.jpg', tag: 'Rookie', price: '$250', lessons: 4, name: 'Angela Roudrigez' },
];
// Duplicate for Swiper loop (needs >= 2x slidesPerView items)
const featuredCoaches = [...featuredCoachesBase, ...featuredCoachesBase.map(c => ({ ...c, id: c.id + 10 }))];

const features = [
  { icon: '/assets/img/icons/coache-icon-01.svg', title: 'Group Coaching', desc: 'Accelerate your skills with tailored group coaching sessions for badminton players.' },
  { icon: '/assets/img/icons/coache-icon-02.svg', title: 'Private Coaching', desc: 'Find private badminton coaches and academies for a personalized approach to skill enhancement.' },
  { icon: '/assets/img/icons/coache-icon-03.svg', title: 'Equipment Store', desc: 'Your one-stop shop for high-quality badminton equipment, enhancing your on-court performance.' },
  { icon: '/assets/img/icons/coache-icon-04.svg', title: 'Innovative Lessons', desc: 'Enhance your badminton skills with innovative lessons, combining modern techniques and training methods.' },
  { icon: '/assets/img/icons/coache-icon-05.svg', title: 'Badminton Community', desc: 'Upraise your game with engaging lessons and a supportive community.' },
  { icon: '/assets/img/icons/coache-icon-06.svg', title: 'Court Rental', desc: 'Enjoy uninterrupted badminton sessions with our premium court rental services.' },
];

const services = [
  { img: '/assets/img/services/service-01.jpg', title: 'Court Rent' },
  { img: '/assets/img/services/service-02.jpg', title: 'Group Lesson' },
  { img: '/assets/img/services/service-03.jpg', title: 'Training Program' },
  { img: '/assets/img/services/service-04.jpg', title: 'Private Lessons' },
];

const stats = [
  { value: '150+', label: 'Courts Available' },
  { value: '80+', label: 'Expert Coaches' },
  { value: '5000+', label: 'Happy Players' },
  { value: '200+', label: 'Tournaments Hosted' },
];

// ─── Component ────────────────────────────────────────────────────────────────

// Duplicate venues for Swiper loop mode
const featuredVenuesLoop = [...featuredVenues, ...featuredVenues.map(v => ({ ...v, id: v.id + 10 }))];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('venue');
  const [yearlyPlans, setYearlyPlans] = useState(false);

  useEffect(() => {
    // Small delay ensures DOM is fully painted before AOS measures elements
    const timer = setTimeout(() => {
      AOS.init({
        duration: 800,
        once: true,
        offset: 80,
        easing: 'ease-in-out',
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="main-wrapper">

      {/* Global Loader */}
      {/* (removed – no loader needed in React; it was jQuery-based) */}

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
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

      {/* ── How It Works ────────────────────────────────────────────────────── */}
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
            {[
              { icon: '/assets/img/icons/work-icon1.svg', title: 'Join Us', link: '/register', desc: 'Quick and Easy Registration: Get started on our platform with a simple account creation process.', btn: 'Register Now' },
              { icon: '/assets/img/icons/work-icon2.svg', title: 'Select Venues', link: '/courts', desc: 'Book badminton venues for expert guidance and premium facilities.', btn: 'Go To Courts' },
              { icon: '/assets/img/icons/work-icon3.svg', title: 'Booking Process', link: '/booking', desc: 'Easily book, pay, and enjoy a seamless experience on our user-friendly platform.', btn: 'Book Now' },
            ].map((item, i) => (
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

      {/* ── Featured Venues ─────────────────────────────────────────────────── */}
      <section className="section featured-venues">
        <div className="container">
          <div className="section-heading aos" data-aos="fade-up">
            <h2>Featured <span>Venues</span></h2>
            <p className="sub-title">Advanced sports venues offer the latest facilities for enhanced badminton performance.</p>
          </div>
          <div className="row">
            <div className="featured-slider-group">
              <Swiper
                modules={[Navigation, Autoplay]}
                navigation
                autoplay={{ delay: 3500, disableOnInteraction: false }}
                loop
                loopAdditionalSlides={4}
                spaceBetween={24}
                breakpoints={{
                  576: { slidesPerView: 1 },
                  768: { slidesPerView: 2 },
                  992: { slidesPerView: 3 },
                  1200: { slidesPerView: 4 },
                }}
                className="featured-venues-slider"
              >
                {featuredVenuesLoop.map((venue) => (
                  <SwiperSlide key={venue.id}>
                    <div className="featured-venues-item aos" data-aos="fade-up">
                      <div className="listing-item mb-0">
                        <div className="listing-img">
                          <Link to="/venue-details">
                            <img src={venue.img} alt="Venue" />
                          </Link>
                          <div className="fav-item-venues">
                            {venue.tag && <span className={`tag ${venue.tagClass}`}>{venue.tag}</span>}
                            <h5 className="tag tag-primary">{venue.price}<span>/hr</span></h5>
                          </div>
                        </div>
                        <div className="listing-content">
                          <div className="list-reviews">
                            <div className="d-flex align-items-center">
                              <span className="rating-bg">{venue.rating}</span><span>{venue.reviews}</span>
                            </div>
                            <a href="#" onClick={(e) => e.preventDefault()} className="fav-icon">
                              <i className="feather-heart"></i>
                            </a>
                          </div>
                          <h3 className="listing-title">
                            <Link to="/venue-details">{venue.name}</Link>
                          </h3>
                          <div className="listing-details-group">
                            <p>{venue.desc}</p>
                            <ul>
                              <li><span><i className="feather-map-pin"></i>{venue.location}</span></li>
                              <li><span><i className="feather-calendar"></i>Next Availability: <span className="primary-text">{venue.available}</span></span></li>
                            </ul>
                          </div>
                          <div className="listing-button">
                            <div className="listing-venue-owner">
                              <Link className="navigation" to="/coach-detail">
                                <img src={venue.avatar} alt="Venue" />{venue.owner}
                              </Link>
                            </div>
                            <Link to="/venue-details" className="user-book-now">
                              <span><i className="feather-calendar me-2"></i></span>Book Now
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </div>
          <div className="view-all text-center aos" data-aos="fade-up">
            <Link to="/courts" className="btn btn-secondary d-inline-flex align-items-center">
              View All Featured<span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Services ────────────────────────────────────────────────────────── */}
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

      {/* ── Convenient CTA ──────────────────────────────────────────────────── */}
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

      {/* ── Featured Coaches ────────────────────────────────────────────────── */}
      <section className="section featured-section">
        <div className="container">
          <div className="section-heading aos" data-aos="fade-up">
            <h2>Featured <span>Coaches</span></h2>
            <p className="sub-title">Uplift your badminton game with our featured coaches, personalized instruction, and expertise.</p>
          </div>
          <div className="row">
            <div className="featured-slider-group aos" data-aos="fade-up">
              <Swiper
                modules={[Navigation, Autoplay]}
                navigation
                autoplay={{ delay: 4000, disableOnInteraction: false }}
                loop
                loopAdditionalSlides={4}
                spaceBetween={24}
                breakpoints={{
                  576: { slidesPerView: 1 },
                  768: { slidesPerView: 2 },
                  992: { slidesPerView: 3 },
                  1200: { slidesPerView: 4 },
                }}
                className="featured-coache-slider"
              >
                {featuredCoaches.map((coach) => (
                  <SwiperSlide key={coach.id}>
                    <div className="featured-venues-item">
                      <div className="listing-item mb-0">
                        <div className="listing-img">
                          <Link to="/coach-detail">
                            <img src={coach.img} alt="Coach" />
                          </Link>
                          <div className="fav-item-venues">
                            <span className="tag tag-blue">{coach.tag}</span>
                            <div className="list-reviews coche-star">
                              <a href="#" onClick={(e) => e.preventDefault()} className="fav-icon">
                                <i className="feather-heart"></i>
                              </a>
                            </div>
                          </div>
                          <div className="hour-list">
                            <h5 className="tag tag-primary">From ${coach.price} <span>/hr</span></h5>
                          </div>
                        </div>
                        <div className="listing-content list-coche-content">
                          <span>{coach.lessons} Lessons</span>
                          <h3><Link to="/coach-detail">{coach.name}</Link></h3>
                          <Link to="/coach-details"><i className="feather-arrow-right"></i></Link>
                          <Link to="/coach-details" className="icon-hover"><i className="feather-calendar"></i></Link>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </div>
          <div className="view-all text-center aos" data-aos="fade-up">
            <Link to="/coaches" className="btn btn-secondary d-inline-flex align-items-center">
              View All Coaches <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Start Your Journey ──────────────────────────────────────────────── */}
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

      {/* ── Our Features ────────────────────────────────────────────────────── */}
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

      {/* ── Earn Money / Become Owner ───────────────────────────────────────── */}
      <section className="section earn-money">
        <div className="cock-img cock-position">
          <div className="cock-img-one"><img src="/assets/img/icons/cock-01.svg" alt="Icon" /></div>
          <div className="cock-img-two"><img src="/assets/img/icons/cock-02.svg" alt="Icon" /></div>
          <div className="cock-circle"><img src="/assets/img/bg/cock-shape.png" alt="Icon" /></div>
        </div>
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <div className="private-venue aos" data-aos="fade-up">
                <div className="convenient-btns become-owner" role="tablist">
                  <button
                    className={`btn ${activeTab === 'venue' ? 'btn-secondary become-venue' : 'btn-primary become-coche'} d-inline-flex align-items-center`}
                    onClick={() => setActiveTab('venue')}
                  >
                    Become A Venue Member
                  </button>
                  <button
                    className={`btn ${activeTab === 'coach' ? 'btn-secondary become-venue' : 'btn-primary become-coche'} d-inline-flex align-items-center`}
                    onClick={() => setActiveTab('coach')}
                  >
                    Become A Coach
                  </button>
                </div>
                {activeTab === 'venue' && (
                  <div>
                    <h2>Earn Money Renting Out Your Badminton Courts on ShuttleUp</h2>
                    <p>Join our network of private facility owners, offering rentals to local players, coaches, and teams.</p>
                    <div className="earn-list">
                      <ul>
                        <li><i className="fa-solid fa-circle-check"></i>Liability insurance covered</li>
                        <li><i className="fa-solid fa-circle-check"></i>Build Trust with Players</li>
                        <li><i className="fa-solid fa-circle-check"></i>Protected Environment for Activities</li>
                      </ul>
                    </div>
                    <div className="convenient-btns">
                      <Link to="/register" className="btn btn-secondary d-inline-flex align-items-center">
                        <span className="lh-1"><i className="feather-user-plus me-2"></i></span>Join With Us
                      </Link>
                    </div>
                  </div>
                )}
                {activeTab === 'coach' && (
                  <div>
                    <h2>Become a Coach and Grow Your Career on ShuttleUp</h2>
                    <p>Join our coach network, reach more students, and grow your badminton coaching career.</p>
                    <div className="earn-list">
                      <ul>
                        <li><i className="fa-solid fa-circle-check"></i>Professional coach profile</li>
                        <li><i className="fa-solid fa-circle-check"></i>Get bookings automatically</li>
                        <li><i className="fa-solid fa-circle-check"></i>Earn more, work flexibly</li>
                      </ul>
                    </div>
                    <div className="convenient-btns">
                      <Link to="/register" className="btn btn-secondary d-inline-flex align-items-center">
                        <span className="lh-1"><i className="feather-user-plus me-2"></i></span>Join With Us
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="col-md-6">
              <div className="private-venue-img aos" data-aos="fade-up">
                <img src="/assets/img/private-venue.png" className="img-fluid" alt="Venue" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Counter ───────────────────────────────────────────────────── */}
      <section className="section counter-section">
        <div className="container">
          <div className="counter-box">
            <div className="row">
              {stats.map((s, i) => (
                <div key={i} className="col-lg-3 col-md-6 d-flex">
                  <div className="count-group w-100 aos" data-aos="fade-up">
                    <div className="customer-count">
                      <h3>{s.value}</h3>
                      <p>{s.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Courts Near You ─────────────────────────────────────────────────── */}
      <section className="section court-near">
        <div className="container">
          <div className="section-heading aos" data-aos="fade-up">
            <h2>Find Courts <span>Near You</span></h2>
            <p className="sub-title">Discover nearby badminton courts for convenient and accessible gameplay.</p>
          </div>
          <div className="row">
            <div className="featured-slider-group aos" data-aos="fade-up">
              <Swiper
                modules={[Navigation, Autoplay]}
                navigation
                autoplay={{ delay: 3500, disableOnInteraction: false }}
                loop
                spaceBetween={24}
                breakpoints={{
                  576: { slidesPerView: 1 },
                  768: { slidesPerView: 2 },
                  992: { slidesPerView: 3 },
                  1200: { slidesPerView: 4 },
                }}
                className="featured-venues-slider"
              >
                {[
                  { id: 1, img: '/assets/img/venues/venues-04.jpg', name: 'Smart Shuttlers', address: '1 Crowthorne Road, 4th Street, NY', rating: '4.2', reviews: '300 Reviews', miles: '2.1 Miles Away' },
                  { id: 2, img: '/assets/img/venues/venues-05.jpg', name: 'Parlers Badminton', address: 'Hope Street, Battersea, SW11 2DA', rating: '4.2', reviews: '200 Reviews', miles: '9.3 Miles Away' },
                  { id: 3, img: '/assets/img/venues/venues-06.jpg', name: '6 Feathers', address: 'Lonsdale Road, Barnes, SW13 9QL', rating: '4.2', reviews: '400 Reviews', miles: '10.8 Miles Away' },
                  { id: 4, img: '/assets/img/venues/venues-05.jpg', name: 'Parlers Badminton', address: '1 Crowthorne Road, 4th Street, NY', rating: '4.2', reviews: '300 Reviews', miles: '8.1 Miles Away' },
                  { id: 5, img: '/assets/img/venues/venues-04.jpg', name: 'Smart Shuttlers', address: '1 Crowthorne Road, 4th Street, NY', rating: '4.2', reviews: '300 Reviews', miles: '2.1 Miles Away' },
                  { id: 6, img: '/assets/img/venues/venues-06.jpg', name: '6 Feathers', address: 'Lonsdale Road, Barnes, SW13 9QL', rating: '4.2', reviews: '400 Reviews', miles: '10.8 Miles Away' },
                ].map((c) => (
                  <SwiperSlide key={c.id}>
                    <div className="featured-venues-item court-near-item">
                      <div className="listing-item mb-0">
                        <div className="listing-img">
                          <Link to="/venue-details">
                            <img src={c.img} alt="Venue" />
                          </Link>
                          <div className="fav-item-venues">
                            <div className="list-reviews coche-star">
                              <a href="#" onClick={(e) => e.preventDefault()} className="fav-icon">
                                <i className="feather-heart"></i>
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="listing-content">
                          <h3 className="listing-title">
                            <Link to="/venue-details">{c.name}</Link>
                          </h3>
                          <div className="listing-details-group">
                            <ul>
                              <li>
                                <span><i className="feather-map-pin"></i>{c.address}</span>
                              </li>
                            </ul>
                          </div>
                          <div className="list-reviews near-review">
                            <div className="d-flex align-items-center">
                              <span className="rating-bg">{c.rating}</span><span>{c.reviews}</span>
                            </div>
                            <span className="mile-away"><i className="feather-zap"></i>{c.miles}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </div>
          <div className="view-all text-center aos" data-aos="fade-up">
            <Link to="/courts" className="btn btn-secondary d-inline-flex align-items-center">
              View All Services <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────────── */}
      <section className="section our-testimonials">
        <div className="container">
          <div className="section-heading aos" data-aos="fade-up">
            <h2>Our <span>Testimonials</span></h2>
            <p className="sub-title">Glowing testimonials from passionate badminton enthusiasts worldwide, showcasing our exceptional services.</p>
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
                {[
                  { id: 1, name: 'Ariyan Rusov', avatar: '/assets/img/profiles/avatar-01.jpg', title: 'Personalized Attention', text: "DreamSports' coaching services enhanced my badminton skills. Personalized attention from knowledgeable coaches propelled my game to new heights.", tag: 'Badminton' },
                  { id: 2, name: 'Darren Valdez', avatar: '/assets/img/profiles/avatar-04.jpg', title: 'Quality Matters !', text: "DreamSports' advanced badminton equipment has greatly improved my performance on the court. Their quality range of rackets and shoes made a significant impact.", tag: 'Badminton' },
                  { id: 3, name: 'Elinor Dunn', avatar: '/assets/img/profiles/avatar-03.jpg', title: 'Excellent Professionalism !', text: "DreamSports' unmatched professionalism and service excellence left a positive experience. Highly recommended for court rentals and equipment purchases.", tag: 'Badminton' },
                  { id: 4, name: 'Darren Valdez', avatar: '/assets/img/profiles/avatar-04.jpg', title: 'Quality Matters !', text: "DreamSports' advanced badminton equipment has greatly improved my performance on the court. Their quality range of rackets and shoes made a significant impact.", tag: 'Badminton' },
                ].map((t) => (
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

      {/* ── Featured Plans ──────────────────────────────────────────────────── */}
      <section className="section featured-plan">
        <div className="work-img">
          <div className="work-img-right">
            <img src="/assets/img/bg/work-bg.png" alt="Icon" />
          </div>
        </div>
        <div className="container">
          <div className="section-heading aos" data-aos="fade-up">
            <h2>We Have Excellent <span>Plans For You</span></h2>
            <p className="sub-title">Choose monthly or yearly plans for uninterrupted access to our premium badminton facilities. Join us and experience convenient excellence.</p>
          </div>
          <div className="interset-btn aos" data-aos="fade-up">
            <div className="status-toggle d-inline-flex align-items-center">
              Monthly
              <input
                type="checkbox"
                id="status_1"
                className="check"
                checked={yearlyPlans}
                onChange={(e) => setYearlyPlans(e.target.checked)}
              />
              <label htmlFor="status_1" className="checktoggle">checkbox</label>
              Yearly
            </div>
          </div>
          <div className="price-wrap aos" data-aos="fade-up">
            <div className="row justify-content-center">
              {[
                {
                  id: 'pro',
                  icon: '/assets/img/icons/price-01.svg',
                  title: 'Professoinal',
                  priceMonthly: '60.00',
                  priceYearly: '600.00',
                  per: yearlyPlans ? 'Per Year' : 'Per Month',
                  features: [
                    { ok: true, text: 'Included : Quality Checked By Envato' },
                    { ok: true, text: 'Included : Future Updates' },
                    { ok: true, text: 'Technical Support' },
                    { ok: false, text: 'Add Listing' },
                    { ok: false, text: 'Approval of Listing' },
                  ],
                  recommended: false,
                },
                {
                  id: 'expert',
                  icon: '/assets/img/icons/price-02.svg',
                  title: 'Expert',
                  priceMonthly: '60.00',
                  priceYearly: '600.00',
                  per: yearlyPlans ? 'Per Year' : 'Per Month',
                  features: [
                    { ok: true, text: 'Included : Quality Checked By Envato' },
                    { ok: true, text: 'Included : Future Updates' },
                    { ok: true, text: '6 Months Technical Support' },
                    { ok: false, text: 'Add Listing' },
                    { ok: false, text: 'Approval of Listing' },
                  ],
                  recommended: true,
                },
                {
                  id: 'ent',
                  icon: '/assets/img/icons/price-03.svg',
                  title: 'Enterprise',
                  priceMonthly: '990.00',
                  priceYearly: '9900.00',
                  per: yearlyPlans ? 'Per Year' : 'Per Month',
                  features: [
                    { ok: true, text: 'Included : Quality Checked By Envato' },
                    { ok: true, text: 'Included : Future Updates' },
                    { ok: true, text: 'Technical Support' },
                    { ok: true, text: 'Add Listing' },
                    { ok: true, text: 'Approval of Listing' },
                  ],
                  recommended: false,
                },
              ].map((p) => (
                <div key={p.id} className="col-lg-4 d-flex col-md-6">
                  <div className="price-card flex-fill">
                    <div className={`price-head${p.recommended ? ' expert-price' : ''}`}>
                      <img src={p.icon} alt="Price" />
                      <h3>{p.title}</h3>
                      {p.recommended && <span>Recommended</span>}
                    </div>
                    <div className="price-body">
                      <div className="per-month">
                        <h2><sup>$</sup><span>{yearlyPlans ? p.priceYearly : p.priceMonthly}</span></h2>
                        <span>{p.per}</span>
                      </div>
                      <div className="features-price-list">
                        <h5>Features</h5>
                        <p>Everything in our free Upto 10 users.</p>
                        <ul>
                          {p.features.map((f, idx) => (
                            <li key={idx} className={f.ok ? 'active' : 'inactive'}>
                              <i className={f.ok ? 'feather-check-circle' : 'feather-x-circle'}></i>{f.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className={`price-choose${p.recommended ? ' active-price' : ''}`}>
                        <a href="#" onClick={(e) => e.preventDefault()} className="btn viewdetails-btn">Choose Plan</a>
                      </div>
                      <div className="price-footer">
                        <p>Use, by you or one client, in a single end product which end users. charged for. The total price includes the item price and a buyer fee.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Latest News ─────────────────────────────────────────────────────── */}
      <section className="section featured-venues latest-news">
        <div className="container">
          <div className="section-heading aos" data-aos="fade-up">
            <h2>The Latest <span>News</span></h2>
            <p className="sub-title">Get the latest buzz from the badminton world- stay informed and inspired by the thrilling updates and remarkable achievements in the sport.</p>
          </div>
          <div className="row">
            <div className="featured-slider-group">
              <Swiper
                modules={[Navigation, Autoplay]}
                navigation
                autoplay={{ delay: 3500, disableOnInteraction: false }}
                loop
                spaceBetween={24}
                breakpoints={{
                  576: { slidesPerView: 1 },
                  768: { slidesPerView: 2 },
                  992: { slidesPerView: 3 },
                  1200: { slidesPerView: 4 },
                }}
                className="featured-venues-slider"
              >
                {[
                  { id: 1, tag: 'Badminton', img: '/assets/img/venues/venues-07.jpg', authorAvatar: '/assets/img/profiles/avatar-01.jpg', author: 'Orlando Waters', date: '15 May 2023', title: 'Badminton Gear Guide: Must-Have Equipment for Every Player', likes: 45, comments: 45, read: '10 Min To Read' },
                  { id: 2, tag: 'Sports Activites', img: '/assets/img/venues/venues-08.jpg', authorAvatar: '/assets/img/profiles/avatar-03.jpg', author: 'Nichols', date: '16 Jun 2023', title: 'Badminton Techniques: Mastering the Smash, Drop Shot, and Clear', likes: 35, comments: 35, read: '12 Min To Read' },
                  { id: 3, tag: 'Rules of Game', img: '/assets/img/venues/venues-09.jpg', authorAvatar: '/assets/img/profiles/avatar-06.jpg', author: 'Joanna Le', date: '11 May 2023', title: 'The Evolution of Badminton:From Backyard Fun to Olympic Sport', likes: 25, comments: 25, read: '14 Min To Read' },
                  { id: 4, tag: 'Sports Activites', img: '/assets/img/venues/venues-08.jpg', authorAvatar: '/assets/img/profiles/avatar-01.jpg', author: 'Mart Sublin', date: '12 May 2023', title: 'Sports Make Us A Lot Stronger And Healthier Than We Think', likes: 35, comments: 35, read: '12 Min To Read' },
                ].map((n) => (
                  <SwiperSlide key={n.id}>
                    <div className="featured-venues-item aos" data-aos="fade-up">
                      <div className="listing-item mb-0">
                        <div className="listing-img">
                          <Link to="/blog">
                            <img src={n.img} alt="News" />
                          </Link>
                          <div className="fav-item-venues news-sports">
                            <span className="tag tag-blue">{n.tag}</span>
                            <div className="list-reviews coche-star">
                              <a href="#" onClick={(e) => e.preventDefault()} className="fav-icon">
                                <i className="feather-heart"></i>
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="listing-content news-content">
                          <div className="listing-venue-owner listing-dates">
                            <a href="#" onClick={(e) => e.preventDefault()} className="navigation">
                              <img src={n.authorAvatar} alt="User" />{n.author}
                            </a>
                            <span><i className="feather-calendar"></i>{n.date}</span>
                          </div>
                          <h3 className="listing-title">
                            <Link to="/blog">{n.title}</Link>
                          </h3>
                          <div className="listing-button read-new">
                            <ul className="nav">
                              <li><a href="#" onClick={(e) => e.preventDefault()}><i className="feather-heart"></i>{n.likes}</a></li>
                              <li><a href="#" onClick={(e) => e.preventDefault()}><i className="feather-message-square"></i>{n.comments}</a></li>
                            </ul>
                            <span><img src="/assets/img/icons/clock.svg" alt="Clock" />{n.read}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </div>
          <div className="view-all text-center aos" data-aos="fade-up">
            <Link to="/blog" className="btn btn-secondary d-inline-flex align-items-center">
              View All News <span className="lh-1"><i className="feather-arrow-right-circle ms-2"></i></span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Newsletter ──────────────────────────────────────────────────────── */}
      <section className="section newsletter-sport">
        <div className="container">
          <div className="row">
            <div className="col-sm-12">
              <div className="subscribe-style aos" data-aos="fade-up">
                <div className="banner-blk">
                  <img src="/assets/img/subscribe-bg.jpg" className="img-fluid" alt="Subscribe" />
                </div>
                <div className="banner-info">
                  <img src="/assets/img/icons/subscribe.svg" className="img-fluid" alt="Subscribe" />
                  <h2>Subscribe to Newsletter</h2>
                  <p>Just for you, exciting badminton news updates.</p>
                  <form className="subscribe-blk bg-white" onSubmit={(e) => e.preventDefault()}>
                    <div className="input-group align-items-center">
                      <i className="feather-mail"></i>
                      <input type="email" className="form-control" placeholder="Enter Email Address" aria-label="email" />
                      <div className="subscribe-btn-grp">
                        <input type="submit" className="btn btn-secondary" value="Subscribe" />
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scroll To Top ───────────────────────────────────────────────────── */}
      <div
        className="progress-wrap"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{ cursor: 'pointer' }}
        title="Back to top"
      >
        <span className="progress-arrow" aria-hidden="true">
          <i className="fa-solid fa-arrow-up"></i>
        </span>
        <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
          <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98"></path>
        </svg>
      </div>

    </div>
  );
}
