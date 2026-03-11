const features = [
  { icon: '/assets/img/icons/coache-icon-01.svg', title: 'Đặt Sân Nhanh Chóng', desc: 'Hệ thống cho phép bạn tìm kiếm và đặt sân cầu lông chỉ với vài cú click chuột.' },
  { icon: '/assets/img/icons/coache-icon-02.svg', title: 'Danh Sách Đa Dạng', desc: 'Cung cấp danh sách đa dạng các cụm sân từ phong trào đến chuyên nghiệp.' },
  { icon: '/assets/img/icons/coache-icon-03.svg', title: 'Minh Bạch Giá Cả', desc: 'Tất cả các sân đều niêm yết giá công khai, không phát sinh chi phí ẩn.' },
  { icon: '/assets/img/icons/coache-icon-04.svg', title: 'Đánh Giá Chân Thực', desc: 'Hệ thống review và chấm điểm sân bãi tử cộng đồng người chơi cầu lông.' },
  { icon: '/assets/img/icons/coache-icon-05.svg', title: 'Cộng Đồng Thể Thao', desc: 'Môi trường kết nối đam mê, tìm bạn chơi và thành lập các câu lạc bộ.' },
  { icon: '/assets/img/icons/coache-icon-06.svg', title: 'Quản Lý Thuận Tiện', desc: 'Dành riêng cho chủ sân công cụ quản lý lịch đặt, doanh thu tự động hóa.' },
];

export default function FeaturesSection() {
  return (
    <section className="section group-coaching">
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Điểm Thú Vị <span>Của Chúng Tôi</span></h2>
          <p className="sub-title">Khám phá các tính năng ưu việt giúp nâng tầm trải nghiệm thể thao của bạn.</p>
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
                  <a href="#" onClick={(e) => e.preventDefault()}>Tìm Hiểu Thêm</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
