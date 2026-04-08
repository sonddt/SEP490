import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

const MOCK_VENUES = [
  { id: 'v1', name: 'ShuttleUp Quận 7', address: '12 Nguyễn Thị Thập, Q.7, TP.HCM', image: '/assets/img/venue/venue-01.jpg', courtCount: 3, activeCourts: 3, totalBookingsThisMonth: 42, revenueThisMonth: 12400000, status: 'active', createdAt: '01/01/2026' },
  { id: 'v2', name: 'ShuttleUp Bình Thạnh', address: '45 Đinh Tiên Hoàng, Q.Bình Thạnh, TP.HCM', image: '/assets/img/venue/venue-02.jpg', courtCount: 2, activeCourts: 2, totalBookingsThisMonth: 28, revenueThisMonth: 8500000, status: 'active', createdAt: '15/01/2026' },
  { id: 'v3', name: 'Cầu lông Gò Vấp', address: '88 Quang Trung, Q.Gò Vấp, TP.HCM', image: '/assets/img/venue/venue-03.jpg', courtCount: 4, activeCourts: 2, totalBookingsThisMonth: 15, revenueThisMonth: 3200000, status: 'inactive', createdAt: '01/02/2026' },
  { id: 'v4', name: 'ShuttleUp Thủ Đức', address: '15 Hoàng Diệu 2, TP.Thủ Đức, TP.HCM', image: '/assets/img/venue/venue-04.jpg', courtCount: 5, activeCourts: 5, totalBookingsThisMonth: 60, revenueThisMonth: 18000000, status: 'active', createdAt: '10/02/2026' },
  { id: 'v5', name: 'ShuttleUp Tân Bình', address: '200 Nam Kỳ Khởi Nghĩa, Q.Tân Bình, TP.HCM', image: '/assets/img/venue/venue-05.jpg', courtCount: 3, activeCourts: 1, totalBookingsThisMonth: 9, revenueThisMonth: 2100000, status: 'pending', createdAt: '20/02/2026' },
];

const STATUS_STYLES = {
  public: { label: 'Public', bg: '#dcfce7', color: '#15803d' },
  draft:  { label: 'Draft', bg: '#f1f5f9', color: '#64748b' },
};

const SORT_OPTIONS = [
  { value: 'name_asc',      label: 'Tên sân (A → Z)' },
  { value: 'name_desc',     label: 'Tên sân (Z → A)' },
  { value: 'revenue_desc',  label: 'Doanh thu (Cao → Thấp)' },
  { value: 'revenue_asc',   label: 'Doanh thu (Thấp → Cao)' },
  { value: 'status_active', label: 'Trạng thái (Public trước)' },
];

const PAGE_SIZE = 4;

