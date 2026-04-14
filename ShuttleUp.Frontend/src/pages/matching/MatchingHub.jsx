import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import matchingApi from '../../api/matchingApi';
import { useAuth } from '../../context/AuthContext';
import MatchingPostCard from '../../components/matching/MatchingPostCard';
import ShuttleDateField from '../../components/ui/ShuttleDateField';
import { normalizeSearchText } from '../../utils/searchNormalize';

const sortOptions = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'soonest', label: 'Sắp diễn ra' },
];

function clientSortCompare(a, b, sort) {
  const priceNum = (p) => (p.pricePerSlot != null && p.pricePerSlot !== '' ? Number(p.pricePerSlot) : null);
  switch (sort) {
    case 'price_asc': {
      const pa = priceNum(a);
      const pb = priceNum(b);
      return (pa ?? Number.POSITIVE_INFINITY) - (pb ?? Number.POSITIVE_INFINITY);
    }
    case 'price_desc': {
      const pa = priceNum(a);
      const pb = priceNum(b);
      return (pb ?? Number.NEGATIVE_INFINITY) - (pa ?? Number.NEGATIVE_INFINITY);
    }
    case 'soonest': {
      const da = new Date(a.playDate).getTime();
      const db = new Date(b.playDate).getTime();
      const na = Number.isNaN(da) ? 0 : da;
      const nb = Number.isNaN(db) ? 0 : db;
      if (na !== nb) return na - nb;
      return String(a.playStartTime || '').localeCompare(String(b.playStartTime || ''));
    }
    case 'oldest': {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    case 'newest':
    default:
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
}

/** Lọc theo chuỗi: tiêu đề, địa chỉ sân, tên chủ bài — dùng cho tab Của tôi / Đã tham gia. */
function applyClientListFilterSort(items, search, sort) {
  let list = Array.isArray(items) ? [...items] : [];
  const nq = normalizeSearchText(search);
  if (nq) {
    list = list.filter((p) => {
      const blob = normalizeSearchText(
        [p.title, p.venueAddress, p.host?.fullName].filter(Boolean).join(' '),
      );
      return blob.includes(nq);
    });
  }
  const key = sort || 'newest';
  list.sort((a, b) => clientSortCompare(a, b, key));
  return list;
}

const skillOptions = [
  { value: '', label: 'Tất cả trình độ' },
  { value: 'Yếu', label: 'Yếu / Mới chơi' },
  { value: 'Trung Bình Yếu', label: 'Trung Bình Yếu' },
  { value: 'Trung Bình', label: 'Trung Bình' },
  { value: 'Khá', label: 'Khá' },
  { value: 'Bán Chuyên', label: 'Bán Chuyên' },
  { value: 'Chuyên Nghiệp', label: 'Chuyên nghiệp' }
];

export default function MatchingHub() {
  const { user } = useAuth();
  const isAdmin = Array.isArray(user?.roles) && user.roles.some((r) => String(r).toUpperCase() === 'ADMIN');
  const [tab, setTab] = useState('all'); // 'all' | 'my' | 'joined'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [posts, setPosts] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [joinedPosts, setJoinedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ skillLevel: user?.skillLevel || '', playDate: '', province: user?.province || '', sort: 'newest' });
  const [searchText, setSearchText] = useState('');

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, pageSize: 12 };
      if (filters.skillLevel) params.skillLevel = filters.skillLevel;
      if (filters.playDate) params.playDate = filters.playDate;
      if (filters.province) params.province = filters.province;
      if (filters.sort) params.sort = filters.sort;
      const q = searchText.trim();
      if (q) params.q = q;

      const res = await matchingApi.getPosts(params);
      setPosts(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Load posts error', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters, searchText]);

  const filteredMyPosts = useMemo(
    () => applyClientListFilterSort(myPosts, searchText, filters.sort),
    [myPosts, searchText, filters.sort]
  );

  const filteredJoinedPosts = useMemo(
    () => applyClientListFilterSort(joinedPosts, searchText, filters.sort),
    [joinedPosts, searchText, filters.sort]
  );

  const loadMyPosts = useCallback(async () => {
    try {
      const res = await matchingApi.getMyPosts();
      setMyPosts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Load my posts error', err);
    }
  }, []);

  const loadJoinedPosts = useCallback(async () => {
    try {
      const res = await matchingApi.getJoinedPosts();
      setJoinedPosts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Load joined posts error', err);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (tab === 'my') loadMyPosts();
    if (tab === 'joined') loadJoinedPosts();
  }, [tab, loadMyPosts, loadJoinedPosts]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };
  
  const handleResetFilters = () => {
    setFilters({ skillLevel: '', playDate: '', province: '', sort: 'newest' });
    setSearchText('');
    setPage(1);
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    setPage(1);
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="main-wrapper content-below-header">
      {/* ── Breadcrumb ── */}
      <section className="breadcrumb breadcrumb-list mb-0">
        <span className="primary-right-round"></span>
        <div className="container">
          <h1 className="text-white">Tìm đồng đội 🏸</h1>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li>Tìm đồng đội</li>
          </ul>
        </div>
      </section>

      <div className="content py-5 matching-hub-content" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <div className="container">

          {user && !isAdmin && user.isPersonalized === false && (
            <div className="alert alert-info d-flex align-items-center mb-4" role="alert" style={{ borderRadius: '16px', border: '1px solid #bae6fd', backgroundColor: '#f0f9ff', padding: '16px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <i className="feather-info me-3 d-none d-sm-block" style={{ fontSize: '24px', color: '#0284c7' }}></i>
              <div>
                <h6 className="alert-heading mb-1" style={{ color: '#0369a1', fontWeight: 'bold' }}>Tối ưu hóa gợi ý của bạn!</h6>
                <p className="mb-0" style={{ color: '#0c4a6e', fontSize: '14px' }}>
                  Cập nhật hồ sơ để hệ thống có thể đề xuất các trận cầu phù hợp nhất với trình độ và khu vực của bạn.
                </p>
              </div>
              <Link to="/personalization" state={{ from: '/matching' }} className="btn btn-primary ms-auto" style={{ whiteSpace: 'nowrap', borderRadius: '10px', padding: '8px 16px', fontWeight: 'bold' }}>
                Cập nhật
              </Link>
            </div>
          )}

          {/* ── Header Bar ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', backgroundColor: '#fff', padding: '6px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                <button
                  style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '15px', transition: 'all 0.2s', backgroundColor: tab === 'all' ? '#e8f5ee' : 'transparent', color: tab === 'all' ? '#097E52' : '#64748b' }}
                  onClick={() => setTab('all')}
                >
                  Tất cả bài đăng
                </button>
                <button
                  style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '15px', transition: 'all 0.2s', backgroundColor: tab === 'my' ? '#e8f5ee' : 'transparent', color: tab === 'my' ? '#097E52' : '#64748b' }}
                  onClick={() => setTab('my')}
                >
                  Bài đăng của tôi
                </button>
                <button
                  style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '15px', transition: 'all 0.2s', backgroundColor: tab === 'joined' ? '#e8f5ee' : 'transparent', color: tab === 'joined' ? '#097E52' : '#64748b' }}
                  onClick={() => setTab('joined')}
                >
                  Bài post đã tham gia
                </button>
            </div>
            
            <Link to="/matching/create" className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: '14px', fontWeight: '700', boxShadow: '0 4px 12px rgba(9,126,82,0.2)' }}>
              <i className="feather-plus me-2"></i> Tạo bài đăng mới
            </Link>
          </div>

          {/* ── Filter & View Options ── */}
          {tab === 'all' && (
            <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', padding: '24px', marginBottom: '32px' }}>
              <div className="row align-items-center">
                  <div className="col-12 mb-3">
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px', display: 'block' }}>
                      <i className="feather-search me-1"></i> Tìm kiếm (theo từng ký tự)
                    </label>
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Tiêu đề, địa chỉ sân, tên chủ bài…"
                      style={{ borderRadius: '12px', padding: '12px 16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '600', color: '#1e293b' }}
                      value={searchText}
                      onChange={handleSearchChange}
                      autoComplete="off"
                    />
                  </div>
                  <div className="col-lg-8">
                     {/* Modern Filter Inputs */}
                     <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px' }}><i className="feather-award me-1"></i> Trình độ</label>
                            <select className="form-select" style={{ borderRadius: '12px', padding: '12px 16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '700', color: '#1e293b' }} value={filters.skillLevel} onChange={(e) => handleFilterChange('skillLevel', e.target.value)}>
                              {skillOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px' }}><i className="feather-calendar me-1"></i> Ngày chơi</label>
                            <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '700', color: '#1e293b', padding: '1px 3px' }}>
                                <ShuttleDateField
                                  value={filters.playDate}
                                  onChange={(ymd) => handleFilterChange('playDate', ymd)}
                                  placeholder="dd/mm/yyyy"
                                />
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px' }}><i className="feather-map-pin me-1"></i> Khu vực</label>
                            <input type="text" className="form-control" placeholder="VD: Quận 7" style={{ borderRadius: '12px', padding: '12px 16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '700', color: '#1e293b' }} value={filters.province} onChange={(e) => handleFilterChange('province', e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px', gap: '8px' }}>
                            <button onClick={() => {
                                setFilters({ skillLevel: user?.skillLevel || '', playDate: '', province: user?.province || '', sort: 'newest' });
                                setSearchText('');
                                setPage(1);
                            }} style={{ height: '48px', padding: '0 16px', borderRadius: '12px', backgroundColor: '#e8f5ee', color: '#097E52', border: '1px solid #bbf7d0', fontWeight: '700', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }}>
                                <i className="feather-target me-1"></i> Phù hợp với bạn
                            </button>
                            <button onClick={handleResetFilters} style={{ height: '48px', padding: '0 16px', borderRadius: '12px', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', fontWeight: '700', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }}>
                                <i className="feather-x me-1"></i> Xoá lọc (Tất cả)
                            </button>
                        </div>
                     </div>
                  </div>
                  
                  <div className="col-lg-4 mt-4 mt-lg-0">
                     <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', alignItems: 'flex-end', height: '100%' }}>
                         {/* View Mode Toggle */}
                         <div>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px', display: 'block', textAlign: 'right' }}>Hiển thị</label>
                            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', border: 'none', backgroundColor: viewMode === 'grid' ? '#fff' : 'transparent', boxShadow: viewMode === 'grid' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'grid' ? '#097E52' : '#94a3b8', transition: 'all 0.2s' }}
                                >
                                    <i className="feather-grid" style={{ fontSize: '18px' }}></i>
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', border: 'none', backgroundColor: viewMode === 'list' ? '#fff' : 'transparent', boxShadow: viewMode === 'list' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'list' ? '#097E52' : '#94a3b8', transition: 'all 0.2s' }}
                                >
                                    <i className="feather-list" style={{ fontSize: '20px' }}></i>
                                </button>
                            </div>
                         </div>
                         
                         {/* Sort Options */}
                         <div style={{ minWidth: '160px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px', display: 'block' }}>Sắp xếp</label>
                            <select className="form-select" style={{ height: '48px', borderRadius: '12px', border: 'none', backgroundColor: '#f1f5f9', fontWeight: '700', color: '#1e293b' }} value={filters.sort || 'newest'} onChange={(e) => handleFilterChange('sort', e.target.value)}>
                              {sortOptions.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                         </div>
                     </div>
                  </div>
              </div>
            </div>
          )}

          {(tab === 'my' || tab === 'joined') && (
            <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', padding: '24px', marginBottom: '32px' }}>
              <div className="row align-items-end g-3">
                <div className="col-12 col-lg-5">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px', display: 'block' }}>
                    <i className="feather-search me-1"></i> Tìm kiếm (theo từng ký tự)
                  </label>
                  <input
                    type="search"
                    className="form-control"
                    placeholder="Tiêu đề, địa chỉ sân, tên chủ bài…"
                    style={{ borderRadius: '12px', padding: '12px 16px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '600', color: '#1e293b' }}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="col-6 col-md-4 col-lg-3">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px', display: 'block' }}>Sắp xếp</label>
                  <select className="form-select" style={{ height: '48px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '700', color: '#1e293b' }} value={filters.sort || 'newest'} onChange={(e) => handleFilterChange('sort', e.target.value)}>
                    {sortOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4 col-lg-4 ms-lg-auto">
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px', display: 'block', textAlign: 'right' }}>Hiển thị</label>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', border: 'none', backgroundColor: viewMode === 'grid' ? '#fff' : 'transparent', boxShadow: viewMode === 'grid' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'grid' ? '#097E52' : '#94a3b8', transition: 'all 0.2s' }}
                    >
                      <i className="feather-grid" style={{ fontSize: '18px' }}></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', border: 'none', backgroundColor: viewMode === 'list' ? '#fff' : 'transparent', boxShadow: viewMode === 'list' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'list' ? '#097E52' : '#94a3b8', transition: 'all 0.2s' }}
                    >
                      <i className="feather-list" style={{ fontSize: '20px' }}></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Grid/List Post Results ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h5 style={{ fontWeight: '700', color: '#1e293b', margin: 0 }}>
                {tab === 'all'
                  ? (total > 0 ? `Đang hiển thị ${total} bài đăng tuyển người` : '')
                  : tab === 'my'
                    ? (myPosts.length > 0
                      ? (searchText.trim()
                        ? `Hiển thị ${filteredMyPosts.length} / ${myPosts.length} bài đăng của bạn`
                        : `Bạn đã tạo ${myPosts.length} bài đăng`)
                      : '')
                    : (joinedPosts.length > 0
                      ? (searchText.trim()
                        ? `Hiển thị ${filteredJoinedPosts.length} / ${joinedPosts.length} bài đã tham gia`
                        : `Bạn đang tham gia ${joinedPosts.length} bài`)
                      : '')
                }
              </h5>
          </div>

          {!loading && (
            <>
              {tab === 'all' ? (
                <>
                  {posts.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', backgroundColor: '#fff', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏸</div>
                      <h3 style={{ fontWeight: '700', color: '#1e293b', marginBottom: '8px', textAlign: 'center' }}>Chưa có bài đăng nào trúng khớp</h3>
                      <p style={{ color: '#64748b', fontWeight: '600', marginBottom: '24px', textAlign: 'center', maxWidth: '420px' }}>
                        {searchText.trim()
                          ? 'Không có kết quả với từ khoá hoặc bộ lọc hiện tại. Thử đổi từ tìm hoặc xoá lọc.'
                          : 'Hãy thử điều chỉnh bộ lọc hoặc là người đầu tiên tạo bài!'}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {searchText.trim() && (
                          <button type="button" onClick={() => { setSearchText(''); setPage(1); }} className="btn btn-outline-primary" style={{ borderRadius: '12px', fontWeight: '700', padding: '10px 24px' }}>
                            Xóa tìm kiếm
                          </button>
                        )}
                        <button type="button" onClick={handleResetFilters} className="btn btn-outline-secondary" style={{ borderRadius: '12px', fontWeight: '700', padding: '10px 24px' }}>
                          Xoá bộ lọc
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="row">
                      {posts.map((p) => (
                        <MatchingPostCard key={p.id} post={p} viewMode={viewMode} onJoined={loadPosts} />
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                      <nav>
                        <ul className="pagination" style={{ gap: '8px' }}>
                          <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                            <button className="page-link" style={{ borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '700', color: '#1e293b' }} onClick={() => setPage(page - 1)}>‹</button>
                          </li>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <li key={p} className="page-item">
                              <button className="page-link" style={{ borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: p === page ? '#097E52' : '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '700', color: p === page ? '#fff' : '#1e293b' }} onClick={() => setPage(p)}>{p}</button>
                            </li>
                          ))}
                          <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                            <button className="page-link" style={{ borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '700', color: '#1e293b' }} onClick={() => setPage(page + 1)}>›</button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  )}
                </>
              ) : tab === 'my' ? (
                /* ── My Posts Tab ── */
                <>
                  {myPosts.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', backgroundColor: '#fff', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                      <h3 style={{ fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Bạn chưa tạo bài đăng nào</h3>
                      <p style={{ color: '#64748b', fontWeight: '600', marginBottom: '24px' }}>Hãy tạo bài tuyển người trải qua những trận cầu đỉnh cao nhé!</p>
                      <Link to="/matching/create" className="btn btn-primary" style={{ borderRadius: '14px', fontWeight: '700', padding: '12px 28px', boxShadow: '0 4px 12px rgba(9,126,82,0.2)' }}>
                        <i className="feather-plus me-2"></i> Tạo bài đăng ngay
                      </Link>
                    </div>
                  ) : filteredMyPosts.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', backgroundColor: '#fff', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                      <h3 style={{ fontWeight: '700', color: '#1e293b', marginBottom: '8px', textAlign: 'center' }}>Không có bài nào khớp tìm kiếm</h3>
                      <p style={{ color: '#64748b', fontWeight: '600', marginBottom: '20px', textAlign: 'center' }}>Thử bỏ bớt từ khoá hoặc kiểm tra chính tả.</p>
                      <button type="button" onClick={() => setSearchText('')} className="btn btn-outline-secondary" style={{ borderRadius: '12px', fontWeight: '700', padding: '10px 24px' }}>
                        Xóa ô tìm kiếm
                      </button>
                    </div>
                  ) : (
                    <div className="row">
                      {filteredMyPosts.map((p) => (
                        <MatchingPostCard key={p.id} post={p} viewMode={viewMode} onJoined={loadMyPosts} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* ── Joined posts tab ── */
                <>
                  {joinedPosts.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', backgroundColor: '#fff', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏸</div>
                      <h3 style={{ fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Chưa có bài nào bạn đã tham gia</h3>
                      <p style={{ color: '#64748b', fontWeight: '600', marginBottom: '24px' }}>Vào tab &quot;Tất cả bài đăng&quot; để xin tham gia nhóm nhé!</p>
                      <button type="button" className="btn btn-primary" style={{ borderRadius: '14px', fontWeight: '700', padding: '12px 28px' }} onClick={() => setTab('all')}>
                        Xem bảng tin
                      </button>
                    </div>
                  ) : filteredJoinedPosts.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', backgroundColor: '#fff', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                      <h3 style={{ fontWeight: '700', color: '#1e293b', marginBottom: '8px', textAlign: 'center' }}>Không có bài nào khớp tìm kiếm</h3>
                      <p style={{ color: '#64748b', fontWeight: '600', marginBottom: '20px', textAlign: 'center' }}>Thử bỏ bớt từ khoá hoặc kiểm tra chính tả.</p>
                      <button type="button" onClick={() => setSearchText('')} className="btn btn-outline-secondary" style={{ borderRadius: '12px', fontWeight: '700', padding: '10px 24px' }}>
                        Xóa ô tìm kiếm
                      </button>
                    </div>
                  ) : (
                    <div className="row">
                      {filteredJoinedPosts.map((p) => (
                        <MatchingPostCard key={p.id} post={p} viewMode={viewMode} onJoined={loadJoinedPosts} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {loading && (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Đang tải...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
