import { useState, useEffect, useCallback } from 'react';
import { getUnreadCount } from '../api/notificationsApi';

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      setCount(Number(data?.count ?? data?.Count ?? 0));
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    load();
    const onRefresh = () => load();
    window.addEventListener('notifications:refresh', onRefresh);
    return () => window.removeEventListener('notifications:refresh', onRefresh);
  }, [load]);

  return { count, refresh: load };
}
