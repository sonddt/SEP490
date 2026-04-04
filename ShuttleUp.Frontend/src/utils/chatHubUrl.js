/**
 * URL hub SignalR chat — ưu tiên VITE_CHAT_HUB_URL; nếu không có thì suy ra từ VITE_API_URL.
 */
export function getChatHubUrl() {
  const explicit = import.meta.env.VITE_CHAT_HUB_URL;
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim().replace(/\/$/, '');
  }
  const api = import.meta.env.VITE_API_URL || 'http://localhost:5079/api';
  const base = String(api).replace(/\/api\/?$/i, '');
  return `${base}/hubs/chat`;
}
