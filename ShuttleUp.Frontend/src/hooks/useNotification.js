import { toast } from 'react-toastify';

const ICON = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const DEFAULT_OPTIONS = {
  position: 'top-right',
  autoClose: 4000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: false,
};

function fire(type, message, options = {}) {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const icon = options.icon ?? ICON[type];
  return toast[type]?.(message, { icon, ...merged })
    ?? toast(message, { icon, ...merged });
}

export function notify(type, message, options) {
  return fire(type, message, options);
}

export const notifySuccess = (msg, opts) => fire('success', msg, opts);
export const notifyError   = (msg, opts) => fire('error', msg, opts);
export const notifyWarning = (msg, opts) => fire('warning', msg, opts);
export const notifyInfo    = (msg, opts) => fire('info', msg, opts);

export function useNotification() {
  return { notify, notifySuccess, notifyError, notifyWarning, notifyInfo };
}
