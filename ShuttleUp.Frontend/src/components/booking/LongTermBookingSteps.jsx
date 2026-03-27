import { Link } from 'react-router-dom';

const DEFAULT_SCHEDULE = '/booking/long-term/fixed';
const DEFAULT_CONFIRM = '/booking/long-term/confirm';

function paymentPath(bookingId) {
  if (bookingId) {
    return `/booking/payment?bookingId=${encodeURIComponent(bookingId)}&flow=long-term`;
  }
  return '/booking/payment?flow=long-term';
}

/** Stepper 4 bước — nhánh cố định hoặc linh hoạt (đổi bước 1 qua props). */
export default function LongTermBookingSteps({
  currentStep,
  bookingId,
  scheduleStepPath = DEFAULT_SCHEDULE,
  scheduleStepLabel = 'Lịch cố định',
  confirmPath = DEFAULT_CONFIRM,
}) {
  const payPath = paymentPath(bookingId);

  const STEPS = [
    { label: scheduleStepLabel, path: scheduleStepPath },
    { label: 'Xác nhận đơn', path: confirmPath },
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
