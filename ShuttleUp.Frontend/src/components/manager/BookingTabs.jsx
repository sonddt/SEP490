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
            style={isActive ? {
              borderColor: st.color,
              color: st.color,
              background: st.bg,
            } : {}}
          >
            <i className={st.icon} style={{ fontSize: 14 }} />
            <span className="bk-tab-label">{st.label}</span>
            <span
              className="bk-tab-count"
              style={isActive ? { background: st.color, color: '#fff' } : {}}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
