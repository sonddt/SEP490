export const BOOKING_STATUSES = {
  PENDING:   { label: 'Chờ duyệt',   color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: 'feather-clock' },
  UPCOMING:  { label: 'Sắp tới',     color: '#097E52', bg: '#e8f5ee', border: '#6ee7b7', icon: 'feather-calendar' },
  COMPLETED: { label: 'Hoàn thành',  color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7', icon: 'feather-check-circle' },
  REJECTED:  { label: 'Đã từ chối',  color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', icon: 'feather-x-circle' },
  CANCELLED: { label: 'Đã huỷ / Từ chối', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', icon: 'feather-slash' },
  PENDING_REFUND: { label: 'Chờ hoàn tiền', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'feather-clock' },
  PENDING_RECONCILIATION: { label: 'Chờ đối soát', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'feather-clock' },
  REFUNDED:  { label: 'Đã hoàn tiền', color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd', icon: 'feather-check-circle' },
};
