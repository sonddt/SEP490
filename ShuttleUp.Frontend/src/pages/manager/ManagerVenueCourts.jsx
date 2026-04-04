import { useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

/* ── Constants ──────────────────────────────────────────────────────────── */
const TYPE_MAP = {
  'Đơn':       { color: '#2563eb', bg: '#eff6ff',  icon: 'feather-user' },
  'Đôi':       { color: '#7c3aed', bg: '#f5f3ff',  icon: 'feather-users' },
  'Đơn / Đôi': { color: '#0d7c5f', bg: '#e8f5ee', icon: 'feather-users' },
};

/* Values that are status-like, not actual court types — skip the type badge */
const STATUS_LIKE = ['ACTIVE', 'INACTIVE', 'ON', 'OFF', 'ENABLED', 'DISABLED'];
function isRealCourtType(type) {
  if (!type) return false;
  return !STATUS_LIKE.includes(type.toUpperCase().trim());
}

/* ── Pagination ─────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '20px 0' }}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}
        className="vc-pg-btn" style={{ opacity: page <= 1 ? 0.4 : 1 }}>
        <i className="feather-chevron-left" /> Trước
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button key={p} type="button" onClick={() => onChange(p)}
          className={`vc-pg-num${p === page ? ' active' : ''}`}>{p}</button>
      ))}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}
        className="vc-pg-btn" style={{ opacity: page >= totalPages ? 0.4 : 1 }}>
        Sau <i className="feather-chevron-right" />
      </button>
    </div>
  );
}

/* ═══ MAIN ═══════════════════════════════════════════════════════════════ */
export default function ManagerVenueCourts() {
  const { venueId } = useParams();
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterTab, setFilterTab] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [deleteModal, setDeleteModal] = useState(null);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
  const itemsPerPage = 12;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get(`/manager/venues/${venueId}/courts?page=1&pageSize=100`);
        if (!mounted) return;
        setCourts(res?.items || res?.data?.items || []);
      } catch (e) {
        console.error('Failed to load courts', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (venueId) load();
    return () => { mounted = false; };
  }, [venueId]);

  const toggleStatus = async (court) => {
    try {
      const nextStatus = !court.status;
      await axiosClient.patch(`/manager/venues/${venueId}/courts/${court.id}/status`, { isActive: nextStatus });
      setCourts(prev => prev.map(c => c.id === court.id ? { ...c, status: nextStatus } : c));
    } catch (e) {
      console.error('Failed to update court status', e);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await axiosClient.delete(`/manager/venues/${venueId}/courts/${deleteModal.id}`);
      setCourts(prev => prev.filter(c => c.id !== deleteModal.id));
      setDeleteModal(null);
    } catch (e) {
      console.error('Failed to delete court', e);
    }
  };

  let filtered = courts.filter(c => {
    if (filterTab === 'active') return c.status;
    if (filterTab === 'inactive') return !c.status;
    return true;
  });
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || (c.type || '').toLowerCase().includes(q) || (c.surface || '').toLowerCase().includes(q));
  }
  if (sortBy === 'price') filtered = [...filtered].sort((a, b) => a.pricePerHour - b.pricePerHour);
  if (sortBy === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentItems = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => { setPage(1); }, [search, filterTab, sortBy]);

  const activeCourts = courts.filter(c => c.status).length;
  const inactiveCourts = courts.filter(c => !c.status).length;
  const avgPrice = courts.length > 0 ? Math.round(courts.reduce((s, c) => s + (c.pricePerHour || 0), 0) / courts.length) : 0;

  return (
    <>
      {/* ── Hero Header ─────────────────────────────── */}
      <div className="vc-hero">
        <div className="vc-hero__left">
          <Link to="/manager/venues" className="vc-hero__back">
            <i className="feather-arrow-left" />
          </Link>
          <div>
            <h2 className="vc-hero__title">Quản lý Sân con</h2>
            <p className="vc-hero__sub">
              <i className="feather-map-pin" style={{ fontSize: 13 }} />
              Cụm sân · {courts.length} sân
            </p>
          </div>
        </div>
        <div className="d-flex gap-2">
          <Link to={`/manager/venues/${venueId}/coupons`} className="btn fw-semibold" style={{ background: '#fef3c7', color: '#d97706', border: 'none' }}>
            <i className="feather-tag" /> Quản lý Voucher
          </Link>
          <Link to={`/manager/venues/${venueId}/courts/add`} className="btn btn-secondary vc-hero__cta">
            <i className="feather-plus-circle" /> Thêm sân mới
          </Link>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────── */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Tổng số sân', value: courts.length, icon: 'feather-grid', variant: 'blue' },
          { label: 'Đang hoạt động', value: activeCourts, icon: 'feather-check-circle', variant: 'green' },
          { label: 'Tạm ngưng', value: inactiveCourts, icon: 'feather-pause-circle', variant: 'red' },
          { label: 'Giá TB / giờ', value: avgPrice > 0 ? `${avgPrice.toLocaleString('vi-VN')}₫` : '—', icon: 'feather-tag', variant: 'amber' },
        ].map(s => (
          <div key={s.label} className="col-xl-3 col-sm-6">
            <div className={`mgr-stat-card mgr-stat-card--${s.variant}`}>
              <div className="mgr-stat-card__icon"><i className={s.icon} /></div>
              <div>
                <div className="mgr-stat-card__label">{s.label}</div>
                <div className="mgr-stat-card__value">{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────── */}
      <div className="vc-toolbar">
        <div className="vc-toolbar__filters">
          <div className="mgr-filter-tabs">
            {[
              { key: 'all', label: 'Tất cả', count: courts.length },
              { key: 'active', label: 'Hoạt động', count: activeCourts },
              { key: 'inactive', label: 'Tạm ngưng', count: inactiveCourts },
            ].map(t => (
              <button key={t.key} type="button"
                className={`mgr-filter-tab${filterTab === t.key ? ' active' : ''}`}
                onClick={() => setFilterTab(t.key)}>
                {t.label}
                <span className="mgr-filter-tab__count">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="vc-toolbar__right">
          <div className="bk-search-wrap" style={{ width: 200 }}>
            <i className="feather-search bk-search-icon" />
            <input type="text" className="form-control bk-search-input"
              placeholder="Tìm sân..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button type="button" className="bk-search-clear" onClick={() => setSearch('')}><i className="feather-x" /></button>}
          </div>
          <select className="form-select vc-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="default">Sắp xếp</option>
            <option value="price">Giá tăng dần</option>
            <option value="name">Tên A→Z</option>
          </select>
          <div className="vc-view-toggle">
            <button type="button" className={`vc-view-btn${viewMode === 'card' ? ' active' : ''}`} onClick={() => setViewMode('card')} title="Dạng thẻ"><i className="feather-grid" /></button>
            <button type="button" className={`vc-view-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => setViewMode('table')} title="Dạng bảng"><i className="feather-list" /></button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      {loading ? (
        <div className="vc-loading">
          <div className="spinner-border text-success" role="status" />
          <p>Đang tải danh sách sân...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="vc-empty">
          <div className="vc-empty__icon"><i className={search ? 'feather-search' : 'feather-inbox'} /></div>
          <h5>{search ? `Không tìm thấy "${search}"` : 'Chưa có sân nào'}</h5>
          <p>
            {search ? 'Thử tìm với từ khoá khác' : 'Bắt đầu bằng cách thêm sân mới cho cụm sân này'}
          </p>
          {!search && (
            <Link to={`/manager/venues/${venueId}/courts/add`} className="btn btn-secondary">
              <i className="feather-plus-circle" /> Thêm sân mới
            </Link>
          )}
        </div>
      ) : viewMode === 'card' ? (
        /* ── Card View ── */
        <div className="row g-3">
          {currentItems.map(court => {
            const tp = TYPE_MAP[court.type] || TYPE_MAP['Đơn / Đôi'];
            return (
              <div key={court.id} className="col-xl-4 col-lg-6">
                <div className={`vc-court-card${!court.status ? ' vc-court-card--inactive' : ''}`}>
                  {/* Image */}
                  <div className="vc-court-card__img">
                    <img src={court.image || '/assets/img/booking/booking-01.jpg'} alt={court.name}
                      onError={e => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
                    <div className={`vc-court-card__status ${court.status ? 'vc-court-card__status--active' : 'vc-court-card__status--off'}`}>
                      <span className="vc-court-card__status-dot" />
                      {court.status ? 'Hoạt động' : 'Tạm ngưng'}
                    </div>
                    {isRealCourtType(court.type) && (
                      <span className="vc-court-card__type" style={{ background: tp.bg, color: tp.color }}>
                        <i className={tp.icon} style={{ fontSize: 12 }} /> {court.type}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="vc-court-card__body">
                    <div className="vc-court-card__top">
                      <h4 className="vc-court-card__name">{court.name}</h4>
                      <div className="vc-court-card__price">
                        {(court.pricePerHour || 0).toLocaleString('vi-VN')} <small>₫/giờ</small>
                      </div>
                    </div>
                    <div className="vc-court-card__meta">
                      {court.surface && (
                        <span className="vc-court-card__tag">
                          <i className="feather-layers" style={{ fontSize: 12 }} /> {court.surface}
                        </span>
                      )}
                      <span className="vc-court-card__tag">
                        <i className="feather-users" style={{ fontSize: 12 }} /> Tối đa {court.maxGuest || '—'} người
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="vc-court-card__footer">
                    <div className="vc-court-card__toggle">
                      <div className="mgr-toggle">
                        <div className="status-toggle d-inline-flex align-items-center">
                          <input type="checkbox" id={`cs_${court.id}`} className="check"
                            checked={court.status} onChange={() => toggleStatus(court)} />
                          <label htmlFor={`cs_${court.id}`} className="checktoggle">checkbox</label>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: court.status ? '#097E52' : '#94a3b8', fontWeight: 600 }}>
                        {court.status ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div className="vc-court-card__actions">
                      <Link to={`/manager/venues/${venueId}/courts/${court.id}/edit`}
                        className="vc-court-card__action-btn vc-court-card__action-btn--edit" title="Chỉnh sửa">
                        <i className="feather-edit-2" />
                        <span>Sửa</span>
                      </Link>
                      <button type="button" className="vc-court-card__action-btn vc-court-card__action-btn--danger"
                        onClick={() => setDeleteModal(court)} title="Xoá">
                        <i className="feather-trash-2" />
                        <span>Xoá</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table View ── */
        <div className="card border-0">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ minWidth: 200 }}>Tên sân</th>
                    <th>Loại</th>
                    <th>Mặt sân</th>
                    <th>Giá/giờ</th>
                    <th>Người tối đa</th>
                    <th>Trạng thái</th>
                    <th style={{ width: 100 }} />
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map(court => {
                    const tp = TYPE_MAP[court.type] || TYPE_MAP['Đơn / Đôi'];
                    return (
                      <tr key={court.id}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <img className="mgr-court-img" src={court.image || '/assets/img/booking/booking-01.jpg'}
                              alt="" onError={e => { e.target.src = '/assets/img/booking/booking-01.jpg'; }} />
                            <span className="mgr-court-name">{court.name}</span>
                          </div>
                        </td>
                        <td>
                          {isRealCourtType(court.type) ? (
                            <span className="vc-type-badge" style={{ background: tp.bg, color: tp.color }}>
                              <i className={tp.icon} style={{ fontSize: 11 }} /> {court.type}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: 14 }}>{court.surface || '—'}</td>
                        <td><span className="mgr-price-tag">{(court.pricePerHour || 0).toLocaleString('vi-VN')} ₫</span></td>
                        <td style={{ fontSize: 14 }}><i className="feather-users" style={{ fontSize: 13, color: '#94a3b8', marginRight: 4 }} />{court.maxGuest || '—'}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="mgr-toggle">
                              <div className="status-toggle d-inline-flex align-items-center">
                                <input type="checkbox" id={`tcs_${court.id}`} className="check" checked={court.status} onChange={() => toggleStatus(court)} />
                                <label htmlFor={`tcs_${court.id}`} className="checktoggle">checkbox</label>
                              </div>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: court.status ? '#097E52' : '#94a3b8' }}>
                              {court.status ? 'Hoạt động' : 'Tắt'}
                            </span>
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="d-flex align-items-center justify-content-end gap-2">
                            <Link to={`/manager/venues/${venueId}/courts/${court.id}/edit`}
                              className="vc-action-icon vc-action-icon--edit" title="Chỉnh sửa"><i className="feather-edit-2" /></Link>
                            <button type="button" onClick={() => setDeleteModal(court)}
                              className="vc-action-icon vc-action-icon--delete" title="Xoá"><i className="feather-trash-2" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="card-footer bg-white border-0"><Pagination page={page} totalPages={totalPages} onChange={setPage} /></div>
          )}
        </div>
      )}

      {viewMode === 'card' && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}

      {/* ── Delete Modal ─────────────────────────────── */}
      {deleteModal && (
        <div className="mgr-delete-modal" onClick={() => setDeleteModal(null)}>
          <div className="mgr-delete-modal__box" onClick={e => e.stopPropagation()}>
            <div className="mgr-delete-modal__icon"><i className="feather-alert-triangle" /></div>
            <h5>Xoá sân?</h5>
            <p>Bạn có chắc muốn xoá <strong>{deleteModal.name}</strong>? Hành động này không thể hoàn tác.</p>
            <div className="mgr-delete-modal__actions">
              <button className="btn btn-outline-secondary" onClick={() => setDeleteModal(null)}>Huỷ</button>
              <button className="btn btn-danger" onClick={handleDelete}>Xoá sân</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
