import { useState } from 'react';

const plans = [
  {
    id: 'pro',
    icon: '/assets/img/icons/price-01.svg',
    title: 'Gói Tiêu Chuẩn',
    priceMonthly: '1.500.000',
    priceYearly: '15.000.000',
    features: [
      { ok: true, text: 'Quản lý 5 sân cầu lông' },
      { ok: true, text: 'Quản lý lịch đặt sân' },
      { ok: true, text: 'Hỗ trợ kỹ thuật qua Email/Chat' },
      { ok: false, text: 'Thêm không giới hạn sân' },
      { ok: false, text: 'Gợi ý sân ưu tiên trên App' },
    ],
    recommended: false,
  },
  {
    id: 'expert',
    icon: '/assets/img/icons/price-02.svg',
    title: 'Gói Cao Cấp',
    priceMonthly: '3.000.000',
    priceYearly: '30.000.000',
    features: [
      { ok: true, text: 'Quản lý 15 sân cầu lông' },
      { ok: true, text: 'Thống kê doanh thu chi tiết' },
      { ok: true, text: 'Hỗ trợ kỹ thuật 24/7' },
      { ok: true, text: 'Quản lý nhân viên/lịch làm việc' },
      { ok: true, text: 'Gợi ý sân ưu tiên trên App' },
    ],
    recommended: true,
  },
];

export default function FeaturedPlan() {
  const [yearlyPlans, setYearlyPlans] = useState(false);

  return (
    <section className="section featured-plan">
      <div className="work-img">
        <div className="work-img-right">
          <img src="/assets/img/bg/work-bg.png" alt="Icon" />
        </div>
      </div>
      <div className="container">
        <div className="section-heading aos" data-aos="fade-up">
          <h2>Gói Giải Pháp <span>Hoàn Hảo</span> Cho Quản Lý Sân</h2>
          <p className="sub-title">Chọn gói giải pháp theo tháng hoặc năm để tối ưu hóa doanh thu và tăng trưởng khách hàng.</p>
        </div>
        <div className="interset-btn aos" data-aos="fade-up">
          <div className="status-toggle d-inline-flex align-items-center">
            Theo Tháng
            <input
              type="checkbox"
              id="status_1"
              className="check"
              checked={yearlyPlans}
              onChange={(e) => setYearlyPlans(e.target.checked)}
            />
            <label htmlFor="status_1" className="checktoggle">checkbox</label>
            Theo Năm
          </div>
        </div>
        <div className="price-wrap aos" data-aos="fade-up">
          <div className="row justify-content-center">
            {plans.map((plan) => (
              <div key={plan.id} className="col-lg-4 col-md-6 d-flex">
                <div className={`price-card w-100 ${plan.recommended ? 'active' : ''}`}>
                  <div className="price-head">
                    <div className="price-level">
                      <h6>{plan.title}</h6>
                    </div>
                    <h4>
                      {yearlyPlans ? plan.priceYearly : plan.priceMonthly} <span>₫ / {yearlyPlans ? 'Năm' : 'Tháng'}</span>
                    </h4>
                  </div>
                  <div className="price-details">
                    <ul>
                      {plan.features.map((feature, i) => (
                        <li key={i} className={feature.ok ? '' : 'inactive'}>
                          <img
                            src={feature.ok ? '/assets/img/icons/green-tick.svg' : '/assets/img/icons/close-icon.svg'}
                            alt="Icon"
                          />
                          {feature.text}
                        </li>
                      ))}
                    </ul>
                    <a href="#" onClick={(e) => e.preventDefault()} className="btn btn-secondary w-100">
                      Đăng Ký Gói Này
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
