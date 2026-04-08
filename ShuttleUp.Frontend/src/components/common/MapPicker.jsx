import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddressQuery } from '../../utils/nominatimGeocode';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER = [10.7769, 106.7009];
const DEFAULT_ZOOM = 13;

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick(e.latlng) });
  return null;
}

function FlyToPoint({ lat, lng }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (lat == null || lng == null) return;
    const key = `${lat},${lng}`;
    if (prev.current === key) return;
    prev.current = key;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

/**
 * Geocode a query string then flyTo the result (without placing a marker).
 * flyToZoom controls the zoom level after flying.
 */
function GeocodeFlyTo({ query, zoom }) {
  const map = useMap();
  const prev = useRef('');
  useEffect(() => {
    if (!query || query === prev.current) return;
    prev.current = query;
    let cancelled = false;
    geocodeAddressQuery(query).then((pos) => {
      if (cancelled || !pos) return;
      map.flyTo([pos.lat, pos.lng], zoom ?? 15, { duration: 0.8 });
    });
    return () => { cancelled = true; };
  }, [query, zoom, map]);
  return null;
}

/**
 * @param {object} props
 * @param {number|null} props.lat - current latitude (marker)
 * @param {number|null} props.lng - current longitude (marker)
 * @param {function} props.onChange - called with { lat, lng } on map click
 * @param {string} [props.flyToQuery] - address query to geocode + flyTo (no marker)
 * @param {number} [props.flyToZoom] - zoom level for flyToQuery
 * @param {number} [props.height]
 */
export default function MapPicker({ lat, lng, onChange, flyToQuery, flyToZoom, height = 360 }) {
  const [marker, setMarker] = useState(
    lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null,
  );

  useEffect(() => {
    if (lat != null && lng != null) {
      setMarker({ lat: Number(lat), lng: Number(lng) });
    }
  }, [lat, lng]);

  const handleClick = useCallback(
    (latlng) => {
      const pos = { lat: latlng.lat, lng: latlng.lng };
      setMarker(pos);
      onChange?.(pos);
    },
    [onChange],
  );

  const center =
    marker && Number.isFinite(marker.lat) && Number.isFinite(marker.lng)
      ? [marker.lat, marker.lng]
      : DEFAULT_CENTER;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <MapContainer
        center={center}
        zoom={marker ? 16 : DEFAULT_ZOOM}
        style={{ height, width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={handleClick} />
        <GeocodeFlyTo query={flyToQuery} zoom={flyToZoom} />
        {marker && Number.isFinite(marker.lat) && Number.isFinite(marker.lng) && (
          <>
            <Marker position={[marker.lat, marker.lng]} icon={defaultIcon} />
            <FlyToPoint lat={marker.lat} lng={marker.lng} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
