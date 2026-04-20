import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axiosClient from '../api/axiosClient';
import { useNotification } from '../hooks/useNotification';

// Import marker SVG directly or link to it
const badmintonIconSvg = '/assets/images/badminton-marker.svg';

const badmintonIcon = new L.Icon({
  iconUrl: badmintonIconSvg,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
  className: 'venue-marker'
});

const defaultCenter = [10.8231, 106.6297]; // Ho Chi Minh City default

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2 && center[0] && center[1]) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

const VenueMapSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const alert = useNotification();
  
  // URL Params parsing
  const queryParams = new URLSearchParams(location.search);
  const initialSearch = queryParams.get('search') || '';
  const initialMinPrice = queryParams.get('minPrice') || '';
  const initialMaxPrice = queryParams.get('maxPrice') || '';
  const initialCancelAllowed = queryParams.get('cancelAllowed') === 'true';

  // State
  const [mapVenues, setMapVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters State
  const [search, setSearch] = useState(initialSearch);
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [cancelAllowed, setCancelAllowed] = useState(initialCancelAllowed);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // Define debounced fetch
  const fetchMapVenues = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (cancelAllowed) params.cancelAllowed = true;

      const res = await axiosClient.get('venues/map', { params });
      setMapVenues(res);
      
      // Auto center map if we have results
      if (res.length > 0 && !selectedVenue) {
         setMapCenter([res[0].lat, res[0].lng]);
      }
    } catch (err) {
      console.error(err);
      alert.notifyError("Không thể tải danh sách sân trên bản đồ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      // Update URL silently
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (cancelAllowed) params.set('cancelAllowed', 'true');
      
      navigate({ search: params.toString() }, { replace: true });

      fetchMapVenues();
    }, 500);

    return () => clearTimeout(handler);
  }, [search, minPrice, maxPrice, cancelAllowed]);

  // Click marker to view details
  const handleMarkerClick = async (venueBasic) => {
    setDetailLoading(true);
    setMapCenter([venueBasic.lat, venueBasic.lng]);
    try {
      const res = await axiosClient.get(`venues/${venueBasic.id}`);
      setSelectedVenue(res);
    } catch (err) {
      console.error(err);
      alert.notifyError("Không thể tải chi tiết sân.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!selectedVenue) return;
    const link = `${window.location.origin}/venues/${selectedVenue.id}`;
    navigator.clipboard.writeText(link);
    alert.notifySuccess("Đã sao chép link sân.");
  };

  const formatPrice = (price) => {
    if (!price) return "Đang cập nhật";
    return price.toLocaleString('vi-VN') + ' đ';
  };

  const isCurrentlyOpen = () => {
    if (!selectedVenue || !selectedVenue.todayOpenHours) return null;
    const now = new Date();
    // Logic to parse todayOpenHours (HH:mm:ss format strings) to check if currently open
    // Since backend already gave Vietnam timezone OpenHours, we just do a simplistic check or just display it.
    // For simplicity, we just display the string.
  };

  return (
    <div className="d-flex flex-column flex-lg-row" style={{ height: 'calc(100vh - 65px)' }}>
      {/* SIDE PANEL (Desktop Left) */}
      <div className="venue-map-sidebar d-flex flex-column" style={{ width: '100%', maxWidth: '400px', backgroundColor: '#f8fafc', zIndex: 1000, boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
        {/* Filters Area */}
        <div className="p-3 bg-white border-bottom shadow-sm">
          <h5 className="mb-3 d-flex align-items-center fw-bold">
            <i className="feather-map-pin me-2 text-emerald-600" style={{ color: '#10b981' }}></i>
            Tìm quanh đây
          </h5>
          <input 
            type="text" 
            className="form-control mb-2" 
            placeholder="Tên sân, khu vực..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="d-flex gap-2 mb-2">
            <input 
              type="number" 
              className="form-control" 
              placeholder="Giá tối thiểu" 
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
            />
            <input 
              type="number" 
              className="form-control" 
              placeholder="Giá tối đa" 
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
            />
          </div>
          <div className="form-check form-switch mb-0">
            <input 
              className="form-check-input" 
              type="checkbox" 
              role="switch" 
              id="cancelAllowedSwitch"
              checked={cancelAllowed}
              onChange={e => setCancelAllowed(e.target.checked)}
            />
            <label className="form-check-label text-muted" htmlFor="cancelAllowedSwitch">
              Sân cho phép hủy
            </label>
          </div>
        </div>

        {/* Selected Venue Details Area */}
        <div className="flex-grow-1 overflow-auto p-3 position-relative">
          {detailLoading ? (
            <div className="d-flex justify-content-center align-items-center h-100">
               <div className="spinner-border text-emerald-500" role="status"></div>
            </div>
          ) : selectedVenue ? (
            <div className="venue-detail-card bg-white rounded shadow-sm border p-3 fade-in">
              {selectedVenue.thumbnailUrl ? (
                <div 
                  className="rounded mb-3" 
                  style={{ 
                    height: '180px', 
                    backgroundImage: `url(${selectedVenue.thumbnailUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}>
                </div>
              ) : (
                <div className="rounded mb-3 bg-light d-flex align-items-center justify-content-center text-muted" style={{ height: '180px' }}>
                  <i className="feather-image fa-3x"></i>
                </div>
              )}
              
              <h4 className="fw-bold fs-5 mb-1">{selectedVenue.name}</h4>
              
              <div className="d-flex align-items-center mb-3">
                <i className="fas fa-star text-warning me-1"></i>
                <span className="fw-bold me-1">{selectedVenue.rating.toFixed(1)}</span>
                <span className="text-muted small">({selectedVenue.reviewCount} đánh giá)</span>
                {selectedVenue.cancelAllowed && (
                  <span className="badge bg-success ms-auto bg-opacity-10 text-success border border-success">
                    <i className="feather-check-circle me-1"></i>Cho phép hủy
                  </span>
                )}
              </div>

              <div className="d-flex align-items-start mb-2">
                <i className="feather-map-pin text-muted mt-1 me-2"></i>
                <span className="text-muted small lh-sm">{selectedVenue.address}</span>
              </div>
              
              <div className="d-flex align-items-start mb-3">
                <i className="feather-clock text-muted mt-1 me-2"></i>
                <span className="text-muted small">
                  {selectedVenue.todayOpenHours && selectedVenue.todayOpenHours.openTime && selectedVenue.todayOpenHours.closeTime
                    ? `Mở cửa hôm nay: ${selectedVenue.todayOpenHours.openTime} - ${selectedVenue.todayOpenHours.closeTime}`
                    : 'Chưa cập nhật giờ hoạt động hôm nay'}
                </span>
              </div>
              
              {selectedVenue.minPrice && (
                 <div className="d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded">
                    <span className="text-muted small">Giá thuê từ:</span>
                    <span className="fw-bold text-dark">{formatPrice(selectedVenue.minPrice)}</span>
                 </div>
              )}

              <div className="d-grid gap-2">
                <Link to={`/venues/${selectedVenue.id}`} className="btn px-4 py-2 text-white border-0 fw-medium" style={{ backgroundColor: '#10b981', borderRadius: '8px' }}>
                   Đặt sân ngay
                </Link>
                <button onClick={handleCopyLink} className="btn py-2 bg-white border fw-medium text-dark" style={{ borderRadius: '8px' }}>
                   <i className="feather-copy me-2"></i>Chia sẻ Local Link
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted mt-5 px-3">
               <i className="feather-map fa-3x mb-3 text-light-gray opacity-50"></i>
               <p className="small">Hiển thị {mapVenues.length} sân phù hợp trên bản đồ</p>
               <p className="small lh-sm">Nhấn vào một sân trên bản đồ không gian để xem chi tiết & giá thuê.</p>
            </div>
          )}
        </div>
      </div>

      {/* MAP AREA (Desktop Right) */}
      <div className="flex-grow-1 position-relative" style={{ minHeight: '50vh' }}>
        {loading && (
           <div className="position-absolute top-0 end-0 m-3 z-3">
              <div className="spinner-border spinner-border-sm bg-white text-emerald-600 shadow" style={{ padding: '10px' }}></div>
           </div>
        )}
        <MapContainer 
          center={mapCenter} 
          zoom={13} 
          scrollWheelZoom={true} 
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <ChangeView center={mapCenter} zoom={13} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
          >
            {mapVenues.map(venue => (
              <Marker 
                key={venue.id} 
                position={[venue.lat, venue.lng]}
                icon={badmintonIcon}
                eventHandlers={{
                  click: () => handleMarkerClick(venue),
                }}
              >
                <Popup className="venue-popup-clean">
                  <div className="text-center pb-2">
                     <div className="fw-bold text-dark">{venue.name}</div>
                     <div className="text-emerald-600 fw-medium mt-1">{formatPrice(venue.minPrice)}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .venue-popup-clean .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          padding: 0;
        }
        .venue-popup-clean .leaflet-popup-content {
          margin: 12px;
          line-height: 1.4;
        }
        .venue-marker {
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          transition: transform 0.2s;
        }
        .venue-marker:hover {
          transform: scale(1.1);
        }
        /* Fix for marker cluster icons if needed */
        .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
          background-color: rgba(16, 185, 129, 0.6);
        }
        .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
          background-color: rgba(16, 185, 129, 1);
          color: white;
          font-weight: bold;
        }
      `}} />
    </div>
  );
};

export default VenueMapSearch;
