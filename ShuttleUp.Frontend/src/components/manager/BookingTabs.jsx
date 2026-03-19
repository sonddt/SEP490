import { BOOKING_STATUSES } from '../../data/bookingsMock';

const TABS = [
  { key: 'PENDING' },
  { key: 'UPCOMING' },
  { key: 'COMPLETED' },
  { key: 'REJECTED' },
  { key: 'CANCELLED' },
];

export default function BookingTabs({ activeTab, counts, onChange }) {
  return (
    <div className="bk-tabs">
      {TABS.map(({ key }) => {
        const st = BOOKING_STATUSES[key];
        const isActive = activeTab === key;
        const count = counts[key] ?? 0;

        return (
          <button
            key={key}
            type="button"
            className={`bk-tab-btn${isActive ? ' active' : ''}`}
            onClick={() => onChange(key)}
          >
            <i className={st.icon} style={{ fontSize: 15 }} />
            <span className="bk-tab-label">{st.label}</span>
            {count > 0 && (
              <span className="bk-tab-count">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
