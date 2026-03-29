/**
 * Toast nhẹ góc màn hình (class bk-toast trong index.css).
 * @param {'success'|'warning'|'info'} type
 */
export function showBkToast(message, type = 'info') {
  const el = document.createElement('div');
  const cls =
    type === 'success' ? 'bk-toast--success' : type === 'warning' ? 'bk-toast--warning' : 'bk-toast--info';
  const icon =
    type === 'success'
      ? 'feather-check-circle'
      : type === 'warning'
        ? 'feather-alert-circle'
        : 'feather-info';
  el.className = `bk-toast ${cls}`;
  el.innerHTML = `<i class="${icon}"></i> ${message}`;
  el.style.position = 'fixed';
  el.style.bottom = '24px';
  el.style.right = '24px';
  el.style.zIndex = '9999';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