/* ── Sort dropdown ─────────────────────────────────────────────────────── */
function SortDropdown({ sort, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.value === sort) || SORT_OPTIONS[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mgr-btn-lift"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 14px', border: '2px solid var(--mgr-accent)', borderRadius: 8,
          background: open ? 'var(--mgr-accent)' : '#fff',
          color: open ? '#fff' : '#334155',
          fontWeight: 600, fontSize: 13.5, cursor: 'pointer', transition: 'all .15s',
          minWidth: 0,
        }}
      >
        <i className="feather-sliders" style={{ fontSize: 15 }} />
        <span style={{ display: 'none' }}>Sắp xếp</span>
        <i className={`feather-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 14 }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 300, minWidth: 230, overflow: 'hidden',
          animation: 'mgr-dd-in .15s ease',
        }}>
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Sắp xếp theo
          </div>
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px',
                border: 'none', background: sort === o.value ? 'rgba(251,191,36,.12)' : 'none',
                fontSize: 13.5, fontWeight: sort === o.value ? 700 : 400, cursor: 'pointer',
                color: sort === o.value ? '#92400e' : '#334155', textAlign: 'left',
                transition: 'background .12s',
              }}
            >
              {sort === o.value && <i className="feather-check" style={{ fontSize: 14, color: '#097E52', flexShrink: 0 }} />}
              <span style={{ marginLeft: sort === o.value ? 0 : 20 }}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Pagination ─────────────────────────────────────────────────────────── */
function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 }}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="mgr-btn-lift"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px',
          border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13,
          fontWeight: 600, color: page <= 1 ? '#cbd5e1' : '#334155', cursor: page <= 1 ? 'default' : 'pointer',
          transition: 'all .15s',
        }}
      >
        <i className="feather-chevron-left" style={{ fontSize: 15 }} /> Trước
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className="mgr-btn-lift"
          style={{
            width: 38, height: 38, borderRadius: 8, border: 'none',
            background: page === p ? 'var(--mgr-accent)' : '#f1f5f9',
            color: page === p ? '#fff' : '#334155',
            fontWeight: page === p ? 800 : 500, fontSize: 14,
            cursor: 'pointer', transition: 'all .15s',
            boxShadow: page === p ? '0 2px 8px rgba(9,126,82,.35)' : 'none',
          }}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="mgr-btn-lift"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px',
          border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13,
          fontWeight: 600, color: page >= totalPages ? '#cbd5e1' : '#334155',
          cursor: page >= totalPages ? 'default' : 'pointer', transition: 'all .15s',
        }}
      >
        Sau <i className="feather-chevron-right" style={{ fontSize: 15 }} />
      </button>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */
export default function ManagerVenueList() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sort, setSort]               = useState('name_asc');
  const [page, setPage]               = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [viewMode, setViewMode]       = useState('grid'); // 'grid' | 'list'
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  const totalCourts   = venues.reduce((s, v) => s + (v.courtCount ?? 0), 0);
  const totalBookings = venues.reduce((s, v) => s + (v.totalBookingsThisMonth ?? 0), 0);
  const totalRevenue  = venues.reduce((s, v) => s + (v.revenueThisMonth ?? 0), 0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/manager/venues?page=1&pageSize=100`);
        const items = res?.items ?? res?.data?.items ?? [];

        const mapped = (items || []).map((v) => {
          const status = v?.isActive ? 'public' : 'draft';

          return {
            id: v?.id,
            name: v?.name ?? '',
            address: v?.address ?? '',
            image: '/assets/img/venue/venue-01.jpg',
            courtCount: v?.courtCount ?? 0,
            activeCourts: v?.activeCourts ?? 0,
            totalBookingsThisMonth: v?.totalBookingsThisMonth ?? 0,
            revenueThisMonth: v?.revenueThisMonth ?? 0,
            status,
            createdAt: v?.createdAt ?? '',
          };
        });

        if (mounted) setVenues(mapped);
      } catch (e) {
        console.error('Failed to load managed venues', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const sorted = useMemo(() => {
    const arr = venues.filter((v) => {
      const ms = v.name.toLowerCase().includes(search.toLowerCase()) || v.address.toLowerCase().includes(search.toLowerCase());
      const mf = filterStatus === 'all' || v.status === filterStatus;
      return ms && mf;
    });
    switch (sort) {
      case 'name_asc':      return [...arr].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      case 'name_desc':     return [...arr].sort((a, b) => b.name.localeCompare(a.name, 'vi'));
      case 'revenue_desc':  return [...arr].sort((a, b) => b.revenueThisMonth - a.revenueThisMonth);
      case 'revenue_asc':   return [...arr].sort((a, b) => a.revenueThisMonth - b.revenueThisMonth);
      case 'status_active': return [...arr].sort((a) => (a.status === 'public' ? -1 : 1));
      default:              return arr;
    }
  }, [venues, search, filterStatus, sort]);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearchChange = (e) => { setSearch(e.target.value); setPage(1); };
  const handleFilterChange = (e) => { setFilterStatus(e.target.value); setPage(1); };
  const handleSortChange   = (v) => { setSort(v); setPage(1); };

  const handleDelete = () => {
    if (!deleteModal) return;
    setVenues((prev) => prev.filter((v) => v.id !== deleteModal.id));
    setDeleteModal(null);
  };

  const handlePublish = async (venue) => {
    try {
      setActionMessage({ type: '', text: '' });
      await axiosClient.put(`/manager/venues/${venue.id}/publish`);
      setVenues((prev) => prev.map((v) => v.id === venue.id ? { ...v, status: 'public' } : v));
      setActionMessage({ type: 'success', text: `Đã publish cụm sân "${venue.name}" thành công!` });
    } catch (e) {
      setActionMessage({ type: 'danger', text: e.response?.data?.message || 'Lỗi khi publish cụm sân' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUnpublish = async (venue) => {
    try {
      setActionMessage({ type: '', text: '' });
      await axiosClient.put(`/manager/venues/${venue.id}/unpublish`);
      setVenues((prev) => prev.map((v) => v.id === venue.id ? { ...v, status: 'draft' } : v));
      setActionMessage({ type: 'warning', text: `Đã unpublish cụm sân "${venue.name}" thành công. Sân đã bị ẩn khỏi người chơi.` });
    } catch (e) {
      setActionMessage({ type: 'danger', text: e.response?.data?.message || 'Lỗi khi unpublish cụm sân' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {actionMessage.text && (
        <div className="alert d-flex align-items-center mb-4 shadow-sm" style={{ borderRadius: 10, border: 'none', padding: '14px 20px', background: actionMessage.type === 'danger' ? '#fef2f2' : (actionMessage.type === 'success' ? '#f0fdf4' : '#fffbeb'), color: actionMessage.type === 'danger' ? '#991b1b' : (actionMessage.type === 'success' ? '#166534' : '#92400e') }}>
          <i className={`feather-${actionMessage.type === 'success' ? 'check-circle' : 'alert-circle'} fs-5 me-2`} />
          <span className="fw-medium">{actionMessage.text}</span>
          <button type="button" className="btn-close ms-auto" style={{ filter: 'opacity(0.5)' }} onClick={() => setActionMessage({ type: '', text: '' })}></button>
        </div>
      )}

      {/* ── Stats ────────────────────────────────────────── */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Tổng cụm sân',       value: venues.length,                                icon: 'feather-map-pin',      variant: 'green' },
          { label: 'Tổng sân',            value: totalCourts,                                  icon: 'feather-grid',         variant: 'blue' },
          { label: 'Đặt sân tháng này',   value: totalBookings,                                icon: 'feather-calendar',     variant: 'amber' },
          { label: 'Doanh thu tháng',     value: (totalRevenue / 1000000).toFixed(1) + ' tr ₫', icon: 'feather-trending-up',  variant: 'teal' },
        ].map((s) => (
          <div key={s.label} className="col-xl-3 col-sm-6">
            <div className={`mgr-stat-card mgr-stat-card--${s.variant}`}>
              <div className="mgr-stat-card__icon">
                <i className={s.icon} />
              </div>
              <div>
                <div className="mgr-stat-card__label">{s.label}</div>
                <div className="mgr-stat-card__value">{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="card border-0 mb-4" style={{ borderRadius: 'var(--mgr-radius)', boxShadow: 'var(--mgr-shadow)' }}>
        <div className="card-body py-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search */}
            <div className="bk-search-wrap" style={{ flex: '1 1 260px', maxWidth: 420 }}>
              <i className="feather-search bk-search-icon" />
              <input
                type="text" className="form-control bk-search-input"
                placeholder="Tìm kiếm cụm sân..."
                value={search} onChange={handleSearchChange}
              />
              {search && (
                <button type="button" className="bk-search-clear" onClick={() => { setSearch(''); setPage(1); }}>
                  <i className="feather-x" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <select
              className="form-select"
              style={{ width: 180, flex: '0 0 auto' }}
              value={filterStatus} onChange={handleFilterChange}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
              <option value="pending">Chờ duyệt</option>
            </select>

            {/* View toggle */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap', marginRight: 4 }}>Hiển thị</span>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="mgr-btn-lift"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 8, border: '1.5px solid',
                  borderColor: viewMode === 'grid' ? 'var(--mgr-accent)' : '#e2e8f0',
                  background: viewMode === 'grid' ? 'var(--mgr-accent)' : '#fff',
                  color: viewMode === 'grid' ? '#fff' : '#64748b',
                  cursor: 'pointer', transition: 'all .15s',
                }}
                title="Dạng lưới"
              >
                <i className="feather-grid" style={{ fontSize: 16 }} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="mgr-btn-lift"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 8, border: '1.5px solid',
                  borderColor: viewMode === 'list' ? 'var(--mgr-accent)' : '#e2e8f0',
                  background: viewMode === 'list' ? 'var(--mgr-accent)' : '#fff',
                  color: viewMode === 'list' ? '#fff' : '#64748b',
                  cursor: 'pointer', transition: 'all .15s',
                }}
                title="Dạng danh sách"
              >
                <i className="feather-list" style={{ fontSize: 16 }} />
              </button>
            </div>

            {/* Sort */}
            <SortDropdown sort={sort} onChange={handleSortChange} />

            {/* Result count */}
            {(search || filterStatus !== 'all') && (
              <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                {sorted.length} kết quả
              </span>
            )}

            {/* Add CTA */}
            <div style={{ marginLeft: 'auto' }}>
              <Link
                to="/manager/venues/add"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 20px', borderRadius: 9,
                  background: 'var(--mgr-accent)', color: '#fff',
                  fontWeight: 700, fontSize: 14, textDecoration: 'none',
                  boxShadow: '0 3px 12px rgba(9,126,82,.3)',
                  transition: 'all .18s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#066D46'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--mgr-accent)'; e.currentTarget.style.transform = ''; }}
              >
                <i className="feather-plus-circle" style={{ fontSize: 18 }} />
                Thêm cụm sân mới
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Venue Cards ──────────────────────────────────── */}
      {paginated.length === 0 ? (
        <div className="card border-0" style={{ borderRadius: 'var(--mgr-radius)', boxShadow: 'var(--mgr-shadow)' }}>
          <div className="card-body text-center" style={{ padding: '60px 20px' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <i className="feather-map-pin" style={{ fontSize: 28, color: '#94a3b8' }} />
            </div>
            <h5 style={{ color: '#334155', marginBottom: 6 }}>Không tìm thấy cụm sân</h5>
            <p className="text-muted mb-3">Thử điều chỉnh bộ lọc hoặc thêm cụm sân mới</p>
            <Link to="/manager/venues/add" className="btn btn-secondary btn-sm">
              <i className="feather-plus-circle" /> Thêm cụm sân
            </Link>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* ── List View ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {paginated.map((venue) => {
            const st = STATUS_STYLES[venue.status] || STATUS_STYLES.active;
            return (
              <div key={venue.id} className="card border-0" style={{ borderRadius: 'var(--mgr-radius)', boxShadow: 'var(--mgr-shadow)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <div style={{ width: 180, minHeight: 140, flexShrink: 0, position: 'relative', overflow: 'hidden', borderRadius: 'var(--mgr-radius) 0 0 var(--mgr-radius)' }}>
                    <img
                      src={venue.image} alt={venue.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }}
                    />
                    <span style={{ position: 'absolute', top: 10, left: 10, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                    <Link to={`/manager/venues/${venue.id}/courts`} style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', textDecoration: 'none' }}>
                      {venue.name}
                    </Link>
                    <div style={{ fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <i className="feather-map-pin" style={{ fontSize: 12 }} />
                      {venue.address}
                    </div>
                    <div style={{ display: 'flex', gap: 20, marginTop: 4, fontSize: 13 }}>
                      <div><strong>{venue.activeCourts}</strong><span style={{ color: '#94a3b8' }}>/{venue.courtCount} sân</span></div>
                      <div><strong>{venue.totalBookingsThisMonth}</strong><span style={{ color: '#94a3b8' }}> đặt sân</span></div>
                      <div style={{ color: '#097E52', fontWeight: 700 }}>{(venue.revenueThisMonth / 1000000).toFixed(1)}tr ₫</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', flexShrink: 0 }}>
                    {venue.status === 'draft' ? (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => handlePublish(venue)}>
                        <i className="feather-upload" /> Publish
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm btn-warning" onClick={() => handleUnpublish(venue)}>
                        <i className="feather-eye-off" /> Unpublish
                      </button>
                    )}
                    <Link to={`/manager/venues/${venue.id}/courts`} className="btn btn-sm btn-outline-secondary">
                      <i className="feather-grid" /> Xem sân
                    </Link>
                    <Link to={`/manager/venues/${venue.id}/edit`} className="btn btn-sm btn-secondary">
                      <i className="feather-edit-2" /> Sửa
                    </Link>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setDeleteModal(venue)}
                      style={{ width: 36, padding: '7px 0', justifyContent: 'center' }}
                    >
                      <i className="feather-trash-2" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Grid View ── */
        <div className="row g-4">
          {paginated.map((venue) => {
            const st = STATUS_STYLES[venue.status] || STATUS_STYLES.active;
            return (
              <div key={venue.id} className="col-xl-4 col-md-6">
                <div className="mgr-venue-card">
                  <div className="mgr-venue-card__img">
                    <img
                      src={venue.image} alt={venue.name}
                      onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }}
                    />
                    <span className="mgr-venue-card__badge" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="mgr-venue-card__body">
                    <Link to={`/manager/venues/${venue.id}/courts`} className="mgr-venue-card__name">
                      {venue.name}
                    </Link>
                    <div className="mgr-venue-card__addr">
                      <i className="feather-map-pin" style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }} />
                      {venue.address}
                    </div>
                    <div className="mgr-venue-card__stats">
                      <div className="mgr-venue-card__stat-item">
                        <div className="mgr-venue-card__stat-val">
                          {venue.activeCourts}<span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>/{venue.courtCount}</span>
                        </div>
                        <div className="mgr-venue-card__stat-lbl">Sân hoạt động</div>
                      </div>
                      <div className="mgr-venue-card__stat-item">
                        <div className="mgr-venue-card__stat-val">{venue.totalBookingsThisMonth}</div>
                        <div className="mgr-venue-card__stat-lbl">Đặt sân</div>
                      </div>
                      <div className="mgr-venue-card__stat-item">
                        <div className="mgr-venue-card__stat-val" style={{ color: '#0d7c5f' }}>
                          {(venue.revenueThisMonth / 1000000).toFixed(1)}tr
                        </div>
                        <div className="mgr-venue-card__stat-lbl">Doanh thu</div>
                      </div>
                    </div>
                  </div>
                  <div className="mgr-venue-card__footer">
                    <Link to={`/manager/venues/${venue.id}/courts`} className="btn btn-sm btn-secondary" style={{ flex: 1 }}>
                      <i className="feather-grid" /> Quản lý sân
                    </Link>
                    <Link to={`/manager/venues/${venue.id}/edit`} className="btn btn-sm btn-outline-secondary" style={{ flex: 0, padding: '7px 14px' }}>
                      <i className="feather-edit-2" />
                    </Link>
                    {venue.status === 'draft' ? (
                      <button type="button" className="btn btn-sm btn-outline-secondary" style={{ flex: 0, padding: '7px 14px' }} onClick={() => handlePublish(venue)} title="Publish">
                        <i className="feather-upload" />
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm btn-outline-secondary" style={{ flex: 0, padding: '7px 14px', color: '#d97706', borderColor: '#fbbf24' }} onClick={() => handleUnpublish(venue)} title="Unpublish">
                        <i className="feather-eye-off" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setDeleteModal(venue)}
                      style={{ flex: 0, padding: '7px 12px' }}
                      title="Xoá"
                    >
                      <i className="feather-trash-2" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────── */}
      <Pagination page={page} total={sorted.length} pageSize={PAGE_SIZE} onChange={setPage} />

      {/* ── Delete confirm ───────────────────────────────── */}
      {deleteModal && (
        <div className="mgr-delete-modal" onClick={() => setDeleteModal(null)}>
          <div className="mgr-delete-modal__box" onClick={(e) => e.stopPropagation()}>
            <div className="mgr-delete-modal__icon">
              <i className="feather-alert-triangle" />
            </div>
            <h5>Xoá cụm sân?</h5>
            <p>Bạn có chắc muốn xoá <strong>{deleteModal.name}</strong>? Tất cả sân và dữ liệu liên quan sẽ bị xoá.</p>
            <div className="mgr-delete-modal__actions">
              <button className="btn btn-outline-secondary" onClick={() => setDeleteModal(null)}>Huỷ</button>
              <button className="btn btn-danger" onClick={handleDelete}>Xoá cụm sân</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
