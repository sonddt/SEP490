import { Link } from 'react-router-dom';

const TEAM = [
  { img: '/assets/img/aboutus/team-01.jpg', name: 'Caterine', role: 'Chief Executive Officer', desc: 'CEO với tầm nhìn chiến lược, dẫn dắt đổi mới và tăng trưởng bền vững.' },
  { img: '/assets/img/aboutus/team-02.jpg', name: 'Anto', role: 'Marketing Manager', desc: 'Chuyên gia marketing, mở rộng thương hiệu và kết nối cộng đồng cầu lông.' },
  { img: '/assets/img/aboutus/team-03.jpg', name: 'Lucas Finn', role: 'Team Leader', desc: 'Team Leader truyền cảm hứng, đảm bảo mọi dự án hoàn thành xuất sắc.' },
  { img: '/assets/img/aboutus/team-04.jpg', name: 'Andrew', role: 'Designer', desc: 'Thiết kế giao diện và trải nghiệm người dùng cho nền tảng.' },
  { img: '/assets/img/aboutus/team-05.jpg', name: 'Adrian', role: 'Business Head', desc: 'Điều hành kinh doanh và phát triển đối tác.' },
  { img: '/assets/img/aboutus/team-06.jpg', name: 'Lucas Finn', role: 'Team Leader', desc: 'Đồng hành cùng đội ngũ đạt mục tiêu trong thể thao.' },
];

const FEATURES = [
  { icon: '/assets/img/icons/coache-icon-01.svg', title: 'Huấn luyện nhóm', desc: 'Nâng cao kỹ năng với các buổi huấn luyện nhóm dành cho người chơi cầu lông.' },
  { icon: '/assets/img/icons/coache-icon-02.svg', title: 'Huấn luyện riêng', desc: 'Tìm HLV cầu lông riêng cho cách tiếp cận cá nhân hóa kỹ năng.' },
  { icon: '/assets/img/icons/coache-icon-03.svg', title: 'Cửa hàng trang thiết bị', desc: 'Một điểm đến cho trang thiết bị cầu lông chất lượng cao.' },
  { icon: '/assets/img/icons/coache-icon-04.svg', title: 'Bài học đổi mới', desc: 'Nâng cao kỹ năng với bài học đổi mới, kết hợp kỹ thuật và phương pháp hiện đại.' },
  { icon: '/assets/img/icons/coache-icon-05.svg', title: 'Cộng đồng cầu lông', desc: 'Cộng đồng hỗ trợ, cùng nhau phát triển và vươn tới đỉnh cao.' },
  { icon: '/assets/img/icons/coache-icon-06.svg', title: 'Thuê sân', desc: 'Đặt sân nhanh chóng, trải nghiệm chơi cầu lông liền mạch với ShuttleUp.' },
];

const TESTIMONIALS = [
  { title: 'Sự quan tâm cá nhân', text: 'Dịch vụ của ShuttleUp đã nâng tầm kỹ năng cầu lông của tôi. Sự hỗ trợ tận tình từ đội ngũ đã đưa tôi lên một tầm cao mới.', avatar: '/assets/img/profiles/avatar-01.jpg', author: 'Ariyan Rusov', tag: 'Cầu lông' },
  { title: 'Chất lượng đáng tin cậy', text: 'Trang thiết bị và dịch vụ đặt sân của ShuttleUp đã cải thiện đáng kể trải nghiệm chơi của tôi.', avatar: '/assets/img/profiles/avatar-04.jpg', author: 'Darren Valdez', tag: 'Cầu lông' },
  { title: 'Chuyên nghiệp xuất sắc', text: 'Sự chuyên nghiệp và chất lượng dịch vụ của ShuttleUp để lại ấn tượng tích cực. Rất đáng dùng cho thuê sân và đặt lịch.', avatar: '/assets/img/profiles/avatar-03.jpg', author: 'Elinor Dunn', tag: 'Cầu lông' },
];

const NEWS = [
  { img: '/assets/img/venues/venues-07.jpg', tag: 'Cầu lông', author: 'Orlando Waters', avatar: '/assets/img/profiles/avatar-01.jpg', date: '15 Tháng 5 2023', title: 'Hướng dẫn trang bị cầu lông: Thiết bị cần có cho mọi người chơi', likes: 45, comments: 45, readTime: '10 phút' },
  { img: '/assets/img/venues/venues-08.jpg', tag: 'Hoạt động thể thao', author: 'Claire Nichols', avatar: '/assets/img/profiles/avatar-06.jpg', date: '16 Tháng 6 2023', title: 'Kỹ thuật cầu lông: Làm chủ cú đập, cắt và đánh cao', likes: 35, comments: 35, readTime: '12 phút' },
  { img: '/assets/img/venues/venues-09.jpg', tag: 'Luật chơi', author: 'Joanna Le', avatar: '/assets/img/profiles/avatar-02.jpg', date: '11 Tháng 5 2023', title: 'Sự phát triển của cầu lông: Từ sân sau đến Olympic', likes: 25, comments: 25, readTime: '14 phút' },
];

