import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';

import axiosClient from '../../api/axiosClient';
import ShuttleDateField from '../../components/ui/ShuttleDateField';

const PAGE_SIZE = 15;

export default function AdminRevenueStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState('REV_DESC');
  const [page, setPage] = useState(1);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const qs = params.toString();
      const result = await axiosClient.get(`/admin/stats/revenue${qs ? `?${qs}` : ''}`);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [startDate, endDate, searchText, sortMode]);

  // Client-side text search filter
  const filteredVenues = useMemo(() => {
    if (!data?.venuesData) return [];
    const query = searchText.trim().toLowerCase();
    if (!query) return data.venuesData;
    return data.venuesData.filter(v => 
      (v.venue && v.venue.toLowerCase().includes(query)) ||
      (v.owner && v.owner.toLowerCase().includes(query))
    );
  }, [data?.venuesData, searchText]);

  // Dynamically calculate dynamic metrics for currently filtered list
  const dynamicTotalRevenue = useMemo(() => {
    return filteredVenues.reduce((sum, v) => sum + (v.revenue || 0), 0);
  }, [filteredVenues]);

  const dynamicTotalBookings = useMemo(() => {
    return filteredVenues.reduce((sum, v) => sum + (v.totalBookings || 0), 0);
  }, [filteredVenues]);

  // Client-side sorting
  const sortedVenues = useMemo(() => {
    let result = [...filteredVenues];
    if (sortMode === 'REV_DESC') result.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    else if (sortMode === 'REV_ASC') result.sort((a, b) => (a.revenue || 0) - (b.revenue || 0));
    else if (sortMode === 'BOOK_DESC') result.sort((a, b) => (b.totalBookings || 0) - (a.totalBookings || 0));
    else if (sortMode === 'BOOK_ASC') result.sort((a, b) => (a.totalBookings || 0) - (b.totalBookings || 0));
    return result;
  }, [filteredVenues, sortMode]);

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(sortedVenues.length / PAGE_SIZE));
  const displayedVenues = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedVenues.slice(start, start + PAGE_SIZE);
  }, [sortedVenues, page]);

  const handleExport = () => {
    try {
      const rows = sortedVenues.map((v, idx) => ({
        'STT': idx + 1,
        'Sân': v.venue,
        'Chủ sân': v.owner,
        'Tổng đặt sân': v.totalBookings,
        'Doanh thu (VNĐ)': v.revenue,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Doanh thu');
      XLSX.writeFile(wb, `thong-ke-doanh-thu-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      // ignore
    }
  };

  const STAT_CONFIG = [
    { key: 'totalRevenue',  label: 'Tổng doanh thu',        icon: 'feather-dollar-sign',  theme: 'indigo', value: `${dynamicTotalRevenue.toLocaleString('vi-VN')} ₫`, isText: true },
    { key: 'totalBookings', label: 'Tổng đặt sân',          icon: 'feather-calendar',     theme: 'green',  value: `${dynamicTotalBookings.toLocaleString('vi-VN')} lượt`, isText: false },
    { key: 'activeVenues',  label: 'Sân đang hoạt động',    icon: 'feather-map-pin',      theme: 'red',    value: (data?.summary?.activeVenues?.toString() || '0'), isText: false },
  ];

  return (
    <>
      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span><i className="feather-alert-triangle me-2"></i>Không thể tải dữ liệu: {error}</span>
          <button className="btn btn-sm btn-outline-danger" onClick={fetchStats}>Thử lại</button>
        </div>
      )}

      {/* ── Revenue Summary Cards ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
        {STAT_CONFIG.map((s) => (
          <div key={s.key} className={`adm-stat-card adm-stat-card--${s.theme}`}>
            <div className="adm-stat-card__icon">
              <i className={s.icon} />
            </div>
            <div>
              <div className="adm-stat-card__label">{s.label}</div>
              <div className="adm-stat-card__value" style={s.isText ? { fontSize: 22 } : {}}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Revenue by Venue Table ────────────────────── */}
      <div className="card card-tableset">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h4 className="mb-1">Doanh thu theo Sân</h4>
              <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>Tổng hợp doanh thu của từng địa điểm</p>
            </div>
            <button
              className="btn btn-sm"
              style={{ background: '#e8f5ee', color: '#097E52', border: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              onClick={handleExport}
              title="Xuất Excel"
              disabled={loading || !(filteredVenues.length > 0)}
            >
              <i className="feather-download" style={{ fontSize: 14 }} /> Xuất Excel
            </button>
          </div>

          <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
            {/* Custom Datepicker input matching calendar popup */}
            <div className="d-flex align-items-center gap-2">
              <label style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', marginBottom: 0 }}>Từ ngày</label>
              <div style={{ width: 160 }}>
                <ShuttleDateField
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <label style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', marginBottom: 0 }}>Đến ngày</label>
              <div style={{ width: 160 }}>
                <ShuttleDateField
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </div>

            {/* Search Input Box */}
            <div style={{ position: 'relative', width: 260 }}>
              <i className="feather-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 32, height: '38px', borderRadius: '8px' }}
                placeholder="Tìm tên sân, chủ sân..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button
                  type="button"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                  onClick={() => setSearchText('')}
                ><i className="feather-x" /></button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div style={{ width: 190 }}>
              <select className="form-select" style={{ height: '38px', borderRadius: '8px' }} value={sortMode} onChange={e => setSortMode(e.target.value)}>
                <option value="REV_DESC">Doanh thu (Cao - Thấp)</option>
                <option value="REV_ASC">Doanh thu (Thấp - Cao)</option>
                <option value="BOOK_DESC">Lượt đặt (Cao - Thấp)</option>
                <option value="BOOK_ASC">Lượt đặt (Thấp - Cao)</option>
              </select>
            </div>

            {(startDate || endDate || searchText || sortMode !== 'REV_DESC') && (
              <button className="btn btn-sm btn-outline-secondary" style={{ height: '38px', borderRadius: '8px' }} onClick={() => { setStartDate(''); setEndDate(''); setSearchText(''); setSortMode('REV_DESC'); }}>
                <i className="feather-refresh-cw" style={{ fontSize: 13 }} /> Xóa lọc
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-borderless align-middle">
              <thead className="thead-light">
                <tr>
                  <th style={{ width: '60px' }}>#</th>
                  <th>Tên Sân</th>
                  <th>Chủ sân</th>
                  <th>Tổng đặt sân</th>
                  <th>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan="5">
                        <div className="placeholder-glow">
                          <span className="placeholder col-12" style={{ height: '30px' }}></span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredVenues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">Không có dữ liệu.</td>
                  </tr>
                ) : (displayedVenues.map((v, idx) => (
                  <tr key={v.id}>
                    <td className="text-muted">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td><strong>{v.venue}</strong></td>
                    <td>{v.owner}</td>
                    <td>{v.totalBookings.toLocaleString()} lượt</td>
                    <td><strong className="text-success">{v.revenue.toLocaleString()} ₫</strong></td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                Trang {page} / {totalPages}
              </span>
              <div className="btn-group">
                <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <i className="feather-chevron-left" /> Trước
                </button>
                <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  Sau <i className="feather-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
