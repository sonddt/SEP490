import { useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

import axiosClient from '../../api/axiosClient';

// Pagination Component
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className="d-flex align-items-center justify-content-center gap-2 mt-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px',
          border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13,
          fontWeight: 600, color: page <= 1 ? '#cbd5e1' : '#334155',
          cursor: page <= 1 ? 'default' : 'pointer', transition: 'all .15s',
        }}
      >
        <i className="feather-chevron-left" style={{ fontSize: 15 }} /> Trước
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
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

const TYPE_COLORS = { 'Đơn': '#2563eb', 'Đôi': '#7c3aed', 'Đơn / Đôi': '#0d7c5f' };

export default function ManagerVenueCourts() {
  const { venueId } = useParams();
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterTab, setFilterTab] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [deleteModal, setDeleteModal] = useState(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

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
      setCourts((prev) => prev.map((c) => c.id === court.id ? { ...c, status: nextStatus } : c));
    } catch (e) {
      console.error('Failed to update court status', e);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await axiosClient.delete(`/manager/venues/${venueId}/courts/${deleteModal.id}`);
      setCourts((prev) => prev.filter((c) => c.id !== deleteModal.id));
      setDeleteModal(null);
    } catch (e) {
      console.error('Failed to delete court', e);
    }
  };

  let filtered = courts.filter((c) => {
    if (filterTab === 'active') return c.status;
    if (filterTab === 'inactive') return !c.status;
    return true;
  });

  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q) || c.surface.toLowerCase().includes(q));
  }

  if (sortBy === 'price') filtered = [...filtered].sort((a, b) => a.pricePerHour - b.pricePerHour);
  if (sortBy === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentItems = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Reset page when search or filter changes
  useEffect(() => { setPage(1); }, [search, filterTab, sortBy]);

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4 border-bottom pb-4">
        <Link to="/manager/venues" className="btn btn-light shadow-sm d-flex align-items-center justify-content-center" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <i className="feather-arrow-left fs-5" />
        </Link>
        <div>
          <h3 className="mb-0 fw-bold text-dark" style={{ fontSize: 20 }}>Quản lý Sân con</h3>
          <p className="text-secondary mb-0 mt-1" style={{ fontSize: 14 }}>Xem và thao tác trên danh sách các sân thuộc cụm sân hiện tại</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
        <div className="mgr-filter-tabs">
          {[
            { key: 'all', label: 'Tất cả sân', count: courts.length },
            { key: 'active', label: 'Đang hoạt động', count: courts.filter(c => c.status).length },
            { key: 'inactive', label: 'Tạm ngưng', count: courts.filter(c => !c.status).length },
          ].map((t) => (
            <button
              key={t.key} type="button"
              className={`mgr-filter-tab${filterTab === t.key ? ' active' : ''}`}
              onClick={() => setFilterTab(t.key)}
            >
              {t.label}
              <span className="mgr-filter-tab__count">{t.count}</span>
            </button>
          ))}
        </div>
        <Link to={`/manager/venues/${venueId}/courts/add`} className="btn btn-secondary">
          <i className="feather-plus-circle" />Thêm sân mới
        </Link>
      </div>

      {/* Table */}
      <div className="card border-0">
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ background: '#fff' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Danh sách sân</h4>
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>
              {filtered.length} sân · {courts.filter((c) => c.status).length} đang hoạt động
            </span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="bk-search-wrap" style={{ width: 220 }}>
              <i className="feather-search bk-search-icon" />
              <input
                type="text" className="form-control bk-search-input"
                placeholder="Tìm sân..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 14 }}
              />
            </div>
            <select className="form-select" style={{ width: 140, fontSize: 14 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="default">Mặc định</option>
              <option value="price">Theo giá</option>
              <option value="name">Theo tên</option>
            </select>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Tên sân</th>
                  <th>Loại</th>
                  <th>Mặt sân</th>
                  <th>Giá/giờ</th>
                  <th>Tối đa</th>
                  <th>Ngày thêm</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 100 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-5" style={{ color: '#94a3b8' }}>
                      <i className="feather-inbox d-block mb-2" style={{ fontSize: 28 }} />
                      Không có sân nào
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={8} className="text-center py-5" style={{ color: '#94a3b8' }}>
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                )}
                {!loading && currentItems.map((court) => (
                  <tr key={court.id}>
                    <td>
                      <div className="d-flex align-items-center gap-3">
                        <img
                          className="mgr-court-img"
                          src={court.image || '/assets/img/booking/booking-01.jpg'}
                          alt=""
                          onError={(e) => { e.target.src = '/assets/img/booking/booking-01.jpg'; }}
                        />
                        <span className="mgr-court-name">{court.name}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${TYPE_COLORS[court.type] || '#64748b'}14`, color: TYPE_COLORS[court.type] || '#64748b' }}>
                        {court.type}
                      </span>
                    </td>
                    <td style={{ fontSize: 14 }}>{court.surface}</td>
                    <td><span className="mgr-price-tag">{court.pricePerHour.toLocaleString('vi-VN')} ₫</span></td>
                    <td style={{ fontSize: 14 }}>
                      <i className="feather-users" style={{ fontSize: 13, color: '#94a3b8', marginRight: 4 }} />
                      {court.maxGuest}
                    </td>
                    <td style={{ fontSize: 13, color: '#64748b' }}>{court.addedOn}</td>
                    <td>
                      <div className="mgr-toggle">
                        <div className="status-toggle d-inline-flex align-items-center">
                          <input
                            type="checkbox"
                            id={`cs_${court.id}`}
                            className="check"
                            checked={court.status}
                            onChange={() => toggleStatus(court)}
                          />
                          <label htmlFor={`cs_${court.id}`} className="checktoggle">checkbox</label>
                        </div>
                      </div>
                    </td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-2">
                        <Link to={`/manager/venues/${venueId}/courts/${court.id}/edit`} className="btn btn-sm btn-light d-inline-flex align-items-center justify-content-center border" style={{ width: 32, height: 32, borderRadius: 8, color: '#334155' }} title="Chỉnh sửa">
                          <i className="feather-edit-2" style={{ fontSize: 14 }} />
                        </Link>
                        <button type="button" onClick={() => setDeleteModal(court)} className="btn btn-sm btn-light d-inline-flex align-items-center justify-content-center border" style={{ width: 32, height: 32, borderRadius: 8, color: '#ef4444' }} title="Xoá sân">
                          <i className="feather-trash-2" style={{ fontSize: 14 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {!loading && totalPages > 1 && (
          <div className="card-footer bg-white border-0 pb-4 pt-2">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteModal && (
        <div className="mgr-delete-modal" onClick={() => setDeleteModal(null)}>
          <div className="mgr-delete-modal__box" onClick={(e) => e.stopPropagation()}>
            <div className="mgr-delete-modal__icon">
              <i className="feather-alert-triangle" />
            </div>
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
