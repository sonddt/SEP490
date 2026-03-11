import { Link } from 'react-router-dom';

export default function WorkSection() {
  const steps = [
    { icon: '/assets/img/icons/work-icon1.svg', title: 'Đăng Ký Tài Khoản', link: '/register', desc: 'Nhanh chóng và dễ dàng: Bắt đầu trên nền tảng của chúng tôi bằng việc tạo một tài khoản cá nhân.', btn: 'Đăng Ký Ngay' },
    { icon: '/assets/img/icons/work-icon2.svg', title: 'Lựa Chọn Sân Bãi', link: '/courts', desc: 'Xem chi tiết và lựa chọn các sân cầu lông với cơ sở vật chất chất lượng cao.', btn: 'Đi Tới Danh Sách' },
    { icon: '/assets/img/icons/work-icon3.svg', title: 'Quy Trình Đặt Sân', link: '/booking', desc: 'Dễ dàng đặt lịch, thanh toán, và tận hưởng trải nghiệm mượt mà trên nền tảng của chúng tôi.', btn: 'Đặt Sân Ngay' },
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
          <h2>Quy Trình <span>Hoạt Động</span></h2>
          <p className="sub-title">Đơn giản hóa việc đặt lịch cho người chơi và tối ưu quản lý cho chủ sân.</p>
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
