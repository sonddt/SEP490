import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';

function hubBaseUrl() {
  const api = import.meta.env.VITE_API_URL || 'http://localhost:5079/api';
  const origin = String(api).replace(/\/api\/?$/i, '');
  return `${origin}/hubs/notifications`;
}

function showBookingToast(title, body) {
  const el = document.createElement('div');
  el.className = 'bk-toast bk-toast--success';
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:10050;max-width:380px;padding:14px 18px;display:flex;gap:12px;align-items:flex-start;box-shadow:0 8px 24px rgba(0,0,0,.12);border-radius:12px;background:#fff;border:1px solid #bbf7d0;';
  const icon = document.createElement('i');
  icon.className = 'feather-bell';
  icon.style.cssText = 'color:#097E52;flex-shrink:0;margin-top:2px;';
  const wrap = document.createElement('div');
  const t = document.createElement('div');
  t.style.cssText = 'font-weight:600;color:#14532d;margin-bottom:4px;';
  t.textContent = title || 'Thông báo';
  const b = document.createElement('div');
  b.style.cssText = 'font-size:13px;color:#166534;line-height:1.45;';
  b.textContent = body || '';
  wrap.appendChild(t);
  wrap.appendChild(b);
  el.appendChild(icon);
  el.appendChild(wrap);
  document.body.appendChild(el);
  const rm = () => {
    try {
      el.remove();
    } catch {
      /* ignore */
    }
  };
  setTimeout(rm, 6000);
}

/**
 * Kết nối SignalR khi đã đăng nhập; nhận `bookingStatus` từ server (chủ sân duyệt/huỷ đơn).
 */
export function useBookingNotificationsHub() {
  const { isAuthenticated } = useAuth();
  const connRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (connRef.current) {
        connRef.current.stop().catch(() => {});
        connRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const url = `${hubBaseUrl()}?access_token=${encodeURIComponent(token)}`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(url, {
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    connRef.current = connection;

    connection.on('bookingStatus', (payload) => {
      const title = payload?.title || 'Cập nhật đơn đặt sân';
      const body = payload?.body || '';
      showBookingToast(title, body);
    });

    let cancelled = false;
    (async () => {
      try {
        await connection.start();
        if (!cancelled) await connection.invoke('Join');
      } catch {
        /* mạng lỗi — có thể reconnect tự động */
      }
    })();

    return () => {
      cancelled = true;
      connection.stop().catch(() => {});
      if (connRef.current === connection) connRef.current = null;
    };
  }, [isAuthenticated]);
}
