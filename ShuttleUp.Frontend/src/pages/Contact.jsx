const Contact = () => {
  return (
    <div className="main-wrapper content-below-header">
      {/* Breadcrumb */}
      <section className="breadcrumb breadcrumb-list mb-0" style={{ padding: '40px 0', overflow: 'hidden', position: 'relative' }}>
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white h2 mb-1">Liên hệ</h1>
          <ul className="mb-0">
            <li><a href="/">Trang chủ</a></li>
            <li>Liên hệ</li>
          </ul>
        </div>
      </section>

      {/* Page Content */}
      <div className="content blog-details contact-group">
        <div className="container">
          <h2 className="text-center mb-40">Thông tin liên hệ</h2>
          <div className="row mb-40">
            <div className="col-12 col-sm-12 col-md-6 col-lg-4">
              <div className="d-flex justify-content-start align-items-center details">
                <i className="feather-mail d-flex justify-content-center align-items-center"></i>
                <div className="info">
                  <h4>Email</h4>
                  <p><a href="mailto:shuttleup.badminton@gmail.com">shuttleup.badminton@gmail.com</a></p>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-12 col-md-6 col-lg-4">
              <div className="d-flex justify-content-start align-items-center details">
                <i className="feather-phone-call d-flex justify-content-center align-items-center"></i>
                <div className="info">
                  <h4>Số điện thoại</h4>
                  <p>0394127869</p>
                </div>
              </div>
            </div>
            <div className="col-12 col-sm-12 col-md-6 col-lg-4">
              <div className="d-flex justify-content-start align-items-center details">
                <i className="feather-map-pin d-flex justify-content-center align-items-center"></i>
                <div className="info">
                  <h4>Địa chỉ</h4>
                  <p>Thành phố Hà Nội, Việt Nam</p>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <div className="google-maps">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d119176.49508935408!2d105.74697779774643!3d21.0227357492978!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135ab9bdad72359%3A0x1e363b9ca7554e2!2zSMOgIE7hu5lpLCBWaeG7h3QgTmFt!5e0!3m2!1svi!2svi!4v1713693000000!5m2!1svi!2svi"
                  height="445"
                  style={{ border: 0, width: '100%' }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="ShuttleUp Location"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
        <section className="section dull-bg">
          <div className="container">
            <h2 className="text-center mb-40">
              Gửi cho chúng tôi câu hỏi của bạn
            </h2>
            <form className="contact-us">
              <div className="row">
                <div className="col-12 col-sm-12 col-md-6 mb-3">
                  <label htmlFor="first-name" className="form-label">Họ</label>
                  <input
                    type="text"
                    className="form-control"
                    id="first-name"
                    placeholder="Nhập họ của bạn"
                  />
                </div>
                <div className="col-12 col-sm-12 col-md-6 mb-3">
                  <label htmlFor="last-name" className="form-label">Tên</label>
                  <input
                    type="text"
                    className="form-control"
                    id="last-name"
                    placeholder="Nhập tên của bạn"
                  />
                </div>
                <div className="col-12 col-sm-12 col-md-6 mb-3">
                  <label htmlFor="e-mail" className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    id="e-mail"
                    placeholder="Nhập địa chỉ email"
                  />
                </div>
                <div className="col-12 col-sm-12 col-md-6 mb-3">
                  <label htmlFor="phone" className="form-label">Số điện thoại</label>
                  <input
                    type="tel"
                    className="form-control"
                    id="phone"
                    placeholder="Nhập số điện thoại"
                  />
                </div>
              </div>
              <div className="row">
                <div className="col mb-3">
                  <label htmlFor="subject" className="form-label">Tiêu đề</label>
                  <input
                    type="text"
                    className="form-control"
                    id="subject"
                    placeholder="Nhập tiêu đề"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="comments" className="form-label">Nội dung</label>
                <textarea
                  className="form-control"
                  id="comments"
                  rows="3"
                  placeholder="Nhập nội dung cần hỗ trợ"
                ></textarea>
              </div>
              <button
                type="button"
                className="btn btn-secondary d-flex align-items-center"
                onClick={(e) => e.preventDefault()}
              >
                Gửi liên hệ
                <i className="feather-arrow-right-circle ms-2"></i>
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Contact;

