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
                  Trở Thành Chủ Sân
                </button>
                <button
                  className={`btn ${activeTab === 'manager' ? 'btn-secondary become-venue' : 'btn-primary become-coche'} d-inline-flex align-items-center`}
                  onClick={() => setActiveTab('manager')}
                >
                  Trở Thành Quản Lý
                </button>
              </div>
              {activeTab === 'venue' && (
                <div>
                  <h2>Tăng Doanh Thu Từ Việc Cho Thuê Sân Cầu Lông Trên ShuttleUp</h2>
                  <p>Tham gia mạng lưới các chủ sân của chúng tôi để tối ưu hóa việc quản lý và tiếp cận nhiều người chơi hơn.</p>
                  <div className="earn-list">
                    <ul>
                      <li><i className="fa-solid fa-circle-check"></i>Hỗ trợ quảng bá miễn phí</li>
                      <li><i className="fa-solid fa-circle-check"></i>Xây dựng niềm tin với người chơi</li>
                      <li><i className="fa-solid fa-circle-check"></i>Hệ thống quản lý an toàn, minh bạch</li>
                    </ul>
                  </div>
                  <div className="convenient-btns">
                    <Link to="/register" className="btn btn-secondary d-inline-flex align-items-center">
                      <span className="lh-1"><i className="feather-user-plus me-2"></i></span>Tham Gia Ngay
                    </Link>
                  </div>
                </div>
              )}
              {activeTab === 'manager' && (
                <div>
                  <h2>Trở Thành Quản Lý Sân Và Phát Triển Sự Nghiệp Cùng ShuttleUp</h2>
                  <p>Tham gia cùng đội ngũ quản lý của chúng tôi để vận hành các cụm sân chất lượng cao một cách chuyên nghiệp.</p>
                  <div className="earn-list">
                    <ul>
                      <li><i className="fa-solid fa-circle-check"></i>Công cụ tự động hóa công việc</li>
                      <li><i className="fa-solid fa-circle-check"></i>Nhận lịch đặt sân theo thời gian thực</li>
                      <li><i className="fa-solid fa-circle-check"></i>Tăng thu nhập với thời gian linh hoạt</li>
                    </ul>
                  </div>
                  <div className="convenient-btns">
                    <Link to="/register" className="btn btn-secondary d-inline-flex align-items-center">
                      <span className="lh-1"><i className="feather-user-plus me-2"></i></span>Tham Gia Ngay
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
