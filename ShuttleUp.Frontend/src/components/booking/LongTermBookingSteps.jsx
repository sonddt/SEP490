import { Link } from 'react-router-dom';

const STEPS = [
  { label: 'Cấu hình lịch', path: '/booking/long-term' },
  { label: 'Xác nhận', path: '/booking/long-term/confirm' },
  { label: 'Thanh toán', path: '/booking/payment' },
];

export default function LongTermBookingSteps({ currentStep }) {
  return (
    <section className="booking-steps py-30" style={{ backgroundColor: '#f0fdf4' }}>
      <div className="container">
        <ul className="d-lg-flex justify-content-center align-items-center">
          {STEPS.map((step, idx) => {
            const stepNum = idx + 1;
            const isActive = stepNum === currentStep;
            const isDone = stepNum < currentStep;
            return (
              <li key={stepNum} className={isActive || isDone ? 'active' : ''}>
                <h5>
                  <Link to={isDone ? step.path : '#'} style={{ pointerEvents: isDone ? 'auto' : 'none' }}>
                    <span>{stepNum}</span>
                    {step.label}
                  </Link>
                </h5>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