const About = () => {
  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Về chúng tôi</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Về chúng tôi</li>
          </ul>
        </div>
      </section>

      {/* Page Content */}
      <div className="content">
        {/* About Us Info */}
        <section className="aboutus-info">
          <div className="container">
            <div className="row d-flex align-items-center">
              <div className="col-12 col-sm-3 col-md-3 col-lg-3">
                <div className="banner text-center">
                  <img src="/assets/img/aboutus/banner-01.jpg" className="img-fluid corner-radius-10" alt="Banner-01" />
                </div>
              </div>
              <div className="col-12 col-sm-6 col-md-6 col-lg-6">
                <div className="banner text-center">
                  <img src="/assets/img/aboutus/banner-02.jpg" className="img-fluid corner-radius-10" alt="Banner-02" />
                </div>
              </div>
              <div className="col-12 col-sm-3 col-md-3 col-lg-3">
                <div className="banner text-center">
                  <img src="/assets/img/aboutus/banner-03.jpg" className="img-fluid corner-radius-10" alt="Banner-03" />
                </div>
              </div>
            </div>

            <div className="vision-mission">
              <div className="row">
                <div className="col-12 col-sm-12 col-md-12 col-lg-8">
                  <h2>Tầm nhìn của chúng tôi</h2>
                  <p>Chúng tôi hướng tới một hệ sinh thái cầu lông phát triển với công nghệ đổi mới, nâng cao kỹ năng và nuôi dưỡng tình yêu với môn thể thao này. Nền tảng ShuttleUp truyền cảm hứng để mỗi người phát huy tối đa tiềm năng cầu lông của mình.</p>
                  <p>Chúng tôi cách mạng hóa trải nghiệm cầu lông, trao quyền cho người chơi và quản lý sân phát triển. Nền tảng cung cấp công cụ và hỗ trợ toàn diện cho sự phát triển trong cộng đồng cầu lông. Hãy cùng chúng tôi vươn tới sự xuất sắc!</p>
                </div>
                <div className="col-12 col-sm-12 col-md-12 col-lg-4">
                  <div className="mission-bg">
                    <h2>Sứ mệnh của chúng tôi</h2>
                    <p>Chúng tôi mang đến cho người chơi và chủ sân một nền tảng kết nối thuận tiện, thông tin cá nhân hóa và tài nguyên hữu ích. Cùng nhau, chúng tôi xây dựng cộng đồng hợp tác, hỗ trợ sự phát triển và thành công trong cầu lông.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Team */}
        <section className="section ourteam dull-bg">
          <div className="container">
            <div className="section-heading">
              <h2>Đội ngũ <span>của chúng tôi</span></h2>
              <p className="sub-title">Đội ngũ cùng đam mê, cùng hướng tới sự xuất sắc.</p>
            </div>
            <div className="row g-4 justify-content-center">
              {TEAM.map((member, i) => (
                <div key={i} className="col-12 col-sm-6 col-lg-4">
                  <div className="team-item">
                    <div className="info text-center">
                      <div className="wrap">
                        <div className="prfile-pic">
                          <img src={member.img} className="img-fluid" alt={member.name} />
                        </div>
                        <div className="short-info">
                          <h4>{member.name}</h4>
                          <h6>{member.role}</h6>
                        </div>
                      </div>
                      <div className="more">
                        <div className="short-info">
                          <h4>{member.name}</h4>
                          <h6>{member.role}</h6>
                        </div>
                        <p>{member.desc}</p>
                        <ul className="social-medias d-inline-flex">
                          <li className="facebook"><a href="#/" onClick={(e) => e.preventDefault()}><i className="fa-brands fa-facebook-f"></i></a></li>
                          <li className="instagram"><a href="#/" onClick={(e) => e.preventDefault()}><i className="fa-brands fa-instagram"></i></a></li>
                          <li className="twitter"><a href="#/" onClick={(e) => e.preventDefault()}><i className="fa-brands fa-twitter"></i></a></li>
                          <li className="pinterest"><a href="#/" onClick={(e) => e.preventDefault()}><i className="fa-brands fa-pinterest"></i></a></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Our Features */}
        <section className="section white-bg">
          <div className="container">
            <div className="section-heading">
              <h2>Tính năng <span>của chúng tôi</span></h2>
              <p className="sub-title">Khám phá tiềm năng của bạn với huấn luyện toàn diện, HLV chuyên nghiệp và cơ sở vật chất hiện đại.</p>
            </div>
            <div className="row justify-content-center g-4">
              {FEATURES.map((item, i) => (
                <div key={i} className="col-lg-4 col-md-6 d-flex">
                  <div className="work-grid coaching-grid w-100">
                    <div className="work-icon">
                      <div className="work-icon-inner">
                        <img src={item.icon} className="img-fluid" alt="" />
                      </div>
                    </div>
                    <div className="work-content">
                      <h3>{item.title}</h3>
                      <p>{item.desc}</p>
                      <a href="#/" onClick={(e) => e.preventDefault()}>Tìm hiểu thêm</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="section our-testimonials">
          <div className="container">
            <div className="section-heading">
              <h2>Ý kiến <span>khách hàng</span></h2>
              <p className="sub-title">Những đánh giá từ người yêu thích cầu lông, phản ánh chất lượng dịch vụ của chúng tôi.</p>
            </div>
            <div className="row g-4">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="col-12 col-md-6 col-lg-4">
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
                      <a className="navigation" href="#/" onClick={(e) => e.preventDefault()}>
                        <img src={t.avatar} className="img-fluid" alt={t.author} />
                      </a>
                      <div className="testimonial-content">
                        <h5>{t.author}</h5>
                        <span className="btn btn-primary">{t.tag}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Latest News */}
        <section className="section featured-venues latest-news">
          <div className="container">
            <div className="section-heading">
              <h2>Tin tức <span>mới nhất</span></h2>
              <p className="sub-title">Cập nhật tin tức từ thế giới cầu lông — luôn cập nhật và truyền cảm hứng.</p>
            </div>
            <div className="row g-4">
              {NEWS.map((item, i) => (
                <div key={i} className="col-12 col-sm-6 col-lg-3">
                  <div className="featured-venues-item">
                    <div className="listing-item mb-0">
                      <div className="listing-img">
                        <Link to="/blog">
                          <img src={item.img} className="img-fluid" alt="" />
                        </Link>
                        <div className="fav-item-venues news-sports">
                          <span className="tag tag-blue">{item.tag}</span>
                          <div className="list-reviews coche-star">
                            <a href="#/" className="fav-icon" onClick={(e) => e.preventDefault()}>
                              <i className="feather-heart"></i>
                            </a>
                          </div>
                        </div>
                      </div>
                      <div className="listing-content news-content">
                        <div className="listing-venue-owner">
                          <div className="navigation">
                            <img src={item.avatar} className="img-fluid" alt="" />
                            {item.author}
                            <span><i className="feather-calendar"></i> {item.date}</span>
                          </div>
                        </div>
                        <h3 className="listing-title">
                          <Link to="/blog">{item.title}</Link>
                        </h3>
                        <div className="listing-button read-new">
                          <ul className="nav">
                            <li><i className="feather-heart"></i> {item.likes}</li>
                            <li><i className="feather-message-square"></i> {item.comments}</li>
                          </ul>
                          <span><img src="/assets/img/icons/clock.svg" className="img-fluid" alt="" /> {item.readTime} đọc</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="view-all text-center mt-4">
              <Link to="/blog" className="btn btn-secondary btn-icon">
                Xem tất cả tin tức
                <i className="feather-arrow-right-circle ms-2"></i>
              </Link>
            </div>
          </div>
        </section>

        {/* Newsletter */}
        <section className="section newsletter-sport">
          <div className="container">
            <div className="row">
              <div className="col-sm-12">
                <div className="subscribe-style">
                  <div className="banner-blk">
                    <img src="/assets/img/subscribe-bg.jpg" className="img-fluid" alt="Banner" />
                  </div>
                  <div className="banner-info">
                    <img src="/assets/img/icons/subscribe.svg" className="img-fluid" alt="" />
                    <h2>Đăng ký nhận tin</h2>
                    <p>Tin tức cầu lông mới nhất, dành riêng cho bạn.</p>
                    <div className="subscribe-blk bg-white">
                      <form className="input-group align-items-center" onSubmit={(e) => e.preventDefault()}>
                        <i className="feather-mail"></i>
                        <input type="email" className="form-control" placeholder="Nhập địa chỉ email" aria-label="email" />
                        <div className="subscribe-btn-grp">
                          <button type="submit" className="btn btn-secondary">Đăng ký</button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
