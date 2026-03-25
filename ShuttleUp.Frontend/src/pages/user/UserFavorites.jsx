import { useEffect, useState } from 'react';
import VenueCard from '../../components/courts/VenueCard';
import UserDashboardMenu from '../../components/user/UserDashboardMenu';
import favoritesApi from '../../api/favoritesApi';

export default function UserFavorites() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState([]);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await favoritesApi.getMyFavorites();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Không tải được danh sách sân yêu thích.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const mappedFavorites = favorites.map((v) => ({
    id: v.id ?? v.Id,
    name: v.name ?? v.Name,
    location: v.address ?? v.Address,
    minPrice: v.minPrice ?? v.MinPrice ?? null,
    maxPrice: v.maxPrice ?? v.MaxPrice ?? null,
    img: '/assets/img/venues/venues-01.jpg',
    rating: '4.5',
    reviews: '',
    desc: '',
    avatar: '/assets/img/profiles/avatar-01.jpg',
    owner: '',
    nextAvailability: '',
  }));

  return (
    <div className="main-wrapper">
      <UserDashboardMenu />
      <div className="content court-bg" style={{ paddingTop: 90 }}>
        <div className="container">
          <div className="row mb-4">
            <div className="col-12">
              <h2 className="text-white mb-2">Sân yêu thích</h2>
              <div className="text-white-50">Nhấn trái tim để xoá bớt khỏi danh sách.</div>
            </div>
          </div>

          {loading && (
            <div className="text-muted py-4">Đang tải...</div>
          )}

          {!loading && error && (
            <div className="alert alert-danger">{error}</div>
          )}

          {!loading && !error && mappedFavorites.length === 0 && (
            <div className="alert alert-info">
              Bạn chưa có sân nào trong danh sách yêu thích.
            </div>
          )}

          <div className="row justify-content-center">
            {!loading && !error && mappedFavorites.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                viewMode="grid"
                isFavorited={true}
                onToggleFavorite={async (venueId, shouldFavorite) => {
                  if (!shouldFavorite) {
                    await favoritesApi.removeFavorite(venueId);
                    await loadFavorites();
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

