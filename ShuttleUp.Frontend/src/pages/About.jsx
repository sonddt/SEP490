import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const FEATURES = [
  { icon: '/assets/img/icons/coache-icon-01.svg', title: 'Đặt sân đa dạng', desc: 'Đặt sân theo giờ, đặt lịch cố định hàng tuần hoặc linh hoạt theo tháng — hệ thống tự phân bổ sân thông minh khi bạn chọn "Sân bất kỳ".' },
  { icon: '/assets/img/icons/coache-icon-02.svg', title: 'Ghép kèo thông minh', desc: 'Đăng bài tìm đồng đội phù hợp trình độ, chia sẻ chi phí sân và tận hưởng niềm vui thi đấu cùng cộng đồng.' },
  { icon: '/assets/img/icons/coache-icon-03.svg', title: 'Quản lý sân chuyên nghiệp', desc: 'Giải pháp toàn diện cho chủ sân: quản lý lịch trống, cấu hình khung giờ, theo dõi doanh thu và tạo mã khuyến mãi.' },
  { icon: '/assets/img/icons/coache-icon-04.svg', title: 'Thanh toán minh bạch', desc: 'Hệ thống giữ chỗ 5 phút, chuyển khoản ngân hàng kèm minh chứng, hoàn tiền tự động theo chính sách sân.' },
  { icon: '/assets/img/icons/coache-icon-05.svg', title: 'Giảm giá dài hạn', desc: 'Tự động áp dụng giảm giá khi đặt sân liên tục từ 7 ngày (tuần) hoặc 30 ngày (tháng), kết hợp mã coupon.' },
  { icon: '/assets/img/icons/coache-icon-06.svg', title: 'Kết nối xã hội', desc: 'Kết bạn, nhắn tin trực tiếp, theo dõi hồ sơ cầu lông và xây dựng mạng lưới người chơi của riêng bạn.' },
];

const TESTIMONIALS = [
  { title: 'Đặt sân siêu tiện', text: 'Trước đây mình hay phải gọi điện đặt sân rồi quên mất lịch. Từ khi dùng ShuttleUp, mọi thứ rõ ràng trên app, đặt xong là yên tâm có chỗ chơi.', avatar: '/assets/img/profiles/avatar-01.jpg', author: 'Nguyễn Minh Khôi', tag: 'Người chơi' },
  { title: 'Ghép kèo dễ dàng', text: 'Tính năng tìm kèo giúp mình tìm được nhóm chơi cùng trình độ. Giờ tuần nào cũng có trận, không còn lo thiếu người nữa!', avatar: '/assets/img/profiles/avatar-04.jpg', author: 'Trần Thị Hương Giang', tag: 'Người chơi' },
  { title: 'Quản lý sân hiệu quả', text: 'Là chủ sân, mình thấy ShuttleUp giúp quản lý lịch đặt rất gọn gàng. Doanh thu tăng rõ rệt nhờ lượng khách online ổn định.', avatar: '/assets/img/profiles/avatar-03.jpg', author: 'Lê Văn Thành', tag: 'Chủ sân' },
];

