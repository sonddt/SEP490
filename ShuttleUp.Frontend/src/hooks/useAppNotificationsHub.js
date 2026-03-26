import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';
import { showAppToast, refreshNotificationBadge } from '../utils/appToast';

function hubBaseUrl() {
  const api = import.meta.env.VITE_API_URL || 'http://localhost:5079/api';
  const origin = String(api).replace(/\/api\/?$/i, '');
  return `${origin}/hubs/notifications`;
}

/**
 * SignalR: nhận `notification` (mọi loại) và `bookingStatus` (đơn đặt sân).
 */
export function useAppNotificationsHub() {
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

    connection.on('notification', (payload) => {
      const title = payload?.title || 'Thông báo';
      const body = payload?.body || '';
      showAppToast('info', body ? `${title} — ${body}` : title, 6000);
      refreshNotificationBadge();
    });

    connection.on('bookingStatus', (payload) => {
      const title = payload?.title || 'Cập nhật đơn đặt sân';
      const body = payload?.body || '';
      showAppToast('success', body ? `${title} — ${body}` : title, 7000);
      refreshNotificationBadge();
    });

    let cancelled = false;
    (async () => {
      try {
        await connection.start();
        if (!cancelled) await connection.invoke('Join');
      } catch {
        /* reconnect */
      }
    })();

    return () => {
      cancelled = true;
      connection.stop().catch(() => {});
      if (connRef.current === connection) connRef.current = null;
    };
  }, [isAuthenticated]);
}
