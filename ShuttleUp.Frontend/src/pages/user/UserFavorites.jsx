import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import VenueCard from '../../components/courts/VenueCard';
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
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-heart text-rose-500"></i>
              Sân yêu thích
            </h2>
            <p className="text-slate-500 text-[13.5px] m-0">Danh sách các sân cầu lông bạn đã xem và lưu lại.</p>
          </div>
          <div className="inline-flex bg-rose-50 text-rose-600 px-4 py-2 rounded-xl font-bold border border-rose-100 items-center gap-2 shadow-sm text-sm">
            <i className="fa-solid fa-bookmark text-rose-500"></i>
            {favorites.length} Sân
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 min-h-[500px]">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <i className="fa-solid fa-circle-notch fa-spin text-emerald-500 text-3xl"></i>
            <p className="text-slate-400 font-medium">Đang tải sân yêu thích...</p>
          </div>
        )}

        {!loading && error && (
          <div className="alert alert-danger rounded-xl border-0 bg-rose-50 text-rose-700 py-3 px-4 shadow-sm">
            <i className="fa-solid fa-circle-exclamation me-2"></i>{error}
          </div>
        )}

        {!loading && !error && mappedFavorites.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <i className="fa-regular fa-heart text-3xl text-slate-300"></i>
            </div>
            <h4 className="text-lg font-bold text-slate-800 mb-2">Chưa có sân yêu thích</h4>
            <p className="text-slate-500 text-[13.5px]">Bạn chưa lưu sân cầu lông nào. Hãy khám phá và lưu lại những sân bạn thích nhé!</p>
            <Link to="/venues" className="mt-4 flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-2.5 rounded-xl font-bold shadow-md shadow-emerald-500/20 transition-all border-0">
              Khám phá sân ngay
            </Link>
          </div>
        )}

        {!loading && !error && mappedFavorites.length > 0 && (
          <div className="row g-4 justify-content-start">
            {mappedFavorites.map((venue) => (
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
        )}
      </div>
    </div>
  );
}

