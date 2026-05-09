import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyActiveHold } from '../../api/bookingApi';

function padTwo(n) { return String(n).padStart(2, '0'); }

/**
 * Global banner that shows when the authenticated user has a HOLDING booking
 * (i.e. they left the payment page before completing payment).
 * Renders below the Header. Auto-hides when countdown reaches 0 or user is not logged in.
 */
export default function ActiveHoldBanner() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [hold, setHold] = useState(null);       // { bookingId, bookingCode, venueName, holdExpiresAt, totalPrice }
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef(null);
  const pollRef = useRef(null);

  const fetchHold = useCallback(async () => {
    if (!isAuthenticated) { setHold(null); return; }
    try {
      const data = await getMyActiveHold();
      if (data && data.bookingId) {
        setHold(data);
        setDismissed(false);
      } else {
        setHold(null);
      }
    } catch {
      setHold(null);
    }
  }, [isAuthenticated]);

  // Poll on mount + every 30s (matches backend cleanup interval)
  useEffect(() => {
    fetchHold();
    pollRef.current = setInterval(fetchHold, 30_000);
    return () => clearInterval(pollRef.current);
  }, [fetchHold]);

  // Re-fetch when route changes (e.g., user leaves payment page)
  useEffect(() => {
    fetchHold();
  }, [location.pathname, fetchHold]);

  // Listen for custom event when a new booking is created (so banner appears immediately)
  useEffect(() => {
    const handler = () => fetchHold();
    window.addEventListener('booking:hold-created', handler);
    return () => window.removeEventListener('booking:hold-created', handler);
  }, [fetchHold]);

  // Countdown timer synced from holdExpiresAt
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!hold?.holdExpiresAt) { setSecondsLeft(null); return; }

    const computeRemaining = () => {
      let ts = hold.holdExpiresAt;
      if (typeof ts === 'string' && !ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
      const diff = Math.floor((new Date(ts).getTime() - Date.now()) / 1000);
      return Math.max(diff, 0);
    };

    setSecondsLeft(computeRemaining());
    intervalRef.current = setInterval(() => {
      const remaining = computeRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        // Auto-hide after a short delay
        setTimeout(() => setHold(null), 2000);
      }
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [hold]);

  // Don't render if no hold, dismissed, not authenticated, or on the payment page already
  if (!isAuthenticated || !hold || dismissed || secondsLeft === null) return null;
  if (location.pathname.startsWith('/booking/payment')) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft <= 60;
  const isExpired = secondsLeft <= 0;

  const handleContinue = () => {
    navigate(`/booking/payment?bookingId=${hold.bookingId}`);
  };

  return (
    <div
      style={{
        background: isExpired
          ? 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)'
          : isUrgent
            ? 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)'
            : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        borderBottom: `2px solid ${isExpired ? '#fca5a5' : isUrgent ? '#fdba74' : '#6ee7b7'}`,
        padding: '12px 0',
        position: 'relative',
        zIndex: 999,
        transition: 'all 0.4s ease',
        animation: 'holdBannerSlideIn 0.4s ease-out',
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: isExpired ? '#fee2e2' : isUrgent ? '#ffedd5' : '#d1fae5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {isExpired ? '⏰' : '⚡'}
        </div>

        {/* Message */}
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <span style={{
            fontWeight: 700, fontSize: 14, color: isExpired ? '#dc2626' : isUrgent ? '#c2410c' : '#065f46',
          }}>
            {isExpired
              ? 'Đơn đặt sân đã hết thời gian giữ chỗ!'
              : 'Bạn có đơn đặt sân chưa hoàn tất!'}
          </span>
          {!isExpired && (
            <span style={{ marginLeft: 8, fontSize: 13, color: '#6b7280' }}>
              {hold.venueName && <>{hold.venueName} — </>}
              còn <strong style={{ color: isUrgent ? '#ea580c' : '#059669', fontVariantNumeric: 'tabular-nums' }}>
                {padTwo(mins)}:{padTwo(secs)}
              </strong>
            </span>
          )}
        </div>

        {/* CTA Button */}
        {!isExpired && (
          <button
            type="button"
            onClick={handleContinue}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 10, border: 'none',
              background: isUrgent
                ? 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)'
                : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
          >
            <i className="feather-arrow-right" style={{ fontSize: 14 }} />
            Tiếp tục thanh toán
          </button>
        )}

        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          title="Ẩn"
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94a3b8', fontSize: 16, padding: 4,
          }}
        >
          <i className="feather-x" />
        </button>
      </div>

      <style>{`
        @keyframes holdBannerSlideIn {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
