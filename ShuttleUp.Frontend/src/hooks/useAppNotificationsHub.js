import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';
import { refreshNotificationBadge } from '../utils/appToast';
import { notifyInfo, notifySuccess } from './useNotification';

function hubBaseUrl() {
  const api = import.meta.env.VITE_API_URL || 'http://localhost:5079/api';
  const origin = String(api).replace(/\/api\/?$/i, '');
  return `${origin}/hubs/notifications`;
}

function toastDedupeKey(kind, payload) {
  const bid = payload?.bookingId;
  if (bid) return `booking:${bid}`;
  if (kind === 'notification' && payload?.id) return `n:${payload.id}`;
  return `${kind}:${payload?.title ?? ''}:${payload?.body ?? ''}`;
}

/**
 * SignalR: nhận `notification` (mọi loại) và `bookingStatus` (đơn đặt sân).
 * Gộp toast trùng (cùng booking / cùng id) trong vài giây để tránh spam.
 */
export function useAppNotificationsHub() {
  const { isAuthenticated } = useAuth();
  const connRef = useRef(null);
  const lastToastRef = useRef({ key: '', at: 0 });

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

    const shouldShowToast = (key) => {
      const now = Date.now();
      if (lastToastRef.current.key === key && now - lastToastRef.current.at < 4500) {
        return false;
      }
      lastToastRef.current = { key, at: now };
      return true;
    };

    connection.on('notification', (payload) => {
      const key = toastDedupeKey('notification', payload);
      if (!shouldShowToast(key)) {
        refreshNotificationBadge();
        return;
      }
      const title = payload?.title || 'Thông báo';
      const body = payload?.body || '';
      notifyInfo(body ? `${title} — ${body}` : title, { autoClose: 6000 });
      refreshNotificationBadge();
    });

    connection.on('bookingStatus', (payload) => {
      const key = toastDedupeKey('bookingStatus', payload);
      if (!shouldShowToast(key)) {
        refreshNotificationBadge();
        return;
      }
      const title = payload?.title || 'Cập nhật đơn đặt sân';
      const body = payload?.body || '';
      notifySuccess(body ? `${title} — ${body}` : title, { autoClose: 7000 });
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
