import { Link } from 'react-router-dom';

const PATH_SCHEDULE = '/booking/long-term';
const PATH_CONFIRM = '/booking/long-term/confirm';

function paymentPath(bookingId) {
  if (bookingId) {
    return `/booking/payment?bookingId=${encodeURIComponent(bookingId)}&flow=long-term`;
  }
  return '/booking/payment?flow=long-term';
}

/** Stepper thống nhất 4 bước cho luồng đặt lịch dài hạn */
export default function LongTermBookingSteps({ currentStep, bookingId }) {
  const payPath = paymentPath(bookingId);

  const STEPS = [
    { label: 'Lịch cố định', path: PATH_SCHEDULE },
    { label: 'Xác nhận đơn', path: PATH_CONFIRM },
    { label: 'Thanh toán', path: payPath },
    { label: 'Hoàn tất', path: '/booking/complete' },
  ];

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
                  <Link
                    to={isDone ? step.path : '#'}
                    style={{ pointerEvents: isDone ? 'auto' : 'none' }}
                  >
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
