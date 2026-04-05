import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildProfileAddressQuery,
  geocodeAddressQuery,
  reverseGeocodeLatLng,
} from '../utils/nominatimGeocode';

/**
 * Điểm neo để sort khoảng cách: GPS khi bật toggle (có fallback hồ sơ), hoặc chỉ geocode hồ sơ khi tắt.
 * @param {boolean} useGps - Bật định vị trình duyệt
 * @param {{ address?: string, district?: string, province?: string }} profileParts
 */
export function useVenueLocationAnchor(useGps, profileParts) {
  const profileQuery = buildProfileAddressQuery(profileParts || {});

  const [refLat, setRefLat] = useState(null);
  const [refLng, setRefLng] = useState(null);
  const [source, setSource] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  /** Địa danh từ reverse Nominatim (chỉ khi neo = GPS). */
  const [gpsPlaceName, setGpsPlaceName] = useState('');
  const [gpsPlaceLoading, setGpsPlaceLoading] = useState(false);

  const mounted = useRef(true);
  const reverseSeq = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const resolveFromProfile = useCallback(async () => {
    if (!profileQuery) {
      return { lat: null, lng: null, src: null };
    }
    const pos = await geocodeAddressQuery(profileQuery);
    if (!pos) return { lat: null, lng: null, src: null };
    return { lat: pos.lat, lng: pos.lng, src: 'profile' };
  }, [profileQuery]);

  const runResolve = useCallback(async () => {
    if (!mounted.current) return;
    setStatus('loading');
    setMessage('');

    const tryGps =
      useGps &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation;

    if (tryGps) {
      const gps = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              ok: true,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          () => resolve({ ok: false }),
          {
            enableHighAccuracy: false,
            timeout: 12000,
            maximumAge: 300_000,
          }
        );
      });

      if (!mounted.current) return;

      if (gps.ok) {
        setRefLat(gps.lat);
        setRefLng(gps.lng);
        setSource('gps');
        setStatus('ready');
        setMessage('');
        return;
      }

      const fb = await resolveFromProfile();
      if (!mounted.current) return;
      if (fb.lat != null) {
        setRefLat(fb.lat);
        setRefLng(fb.lng);
        setSource('profile');
        setStatus('ready');
        setMessage(
          'Không lấy được vị trí GPS — đang dùng địa chỉ trong hồ sơ.'
        );
        return;
      }
      setRefLat(null);
      setRefLng(null);
      setSource(null);
      setStatus('ready');
      setMessage(
        'Không lấy được GPS và chưa có địa chỉ hồ sơ (hoặc không tìm thấy trên bản đồ).'
      );
      return;
    }

    const p = await resolveFromProfile();
    if (!mounted.current) return;
    if (p.lat != null) {
      setRefLat(p.lat);
      setRefLng(p.lng);
      setSource('profile');
      setStatus('ready');
      setMessage('');
      return;
    }
    setRefLat(null);
    setRefLng(null);
    setSource(null);
    setStatus('ready');
    setMessage('');
  }, [useGps, resolveFromProfile]);

  useEffect(() => {
    runResolve();
  }, [runResolve]);

  useEffect(() => {
    if (refLat == null || refLng == null || source !== 'gps') {
      setGpsPlaceName('');
      setGpsPlaceLoading(false);
      return;
    }

    const seq = ++reverseSeq.current;
    setGpsPlaceLoading(true);
    setGpsPlaceName('');

    let cancelled = false;
    (async () => {
      try {
        const name = await reverseGeocodeLatLng(refLat, refLng);
        if (cancelled || seq !== reverseSeq.current || !mounted.current) return;
        setGpsPlaceName(name || '');
      } finally {
        if (!cancelled && seq === reverseSeq.current && mounted.current) {
          setGpsPlaceLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refLat, refLng, source]);

  const refreshGps = useCallback(() => {
    if (!useGps) return;
    runResolve();
  }, [useGps, runResolve]);

  const hasAnchor = refLat != null && refLng != null;

  return {
    refLat,
    refLng,
    source,
    status,
    message,
    hasAnchor,
    profileQuery,
    refreshGps,
    gpsPlaceName,
    gpsPlaceLoading,
  };
}
