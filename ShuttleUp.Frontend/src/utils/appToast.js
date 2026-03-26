/**
 * Toast thân thiện (theo docs/rule — tránh từ gay gắt ở UI công cộng).
 * @param {'success'|'info'|'warning'} kind
 * @param {string} message
 * @param {number} [durationMs]
 */
export function showAppToast(kind, message, durationMs = 4500) {
  const el = document.createElement('div');
  const variant = kind === 'success' ? 'bk-toast--success' : kind === 'warning' ? 'bk-toast--warning' : 'bk-toast--success';
  el.className = `bk-toast ${variant}`;
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:10060;max-width:400px;padding:14px 18px;display:flex;gap:10px;align-items:flex-start;box-shadow:0 8px 24px rgba(0,0,0,.12);border-radius:12px;background:#fff;';
  const icon = document.createElement('i');
  icon.className = kind === 'warning' ? 'feather-alert-circle' : 'feather-info';
  icon.style.cssText = 'color:#097E52;flex-shrink:0;margin-top:2px;';
  const text = document.createElement('div');
  text.style.cssText = 'font-size:14px;color:#14532d;line-height:1.45;';
  text.textContent = message;
  el.appendChild(icon);
  el.appendChild(text);
  document.body.appendChild(el);
  const t = setTimeout(() => {
    try {
      el.remove();
    } catch {
      /* ignore */
    }
  }, durationMs);
  return () => clearTimeout(t);
}

export function refreshNotificationBadge() {
  try {
    window.dispatchEvent(new Event('notifications:refresh'));
  } catch {
    /* ignore */
  }
}
