import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const TEAM = [
  { img: '/assets/img/aboutus/team-01.jpg', name: 'Đinh Đăng Sơn', role: 'Team Leader / Fullstack', desc: 'Định hướng kiến trúc, dẫn dắt đội ngũ kỹ thuật và quản lý tiến độ dự án ShuttleUp.' },
  { img: '/assets/img/aboutus/team-02.jpg', name: 'Thành viên 2', role: 'Backend Developer', desc: 'Xây dựng API, xử lý nghiệp vụ đặt sân và logic ghép kèo phức tạp.' },
  { img: '/assets/img/aboutus/team-03.jpg', name: 'Thành viên 3', role: 'Frontend Developer', desc: 'Phát triển giao diện, tối ưu hoá trải nghiệm người dùng trên mọi thiết bị.' },
  { img: '/assets/img/aboutus/team-04.jpg', name: 'Thành viên 4', role: 'Business Analyst', desc: 'Phân tích yêu cầu nghiệp vụ, định hình tính năng và tài liệu hoá quy trình.' },
  { img: '/assets/img/aboutus/team-05.jpg', name: 'Thành viên 5', role: 'Quality Assurance', desc: 'Kiểm thử toàn diện, đảm bảo nền tảng hoạt động ổn định và không lỗi.' },
];

const FEATURES = [
  { icon: '/assets/img/icons/coache-icon-01.svg', title: 'Đặt sân nhanh chóng', desc: 'Hệ thống cho phép tìm kiếm và đặt sân linh hoạt: đặt theo giờ, đặt lịch cố định, hoặc linh hoạt theo tháng.' },
  { icon: '/assets/img/icons/coache-icon-02.svg', title: 'Cộng đồng ghép kèo', desc: 'Tìm đồng đội phù hợp với trình độ của bạn để chia sẻ chi phí sân và gia tăng niềm vui thi đấu.' },
  { icon: '/assets/img/icons/coache-icon-03.svg', title: 'Quản lý sân chuyên nghiệp', desc: 'Giải pháp toàn diện cho chủ cụm sân: quản lý lịch trống, khung giờ chuẩn, doanh thu và khuyến mãi.' },
  { icon: '/assets/img/icons/coache-icon-04.svg', title: 'Tích hợp ưu đãi', desc: 'Săn các coupon đánh vãng lai, giảm giá thẻ tháng độc quyền chỉ có trên nên tảng ShuttleUp.' },
  { icon: '/assets/img/icons/coache-icon-05.svg', title: 'Hỗ trợ đa dạng', desc: 'Giao diện tương thích từ điện thoại đến máy tính, giúp bạn quản lý và đặt sân ở bất kỳ đâu.' },
  { icon: '/assets/img/icons/coache-icon-06.svg', title: 'Tin tức & Giải đấu', desc: 'Cập nhật kịp thời tin phong trào, giải đấu và tình hình của các đối tác cầu lông trên toàn quốc.' },
];

const TESTIMONIALS = [
  { title: 'Sự quan tâm cá nhân', text: 'Dịch vụ của ShuttleUp đã nâng tầm kỹ năng cầu lông của tôi. Sự hỗ trợ tận tình từ đội ngũ đã đưa tôi lên một tầm cao mới.', avatar: '/assets/img/profiles/avatar-01.jpg', author: 'Ariyan Rusov', tag: 'Cầu lông' },
  { title: 'Chất lượng đáng tin cậy', text: 'Trang thiết bị và dịch vụ đặt sân của ShuttleUp đã cải thiện đáng kể trải nghiệm chơi của tôi.', avatar: '/assets/img/profiles/avatar-04.jpg', author: 'Darren Valdez', tag: 'Cầu lông' },
  { title: 'Chuyên nghiệp xuất sắc', text: 'Sự chuyên nghiệp và chất lượng dịch vụ của ShuttleUp để lại ấn tượng tích cực. Rất đáng dùng cho thuê sân và đặt lịch.', avatar: '/assets/img/profiles/avatar-03.jpg', author: 'Elinor Dunn', tag: 'Cầu lông' },
];


