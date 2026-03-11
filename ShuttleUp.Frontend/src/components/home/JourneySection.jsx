import { Link } from 'react-router-dom';

export default function JourneySection() {
  return (
    <section className="section journey-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-6 d-flex align-items-center">
            <div className="start-your-journey aos" data-aos="fade-up">
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
                <Link to="/about" className="btn btn-secondary d-inline-flex align-items-center">
                  <span><i className="feather-align-justify me-2"></i></span>Tìm Hiểu Thêm
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
  );
}