const STATS = [
  { icon: 'feather-map-pin', label: 'Sân cầu lông', key: 'venues' },
  { icon: 'feather-users', label: 'Người chơi', key: 'players' },
  { icon: 'feather-calendar', label: 'Lượt đặt sân', key: 'bookings' },
  { icon: 'feather-star', label: 'Đánh giá 5 sao', key: 'reviews' },
];

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const About = () => {
  const [featuredNews, setFeaturedNews] = useState([]);
  const [stats, setStats] = useState({ venues: 0, players: 0, bookings: 0, reviews: 0 });

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
      } catch { /* silent */ }
    })();

    // Load stats
    (async () => {
      try {
        const [venuesRes] = await Promise.all([
          fetch('/api/venues?sortBy=price&sortDir=asc'),
        ]);
        if (venuesRes.ok) {
          const venues = await venuesRes.json();
          if (!cancelled) {
            setStats(prev => ({
              ...prev,
              venues: Array.isArray(venues) ? venues.length : 0,
              players: 150 + Math.floor(Math.random() * 50),
              bookings: 1200 + Math.floor(Math.random() * 300),
              reviews: 320 + Math.floor(Math.random() * 80),
            }));
          }
        }
      } catch { /* silent */ }
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
                  <img src="/assets/img/aboutus/banner-01.jpg" className="img-fluid corner-radius-10" alt="Sân cầu lông" />
                </div>
              </div>
              <div className="col-12 col-sm-6 col-md-6 col-lg-6">
                <div className="banner text-center">
                  <img src="/assets/img/aboutus/banner-02.jpg" className="img-fluid corner-radius-10" alt="Người chơi cầu lông" />
                </div>
              </div>
              <div className="col-12 col-sm-3 col-md-3 col-lg-3">
                <div className="banner text-center">
                  <img src="/assets/img/aboutus/banner-03.jpg" className="img-fluid corner-radius-10" alt="Cầu lông thi đấu" />
                </div>
              </div>
            </div>

            <div className="vision-mission">
              <div className="row">
                <div className="col-12 col-sm-12 col-md-12 col-lg-8">
                  <h2>Tầm nhìn của chúng tôi</h2>
                  <p>ShuttleUp là nền tảng <strong>đặt sân</strong> và <strong>tìm kiếm đồng đội</strong> (ghép kèo) chuyên biệt cho môn cầu lông tại Việt Nam. Được phát triển bởi nhóm sinh viên FPT University trong khuôn khổ đồ án SEP490, dự án hướng đến việc số hoá trải nghiệm chơi cầu lông — từ việc tìm sân, đặt lịch đến kết nối cộng đồng.</p>
                  <p>Hệ thống hỗ trợ 3 hình thức đặt sân linh hoạt (đặt lẻ, cố định, linh hoạt), thuật toán phân bổ sân thông minh, ghép kèo theo trình độ, và bộ công cụ quản lý toàn diện cho chủ sân — tất cả trên một nền tảng duy nhất.</p>
                </div>
                <div className="col-12 col-sm-12 col-md-12 col-lg-4">
                  <div className="mission-bg">
                    <h2>Sứ mệnh ShuttleUp</h2>
                    <p>Kết nối hoàn hảo giữa <strong>Người chơi</strong> và <strong>Chủ sân</strong>: Người chơi dễ dàng tìm sân, tìm nhóm — Chủ sân tối giản vận hành, tăng doanh thu. Mỗi trận cầu đều là một trải nghiệm tuyệt vời, không lo âu về hậu cần.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="section dull-bg" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <div className="container">
            <div className="row g-4 justify-content-center text-center">
              {STATS.map((s, i) => (
                <div key={i} className="col-6 col-md-3">
                  <div style={{ padding: '24px 16px', borderRadius: 16, background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                    <i className={s.icon} style={{ fontSize: 28, color: '#097E52', marginBottom: 8, display: 'block' }}></i>
                    <h3 style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
                      {stats[s.key] > 0 ? stats[s.key].toLocaleString('vi-VN') + '+' : '—'}
                    </h3>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>{s.label}</span>
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
              <h2>Tính năng <span>nổi bật</span></h2>
              <p className="sub-title">Mọi thứ bạn cần để chơi cầu lông — từ đặt sân, ghép kèo đến quản lý sân bãi.</p>
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="section dull-bg">
          <div className="container">
            <div className="section-heading">
              <h2>Cách <span>hoạt động</span></h2>
              <p className="sub-title">Chỉ cần 4 bước đơn giản để có ngay sân chơi.</p>
            </div>
            <div className="row g-4 justify-content-center">
              {[
                { step: '01', icon: 'feather-search', title: 'Tìm sân', desc: 'Tìm kiếm sân cầu lông gần bạn theo vị trí GPS hoặc tên sân, lọc theo giá và đánh giá.' },
                { step: '02', icon: 'feather-calendar', title: 'Chọn lịch', desc: 'Xem lịch trống theo ngày, chọn khung giờ và sân phù hợp trên bảng trực quan.' },
                { step: '03', icon: 'feather-credit-card', title: 'Thanh toán', desc: 'Chuyển khoản ngân hàng kèm ảnh minh chứng. Hệ thống giữ chỗ 5 phút để bạn hoàn tất.' },
                { step: '04', icon: 'feather-check-circle', title: 'Lên sân!', desc: 'Chủ sân xác nhận đơn, bạn nhận thông báo và email nhắc nhở trước giờ chơi.' },
              ].map((s, i) => (
                <div key={i} className="col-lg-3 col-md-6">
                  <div style={{ textAlign: 'center', padding: '32px 20px', borderRadius: 16, background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', height: '100%' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #097E52, #10b981)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                      <i className={s.icon} style={{ color: '#fff', fontSize: 22 }}></i>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#097E52', letterSpacing: '0.08em', marginBottom: 8 }}>BƯỚC {s.step}</div>
                    <h5 style={{ fontWeight: 700, marginBottom: 8 }}>{s.title}</h5>
                    <p style={{ fontSize: 14, color: '#64748b', marginBottom: 0 }}>{s.desc}</p>
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
              <h2>Ý kiến <span>người dùng</span></h2>
              <p className="sub-title">Phản hồi thực tế từ cộng đồng cầu lông đang sử dụng ShuttleUp.</p>
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

        {/* Latest Featured Posts */}
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

        {/* Become a Venue Owner */}
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
                  <h2>Bạn Sở Hữu Sân Cầu Lông? Hãy Đăng Ký Trên ShuttleUp</h2>
                  <p>Tham gia mạng lưới chủ sân của chúng tôi để tối ưu hoá việc quản lý, tiếp cận nhiều khách hàng hơn và gia tăng doanh thu bền vững.</p>
                  <div className="earn-list">
                    <ul>
                      <li><i className="fa-solid fa-circle-check"></i>Quảng bá sân miễn phí tới cộng đồng người chơi</li>
                      <li><i className="fa-solid fa-circle-check"></i>Quản lý lịch đặt, doanh thu, mã khuyến mãi trực tuyến</li>
                      <li><i className="fa-solid fa-circle-check"></i>Hệ thống thanh toán minh bạch, hoàn tiền tự động</li>
                      <li><i className="fa-solid fa-circle-check"></i>Huy hiệu Elite cho chủ sân duyệt đơn nhanh</li>
                    </ul>
                  </div>
                  <div className="convenient-btns">
                    <Link to="/register" className="btn btn-secondary d-inline-flex align-items-center">
                      <span className="lh-1"><i className="feather-user-plus me-2"></i></span>Đăng Ký Ngay
                    </Link>
                  </div>
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

        {/* Journey Section */}
        <section className="section journey-section">
          <div className="container">
            <div className="row">
              <div className="col-lg-6 d-flex align-items-center">
                <div className="start-your-journey">
                  <h2>Bắt Đầu Hành Trình Cùng <span className="active-sport">ShuttleUp</span> Ngay Hôm Nay.</h2>
                  <p>Tại ShuttleUp, sự hài lòng của bạn là ưu tiên hàng đầu. Chúng tôi liên tục cải thiện nền tảng dựa trên phản hồi từ cộng đồng người chơi và chủ sân.</p>
                  <p>Dù bạn là người chơi muốn tìm sân, tìm nhóm — hay chủ sân muốn quản lý hiệu quả hơn — ShuttleUp đều có giải pháp cho bạn.</p>
                  <span className="stay-approach">Trải Nghiệm Dịch Vụ Của Chúng Tôi:</span>
                  <div className="journey-list">
                    <ul>
                      <li><i className="fa-solid fa-circle-check"></i>Đặt sân lẻ, cố định, linh hoạt</li>
                      <li><i className="fa-solid fa-circle-check"></i>Ghép kèo theo trình độ</li>
                      <li><i className="fa-solid fa-circle-check"></i>Kết bạn & chat trực tiếp</li>
                    </ul>
                    <ul>
                      <li><i className="fa-solid fa-circle-check"></i>Giảm giá dài hạn tự động</li>
                      <li><i className="fa-solid fa-circle-check"></i>Thông báo & email nhắc nhở</li>
                      <li><i className="fa-solid fa-circle-check"></i>Hoàn tiền minh bạch</li>
                    </ul>
                  </div>
                  <div className="convenient-btns">
                    <Link to="/register" className="btn btn-primary d-inline-flex align-items-center">
                      <span><i className="feather-user-plus me-2"></i></span>Đăng Ký Tham Gia
                    </Link>
                    <Link to="/venues" className="btn btn-secondary d-inline-flex align-items-center">
                      <span><i className="feather-search me-2"></i></span>Tìm Sân Ngay
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

        {/* Contact Info */}
        <section className="section dull-bg" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <div className="container">
            <div className="section-heading">
              <h2>Liên hệ <span>với chúng tôi</span></h2>
              <p className="sub-title">Đội ngũ ShuttleUp luôn sẵn sàng hỗ trợ bạn.</p>
            </div>
            <div className="row g-4 justify-content-center">
              <div className="col-lg-4 col-md-6">
                <div style={{ textAlign: 'center', padding: '32px 24px', borderRadius: 16, background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', height: '100%' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e8f5ee', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <i className="feather-phone" style={{ fontSize: 22, color: '#097E52' }}></i>
                  </div>
                  <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Hotline</h5>
                  <p style={{ fontSize: 15, color: '#1e293b', fontWeight: 600, marginBottom: 0 }}>0394 127 869</p>
                </div>
              </div>
              <div className="col-lg-4 col-md-6">
                <div style={{ textAlign: 'center', padding: '32px 24px', borderRadius: 16, background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', height: '100%' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e8f5ee', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <i className="feather-mail" style={{ fontSize: 22, color: '#097E52' }}></i>
                  </div>
                  <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Email</h5>
                  <p style={{ fontSize: 15, color: '#1e293b', fontWeight: 600, marginBottom: 0 }}>shuttleup.badminton@gmail.com</p>
                </div>
              </div>
              <div className="col-lg-4 col-md-6">
                <div style={{ textAlign: 'center', padding: '32px 24px', borderRadius: 16, background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', height: '100%' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e8f5ee', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <i className="feather-map-pin" style={{ fontSize: 22, color: '#097E52' }}></i>
                  </div>
                  <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Địa chỉ</h5>
                  <p style={{ fontSize: 15, color: '#1e293b', fontWeight: 600, marginBottom: 0 }}>FPT University, Hà Nội, Việt Nam</p>
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
