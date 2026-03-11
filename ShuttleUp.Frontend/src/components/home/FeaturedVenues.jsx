import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';

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

const featuredVenuesLoop = [...featuredVenues, ...featuredVenues.map(v => ({ ...v, id: v.id + 10 }))];

export default function FeaturedVenues() {
  return (
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
  );
}
