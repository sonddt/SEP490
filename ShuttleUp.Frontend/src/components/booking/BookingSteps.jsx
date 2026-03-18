import { Link } from 'react-router-dom';

const STEPS = [
  { label: 'Chọn giờ',    path: '/booking' },
  { label: 'Xác nhận đơn', path: '/booking/confirm' },
  { label: 'Thanh toán',  path: '/booking/payment' },
  { label: 'Hoàn tất',    path: '/booking/complete' },
];

export default function BookingSteps({ currentStep }) {
  return (
    <section className="booking-steps py-30">
      <div className="container">
        <ul className="d-lg-flex justify-content-center align-items-center">
          {STEPS.map((step, idx) => {
            const stepNum = idx + 1;
            const isActive = stepNum === currentStep;
            const isDone   = stepNum < currentStep;
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