function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const About = () => {
  const [earnTab, setEarnTab] = useState('venue');
  const [featuredNews, setFeaturedNews] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/featured-posts');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setFeaturedNews(data.slice(0, 3));
        }
      } catch {
        // silent fail — section sẽ ẩn nếu không có bài
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0" style={{ padding: '40px 0', overflow: 'hidden', position: 'relative' }}>
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white h2 mb-1">Giới thiệu</h1>
          <ul className="mb-0">
            <li><Link to="/">Trang chủ</Link></li>
            <li>Giới thiệu</li>
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
                  <p>ShuttleUp là dự án đặt sân và tìm kiếm đồng đội (matching) chuyên biệt cho môn cầu lông tại Việt Nam. Chúng tôi tin rằng công nghệ có thể phá vỡ rào cản việc tìm kiếm bãi tập, cũng như giải quyết vấn nạn thiếu đồng đội.</p>
                  <p>Từ ứng dụng web quản lý sân trơn tru đến hệ thống đề xuất nhóm chơi thông minh, ShuttleUp hướng đến việc trở thành hệ sinh thái cầu lông khép kín — giúp người chơi thoả đam mê và chủ sân tối ưu hoá hiệu suất phục vụ.</p>
                </div>
                <div className="col-12 col-sm-12 col-md-12 col-lg-4">
                  <div className="mission-bg">
                    <h2>Sứ mệnh ShuttleUp</h2>
                    <p>Cung cấp giải pháp kết nối 2 chiều hoàn hảo: Người chơi tìm sân, tìm nhóm dễ dàng — Chủ cụm sân tối giản vận hành, gia tăng doanh thu. Chúng tôi mong muốn mỗi trận cầu đều là một trải nghiệm tuyệt vời, không lo âu về hậu cần.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Team (Hidden for now, uncomment to restore) */}
        {/*
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
        */}

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

        {/* Latest Featured Posts — ẩn nếu không có bài */}
        {featuredNews.length > 0 && (
          <section className="section featured-venues latest-news">
            <div className="container">
              <div className="section-heading">
                <h2>Bài đăng <span>nổi bật</span></h2>
                <p className="sub-title">Những tin tức và ưu đãi mới nhất từ ShuttleUp.</p>
              </div>
              <div className="row g-4">
                {featuredNews.map((post) => (
                  <div key={post.id} className="col-12 col-sm-6 col-lg-4">
                    <div className="featured-venues-item">
                      <div className="listing-item mb-0">
                        {post.coverImageUrl && (
                          <div className="listing-img">
                            <Link to={post.linkUrl || '/featured'}>
                              <img src={post.coverImageUrl} className="img-fluid" alt={post.title} style={{ height: 200, objectFit: 'cover', width: '100%' }} />
                            </Link>
                          </div>
                        )}
                        <div className="listing-content news-content">
                          <h3 className="listing-title">
                            <Link to={post.linkUrl || '/featured'}>{post.title}</Link>
                          </h3>
                          {post.excerpt && <p className="text-muted small mb-2">{post.excerpt}</p>}
                          <div className="listing-button read-new">
                            <span><i className="feather-calendar me-1"></i>{fmtDate(post.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="view-all text-center mt-4">
                <Link to="/featured" className="btn btn-secondary btn-icon">
                  Xem tất cả bài đăng
                  <i className="feather-arrow-right-circle ms-2"></i>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Earn Money Section (from HomePage) */}
        <section className="section earn-money">
          <div className="cock-img cock-position">
            <div className="cock-img-one"><img src="/assets/img/icons/cock-01.svg" alt="Icon" /></div>
            <div className="cock-img-two"><img src="/assets/img/icons/cock-02.svg" alt="Icon" /></div>
            <div className="cock-circle"><img src="/assets/img/bg/cock-shape.png" alt="Icon" /></div>
          </div>
          <div className="container">
            <div className="row">
              <div className="col-md-6">
                <div className="private-venue">
                  <div className="convenient-btns become-owner" role="tablist">
                    <button
                      className={`btn ${earnTab === 'venue' ? 'btn-secondary become-venue' : 'btn-primary become-coche'} d-inline-flex align-items-center`}
                      onClick={() => setEarnTab('venue')}
                    >
                      Trở Thành Chủ Sân
                    </button>
                    <button
                      className={`btn ${earnTab === 'manager' ? 'btn-secondary become-venue' : 'btn-primary become-coche'} d-inline-flex align-items-center`}
                      onClick={() => setEarnTab('manager')}
                    >
                      Trở Thành Quản Lý
                    </button>
                  </div>
                  {earnTab === 'venue' && (
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
                  {earnTab === 'manager' && (
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
                <div className="private-venue-img">
                  <img src="/assets/img/private-venue.png" className="img-fluid" alt="Venue" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Journey Section (from HomePage) */}
        <section className="section journey-section">
          <div className="container">
            <div className="row">
              <div className="col-lg-6 d-flex align-items-center">
                <div className="start-your-journey">
                  <h2>Bắt Đầu Hành Trình Cùng <span className="active-sport">ShuttleUp</span> Ngay Hôm Nay.</h2>
                  <p>Tại ShuttleUp, sự hài lòng của bạn là ưu tiên hàng đầu. Chúng tôi luôn lắng nghe phản hồi để cải thiện và mang lại trải nghiệm đặt sân tốt nhất.</p>
                  <p>Bạn sẽ dễ dàng tìm kiếm sân bãi phù hợp, thuận tiện và được hỗ trợ tận tình bởi đội ngũ quản lý sân chuyên nghiệp.</p>
                  <span className="stay-approach">Trải Nghiệm Dịch Vụ Của Chúng Tôi Với:</span>
                  <div className="journey-list">
                    <ul>
                      <li><i className="fa-solid fa-circle-check"></i>Hệ Thống Tiện Lợi</li>
                      <li><i className="fa-solid fa-circle-check"></i>Quy Trình Nhanh Gọn</li>
                      <li><i className="fa-solid fa-circle-check"></i>Hỗ Trợ Tận Tâm</li>
                    </ul>
                    <ul>
                      <li><i className="fa-solid fa-circle-check"></i>Chi Phí Hợp Lý</li>
                      <li><i className="fa-solid fa-circle-check"></i>Sân Bãi Chất Lượng</li>
                      <li><i className="fa-solid fa-circle-check"></i>Tính Năng Đa Dạng</li>
                    </ul>
                  </div>
                  <div className="convenient-btns">
                    <Link to="/register" className="btn btn-primary d-inline-flex align-items-center">
                      <span><i className="feather-user-plus me-2"></i></span>Đăng Ký Tham Gia
                    </Link>
                    <Link to="/venues" className="btn btn-secondary d-inline-flex align-items-center">
                      <span><i className="feather-align-justify me-2"></i></span>Tìm Hiểu Thêm
                    </Link>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="journey-img">
                  <img src="/assets/img/journey-01.png" className="img-fluid" alt="Journey" />
                </div>
              </div>
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
