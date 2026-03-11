import { useState } from 'react';

const plans = [
  {
    id: 'pro',
    icon: '/assets/img/icons/price-01.svg',
    title: 'Professional',
    priceMonthly: '60.00',
    priceYearly: '600.00',
    features: [
      { ok: true, text: 'Included : Quality Checked By Envato' },
      { ok: true, text: 'Included : Future Updates' },
      { ok: true, text: 'Technical Support' },
      { ok: false, text: 'Add Listing' },
      { ok: false, text: 'Approval of Listing' },
    ],
    recommended: false,
  },
  {
    id: 'expert',
    icon: '/assets/img/icons/price-02.svg',
    title: 'Expert',
    priceMonthly: '60.00',
    priceYearly: '600.00',
    features: [
      { ok: true, text: 'Included : Quality Checked By Envato' },
      { ok: true, text: 'Included : Future Updates' },
      { ok: true, text: 'Technical Support' },
      { ok: true, text: 'Add Listing' },
      { ok: true, text: 'Approval of Listing' },
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
          <h2>We Have Excellent <span>Plans For You</span></h2>
          <p className="sub-title">Choose monthly or yearly plans for uninterrupted access to our premium badminton facilities. Join us and experience convenient excellence.</p>
        </div>
        <div className="interset-btn aos" data-aos="fade-up">
          <div className="status-toggle d-inline-flex align-items-center">
            Monthly
            <input
              type="checkbox"
              id="status_1"
              className="check"
              checked={yearlyPlans}
              onChange={(e) => setYearlyPlans(e.target.checked)}
            />
            <label htmlFor="status_1" className="checktoggle">checkbox</label>
            Yearly
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
                      ${yearlyPlans ? plan.priceYearly : plan.priceMonthly} <span>/ {yearlyPlans ? 'Per Year' : 'Per Month'}</span>
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
                      Choose Plan
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
