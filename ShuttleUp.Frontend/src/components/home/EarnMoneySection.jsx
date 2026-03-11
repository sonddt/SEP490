import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function EarnMoneySection() {
  const [activeTab, setActiveTab] = useState('venue');

  return (
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
  );
}
